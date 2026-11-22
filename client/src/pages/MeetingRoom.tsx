import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import type { TranscriptItem } from "../store/store";
import { socket } from "../services/socket";
import { 
    Mic, MicOff, Video as VideoIcon, VideoOff, 
    Monitor, MessageSquare, ListTodo, Users, 
    Send, LogOut, Bot, Copy, Volume2
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

// Resilient STUN configuration for NAT traversal between mobile 4G/5G and Wi-Fi networks
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.relay.metered.ca:80" },
        { urls: "stun:global.stun.twilio.com:3478" }
    ],
    iceCandidatePoolSize: 10
};

// Sub-component to render remote peer video and audio feeds
function RemoteVideoTile({ peer, stream }: { peer: { socketId: string; user: any }; stream?: MediaStream }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

    useEffect(() => {
        if (!stream) {
            setHasRemoteVideo(false);
            return;
        }

        const videoTracks = stream.getVideoTracks();
        setHasRemoteVideo(videoTracks.length > 0 && videoTracks[0].enabled);

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch((err) => {
                console.warn("Peer video autoplay was prevented:", err);
            });
        }

        if (audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().then(() => {
                setAudioBlocked(false);
            }).catch((err) => {
                console.warn("Peer audio autoplay was blocked by browser:", err);
                setAudioBlocked(true);
            });
        }
    }, [stream]);

    const handleEnableAudio = () => {
        if (audioRef.current) {
            audioRef.current.play().then(() => setAudioBlocked(false)).catch(console.error);
        }
        if (videoRef.current) {
            videoRef.current.play().catch(console.error);
        }
    };

    return (
        <div className="aspect-video max-w-2xl w-full h-full mx-auto rounded-3xl bg-[#0e0f14] border border-white/5 shadow-lg relative overflow-hidden flex items-center justify-center">
            {/* Dedicated HTML5 audio tag for clear speaker output */}
            <audio ref={audioRef} autoPlay playsInline />

            {stream && hasRemoteVideo ? (
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-400 font-extrabold text-lg flex items-center justify-center mx-auto">
                        {peer.user?.fullName?.charAt(0).toUpperCase() || "P"}
                    </div>
                    <span className="text-xs text-neutral-400 block">{peer.user?.fullName}</span>
                    <span className="text-[10px] text-neutral-500 block">
                        {stream ? "Audio only" : "Connecting..."}
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

            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs font-medium border border-white/5 flex items-center gap-1.5 backdrop-blur-md">
                <span className={`w-1.5 h-1.5 rounded-full ${stream ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                {peer.user?.fullName || "Peer"}
            </div>
        </div>
    );
}

export default function MeetingRoom() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { user, activeMeeting, joinMeeting, endMeeting, addTranscriptMessage } = useStore();

    // UI States
    const [inLobby, setInLobby] = useState(true);
    const [micEnabled, setMicEnabled] = useState(true);
    const [camEnabled, setCamEnabled] = useState(true);
    const [screenSharing, setScreenSharing] = useState(false);
    const [activeTab, setActiveTab] = useState<"chat" | "notes" | "participants">("chat");

    // Chat and note states
    const [messages, setMessages] = useState<TranscriptItem[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [meetingNotes, setMeetingNotes] = useState("");
    const [typingUser, setTypingUser] = useState("");
    const [typingTimeout, setTypingTimeout] = useState<any>(null);

    // AI Transcription inputs
    const [captionInput, setCaptionInput] = useState("");
    const [liveCaptionText, setLiveCaptionText] = useState("AI Voice Assistant: Listening to conversation...");

    // Media stream references
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    
    // WebRTC Peer connections, Queued ICE Candidates & Remote Streams
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const [peers, setPeers] = useState<{ socketId: string; user: any }[]>([]);
    const [remoteStreams, setRemoteStreams] = useState<{ [socketId: string]: MediaStream }>({});

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
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }

            localStreamRef.current = stream;
            setLocalStream(stream);
            setCamEnabled(true);
            const hasAudio = stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled;
            setMicEnabled(hasAudio);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.play().catch(() => {});
            }

            // Replace tracks on any existing peer connections
            peersRef.current.forEach((pc) => {
                stream.getTracks().forEach((track) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
                    if (sender) {
                        sender.replaceTrack(track);
                    } else {
                        pc.addTrack(track, stream);
                    }
                });
            });

            return stream;
        } catch (err: any) {
            console.error("Camera access failed completely:", err);
            toast.error("Could not access camera/mic. Please check browser permissions.");
            setCamEnabled(false);
            return null;
        }
    };

    const stopCamera = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
    };

    // Initialize camera on mount and cleanup on unmount
    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, []);

    // Reattach localStream whenever localVideoRef element re-mounts (e.g. Lobby -> Room transition)
    useEffect(() => {
        if (localVideoRef.current) {
            if (localStream && camEnabled) {
                localVideoRef.current.srcObject = localStream;
                localVideoRef.current.play().catch(() => {});
            } else {
                localVideoRef.current.srcObject = null;
            }
        }
    }, [localStream, inLobby, camEnabled]);

    // 2. Fetch Meeting details on load
    useEffect(() => {
        if (roomId) {
            const cleanId = normalizeRoomId(roomId);
            joinMeeting(cleanId).catch((err: any) => {
                console.error("Meeting join failed:", err);
                toast.error(err.message || "Meeting room not found");
                navigate("/dashboard");
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

    // Helper: Create an RTCPeerConnection for a target peer
    const createPeerConnection = (targetSocketId: string) => {
        if (peersRef.current.has(targetSocketId)) {
            return peersRef.current.get(targetSocketId)!;
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current.set(targetSocketId, pc);

        // Add local tracks (both video & audio) to peer connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        // Send gathered ICE candidate to peer
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", {
                    target: targetSocketId,
                    candidate: event.candidate.toJSON()
                });
            }
        };

        // Receive remote track (combines both audio and video into unified MediaStream)
        pc.ontrack = (event) => {
            console.log(`📡 Remote track received from ${targetSocketId}:`, event.track.kind);
            setRemoteStreams((prev) => {
                const existing = prev[targetSocketId];
                if (existing) {
                    if (!existing.getTracks().some((t) => t.id === event.track.id)) {
                        existing.addTrack(event.track);
                    }
                    return {
                        ...prev,
                        [targetSocketId]: new MediaStream(existing.getTracks())
                    };
                } else {
                    const newStream = event.streams && event.streams[0]
                        ? new MediaStream(event.streams[0].getTracks())
                        : new MediaStream([event.track]);
                    return {
                        ...prev,
                        [targetSocketId]: newStream
                    };
                }
            });
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`🧊 ICE State with ${targetSocketId}:`, pc.iceConnectionState);
            if (pc.iceConnectionState === "failed") {
                pc.restartIce();
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`🔌 Connection state with ${targetSocketId}:`, pc.connectionState);
            if (
                pc.connectionState === "disconnected" ||
                pc.connectionState === "failed" ||
                pc.connectionState === "closed"
            ) {
                setRemoteStreams((prev) => {
                    const next = { ...prev };
                    delete next[targetSocketId];
                    return next;
                });
            }
        };

        return pc;
    };

    // 3. Connect Sockets and WebRTC signalling on joining
    const handleJoinRoom = async () => {
        if (!roomId) return;
        const cleanRoomId = normalizeRoomId(roomId);
        setInLobby(false);

        // Ensure camera & mic stream is acquired BEFORE creating peer connections
        let currentStream = localStreamRef.current;
        if (!currentStream) {
            currentStream = await startCamera();
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

        // Listeners
        socket.on("all-users", async (usersList: { socketId: string; user: any }[]) => {
            console.log("👥 Existing users in room:", usersList);
            setPeers(usersList);
            toast.success("Connected to meeting room");

            // Initiate WebRTC peer connections with everyone currently in the room
            for (const peer of usersList) {
                try {
                    const pc = createPeerConnection(peer.socketId);
                    const offer = await pc.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: true
                    });
                    await pc.setLocalDescription(offer);
                    socket.emit("sending-signal", {
                        userToSignal: peer.socketId,
                        callerId: socket.id,
                        callerUser: safeUser,
                        signal: offer
                    });
                } catch (err) {
                    console.error("Failed to create offer for peer:", peer.socketId, err);
                }
            }
        });

        socket.on("user-connected", ({ socketId, user: joiningUser }) => {
            console.log("👤 New user joined room:", joiningUser?.fullName, socketId);
            setPeers((prev) => {
                if (prev.some((p) => p.socketId === socketId)) return prev;
                return [...prev, { socketId, user: joiningUser }];
            });
            toast.success(`${joiningUser?.fullName || "A peer"} joined the call`);
        });

        // Receiving an offer from a newcomer
        socket.on("user-joined-signal", async ({ callerId, callerUser, signal }) => {
            console.log("📥 Received WebRTC offer from:", callerId, callerUser?.fullName);
            try {
                setPeers((prev) => {
                    if (prev.some((p) => p.socketId === callerId)) return prev;
                    return [...prev, { socketId: callerId, user: callerUser }];
                });

                const pc = createPeerConnection(callerId);
                await pc.setRemoteDescription(new RTCSessionDescription(signal));

                // Drain any early ICE candidates received while waiting for offer
                await drainQueuedCandidates(callerId, pc);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit("returning-signal", {
                    callerId,
                    signal: answer
                });
            } catch (err) {
                console.error("Failed to answer incoming WebRTC call from:", callerId, err);
            }
        });

        // Receiving an answer back from the target peer
        socket.on("receiving-returned-signal", async ({ id, signal }) => {
            console.log("📥 Received WebRTC answer from:", id);
            try {
                const pc = peersRef.current.get(id);
                if (pc) {
                    if (pc.signalingState !== "stable") {
                        await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    }
                    // Drain any queued ICE candidates received while waiting for answer
                    await drainQueuedCandidates(id, pc);
                }
            } catch (err) {
                console.error("Failed to set remote description from:", id, err);
            }
        });

        // Handle incoming ICE candidate with queuing to prevent premature drops
        socket.on("ice-candidate", async ({ sender, candidate }) => {
            const pc = peersRef.current.get(sender);
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.warn("Failed to add ICE candidate from:", sender, err);
                }
            } else {
                // Queue candidate until setRemoteDescription finishes
                const queue = iceCandidatesQueue.current.get(sender) || [];
                queue.push(candidate);
                iceCandidatesQueue.current.set(sender, queue);
            }
        });

        socket.on("user-disconnected", ({ socketId, name }) => {
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
        });

        socket.on("receive-message", (msg: TranscriptItem) => {
            setMessages((prev) => [...prev, msg]);
            setLiveCaptionText(`${msg.sender}: ${msg.text}`);
        });

        socket.on("user-typing", ({ userName, isTyping }) => {
            setTypingUser(isTyping ? userName : "");
        });

        const botTimer = setTimeout(() => {
            simulateTeammateTalk();
        }, 15000);

        return () => {
            clearTimeout(botTimer);
        };
    };

    // Clean up sockets & WebRTC peers on unmount
    useEffect(() => {
        return () => {
            socket.off("all-users");
            socket.off("user-connected");
            socket.off("user-joined-signal");
            socket.off("receiving-returned-signal");
            socket.off("ice-candidate");
            socket.off("user-disconnected");
            socket.off("receive-message");
            socket.off("user-typing");
            socket.disconnect();

            peersRef.current.forEach((pc) => pc.close());
            peersRef.current.clear();
            iceCandidatesQueue.current.clear();
        };
    }, []);

    // 4. Simulate other participants talking if alone
    const simulateTeammateTalk = () => {
        if (peers.length === 0) {
            const simulatedTalks = [
                { sender: "AI Guide", text: "Hey! I will help summarize our progress. Let's make sure we discuss the database config." },
                { sender: "Sarah (Product)", text: "I will take care of the landing page illustrations this afternoon." },
                { sender: "James (Backend)", text: "Sure, and I need to deploy the Redis clusters to Kubernetes on Day 5." }
            ];

            simulatedTalks.forEach((talk, idx) => {
                setTimeout(() => {
                    const msg = { sender: talk.sender, text: talk.text, timestamp: new Date().toISOString() };
                    setMessages((prev) => [...prev, msg]);
                    setLiveCaptionText(`${talk.sender}: ${talk.text}`);
                    if (roomId) {
                        addTranscriptMessage(roomId, talk.sender, talk.text);
                    }
                }, (idx + 1) * 8000);
            });
        }
    };

    // 5. Mute & Camera Toggles
    const toggleMic = () => {
        if (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0) {
            setMicEnabled(!micEnabled);
            return;
        }

        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
            const nextState = !micEnabled;
            audioTrack.enabled = nextState;
            setMicEnabled(nextState);
            toast.success(nextState ? "Microphone enabled" : "Microphone muted");
        } else {
            setMicEnabled(!micEnabled);
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
        if (!roomId || !user) return;

        socket.emit("typing", { roomId, userName: user.fullName, isTyping: true });

        if (typingTimeout) clearTimeout(typingTimeout);
        
        setTypingTimeout(
            setTimeout(() => {
                socket.emit("typing", { roomId, userName: user.fullName, isTyping: false });
            }, 1500)
        );
    };

    const handleSendChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !roomId || !user) return;

        const messageData = {
            sender: user.fullName,
            text: chatInput.trim(),
            timestamp: new Date().toISOString()
        };

        socket.emit("send-message", { roomId, message: messageData });
        addTranscriptMessage(roomId, user.fullName, chatInput.trim());

        socket.emit("typing", { roomId, userName: user.fullName, isTyping: false });
        if (typingTimeout) clearTimeout(typingTimeout);

        setChatInput("");
    };

    // 7. Live Custom Speech/Caption submit
    const handleAddLiveSpeech = (e: React.FormEvent) => {
        e.preventDefault();
        if (!captionInput.trim() || !roomId || !user) return;

        addTranscriptMessage(roomId, user.fullName, captionInput.trim());

        const msg = {
            sender: user.fullName,
            text: captionInput.trim(),
            timestamp: new Date().toISOString()
        };
        socket.emit("send-message", { roomId, message: msg });

        setLiveCaptionText(`${user.fullName}: ${captionInput.trim()}`);
        setCaptionInput("");
        toast.success("AI Transcribed Speech", { icon: "🎙️" });
    };

    // 8. End or Leave Meeting
    const handleLeaveMeeting = () => {
        socket.disconnect();
        stopCamera();
        peersRef.current.forEach((pc) => pc.close());
        peersRef.current.clear();
        iceCandidatesQueue.current.clear();
        toast.success("You left the meeting room");
        navigate("/dashboard");
    };

    const handleEndMeeting = async () => {
        if (!roomId) return;
        const confirm = window.confirm("Are you sure you want to end the meeting for everyone? This triggers AI summary analysis.");
        if (!confirm) return;

        try {
            stopCamera();
            peersRef.current.forEach((pc) => pc.close());
            peersRef.current.clear();
            iceCandidatesQueue.current.clear();
            await endMeeting(roomId);
            toast.success("Meeting ended! AI analysis ready.");
            navigate(`/meeting/${roomId}/summary`);
        } catch (err: any) {
            toast.error(err.message || "Failed to end meeting");
        }
    };

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
                            {camEnabled && localStream ? (
                                <video 
                                    ref={localVideoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover scale-x-[-1]"
                                />
                            ) : (
                                <div className="text-center space-y-2">
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
                            {camEnabled && localStream ? (
                                <video 
                                    ref={localVideoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover scale-x-[-1]"
                                />
                            ) : (
                                <div className="text-center space-y-1">
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
                            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                                activeTab === "chat" 
                                    ? "border-violet-600 text-violet-400 bg-white/5" 
                                    : "border-transparent text-neutral-400 hover:text-white"
                            }`}
                        >
                            <MessageSquare className="w-3.5 h-3.5" /> Room Chat
                        </button>
                        <button
                            onClick={() => setActiveTab("notes")}
                            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                                activeTab === "notes" 
                                    ? "border-violet-600 text-violet-400 bg-white/5" 
                                    : "border-transparent text-neutral-400 hover:text-white"
                            }`}
                        >
                            <ListTodo className="w-3.5 h-3.5" /> Meeting Notes
                        </button>
                        <button
                            onClick={() => setActiveTab("participants")}
                            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 cursor-pointer ${
                                activeTab === "participants" 
                                    ? "border-violet-600 text-violet-400 bg-white/5" 
                                    : "border-transparent text-neutral-400 hover:text-white"
                            }`}
                        >
                            <Users className="w-3.5 h-3.5" /> Members ({peers.length + 1})
                        </button>
                    </div>

                    {/* Tab Contents */}
                    <div className="flex-1 flex flex-col min-h-0">
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
                                    <span className="text-[10px] text-violet-400 font-bold bg-violet-500/10 px-2 py-0.5 rounded">Host</span>
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
                    <button
                        onClick={handleLeaveMeeting}
                        className="flex items-center gap-1.5 text-xs border border-white/10 hover:bg-white/5 text-neutral-300 px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer"
                    >
                        <LogOut className="w-3.5 h-3.5" /> Leave Lobby
                    </button>
                    <button
                        onClick={handleEndMeeting}
                        className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold shadow shadow-red-500/20 transition-all cursor-pointer"
                    >
                        End Call (AI Summary)
                    </button>
                </div>
            </footer>
        </div>
    );
}
