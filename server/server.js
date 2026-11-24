require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const { findMeetingByRoomId } = require("./controllers/meetingControllers");

const jwt = require("jsonwebtoken");
const User = require("./model/User");
const Workspace = require("./model/Workspace");

const PORT = process.env.PORT || 5000;

// Helper to normalize room IDs across all clients
const normalizeRoomId = (id) => {
    if (!id) return "";
    let clean = String(id).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (clean.length === 9) {
        return `${clean.substring(0, 3)}-${clean.substring(3, 6)}-${clean.substring(6, 9)}`;
    }
    return clean;
};

// Track active users and their rooms
// socketId -> { roomId, user }
const activeConnections = new Map();

const startServer = async () => {
    try {
        const server = http.createServer(app);

        // Configure Socket.io with CORS
        const io = new Server(server, {
            cors: {
                origin: (origin, callback) => {
                    // Allow all client origins with credentials (localhost, vercel, custom domain)
                    callback(null, true);
                },
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        app.set("io", io);

        // Socket.io JWT authentication middleware
        io.use(async (socket, next) => {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
            if (!token) {
                return next();
            }
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select("-password");
                if (user) {
                    socket.user = user;
                }
                next();
            } catch (err) {
                next();
            }
        });

        // Socket.io connection logic
        io.on("connection", (socket) => {
            console.log(`🔌 Socket connected: ${socket.id}`);

            // 1. Join room
            socket.on("join-room", ({ roomId, user }) => {
                const cleanRoomId = normalizeRoomId(roomId);
                const safeUser = user || { _id: socket.id, fullName: "Participant" };

                socket.join(cleanRoomId);
                activeConnections.set(socket.id, { roomId: cleanRoomId, user: safeUser });

                console.log(`👤 User "${safeUser.fullName}" (${safeUser._id}) joined room: ${cleanRoomId}`);

                // Fetch other sockets in this room to establish WebRTC connections
                const clientsInRoom = io.sockets.adapter.rooms.get(cleanRoomId);
                const otherUserSockets = [];
                
                if (clientsInRoom) {
                    for (const clientId of clientsInRoom) {
                        if (clientId !== socket.id) {
                            const clientData = activeConnections.get(clientId);
                            otherUserSockets.push({
                                socketId: clientId,
                                user: clientData ? clientData.user : { _id: clientId, fullName: "Peer" }
                            });
                        }
                    }
                }

                // Tell the entering user who is already in the room
                socket.emit("all-users", otherUserSockets);

                // Notify other users that a new user connected
                socket.to(cleanRoomId).emit("user-connected", {
                    socketId: socket.id,
                    user: safeUser
                });
            });

            // 2. WebRTC Peer Signaling Relay
            socket.on("sending-signal", ({ userToSignal, signal, callerId, callerUser }) => {
                io.to(userToSignal).emit("user-joined-signal", {
                    signal,
                    callerId,
                    callerUser
                });
            });

            socket.on("returning-signal", ({ callerId, signal }) => {
                io.to(callerId).emit("receiving-returned-signal", {
                    signal,
                    id: socket.id
                });
            });

            // WebRTC ICE Candidate Relay
            socket.on("ice-candidate", ({ target, candidate }) => {
                io.to(target).emit("ice-candidate", {
                    sender: socket.id,
                    candidate
                });
            });

            // 3. Real-Time Chat inside room (persists separately to meeting.chats)
            socket.on("send-message", async ({ roomId, message }) => {
                const cleanRoomId = normalizeRoomId(roomId);
                io.to(cleanRoomId).emit("receive-message", message);

                try {
                    const meeting = await findMeetingByRoomId(cleanRoomId);
                    if (meeting && message && message.text) {
                        if (!meeting.chats) meeting.chats = [];
                        meeting.chats.push({
                            sender: message.sender || "Participant",
                            text: message.text,
                            timestamp: message.timestamp ? new Date(message.timestamp) : new Date()
                        });
                        await meeting.save();
                    }
                } catch (saveErr) {
                    console.warn("Could not persist chat message:", saveErr.message);
                }
            });

            // 4. Real-Time Voice Transcription (persists separately to meeting.transcript under speaker's name)
            socket.on("voice-transcript", async ({ roomId, transcript }) => {
                const cleanRoomId = normalizeRoomId(roomId);
                io.to(cleanRoomId).emit("receive-transcript", transcript);

                try {
                    const meeting = await findMeetingByRoomId(cleanRoomId);
                    if (meeting && transcript && transcript.text) {
                        if (!meeting.transcript) meeting.transcript = [];
                        meeting.transcript.push({
                            sender: transcript.sender || "Speaker",
                            text: transcript.text,
                            timestamp: transcript.timestamp ? new Date(transcript.timestamp) : new Date()
                        });
                        await meeting.save();
                    }
                } catch (saveErr) {
                    console.warn("Could not persist voice transcript:", saveErr.message);
                }
            });

            // 5. Typing indicators
            socket.on("typing", ({ roomId, userName, isTyping }) => {
                const cleanRoomId = normalizeRoomId(roomId);
                socket.to(cleanRoomId).emit("user-typing", { userName, isTyping });
            });

            // 5. Kanban / Workspace Board Sync
            socket.on("join-workspace", async ({ workspaceId }) => {
                if (!workspaceId) return;
                try {
                    // Check workspace authorization if socket.user is authenticated
                    if (socket.user) {
                        const ws = await Workspace.findById(workspaceId);
                        if (ws) {
                            const isMember = ws.owner.toString() === socket.user._id.toString() ||
                                (ws.members && ws.members.some(m => m.toString() === socket.user._id.toString()));
                            if (!isMember) {
                                socket.emit("workspace-error", { message: "Unauthorized to join this workspace room" });
                                return;
                            }
                        }
                    }
                    socket.join(`workspace-${workspaceId}`);
                    console.log(`📌 Socket ${socket.id} (user: ${socket.user?.fullName || "guest"}) joined authorized workspace: workspace-${workspaceId}`);
                } catch (e) {
                    console.warn("join-workspace error:", e.message);
                }
            });

            socket.on("leave-workspace", ({ workspaceId }) => {
                if (workspaceId) {
                    socket.leave(`workspace-${workspaceId}`);
                }
            });

            socket.on("kanban-task-change", ({ workspaceId }) => {
                if (workspaceId) {
                    io.to(`workspace-${workspaceId}`).emit("refresh-kanban-board", { workspaceId });
                    socket.broadcast.emit("refresh-kanban-board", { workspaceId });
                }
            });

            // 6. Explicit Leave Room
            socket.on("leave-room", ({ roomId, user }) => {
                const cleanRoomId = normalizeRoomId(roomId);
                const safeUser = user || { _id: socket.id, fullName: "A participant" };
                console.log(`👋 User "${safeUser.fullName}" explicitly left room: ${cleanRoomId}`);

                socket.leave(cleanRoomId);
                activeConnections.delete(socket.id);

                socket.to(cleanRoomId).emit("user-disconnected", {
                    socketId: socket.id,
                    userId: safeUser._id || socket.id,
                    name: safeUser.fullName || "A participant"
                });
            });

            // 7. Host Ends Meeting for All Participants
            socket.on("end-meeting", ({ roomId, userId }) => {
                const cleanRoomId = normalizeRoomId(roomId);
                console.log(`🛑 Meeting ended in room "${cleanRoomId}" by user "${userId}"`);

                // Broadcast termination event to all clients in the room
                io.to(cleanRoomId).emit("meeting-ended", {
                    roomId: cleanRoomId,
                    message: "The host has ended this meeting."
                });

                // Clear room sockets and active tracking
                const clientsInRoom = io.sockets.adapter.rooms.get(cleanRoomId);
                if (clientsInRoom) {
                    for (const clientId of Array.from(clientsInRoom)) {
                        const clientSocket = io.sockets.sockets.get(clientId);
                        if (clientSocket) {
                            clientSocket.leave(cleanRoomId);
                        }
                        activeConnections.delete(clientId);
                    }
                }
            });

            // 8. Handle Disconnection
            socket.on("disconnect", () => {
                console.log(`🔌 Socket disconnected: ${socket.id}`);
                const connectionData = activeConnections.get(socket.id);
                if (connectionData) {
                    const { roomId, user } = connectionData;
                    socket.to(roomId).emit("user-disconnected", {
                        socketId: socket.id,
                        userId: user?._id || socket.id,
                        name: user?.fullName || "A participant"
                    });
                    activeConnections.delete(socket.id);
                }
            });
        });

        server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.error(`❌ Port ${PORT} is already in use. Please terminate the process using port ${PORT} or choose another port.`);
            } else {
                console.error("❌ Server error:", err);
            }
        });

        server.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
        });

        // Connect to MongoDB
        await connectDB();
    } catch (err) {
        console.error("Failed to start server:", err);
    }
};

startServer();