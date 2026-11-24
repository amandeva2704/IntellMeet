const express = require("express");
const router = express.Router();
const multer = require("multer");
const meetingControllers = require("../controllers/meetingControllers");
const protect = require("../midlleware/authMiddleware");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB chunk max
});

router.post("/", protect, meetingControllers.createMeeting);
router.get("/", protect, meetingControllers.getMeetingHistory);
router.get("/history", protect, meetingControllers.getMeetingHistory);
router.get("/:roomId", protect, meetingControllers.getMeetingDetails);
router.post("/:roomId/join", protect, meetingControllers.joinMeeting);
router.post("/:roomId/whisper-transcribe", protect, upload.single("audio"), meetingControllers.whisperTranscribeAudioChunk);
router.put("/:roomId/transcript", protect, meetingControllers.updateMeetingTranscript);
router.post("/:roomId/transcript", protect, meetingControllers.updateMeetingTranscript);
router.post("/:roomId/chat", protect, meetingControllers.addMeetingChat);
router.put("/:roomId/chat", protect, meetingControllers.addMeetingChat);
router.post("/:roomId/leave", protect, meetingControllers.leaveMeeting);
router.post("/:roomId/end", protect, meetingControllers.endMeeting);

module.exports = router;
