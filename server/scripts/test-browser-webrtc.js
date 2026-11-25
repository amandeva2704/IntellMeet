const { spawn } = require("child_process");
const http = require("http");

// Simple HTML page that tests WebRTC negotiation between PC1 and PC2 using the exact MeetingRoom logic
const html = `
<!DOCTYPE html>
<html>
<body>
<script>
const realLog = console.log;
const realErr = console.error;
function send(type, args) {
    fetch('/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, msg: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') })
    }).catch(() => {});
}
console.log = (...args) => { realLog(...args); send('log', args); };
console.error = (...args) => { realErr(...args); send('error', args); };

async function runWebRTCTest() {
    try {
        const stream1 = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const stream2 = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

        console.log("Local streams acquired successfully");
        console.log("Stream1 tracks:", stream1.getTracks().map(t => t.kind));
        console.log("Stream2 tracks:", stream2.getTracks().map(t => t.kind));

        const pc1 = new RTCPeerConnection();
        const pc2 = new RTCPeerConnection();

        // Simulate PC1 initiating call (caller)
        for (const track of stream1.getTracks()) {
            pc1.addTrack(track, stream1);
        }

        // PC1 gathers ICE and sends to PC2
        pc1.onicecandidate = (e) => {
            if (e.candidate) pc2.addIceCandidate(e.candidate).catch(console.warn);
        };
        pc2.onicecandidate = (e) => {
            if (e.candidate) pc1.addIceCandidate(e.candidate).catch(console.warn);
        };

        let pc1RemoteTracks = [];
        let pc2RemoteTracks = [];

        pc1.ontrack = (e) => {
            console.log("PC1 received remote track:", e.track.kind, "streams:", e.streams.length);
            pc1RemoteTracks.push(e.track.kind);
        };

        pc2.ontrack = (e) => {
            console.log("PC2 received remote track:", e.track.kind, "streams:", e.streams.length);
            pc2RemoteTracks.push(e.track.kind);
        };

        // Create offer
        const offer = await pc1.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc1.setLocalDescription(offer);

        // PC2 receives offer
        await pc2.setRemoteDescription(offer);

        // PC2 attaches local tracks using addTrack
        for (const track of stream2.getTracks()) {
            pc2.addTrack(track, stream2);
        }

        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);

        console.log("Answer SDP has msid?:", answer.sdp.includes("a=msid"));
        console.log("Answer SDP has sendrecv?:", answer.sdp.includes("a=sendrecv"));

        await pc1.setRemoteDescription(answer);

        // Wait for ICE connection and tracks
        await new Promise(r => setTimeout(r, 2000));

        console.log("PC1 connectionState:", pc1.connectionState, "iceConnectionState:", pc1.iceConnectionState);
        console.log("PC2 connectionState:", pc2.connectionState, "iceConnectionState:", pc2.iceConnectionState);
        console.log("PC1 remote tracks count:", pc1RemoteTracks.length, pc1RemoteTracks);
        console.log("PC2 remote tracks count:", pc2RemoteTracks.length, pc2RemoteTracks);

        if (pc1RemoteTracks.length >= 2 && pc2RemoteTracks.length >= 2) {
            console.log("TEST_SUCCESS");
        } else {
            console.log("TEST_FAILED: Missing tracks");
        }
    } catch (err) {
        console.error("TEST_ERROR:", err);
    }
}
runWebRTCTest();
</script>
</body>
</html>
`;

let chromeProcess = null;

const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/log") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            try {
                const data = JSON.parse(body);
                console.log(`[BROWSER ${data.type.toUpperCase()}]:`, data.msg);
                if (data.msg.includes("TEST_SUCCESS") || data.msg.includes("TEST_FAILED")) {
                    setTimeout(() => {
                        if (chromeProcess) chromeProcess.kill();
                        server.close();
                        process.exit(data.msg.includes("TEST_SUCCESS") ? 0 : 1);
                    }, 500);
                }
            } catch (e) {}
            res.writeHead(200);
            res.end("ok");
        });
        return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
});

server.listen(9876, () => {
    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    const chrome = spawn(chromePath, [
        "--headless=new",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--no-sandbox",
        "http://localhost:9876"
    ]);
    chromeProcess = chrome;

    let output = "";
    chrome.stdout.on("data", (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
    });

    chrome.stderr.on("data", (data) => {
        const text = data.toString();
        output += text;
        process.stderr.write(text);
        if (text.includes("TEST_SUCCESS") || text.includes("TEST_FAILED")) {
            setTimeout(() => {
                chrome.kill();
                server.close();
                process.exit(text.includes("TEST_SUCCESS") ? 0 : 1);
            }, 500);
        }
    });

    setTimeout(() => {
        console.log("Timeout reached, closing test...");
        chrome.kill();
        server.close();
        process.exit(1);
    }, 15000);
});
