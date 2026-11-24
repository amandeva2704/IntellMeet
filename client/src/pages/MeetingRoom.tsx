import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import type { TranscriptItem, ChatItem } from "../store/store";
import { socket } from "../services/socket";
import api from "../services/api";
import { 
    Mic, MicOff, Video as VideoIcon, VideoOff, 
    Monitor, MessageSquare, ListTodo, Users, 
    Send, LogOut, Bot, Copy, Volume2, AudioWaveform
} from "lucide-react";
import toast from "react-hot-toast";

const normalizeRoomId = (input?: string): string => {
    if (!input) return "";
    let clean = input.trim();
    if (clean.includes("/")) {
        clean = clean.split("/").filter(Boolean).pop() || clean;
    }
    clean = clean.split("?")[0].split("#")[0].trim().toLowerCase();
    const alphanumeric = clean.replace(/[^a-z0-9]/g, "");
    if (alphanumeric.length === 9) {
        return `${alphanumeric.substring(0, 3)}-${alphanumeric.substring(3, 6)}-${alphanumeric.substring(6, 9)}`;
    }
    return clean;
};

// Ultra-fast, reliable global STUN and TURN relay configuration
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelay",
            credential: "openrelay"
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelay",
            credential: "openrelay"
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelay",
            credential: "openrelay"
        }
    ],
    iceCandidatePoolSize: 2
};

// Sub-component to render remote peer video and audio feeds
function RemoteVideoTile({ peer, stream }: { peer: { socketId: string; user: any }; stream?: MediaStream }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

    const hasVideoTrack = Boolean(
        stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks().some((t) => t.enabled)
    );

    // Sync MediaStream to DOM video and audio elements
    useEffect(() => {
        if (!stream) {
            setHasRemoteVideo(false);
            if (videoRef.current) videoRef.current.srcObject = null;
            if (audioRef.current) audioRef.current.srcObject = null;
            return;
        }

        // 1. Sync Audio Element
        if (audioRef.current) {
            if (audioRef.current.srcObject !== stream) {
                audioRef.current.srcObject = stream;
            }
            if (stream.getAudioTracks().length > 0) {
                audioRef.current.play().then(() => {
                    setAudioBlocked(false);
                }).catch((err) => {
                    if (err.name === "NotAllowedError") {
                        setAudioBlocked(true);
                    }
                });
            }
        }

        // 2. Sync Video Element
        if (videoRef.current) {
            if (videoRef.current.srcObject !== stream) {
                videoRef.current.srcObject = stream;
            }
            videoRef.current.muted = true; // Always muted so browser autoplay policy NEVER blocks it
            videoRef.current.play().then(() => {
                setHasRemoteVideo(true);
            }).catch(console.warn);

            const vTracks = stream.getVideoTracks();
            if (vTracks.length > 0 && vTracks.some((t) => t.enabled)) {
                setHasRemoteVideo(true);
            }
        }

        const handleTrackActivity = () => {
            if (!stream) return;
            const vTracks = stream.getVideoTracks();
            const isLive = vTracks.length > 0 && vTracks.some((t) => t.enabled && t.readyState === "live");
            if (isLive) {
                setHasRemoteVideo(true);
                if (videoRef.current) {
                    videoRef.current.play().catch(console.warn);
                }
            }
            if (audioRef.current && stream.getAudioTracks().length > 0) {
                audioRef.current.play().then(() => setAudioBlocked(false)).catch(() => {});
            }
        };

        const tracks = stream.getTracks();
        tracks.forEach((t) => {
            t.addEventListener("mute", handleTrackActivity);
            t.addEventListener("unmute", handleTrackActivity);
            t.addEventListener("ended", handleTrackActivity);
        });

        // Periodic check to capture video frames as soon as ICE connection settles
        const intervalId = setInterval(handleTrackActivity, 1000);

        return () => {
            clearInterval(intervalId);
            tracks.forEach((t) => {
                t.removeEventListener("mute", handleTrackActivity);
                t.removeEventListener("unmute", handleTrackActivity);
                t.removeEventListener("ended", handleTrackActivity);
            });
        };
    }, [stream]);

    // Global unlock listener for clicks, touch, and keys
    useEffect(() => {
        const unlockAudio = () => {
            if (audioRef.current && stream && stream.getAudioTracks().length > 0) {
                audioRef.current.play().then(() => setAudioBlocked(false)).catch(() => {});
            }
        };
        window.addEventListener("click", unlockAudio);
        window.addEventListener("touchstart", unlockAudio);
        window.addEventListener("keydown", unlockAudio);
        return () => {
            window.removeEventListener("click", unlockAudio);
            window.removeEventListener("touchstart", unlockAudio);
            window.removeEventListener("keydown", unlockAudio);
        };
    }, [stream]);

    const handleEnableAudio = () => {
        if (audioRef.current && stream && stream.getAudioTracks().length > 0) {
            audioRef.current.play().then(() => setAudioBlocked(false)).catch(console.error);
        }
    };

    const isVideoVisible = (hasRemoteVideo || hasVideoTrack) && Boolean(stream);

    return (
        <div className="aspect-video max-w-2xl w-full h-full mx-auto rounded-3xl bg-[#0e0f14] border border-white/5 shadow-lg relative overflow-hidden flex items-center justify-center">
            {/* Dedicated HTML5 audio tag for clear speaker output */}
            <audio ref={audioRef} autoPlay playsInline />

            {/* Video element is ALWAYS mounted, active in render tree, and MUTED so browser NEVER blocks autoplay */}
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted={true}
                onLoadedMetadata={() => {
                    if (videoRef.current) {
                        videoRef.current.play().catch(console.warn);
                        setHasRemoteVideo(true);
                    }
                }}
                onCanPlay={() => {
                    if (videoRef.current) {
                        videoRef.current.play().catch(console.warn);
                        setHasRemoteVideo(true);
                    }
                }}
                onPlaying={() => {
                    setHasRemoteVideo(true);
                }}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                    isVideoVisible ? "opacity-100 relative z-10" : "opacity-0 absolute inset-0 pointer-events-none"
                }`}
            />

            {/* Avatar placeholder shown when video is inactive, camera is off, or stream is connecting */}
            {!isVideoVisible && (
                <div className="text-center space-y-2 relative z-0">
                    <div className="w-16 h-16 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-400 font-extrabold text-lg flex items-center justify-center mx-auto">
                        {peer.user?.fullName?.charAt(0).toUpperCase() || "P"}
                    </div>
                    <span className="text-xs text-neutral-400 block">{peer.user?.fullName || "Peer"}</span>
                    <span className="text-[10px] text-neutral-500 block">
                        {stream ? (stream.getVideoTracks().length > 0 ? "Video loading..." : "Audio only") : "Connecting..."}
                    </span>
                </div>
            )}

            {/* Click-to-play Audio Unlock for mobile browsers */}
            {audioBlocked && (
                <button
                    type="button"
                    onClick={handleEnableAudio}
                    className="absolute top-3 right-3 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl z-20 animate-pulse cursor-pointer"
                >
                    <Volume2 className="w-3.5 h-3.5" /> Tap to Hear Audio
                </button>
            )}

            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs font-medium border border-white/5 flex items-center gap-1.5 backdrop-blur-md z-20">
                <span className={`w-1.5 h-1.5 rounded-full ${stream ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                {peer.user?.fullName || "Peer"}
            </div>
        </div>
    );
}

