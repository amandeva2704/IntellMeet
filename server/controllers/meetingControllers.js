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
        if (!title) {
            return res.status(400).json({
                success: false,
                message: "Meeting title is required"
            });
        }

        const roomId = generateRoomId();
        const meeting = await Meeting.create({
            roomId,
            title,
            host: req.user._id,
            participants: [{ user: req.user._id, name: req.user.fullName }]
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

        // If meeting was previously completed, reactivate it so participants can rejoin
        if (meeting.status === "completed") {
            meeting.status = "active";
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
        const { sender, text } = req.body;

        const meeting = await findMeetingByRoomId(roomId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        meeting.transcript.push({ sender, text, timestamp: new Date() });
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
            return res.status(400).json({
                success: false,
                message: "Meeting has already been ended"
            });
        }

        meeting.status = "completed";
        meeting.endTime = new Date();

        // Process AI intelligence (transcripts/summary/action items)
        const transcriptText = meeting.transcript
            .map(t => `${t.sender}: ${t.text}`)
            .join("\n");

        const aiResult = await aiService.generateSummaryAndActionItems(transcriptText, meeting.title);
        meeting.summary = aiResult.summary;
        meeting.actionItems = aiResult.actionItems.map(item => ({
            title: item.title,
            assigneeName: item.assigneeName || "",
            status: "pending"
        }));

        await meeting.save();

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
