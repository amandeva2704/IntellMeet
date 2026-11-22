const express = require("express");
const router = express.Router();
const meetingControllers = require("../controllers/meetingControllers");
const protect = require("../midlleware/authMiddleware");

router.post("/", protect, meetingControllers.createMeeting);
router.get("/history", protect, meetingControllers.getMeetingHistory);
router.get("/:roomId", protect, meetingControllers.getMeetingDetails);
router.post("/:roomId/join", protect, meetingControllers.joinMeeting);
router.put("/:roomId/transcript", protect, meetingControllers.updateMeetingTranscript);
router.post("/:roomId/end", protect, meetingControllers.endMeeting);

module.exports = router;