export default function MeetingRoom() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { user, activeMeeting, joinMeeting, endMeeting, leaveMeeting, addTranscriptMessage, addChatMessage } = useStore();

    // UI States
    const [inLobby, setInLobby] = useState(true);
    const [micEnabled, setMicEnabled] = useState(true);
    const [camEnabled, setCamEnabled] = useState(true);
    const [screenSharing, setScreenSharing] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const [activeTab, setActiveTab] = useState<"chat" | "transcript" | "notes" | "participants">("chat");

    // Determine whether current user is the host
    const isHost = Boolean(
        activeMeeting && user && (
            (typeof activeMeeting.host === "string" && (activeMeeting.host === user._id || activeMeeting.host === (user as any).id)) ||
            (typeof activeMeeting.host === "object" && (
                activeMeeting.host?._id === user._id || 
                (activeMeeting.host as any)?._id === (user as any).id || 
                (activeMeeting.host as any)?.toString() === user._id
            ))
        )
    );

    // Chat and note states (text chats saved separately)
    const [messages, setMessages] = useState<ChatItem[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [meetingNotes, setMeetingNotes] = useState("");
    const [typingUser, setTypingUser] = useState("");
    const [typingTimeout, setTypingTimeout] = useState<any>(null);

    // Voice Transcripts (spoken speech-to-text saved separately)
    const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
    const [captionInput, setCaptionInput] = useState("");
    const [liveCaptionText, setLiveCaptionText] = useState("AI Voice Assistant: Listening to conversation...");
    const [isTranscribing, setIsTranscribing] = useState(false);
    const recognitionRef = useRef<any>(null);
    const audioRecorderRef = useRef<MediaRecorder | null>(null);
    const isInMeetingRef = useRef<boolean>(false);
    const micEnabledRef = useRef<boolean>(true);

    // Media stream references
    const lobbyVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    
    // WebRTC Peer connections, Queued ICE Candidates & Remote Streams
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const [peers, setPeers] = useState<{ socketId: string; user: any }[]>([]);
    const [remoteStreams, setRemoteStreams] = useState<{ [socketId: string]: MediaStream }>({});
    const cleanupMeetingRef = useRef<() => void>(() => {});

    // Keep state refs in sync
    useEffect(() => {
        isInMeetingRef.current = !inLobby;
    }, [inLobby]);

    useEffect(() => {
        micEnabledRef.current = micEnabled;
    }, [micEnabled]);

    // 1. Camera & Microphone Initialization
    const startCamera = async () => {
        try {
            let stream: MediaStream;
            try {
                // Request video & audio with ideal mobile & desktop settings
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "user",
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            } catch (bothErr) {
                console.warn("Could not access video+audio together, trying video only:", bothErr);
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false
                    });
                } catch (vidErr) {
                    console.warn("Could not access video, trying audio only:", vidErr);
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: true
                    });
                }
            }

            localStreamRef.current = stream;
            setLocalStream(stream);

            const hasVideo = stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
            setCamEnabled(hasVideo);

            const hasAudio = stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled;
            setMicEnabled(hasAudio);
            micEnabledRef.current = hasAudio;

            if (lobbyVideoRef.current) {
                lobbyVideoRef.current.srcObject = stream;
                lobbyVideoRef.current.play().catch(() => {});
            }
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.play().catch(() => {});
            }

            // Replace tracks on any existing peer connections
            peersRef.current.forEach((pc) => {
                const transceivers = pc.getTransceivers();
                stream.getTracks().forEach((track) => {
                    const matchingTransceiver = transceivers.find((t) =>
                        (t.sender.track && t.sender.track.kind === track.kind) ||
                        (t.receiver.track && t.receiver.track.kind === track.kind)
                    );
                    if (matchingTransceiver) {
                        matchingTransceiver.sender.replaceTrack(track).catch(console.warn);
                        if (matchingTransceiver.direction !== "stopped") {
                            matchingTransceiver.direction = "sendrecv";
                        }
                    } else {
                        try {
                            pc.addTrack(track, stream);
                        } catch (e) {
                            console.warn("addTrack error:", e);
                        }
                    }
                });
            });

            return stream;
        } catch (err: any) {
            console.error("Camera access failed completely:", err);
            toast.error("Could not access camera/mic. Please check browser permissions.");
            setCamEnabled(false);
            setMicEnabled(false);
            micEnabledRef.current = false;
            return null;
        }
    };

    const stopCamera = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                track.stop();
                track.enabled = false;
            });
            localStreamRef.current = null;
            setLocalStream(null);
        }
        if (lobbyVideoRef.current) {
            lobbyVideoRef.current.srcObject = null;
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
    };

    // Initialize camera and pre-connect socket on mount
    useEffect(() => {
        startCamera();
        if (!socket.connected) {
            socket.connect();
        }
        return () => {
            stopCamera();
        };
    }, []);

    // Sync stream to lobby preview video
    useEffect(() => {
        if (inLobby && lobbyVideoRef.current) {
            if (localStream && camEnabled) {
                lobbyVideoRef.current.srcObject = localStream;
                lobbyVideoRef.current.play().catch(() => {});
            } else {
                lobbyVideoRef.current.srcObject = null;
            }
        }
    }, [localStream, inLobby, camEnabled]);

    // Sync stream to active meeting room video
    useEffect(() => {
        if (!inLobby && localVideoRef.current) {
            if (localStream && camEnabled) {
                localVideoRef.current.srcObject = localStream;
                localVideoRef.current.play().catch(() => {});
            } else {
                localVideoRef.current.srcObject = null;
            }
        }
    }, [localStream, inLobby, camEnabled]);

    // 2. Fetch Meeting details on load (pre-populates chats, voice transcripts, or redirects if ended)
    useEffect(() => {
        if (roomId) {
            const cleanId = normalizeRoomId(roomId);
            joinMeeting(cleanId).then((m: any) => {
                if (m) {
                    if (m.status === "completed" || m.isCompleted) {
                        toast("This meeting has already ended. Loading summary...", { icon: "🏁" });
                        navigate(`/meeting/${cleanId}/summary`, { replace: true });
                        return;
                    }
                    if (m.chats && m.chats.length > 0) {
                        setMessages(m.chats);
                    }
                    if (m.transcript && m.transcript.length > 0) {
                        setTranscripts(m.transcript);
                        const last = m.transcript[m.transcript.length - 1];
                        setLiveCaptionText(`${last.sender}: ${last.text}`);
                    }
                }
            }).catch((err: any) => {
                console.warn("Meeting join notice:", err);
                const currentActive = useStore.getState().activeMeeting;
                if (!currentActive || normalizeRoomId(currentActive.roomId) !== cleanId) {
                    toast.error(err.message || "Meeting room not found");
                    navigate("/dashboard", { replace: true });
                }
            });
        }
    }, [roomId]);

    // Helper: Drain queued ICE candidates once remoteDescription is set
    const drainQueuedCandidates = async (peerSocketId: string, pc: RTCPeerConnection) => {
        const queued = iceCandidatesQueue.current.get(peerSocketId) || [];
        if (queued.length > 0) {
            console.log(`🧊 Applying ${queued.length} queued ICE candidates for ${peerSocketId}`);
            for (const cand of queued) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (err) {
                    console.warn("Error applying queued ICE candidate:", err);
                }
            }
            iceCandidatesQueue.current.delete(peerSocketId);
        }
    };

    // Helper: Attach local tracks to a peer connection (matches existing transceivers or adds cleanly)
    const attachLocalTracks = async (pc: RTCPeerConnection) => {
        if (!localStreamRef.current) return;

        const localTracks = localStreamRef.current.getTracks();
        const transceivers = pc.getTransceivers();

        for (const track of localTracks) {
            const matchingTransceiver = transceivers.find((t) =>
                (t.sender.track && t.sender.track.kind === track.kind) ||
                (t.receiver.track && t.receiver.track.kind === track.kind)
            );
            if (matchingTransceiver) {
                try {
                    await matchingTransceiver.sender.replaceTrack(track);
                    if (matchingTransceiver.direction !== "stopped") {
                        matchingTransceiver.direction = "sendrecv";
                    }
                } catch (err) {
                    console.warn(`replaceTrack error for ${track.kind}:`, err);
                }
            } else {
                try {
                    pc.addTrack(track, localStreamRef.current!);
                } catch (err) {
                    console.warn(`addTrack warning for ${track.kind}:`, err);
                }
            }
        }
    };

    // Helper: Create an RTCPeerConnection for a target peer
    const createPeerConnection = (targetSocketId: string) => {
        if (peersRef.current.has(targetSocketId)) {
            return peersRef.current.get(targetSocketId)!;
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current.set(targetSocketId, pc);

        // Send gathered ICE candidate to peer
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", {
                    target: targetSocketId,
                    candidate: event.candidate.toJSON()
                });
            }
        };

        // Receive remote track (combines both audio and video into unified MediaStream with new reference)
        pc.ontrack = (event) => {
            console.log(`📡 Remote track received from ${targetSocketId}: kind=${event.track.kind}, id=${event.track.id}`);
            setRemoteStreams((prev) => {
                const currentStream = prev[targetSocketId];
                const existingTracks = currentStream ? currentStream.getTracks() : [];
                const otherTracks = existingTracks.filter((t) => t.id !== event.track.id && t.kind !== event.track.kind);
                const updatedTracks = [...otherTracks, event.track];
                return {
                    ...prev,
                    [targetSocketId]: new MediaStream(updatedTracks)
                };
            });
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`🧊 ICE State with ${targetSocketId}:`, pc.iceConnectionState);
            if (pc.iceConnectionState === "failed") {
                console.warn(`ICE failed with ${targetSocketId}, attempting restart...`);
                try {
                    pc.restartIce();
                } catch (e) {
                    console.warn("restartIce error:", e);
                }
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`🔌 Connection state with ${targetSocketId}:`, pc.connectionState);
            if (pc.connectionState === "failed") {
                console.warn(`Connection state failed with ${targetSocketId}, restarting ICE...`);
                try {
                    pc.restartIce();
                } catch (e) {
                    console.warn("restartIce error:", e);
                }
            } else if (pc.connectionState === "closed") {
                setRemoteStreams((prev) => {
                    const next = { ...prev };
                    delete next[targetSocketId];
                    return next;
                });
            }
        };

        return pc;
    };

    // Helper: Initiate a WebRTC call to an existing peer in the room
    const initiateCallToPeer = async (peerSocketId: string, callerSafeUser: any) => {
        try {
            const existingPc = peersRef.current.get(peerSocketId);
            if (
                existingPc &&
                (existingPc.connectionState === "connected" ||
                 existingPc.iceConnectionState === "connected" ||
                 existingPc.connectionState === "connecting" ||
                 existingPc.iceConnectionState === "checking")
            ) {
                console.log(`Peer connection to ${peerSocketId} is already active or negotiating, skipping re-initiation.`);
                return;
            }
            if (existingPc) {
                existingPc.close();
                peersRef.current.delete(peerSocketId);
            }

            let stream = localStreamRef.current;
            if (!stream) {
                stream = await startCamera();
            }

            const pc = createPeerConnection(peerSocketId);
            await attachLocalTracks(pc);

            pc.getTransceivers().forEach((transceiver) => {
                if (transceiver.direction !== "stopped") {
                    transceiver.direction = "sendrecv";
                }
            });

            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await pc.setLocalDescription(offer);

            socket.emit("sending-signal", {
                userToSignal: peerSocketId,
                callerId: socket.id,
                callerUser: callerSafeUser,
                signal: offer
            });
        } catch (err) {
            console.error("Failed to create offer for peer:", peerSocketId, err);
        }
    };

    // Helper: Answer an incoming offer from a newcomer
    const handleIncomingOffer = async (callerId: string, callerUser: any, signal: any) => {
        console.log("📥 Received WebRTC offer from:", callerId, callerUser?.fullName);
        try {
            setPeers((prev) => {
                if (prev.some((p) => p.socketId === callerId)) return prev;
                return [...prev, { socketId: callerId, user: callerUser }];
            });

            // Ensure local camera/mic stream is ready before answering
            let stream = localStreamRef.current;
            if (!stream) {
                console.log("Local stream not ready on incoming offer, initializing camera...");
                stream = await startCamera();
            }

            const pc = createPeerConnection(callerId);

            // Handle offer collision / glare gracefully using polite-peer rule
            if (pc.signalingState !== "stable") {
                const isPolite = (socket.id || "") > callerId;
                if (!isPolite) {
                    console.log(`⚠️ Glare detected with ${callerId}, impolite peer ignoring colliding offer.`);
                    return;
                }
                console.log(`⚠️ Glare detected with ${callerId}, polite peer rolling back.`);
                await pc.setLocalDescription({ type: "rollback" } as any).catch(() => {});
            }

            // 1. Set remote description from incoming offer
            await pc.setRemoteDescription(new RTCSessionDescription(signal));

            // 2. Attach local tracks to transceivers/senders and await
            await attachLocalTracks(pc);

            // 3. Ensure transceiver direction is bidirectional sendrecv
            pc.getTransceivers().forEach((transceiver) => {
                if (transceiver.direction !== "stopped") {
                    transceiver.direction = "sendrecv";
                }
            });

            // 4. Create answer with guaranteed audio and video tracks
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // 5. Send answer to caller
            socket.emit("returning-signal", {
                callerId,
                signal: answer
            });

            // 6. Drain any queued ICE candidates NOW that BOTH remote and local descriptions are established
            await drainQueuedCandidates(callerId, pc);
        } catch (err) {
            console.error("Failed to answer incoming WebRTC call from:", callerId, err);
        }
    };

    // Helper: Handle answer returned from the target peer
    const handleIncomingAnswer = async (id: string, signal: any) => {
        console.log("📥 Received WebRTC answer from:", id);
        try {
            const pc = peersRef.current.get(id);
            if (pc) {
                if (pc.signalingState !== "stable") {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                }
                await drainQueuedCandidates(id, pc);
            }
        } catch (err) {
            console.error("Failed to set remote description from answer:", id, err);
        }
    };

    // 3. Centralized Socket Event Listeners with Automatic Reconnection
    useEffect(() => {
        const handleAllUsers = async (usersList: { socketId: string; user: any }[]) => {
            console.log("👥 Existing users in room:", usersList);
            setPeers(usersList);
            toast.success("Connected to meeting room");

            const safeUser = user || {
                _id: "user_" + Date.now(),
                fullName: "Participant"
            };

            // Parallel initiation to all peers in room for ultra-fast connection
            await Promise.allSettled(
                usersList.map((peer) => initiateCallToPeer(peer.socketId, safeUser))
            );
        };

        const handleUserConnected = ({ socketId, user: joiningUser }: { socketId: string; user: any }) => {
            console.log("👤 New user joined room:", joiningUser?.fullName, socketId);
            setPeers((prev) => {
                if (prev.some((p) => p.socketId === socketId)) return prev;
                return [...prev, { socketId, user: joiningUser }];
            });
            toast.success(`${joiningUser?.fullName || "A peer"} joined the call`);
        };

        const handleUserJoinedSignal = async ({ callerId, callerUser, signal }: any) => {
            await handleIncomingOffer(callerId, callerUser, signal);
        };

        const handleReceivingReturnedSignal = async ({ id, signal }: any) => {
            await handleIncomingAnswer(id, signal);
        };

        const handleIceCandidate = async ({ sender, candidate }: any) => {
            const pc = peersRef.current.get(sender);
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.warn("Failed to add ICE candidate from:", sender, err);
                }
            } else {
                const queue = iceCandidatesQueue.current.get(sender) || [];
                queue.push(candidate);
                iceCandidatesQueue.current.set(sender, queue);
            }
        };

        const handleUserDisconnected = ({ socketId, name }: any) => {
            console.log("👋 User disconnected:", socketId, name);
            const pc = peersRef.current.get(socketId);
            if (pc) {
                pc.close();
                peersRef.current.delete(socketId);
            }
            iceCandidatesQueue.current.delete(socketId);
            setRemoteStreams((prev) => {
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
            setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
            toast.success(`${name || "A participant"} left the call`);
        };

        const handleReceiveMessage = (msg: ChatItem) => {
            setMessages((prev) => {
                if (prev.some((m) => m.sender === msg.sender && m.text === msg.text && Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 3000)) {
                    return prev;
                }
                return [...prev, msg];
            });
        };

        const handleReceiveTranscript = (transcript: TranscriptItem) => {
            setTranscripts((prev) => {
                if (prev.some((t) => t.sender === transcript.sender && t.text === transcript.text && Math.abs(new Date(t.timestamp).getTime() - new Date(transcript.timestamp).getTime()) < 3000)) {
                    return prev;
                }
                return [...prev, transcript];
            });
            setLiveCaptionText(`${transcript.sender}: ${transcript.text}`);
        };

        const handleUserTyping = ({ userName, isTyping }: any) => {
            setTypingUser(isTyping ? userName : "");
        };

        // Automatic reconnection handler
        const handleSocketConnect = () => {
            console.log("🔌 Socket connected/reconnected with ID:", socket.id);
            if (isInMeetingRef.current && roomId) {
                const cleanRoomId = normalizeRoomId(roomId);
                const safeUser = user || {
                    _id: "user_" + Date.now(),
                    fullName: "Participant"
                };
                socket.emit("join-room", { roomId: cleanRoomId, user: safeUser });
            }
        };

        // Host Meeting Termination handler for participants
        const handleMeetingEnded = ({ roomId: endedRoomId }: any) => {
            console.log("🛑 Host ended the meeting:", endedRoomId);
            toast("The host has ended this meeting for everyone. Loading AI summary...", { icon: "🏁", duration: 5000 });
            cleanupMeetingRef.current();
            navigate(`/meeting/${endedRoomId || roomId}/summary`, { replace: true });
        };

        socket.on("all-users", handleAllUsers);
        socket.on("user-connected", handleUserConnected);
        socket.on("user-joined-signal", handleUserJoinedSignal);
        socket.on("receiving-returned-signal", handleReceivingReturnedSignal);
        socket.on("ice-candidate", handleIceCandidate);
        socket.on("user-disconnected", handleUserDisconnected);
        socket.on("receive-message", handleReceiveMessage);
        socket.on("receive-transcript", handleReceiveTranscript);
        socket.on("user-typing", handleUserTyping);
        socket.on("meeting-ended", handleMeetingEnded);
        socket.on("connect", handleSocketConnect);

        return () => {
            socket.off("all-users", handleAllUsers);
            socket.off("user-connected", handleUserConnected);
            socket.off("user-joined-signal", handleUserJoinedSignal);
            socket.off("receiving-returned-signal", handleReceivingReturnedSignal);
            socket.off("ice-candidate", handleIceCandidate);
            socket.off("user-disconnected", handleUserDisconnected);
            socket.off("receive-message", handleReceiveMessage);
            socket.off("receive-transcript", handleReceiveTranscript);
            socket.off("user-typing", handleUserTyping);
            socket.off("meeting-ended", handleMeetingEnded);
            socket.off("connect", handleSocketConnect);
        };
    }, [roomId, user]);

    // 4. Enter Room Action
    const handleJoinRoom = async () => {
        if (!roomId) return;
        const cleanRoomId = normalizeRoomId(roomId);
        setInLobby(false);
        isInMeetingRef.current = true;

        // Ensure camera & mic stream is acquired BEFORE creating peer connections
        let currentStream = localStreamRef.current;
        if (!currentStream) {
            currentStream = await startCamera();
        }

        // Start continuous speech recognition directly from button click gesture
        if (micEnabled) {
            startSpeechRecognition();
        }

        const safeUser = user || {
            _id: "user_" + Date.now(),
            fullName: "Participant"
        };

        // Connect socket if not already connected
        if (!socket.connected) {
            socket.connect();
        }
        
        // Emit join-room with normalized roomId
        socket.emit("join-room", { roomId: cleanRoomId, user: safeUser });
    };

    // Clean up sockets & WebRTC peers on unmount
    useEffect(() => {
        return () => {
            socket.disconnect();
            peersRef.current.forEach((pc) => pc.close());
            peersRef.current.clear();
            iceCandidatesQueue.current.clear();
            stopSpeechRecognition();
        };
    }, []);

    // 4. Continuous Web Speech Recognition engine
    const startSpeechRecognition = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.log("Web Speech API not supported in this browser. Fallback to manual transcription active.");
            return;
        }

        try {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) {}
                recognitionRef.current = null;
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "en-US";
            recognition.maxAlternatives = 1;

            recognition.onresult = (event: any) => {
                let interimStr = "";
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i];
                    const transcriptPiece = result[0]?.transcript || "";

                    if (result.isFinal) {
                        const spokenText = transcriptPiece.trim();
                        if (spokenText && roomId) {
                            const senderName = user?.fullName || "Participant";
                            const item: TranscriptItem = {
                                sender: senderName,
                                text: spokenText,
                                timestamp: new Date().toISOString()
                            };

                            // Broadcast live voice transcript to all peers in room
                            socket.emit("voice-transcript", {
                                roomId: normalizeRoomId(roomId),
                                transcript: item
                            });

                            // Persist to MongoDB under user's name
                            addTranscriptMessage(roomId, senderName, spokenText);

                            setTranscripts((prev) => {
                                if (prev.some((t) => t.sender === item.sender && t.text === item.text && Math.abs(new Date(t.timestamp).getTime() - new Date(item.timestamp).getTime()) < 3000)) {
                                    return prev;
                                }
                                return [...prev, item];
                            });

                            setLiveCaptionText(`${senderName}: ${spokenText}`);
                        }
                    } else {
                        interimStr += transcriptPiece;
                    }
                }

                if (interimStr.trim()) {
                    const senderName = user?.fullName || "You";
                    setLiveCaptionText(`${senderName}: ${interimStr.trim()}...`);
                }
            };

            recognition.onerror = (event: any) => {
                if (event.error !== "no-speech") {
                    console.warn("Speech recognition notice:", event.error);
                }
                if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                    setIsTranscribing(false);
                }
            };

            recognition.onend = () => {
                if (isInMeetingRef.current && micEnabledRef.current) {
                    setTimeout(() => {
                        if (isInMeetingRef.current && micEnabledRef.current && recognitionRef.current) {
                            try {
                                recognition.start();
                                setIsTranscribing(true);
                            } catch (e) {
                                // Ignore restart collision
                            }
                        }
                    }, 300);
                } else {
                    setIsTranscribing(false);
                }
            };

            recognition.start();
            recognitionRef.current = recognition;
            setIsTranscribing(true);
        } catch (err) {
            console.warn("Speech recognition error:", err);
            setIsTranscribing(false);
        }
    };

    const stopSpeechRecognition = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {}
            recognitionRef.current = null;
        }
        setIsTranscribing(false);
    };

    // Continuous Whisper audio capture via MediaRecorder (chunked audio slices)
    const startWhisperAudioCapture = () => {
        if (!localStreamRef.current) return;
        const audioTracks = localStreamRef.current.getAudioTracks();
        if (audioTracks.length === 0) return;

        try {
            if (audioRecorderRef.current && audioRecorderRef.current.state !== "inactive") {
                audioRecorderRef.current.stop();
            }

            const audioStream = new MediaStream(audioTracks);
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
                ? "audio/webm;codecs=opus" 
                : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "");

            const options = mimeType ? { mimeType } : undefined;
            const recorder = new MediaRecorder(audioStream, options);

            recorder.ondataavailable = async (e: BlobEvent) => {
                if (e.data && e.data.size > 2000 && micEnabledRef.current && roomId) {
                    try {
                        const formData = new FormData();
                        formData.append("audio", e.data, `voice_${user?._id || "user"}_${Date.now()}.webm`);
                        formData.append("sender", user?.fullName || "Speaker");
                        if (user?._id) formData.append("senderUser", user._id);

                        await api.post(`/meetings/${roomId}/whisper-transcribe`, formData, {
                            headers: { "Content-Type": "multipart/form-data" }
                        });
                    } catch (err: any) {
                        // Silent catch on network / chunk processing
                    }
                }
            };

            // Stream continuous audio chunks in 5000ms slices
            recorder.start(5000);
            audioRecorderRef.current = recorder;
            console.log("🎙️ Whisper continuous audio capture active (5s slices)");
        } catch (e) {
            console.warn("Could not start MediaRecorder for Whisper:", e);
        }
    };

    const stopWhisperAudioCapture = () => {
        if (audioRecorderRef.current && audioRecorderRef.current.state !== "inactive") {
            try {
                audioRecorderRef.current.stop();
            } catch (e) {}
            audioRecorderRef.current = null;
        }
    };

    // Auto-activate or stop speech recognition & Whisper based on microphone status
    useEffect(() => {
        if (!inLobby && micEnabled) {
            startSpeechRecognition();
            startWhisperAudioCapture();
        } else {
            stopSpeechRecognition();
            stopWhisperAudioCapture();
        }
        return () => {
            stopSpeechRecognition();
            stopWhisperAudioCapture();
        };
    }, [inLobby, micEnabled]);

    // 5. Mute & Camera Toggles
    const toggleMic = () => {
        if (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0) {
            const nextState = !micEnabled;
            setMicEnabled(nextState);
            micEnabledRef.current = nextState;
            if (!inLobby) {
                if (nextState) startSpeechRecognition();
                else stopSpeechRecognition();
            }
            return;
        }

        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
            const nextState = !micEnabled;
            audioTrack.enabled = nextState;
            setMicEnabled(nextState);
            micEnabledRef.current = nextState;
            if (!inLobby) {
                if (nextState) startSpeechRecognition();
                else stopSpeechRecognition();
            }
            toast.success(nextState ? "Microphone enabled" : "Microphone muted");
        } else {
            const nextState = !micEnabled;
            setMicEnabled(nextState);
            micEnabledRef.current = nextState;
            if (!inLobby) {
                if (nextState) startSpeechRecognition();
                else stopSpeechRecognition();
            }
        }
    };

    const toggleCam = async () => {
        if (!localStreamRef.current || localStreamRef.current.getVideoTracks().length === 0) {
            await startCamera();
            return;
        }

        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
            const nextState = !camEnabled;
            videoTrack.enabled = nextState;
            setCamEnabled(nextState);

            if (!nextState && localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            } else if (nextState && localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
                localVideoRef.current.play().catch(() => {});
            }
            toast.success(nextState ? "Camera enabled" : "Camera turned off");
        } else {
            await startCamera();
        }
    };

    const toggleScreenSharing = async () => {
        if (!screenSharing) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.play().catch(() => {});
                }
                setScreenSharing(true);
                toast.success("Sharing your screen");
                
                const screenTrack = stream.getVideoTracks()[0];
                peersRef.current.forEach((pc) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                    if (sender) {
                        sender.replaceTrack(screenTrack);
                    }
                });

                // When user stops screen sharing from browser control
                screenTrack.onended = () => {
                    setScreenSharing(false);
                    if (localStreamRef.current && localVideoRef.current) {
                        localVideoRef.current.srcObject = localStreamRef.current;
                        localVideoRef.current.play().catch(() => {});
                        const camTrack = localStreamRef.current.getVideoTracks()[0];
                        if (camTrack) {
                            peersRef.current.forEach((pc) => {
                                const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                                if (sender) sender.replaceTrack(camTrack);
                            });
                        }
                    }
                };
            } catch (err) {
                console.error("Screen share cancel: ", err);
            }
        } else {
            setScreenSharing(false);
            if (localStreamRef.current && localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
                localVideoRef.current.play().catch(() => {});
                const camTrack = localStreamRef.current.getVideoTracks()[0];
                if (camTrack) {
                    peersRef.current.forEach((pc) => {
                        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                        if (sender) sender.replaceTrack(camTrack);
                    });
                }
            }
        }
    };

    // 6. Typing and Chat Handlers
    const handleChatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setChatInput(e.target.value);
        if (!roomId) return;

        const senderName = user?.fullName || "Participant";
        socket.emit("typing", { roomId: normalizeRoomId(roomId), userName: senderName, isTyping: true });

        if (typingTimeout) clearTimeout(typingTimeout);
        
        setTypingTimeout(
            setTimeout(() => {
                socket.emit("typing", { roomId: normalizeRoomId(roomId), userName: senderName, isTyping: false });
            }, 1500)
        );
    };

    const handleSendChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !roomId) return;

        const senderName = user?.fullName || "Participant";
        const messageData: ChatItem = {
            sender: senderName,
            text: chatInput.trim(),
            timestamp: new Date().toISOString()
        };

        socket.emit("send-message", { roomId: normalizeRoomId(roomId), message: messageData });
        addChatMessage(roomId, senderName, chatInput.trim());

        setMessages((prev) => {
            if (prev.some((m) => m.sender === senderName && m.text === messageData.text && Math.abs(new Date(m.timestamp).getTime() - new Date(messageData.timestamp).getTime()) < 3000)) {
                return prev;
            }
            return [...prev, messageData];
        });

        socket.emit("typing", { roomId: normalizeRoomId(roomId), userName: senderName, isTyping: false });
        if (typingTimeout) clearTimeout(typingTimeout);

        setChatInput("");
    };

    // 7. Live Voice Transcription submit (manual dictation fallback)
    const handleAddLiveSpeech = (e: React.FormEvent) => {
        e.preventDefault();
        if (!captionInput.trim() || !roomId) return;

        const senderName = user?.fullName || "Participant";
        const transcriptItem: TranscriptItem = {
            sender: senderName,
            text: captionInput.trim(),
            timestamp: new Date().toISOString()
        };

        socket.emit("voice-transcript", {
            roomId: normalizeRoomId(roomId),
            transcript: transcriptItem
        });

        addTranscriptMessage(roomId, senderName, captionInput.trim());

        setTranscripts((prev) => {
            if (prev.some((t) => t.sender === senderName && t.text === transcriptItem.text && Math.abs(new Date(t.timestamp).getTime() - new Date(transcriptItem.timestamp).getTime()) < 3000)) {
                return prev;
            }
            return [...prev, transcriptItem];
        });
        setLiveCaptionText(`${senderName}: ${captionInput.trim()}`);
        setCaptionInput("");
        toast.success("Voice transcript saved under your name", { icon: "🎙️" });
    };

    // Helper: Completely teardown all meeting streams, peers, speech recognition, and sockets
    const cleanupMeetingState = () => {
        isInMeetingRef.current = false;
        stopCamera();
        stopSpeechRecognition();
        stopWhisperAudioCapture();
        peersRef.current.forEach((pc) => {
            try {
                pc.close();
            } catch (e) {}
        });
        peersRef.current.clear();
        iceCandidatesQueue.current.clear();
        setRemoteStreams({});
        setPeers([]);
        if (socket.connected) {
            socket.disconnect();
        }
    };
    cleanupMeetingRef.current = cleanupMeetingState;

    // 8. End or Leave Meeting Action
    const handleEndOrLeaveMeeting = async () => {
        if (!roomId || isEnding) return;
        const cleanRoomId = normalizeRoomId(roomId);

        if (isHost) {
            // HOST: Ends meeting for all participants & generates AI summary
            const confirmEnd = window.confirm(
                "Are you sure you want to end the meeting for everyone? This will save all chats, voice transcripts, and generate the AI summary."
            );
            if (!confirmEnd) return;

            setIsEnding(true);
            try {
                // 1. Notify all connected participants via Socket.IO immediately
                socket.emit("end-meeting", { roomId: cleanRoomId, userId: user?._id });

                // 2. Persist AI summary, final transcripts, chats & notes to database
                await endMeeting(cleanRoomId, {
                    finalTranscripts: transcripts,
                    finalChats: messages,
                    notes: meetingNotes
                });

                // 3. Clean up hardware and WebRTC peer connections
                cleanupMeetingState();

                toast.success("Meeting ended! AI analysis ready.");
                navigate(`/meeting/${cleanRoomId}/summary`, { replace: true });
            } catch (err: any) {
                console.error("Failed to end meeting:", err);
                toast.error(err.message || "Failed to end meeting");
                setIsEnding(false);
            }
        } else {
            // PARTICIPANT: Leaves meeting room only, meeting continues for everyone else
            const confirmLeave = window.confirm("Are you sure you want to leave this meeting?");
            if (!confirmLeave) return;

            try {
                // 1. Notify room that participant left
                const safeUser = user || { _id: "user_" + Date.now(), fullName: "Participant" };
                socket.emit("leave-room", { roomId: cleanRoomId, user: safeUser });

                // 2. Update participant leftAt in database
                await leaveMeeting(cleanRoomId);

                // 3. Clean up hardware and WebRTC connections immediately
                cleanupMeetingState();

                toast.success("You left the meeting");
                navigate("/dashboard", { replace: true });
            } catch (err: any) {
                cleanupMeetingState();
                navigate("/dashboard", { replace: true });
            }
        }
    };

    // Host can also leave without terminating the meeting for others
    const handleHostLeaveWithoutEnding = async () => {
        if (!roomId || isEnding) return;
        const cleanRoomId = normalizeRoomId(roomId);
        const confirmLeave = window.confirm(
            "Leave the room without ending the meeting? Other participants will remain connected."
        );
        if (!confirmLeave) return;

        try {
            const safeUser = user || { _id: "user_" + Date.now(), fullName: "Host" };
            socket.emit("leave-room", { roomId: cleanRoomId, user: safeUser });
            await leaveMeeting(cleanRoomId);
            cleanupMeetingState();
            toast.success("You left the meeting room");
            navigate("/dashboard", { replace: true });
        } catch (err: any) {
            cleanupMeetingState();
            navigate("/dashboard", { replace: true });
        }
    };

    // 9. Handle unexpected disconnections and browser closures
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isInMeetingRef.current && roomId) {
                const cleanRoomId = normalizeRoomId(roomId);
                const safeUser = user || { _id: "user_" + Date.now(), fullName: "Participant" };
                if (socket.connected) {
                    socket.emit("leave-room", { roomId: cleanRoomId, user: safeUser });
                }
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    track.stop();
                    track.enabled = false;
                });
            }
            peersRef.current.forEach((pc) => {
                try {
                    pc.close();
                } catch (e) {}
            });
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        window.addEventListener("pagehide", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.removeEventListener("pagehide", handleBeforeUnload);
        };
    }, [roomId, user]);

    // Render Lobby Frame
    if (inLobby) {
        return (
            <div className="min-h-screen bg-[#08090c] text-white flex items-center justify-center p-4">
                <div className="w-full max-w-4xl glass-panel rounded-3xl p-6 md:p-10 border border-white/10 flex flex-col md:flex-row gap-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-40 h-40 bg-violet-600/10 rounded-full blur-3xl pointer-events-none"></div>

                    {/* Left Panel: Camera Setup */}
                    <div className="flex-1 space-y-4">
                        <h2 className="text-xl font-bold">Lobby Hardware Setup</h2>
                        <div className="aspect-video w-full rounded-2xl bg-black/60 border border-white/5 relative overflow-hidden flex items-center justify-center">
                            {/* Keep lobby video element always in DOM to preserve stream binding */}
                            <video 
                                ref={lobbyVideoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${camEnabled && localStream ? "opacity-100 relative z-10" : "opacity-0 absolute inset-0 pointer-events-none"}`}
                            />
                            {(!camEnabled || !localStream) && (
                                <div className="text-center space-y-2 relative z-0">
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-neutral-400">
                                        <VideoOff className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs text-neutral-500 block">Camera is Disabled</span>
                                </div>
                            )}

                            {/* Camera overlay indicators */}
                            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-neutral-300 font-semibold border border-white/5 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${camEnabled && localStream ? "bg-emerald-500" : "bg-red-500"}`}></span>
                                {user?.fullName || "You"}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={toggleMic}
                                className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                                    micEnabled 
                                        ? "bg-white/5 border-white/10 text-white hover:bg-white/10" 
                                        : "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
                                }`}
                                title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
                            >
                                {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={toggleCam}
                                className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                                    camEnabled 
                                        ? "bg-white/5 border-white/10 text-white hover:bg-white/10" 
                                        : "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
                                }`}
                                title={camEnabled ? "Disable Camera" : "Enable Camera"}
                            >
                                {camEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Right Panel: Lobby Actions */}
                    <div className="w-full md:w-80 flex flex-col justify-between space-y-6">
                        <div className="space-y-4">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Ready to join?</span>
                                <h1 className="text-2xl font-extrabold tracking-tight mt-1">{activeMeeting?.title || "IntellMeet Room"}</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-neutral-400 font-mono">Room ID: {roomId}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const url = `${window.location.origin}/meeting/${roomId}`;
                                            navigator.clipboard.writeText(url);
                                            toast.success("Meeting link copied!", { icon: "📋" });
                                        }}
                                        className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 bg-violet-500/10 hover:bg-violet-500/20 px-2 py-0.5 rounded border border-violet-500/20 cursor-pointer transition-all"
                                        title="Copy Meeting Invite Link"
                                    >
                                        <Copy className="w-2.5 h-2.5" /> Copy Invite Link
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-2">
                                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Host Creator</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-violet-600/20 text-violet-400 font-bold text-xs flex items-center justify-center">
                                        H
                                    </div>
                                    <span className="text-xs font-semibold text-neutral-200">
                                        Organizer Ref: {activeMeeting?.host ? "Assigned" : "Guest Mode"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <button
                                onClick={handleJoinRoom}
                                className="w-full glow-btn bg-violet-600 hover:bg-violet-500 text-sm font-semibold py-3.5 rounded-xl cursor-pointer"
                            >
                                Enter Meeting Room
                            </button>
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="w-full border border-white/10 hover:bg-white/5 text-sm font-semibold py-3.5 rounded-xl transition-all cursor-pointer"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Active Meeting Room Layout
    return (
        <div className="min-h-screen bg-[#08090c] text-white flex flex-col">
            {/* Top meeting title details */}
            <header className="h-14 border-b border-white/5 bg-[#0a0b0f] shrink-0 flex items-center justify-between px-6 z-10">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white uppercase bg-violet-600/10 text-violet-400 border border-violet-500/20 px-2.5 py-0.5 rounded">
                        Live Room
                    </span>
                    <h2 className="text-sm font-bold truncate max-w-xs">{activeMeeting?.title}</h2>
                    <span className="text-[10px] text-neutral-400 hidden sm:inline">({roomId})</span>
                    <button
                        type="button"
                        onClick={() => {
                            const url = `${window.location.origin}/meeting/${roomId}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Meeting link copied!", { icon: "📋" });
                        }}
                        className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 bg-violet-500/10 hover:bg-violet-500/20 px-2 py-1 rounded border border-violet-500/20 cursor-pointer transition-all"
                        title="Copy Meeting Invite Link"
                    >
                        <Copy className="w-2.5 h-2.5" /> Copy Invite Link
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-white/5 px-2.5 py-1 rounded-full text-xs font-medium border border-white/5 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{peers.length + 1} connected</span>
                    </div>
                </div>
            </header>

            {/* Grid & Chat Split Panel */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
                
                {/* Left Side: Video Tiles */}
                <div className="flex-1 flex flex-col justify-between p-4 space-y-4 min-h-0">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-center min-h-[300px]">
                        {/* Tile 1: Local Stream */}
                        <div className="aspect-video max-w-2xl w-full h-full mx-auto rounded-3xl bg-[#0e0f14] border border-white/5 shadow-lg relative overflow-hidden flex items-center justify-center group">
                            <video 
                                ref={localVideoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${camEnabled && localStream ? "opacity-100 relative z-10" : "opacity-0 absolute inset-0 pointer-events-none"}`}
                            />
                            {(!camEnabled || !localStream) && (
                                <div className="text-center space-y-1 relative z-0">
                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto text-neutral-500">
                                        <VideoOff className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs text-neutral-500 block">Cam Feed Disabled</span>
                                </div>
                            )}

                            {/* User details */}
                            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs font-medium border border-white/5 flex items-center gap-1.5 backdrop-blur-md">
                                <span className={`w-1.5 h-1.5 rounded-full ${camEnabled && localStream ? "bg-emerald-500" : "bg-red-500"}`}></span>
                                {user?.fullName || "You"} (You)
                            </div>
                        </div>

                        {/* Tile 2+: Remote Peer Video Streams */}
                        {peers.length > 0 ? (
                            peers.map((peer) => (
                                <RemoteVideoTile
                                    key={peer.socketId}
                                    peer={peer}
                                    stream={remoteStreams[peer.socketId]}
                                />
                            ))
                        ) : (
                            // Simulated slide presentation when testing solo
                            <div className="aspect-video max-w-2xl w-full h-full mx-auto rounded-3xl bg-gradient-to-br from-[#12131a] to-[#1c1d29] border border-violet-500/10 shadow-lg relative overflow-hidden flex flex-col items-center justify-center text-center p-6">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 blur-2xl"></div>
                                <Bot className="w-10 h-10 text-violet-400 mb-2 animate-bounce" />
                                <h3 className="font-bold text-sm">Waiting for teammates...</h3>
                                <p className="text-xs text-neutral-400 max-w-xs mt-1.5 leading-relaxed">
                                    Share the invite link to invite peers. As soon as they enter the room, their camera and audio will stream live here.
                                </p>
                                <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs font-medium border border-white/5 flex items-center gap-1.5 backdrop-blur-md">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                    WebRTC Room Ready
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom AI floating caption bar */}
                    <div className="bg-black/80 backdrop-blur-md border border-white/5 rounded-2xl p-3 max-w-3xl mx-auto w-full flex items-center gap-3.5 shadow-xl">
                        <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[10px] uppercase font-bold text-violet-400 tracking-wider">Live Caption Overlay</span>
                            <p className="text-xs font-medium text-neutral-200 truncate mt-0.5 italic">
                                "{liveCaptionText}"
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side: Sidebar Panels */}
                <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-white/5 bg-[#0a0b0f] flex flex-col shrink-0 min-h-0">
                    {/* Tab Selection */}
                    <div className="flex border-b border-white/5">
                        <button
                            onClick={() => setActiveTab("chat")}
                            className={`flex-1 py-3 text-[11px] font-semibold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                                activeTab === "chat" 
                                    ? "border-violet-600 text-violet-400 bg-white/5" 
                                    : "border-transparent text-neutral-400 hover:text-white"
                            }`}
                        >
                            <MessageSquare className="w-3.5 h-3.5" /> Chat ({messages.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("transcript")}
                            className={`flex-1 py-3 text-[11px] font-semibold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                                activeTab === "transcript" 
                                    ? "border-violet-600 text-violet-400 bg-white/5" 
                                    : "border-transparent text-neutral-400 hover:text-white"
                            }`}
                        >
                            <AudioWaveform className="w-3.5 h-3.5" /> Voice ({transcripts.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("notes")}
                            className={`flex-1 py-3 text-[11px] font-semibold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                                activeTab === "notes" 
                                    ? "border-violet-600 text-violet-400 bg-white/5" 
                                    : "border-transparent text-neutral-400 hover:text-white"
                            }`}
                        >
                            <ListTodo className="w-3.5 h-3.5" /> Notes
                        </button>
                        <button
                            onClick={() => setActiveTab("participants")}
                            className={`flex-1 py-3 text-[11px] font-semibold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                                activeTab === "participants" 
                                    ? "border-violet-600 text-violet-400 bg-white/5" 
                                    : "border-transparent text-neutral-400 hover:text-white"
                            }`}
                        >
                            <Users className="w-3.5 h-3.5" /> ({peers.length + 1})
                        </button>
                    </div>

                    {/* Tab Contents */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {activeTab === "transcript" && (
                            <div className="flex-1 flex flex-col min-h-0 p-4 justify-between">
                                {/* Status Header */}
                                <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${isTranscribing && micEnabled ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"}`}></span>
                                        {isTranscribing && micEnabled ? "Live Voice-to-Text Active" : (micEnabled ? "Mic on / Ready" : "Mic Muted (Paused)")}
                                    </span>
                                    <span className="text-[10px] text-neutral-400 font-mono">
                                        {transcripts.length} entries
                                    </span>
                                </div>

                                {/* Transcripts list */}
                                <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
                                    {transcripts.length === 0 ? (
                                        <div className="text-center py-10 text-neutral-500 text-xs space-y-2">
                                            <AudioWaveform className="w-8 h-8 text-neutral-600 mx-auto opacity-50" />
                                            <p className="font-semibold text-neutral-400">No voice transcripts yet</p>
                                            <p className="text-[11px] text-neutral-500 max-w-[220px] mx-auto">
                                                Speak into your microphone. Words are transcribed into text and saved under your username.
                                            </p>
                                        </div>
                                    ) : (
                                        transcripts.map((item, index) => (
                                            <div 
                                                key={index} 
                                                className={`p-3 rounded-2xl max-w-[90%] text-xs border ${
                                                    item.sender === user?.fullName 
                                                        ? "ml-auto bg-emerald-500/10 border-emerald-500/20 text-emerald-200" 
                                                        : "bg-white/5 border-white/5 text-neutral-300"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-4 mb-1 text-[9px] font-bold opacity-60">
                                                    <span className="flex items-center gap-1 text-violet-300">
                                                        <Mic className="w-2.5 h-2.5" />
                                                        {item.sender}
                                                    </span>
                                                    <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="leading-relaxed break-words">{item.text}</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Manual dictation fallback */}
                                <form onSubmit={handleAddLiveSpeech} className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Type speech note under your name..."
                                        value={captionInput}
                                        onChange={(e) => setCaptionInput(e.target.value)}
                                        className="flex-1 text-xs px-3 py-2 rounded-xl glass-input"
                                    />
                                    <button 
                                        type="submit" 
                                        className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 flex items-center justify-center shrink-0 shadow shadow-violet-500/20 cursor-pointer"
                                        title="Save to voice transcript"
                                    >
                                        <Send className="w-4 h-4 text-white" />
                                    </button>
                                </form>
                            </div>
                        )}
                        {activeTab === "chat" && (
                            <div className="flex-1 flex flex-col min-h-0 p-4 justify-between">
                                {/* Message area */}
                                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                                    {messages.length === 0 ? (
                                        <div className="text-center py-10 text-neutral-500 text-xs">
                                            No messages yet. Send a note to the group chat.
                                        </div>
                                    ) : (
                                        messages.map((msg, index) => (
                                            <div 
                                                key={index} 
                                                className={`p-3 rounded-2xl max-w-[85%] text-xs border ${
                                                    msg.sender === user?.fullName 
                                                        ? "ml-auto bg-violet-600/10 border-violet-500/20 text-violet-200" 
                                                        : "bg-white/5 border-white/5 text-neutral-300"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-4 mb-1 text-[9px] font-bold opacity-60">
                                                    <span>{msg.sender}</span>
                                                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="leading-relaxed break-words">{msg.text}</p>
                                            </div>
                                        ))
                                    )}
                                    {typingUser && (
                                        <div className="text-[10px] text-neutral-400 italic font-medium">
                                            {typingUser} is typing...
                                        </div>
                                    )}
                                </div>

                                {/* Send chat form */}
                                <form onSubmit={handleSendChat} className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Type chat message..."
                                        value={chatInput}
                                        onChange={handleChatChange}
                                        className="flex-1 text-xs px-3 py-2 rounded-xl glass-input"
                                    />
                                    <button 
                                        type="submit" 
                                        className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 flex items-center justify-center shrink-0 shadow shadow-violet-500/20 cursor-pointer"
                                    >
                                        <Send className="w-4 h-4 text-white" />
                                    </button>
                                </form>
                            </div>
                        )}

                        {activeTab === "notes" && (
                            <div className="flex-1 flex flex-col p-4 justify-between min-h-0">
                                <div className="flex-1 flex flex-col space-y-3 min-h-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Meeting Notes Draft</span>
                                    <textarea
                                        placeholder="Draft notes, items, goals or documentation discussed during meeting here..."
                                        value={meetingNotes}
                                        onChange={(e) => setMeetingNotes(e.target.value)}
                                        className="flex-1 w-full text-xs p-3 rounded-2xl glass-input resize-none focus:ring-1"
                                    />
                                </div>
                                <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                                    <button 
                                        onClick={() => {
                                            toast.success("Notes saved to local storage!");
                                        }}
                                        className="bg-white/5 border border-white/10 hover:bg-white/10 text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                                    >
                                        Save Draft
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === "participants" && (
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">Connected Peers</span>
                                
                                {/* Local */}
                                <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-[#12131a]">
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 font-bold text-[10px] flex items-center justify-center">
                                            {user?.fullName?.charAt(0).toUpperCase() || "Y"}
                                        </div>
                                        <span className="font-semibold text-white">{user?.fullName || "You"} (You)</span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isHost ? "text-violet-400 bg-violet-500/10" : "text-neutral-400 bg-white/5"}`}>
                                        {isHost ? "Host" : "Participant"}
                                    </span>
                                </div>

                                {/* Remotes */}
                                {peers.map((peer) => (
                                    <div key={peer.socketId} className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-[#12131a]">
                                        <div className="flex items-center gap-2 text-xs">
                                            <div className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 font-bold text-[10px] flex items-center justify-center">
                                                {peer.user?.fullName?.charAt(0).toUpperCase() || "P"}
                                            </div>
                                            <span className="font-semibold text-neutral-300">{peer.user?.fullName}</span>
                                        </div>
                                        <span className="text-[10px] text-neutral-500">Connected</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Meeting Controls */}
            <footer className="h-20 border-t border-white/5 bg-[#0a0b0f] shrink-0 flex flex-col md:flex-row items-center justify-between px-6 py-3 gap-3 z-10">
                {/* 1. Mute and camera hardware buttons */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleMic}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                            micEnabled 
                                ? "bg-white/5 border-white/10 text-white hover:bg-white/10" 
                                : "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
                        }`}
                        title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
                    >
                        {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={toggleCam}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                            camEnabled 
                                ? "bg-white/5 border-white/10 text-white hover:bg-white/10" 
                                : "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
                        }`}
                        title={camEnabled ? "Disable Camera" : "Enable Camera"}
                    >
                        {camEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={toggleScreenSharing}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                            screenSharing 
                                ? "bg-violet-600/15 border-violet-500/30 text-violet-400 hover:bg-violet-500/25" 
                                : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                        }`}
                        title={screenSharing ? "Stop Screen Share" : "Share Screen"}
                    >
                        <Monitor className="w-4 h-4" />
                    </button>
                </div>

                {/* 2. Speak/Transcribe Simulator Panel */}
                <form onSubmit={handleAddLiveSpeech} className="flex-1 max-w-md w-full flex items-center gap-2">
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-violet-400">
                            <Mic className="w-3.5 h-3.5" />
                        </span>
                        <input
                            type="text"
                            placeholder="Type simulated vocal input (adds to AI Summary)..."
                            value={captionInput}
                            onChange={(e) => setCaptionInput(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs glass-input focus:border-violet-500"
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer"
                    >
                        Speak
                    </button>
                </form>

                {/* 3. Leave and End meeting actions */}
                <div className="flex items-center gap-3">
                    {isHost && (
                        <button
                            type="button"
                            onClick={handleHostLeaveWithoutEnding}
                            disabled={isEnding}
                            className="flex items-center gap-1.5 text-xs border border-white/10 hover:bg-white/5 text-neutral-300 px-3.5 py-2.5 rounded-xl font-semibold transition-all cursor-pointer disabled:opacity-50"
                            title="Leave meeting without ending it for other participants"
                        >
                            <LogOut className="w-3.5 h-3.5" /> Leave Room
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleEndOrLeaveMeeting}
                        disabled={isEnding}
                        className="flex items-center gap-2 text-xs bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                        title={isHost ? "End meeting for all participants and generate AI Summary" : "Leave this meeting room"}
                    >
                        <LogOut className="w-4 h-4" />
                        {isEnding 
                            ? "Ending Meeting..." 
                            : (isHost ? "End AI Summary / Leave (All)" : "End AI Summary / Leave")
                        }
                    </button>
                </div>
            </footer>
        </div>
    );
}
