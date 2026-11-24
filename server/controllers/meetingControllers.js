const Meeting = require("../model/Meeting");
const { v4: uuidv4 } = require("uuid");
const aiService = require("../config/aiService");

// Generate unique meeting room ID (format: xxx-xxx-xxx)
const generateRoomId = () => {
    const uuid = uuidv4().replace(/-/g, "");
    return `${uuid.substring(0, 3)}-${uuid.substring(3, 6)}-${uuid.substring(6, 9)}`;
};

// Normalize any room ID from user input (handles full URLs, uppercase, spaces, missing hyphens)
const normalizeRoomId = (id) => {
    if (!id) return "";
    let clean = String(id).trim();
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

// Robust meeting lookup that handles with/without hyphens, uppercase/lowercase, and extra whitespace
const findMeetingByRoomId = async (rawRoomId) => {
    if (!rawRoomId) return null;
    const cleanId = normalizeRoomId(rawRoomId);
    const alphanumeric = cleanId.replace(/[^a-z0-9]/g, "");

    // 1. Direct match on cleanId or raw input
    let meeting = await Meeting.findOne({
        $or: [
            { roomId: cleanId },
            { roomId: String(rawRoomId).trim() },
            { roomId: String(rawRoomId).trim().toLowerCase() }
        ]
    });
    if (meeting) return meeting;

    // 2. Format-agnostic regex match for 9-char codes
    if (alphanumeric.length === 9) {
        const regexPattern = `^${alphanumeric.substring(0, 3)}[- ]?${alphanumeric.substring(3, 6)}[- ]?${alphanumeric.substring(6, 9)}$`;
        meeting = await Meeting.findOne({
            roomId: { $regex: new RegExp(regexPattern, "i") }
        });
        if (meeting) return meeting;
    }

    // 3. Fallback case-insensitive exact regex
    return await Meeting.findOne({
        roomId: { $regex: new RegExp(`^${cleanId}$`, "i") }
    });
};

exports.createMeeting = async (req, res) => {
    try {
        const { title } = req.body;
        const finalTitle = (title && String(title).trim())
            ? String(title).trim()
            : `${req.user?.fullName || "Instant"}'s Meeting`;

        const roomId = generateRoomId();
        const meeting = await Meeting.create({
            roomId,
            title: finalTitle,
            host: req.user._id,
            participants: [{ user: req.user._id, name: req.user?.fullName || "Host" }]
        });

        res.status(201).json({
            success: true,
            meeting
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.joinMeeting = async (req, res) => {
    try {
        const { roomId } = req.params;
        const meeting = await findMeetingByRoomId(roomId);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting room not found. Please check the Meeting ID or invite link."
            });
        }

        // If meeting was previously completed, return completion status without reactivating
        if (meeting.status === "completed") {
            return res.status(200).json({
                success: true,
                isCompleted: true,
                message: "This meeting has already ended",
                meeting
            });
        }

        // Add user to participants if not already added
        const exists = meeting.participants.some(
            p => p.user && p.user.toString() === req.user._id.toString()
        );

        if (!exists) {
            meeting.participants.push({
                user: req.user._id,
                name: req.user.fullName
            });
        }

        await meeting.save();

        res.status(200).json({
            success: true,
            meeting
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getMeetingHistory = async (req, res) => {
    try {
        const meetings = await Meeting.find({
            $or: [
                { host: req.user._id },
                { "participants.user": req.user._id }
            ]
        })
        .populate("host", "fullName email")
        .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            meetings
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getMeetingDetails = async (req, res) => {
    try {
        const { roomId } = req.params;
        const meeting = await findMeetingByRoomId(roomId);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        // Populate host and participants
        await meeting.populate("host", "fullName email");
        await meeting.populate("participants.user", "fullName email avatar");

        res.status(200).json({
            success: true,
            meeting
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.updateMeetingTranscript = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { sender, text, timestamp } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: "Transcript text cannot be empty"
            });
        }

        const meeting = await findMeetingByRoomId(roomId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        const transcriptEntry = {
            sender: sender || req.user?.fullName || "Speaker",
            senderUser: req.user?._id,
            text: text.trim(),
            timestamp: timestamp ? new Date(timestamp) : new Date()
        };

        if (!meeting.transcript) meeting.transcript = [];
        meeting.transcript.push(transcriptEntry);
        await meeting.save();

        res.status(200).json({
            success: true,
            transcript: transcriptEntry,
            transcriptCount: meeting.transcript.length,
            meeting
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.addMeetingChat = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { sender, text, timestamp } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message text cannot be empty"
            });
        }

        const meeting = await findMeetingByRoomId(roomId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        const chatEntry = {
            sender: sender || req.user?.fullName || "Participant",
            senderUser: req.user?._id,
            text: text.trim(),
            timestamp: timestamp ? new Date(timestamp) : new Date()
        };

        if (!meeting.chats) meeting.chats = [];
        meeting.chats.push(chatEntry);
        await meeting.save();

        res.status(200).json({
            success: true,
            chat: chatEntry,
            chatsCount: meeting.chats.length,
            meeting
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.endMeeting = async (req, res) => {
    try {
        const { roomId } = req.params;
        const meeting = await findMeetingByRoomId(roomId);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        if (meeting.status === "completed") {
            return res.status(200).json({
                success: true,
                message: "Meeting has already been ended",
                meeting
            });
        }

        // Merge any final in-memory transcripts, chats, and notes sent from client
        const { finalTranscripts, finalChats, notes } = req.body || {};

        if (notes && typeof notes === "string") {
            meeting.notes = notes;
        }

        if (Array.isArray(finalTranscripts) && finalTranscripts.length > 0) {
            if (!meeting.transcript) meeting.transcript = [];
            for (const ft of finalTranscripts) {
                if (ft.text && !meeting.transcript.some(t => t.sender === ft.sender && t.text === ft.text)) {
                    meeting.transcript.push({
                        sender: ft.sender || "Speaker",
                        text: ft.text,
                        timestamp: ft.timestamp ? new Date(ft.timestamp) : new Date()
                    });
                }
            }
        }

        if (Array.isArray(finalChats) && finalChats.length > 0) {
            if (!meeting.chats) meeting.chats = [];
            for (const fc of finalChats) {
                if (fc.text && !meeting.chats.some(c => c.sender === fc.sender && c.text === fc.text)) {
                    meeting.chats.push({
                        sender: fc.sender || "Participant",
                        text: fc.text,
                        timestamp: fc.timestamp ? new Date(fc.timestamp) : new Date()
                    });
                }
            }
        }

        meeting.status = "completed";
        meeting.endTime = new Date();

        // Process AI intelligence (combine spoken voice transcripts, plus chats & notes)
        let conversationText = (meeting.transcript || [])
            .map(t => `${t.sender} (Voice): ${t.text}`)
            .join("\n");

        if (meeting.chats && meeting.chats.length > 0) {
            const chatLog = meeting.chats
                .map(c => `${c.sender} (Chat): ${c.text}`)
                .join("\n");
            conversationText = conversationText 
                ? `${conversationText}\n\n[Meeting Room Chats]:\n${chatLog}`
                : `[Meeting Room Chats]:\n${chatLog}`;
        }

        if (meeting.notes && meeting.notes.trim()) {
            conversationText = `${conversationText}\n\n[Meeting Notes]:\n${meeting.notes.trim()}`;
        }

        const aiResult = await aiService.generateSummaryAndActionItems(conversationText, meeting.title);
        meeting.summary = aiResult.summary;
        meeting.actionItems = (aiResult.actionItems || []).map(item => ({
            title: item.title,
            assigneeName: item.assigneeName || "",
            status: "pending"
        }));

        await meeting.save();

        // Broadcast meeting-ended notification to all connected participants via socket.io
        try {
            const io = req.app.get("io");
            if (io) {
                const cleanRoomId = normalizeRoomId(roomId);
                io.to(cleanRoomId).emit("meeting-ended", {
                    roomId: cleanRoomId,
                    message: "The host has ended this meeting."
                });
            }
        } catch (sockErr) {
            console.warn("Socket broadcast error on meeting end:", sockErr.message);
        }

        res.status(200).json({
            success: true,
            message: "Meeting ended and AI analysis completed",
            meeting
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.leaveMeeting = async (req, res) => {
    try {
        const { roomId } = req.params;
        const meeting = await findMeetingByRoomId(roomId);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        // Record leftAt timestamp for the leaving user
        if (req.user) {
            const participant = meeting.participants.find(
                p => p.user && p.user.toString() === req.user._id.toString()
            );
            if (participant) {
                participant.leftAt = new Date();
                await meeting.save();
            }
        }

        res.status(200).json({
            success: true,
            message: "Left meeting successfully"
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.findMeetingByRoomId = findMeetingByRoomId;
exports.normalizeRoomId = normalizeRoomId;
