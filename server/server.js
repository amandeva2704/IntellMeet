require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

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

        // Socket.io connection logic
        io.on("connection", (socket) => {
            console.log(`🔌 Socket connected: ${socket.id}`);

            // 1. Join room
            socket.on("join-room", ({ roomId, user }) => {
                const cleanRoomId = roomId ? String(roomId).trim().toLowerCase().replace(/[^a-z0-9-]/g, "") : roomId;
                socket.join(cleanRoomId);
                activeConnections.set(socket.id, { roomId: cleanRoomId, user });

                console.log(`👤 User "${user.fullName}" (${user._id}) joined room: ${cleanRoomId}`);

                // Fetch other sockets in this room to establish WebRTC connections
                const clientsInRoom = io.sockets.adapter.rooms.get(cleanRoomId);
                const otherUserSockets = [];
                
                if (clientsInRoom) {
                    for (const clientId of clientsInRoom) {
                        if (clientId !== socket.id) {
                            const clientData = activeConnections.get(clientId);
                            otherUserSockets.push({
                                socketId: clientId,
                                user: clientData ? clientData.user : null
                            });
                        }
                    }
                }

                // Tell the entering user who is already in the room
                socket.emit("all-users", otherUserSockets);

                // Notify other users that a new user connected
                socket.to(cleanRoomId).emit("user-connected", {
                    socketId: socket.id,
                    user: user
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

            // 3. Real-Time Chat inside room
            socket.on("send-message", ({ roomId, message }) => {
                // message: { sender, text, timestamp }
                io.to(roomId).emit("receive-message", message);
            });

            // 4. Typing indicators
            socket.on("typing", ({ roomId, userName, isTyping }) => {
                socket.to(roomId).emit("user-typing", { userName, isTyping });
            });

            // 5. Kanban / Workspace Board Sync
            socket.on("kanban-task-change", ({ workspaceId }) => {
                // Broadcast to everyone in the workspace room to refresh their tasks
                socket.broadcast.emit("refresh-kanban-board", { workspaceId });
            });

            // 6. Handle Disconnection
            socket.on("disconnect", () => {
                console.log(`🔌 Socket disconnected: ${socket.id}`);
                const connectionData = activeConnections.get(socket.id);
                if (connectionData) {
                    const { roomId, user } = connectionData;
                    // Notify other users
                    socket.to(roomId).emit("user-disconnected", {
                        socketId: socket.id,
                        userId: user._id,
                        name: user.fullName
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