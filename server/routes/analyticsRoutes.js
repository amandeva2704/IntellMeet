const express = require("express");
const router = express.Router();
const analyticsControllers = require("../controllers/analyticsControllers");
const protect = require("../midlleware/authMiddleware");

// Routes for workspace and overall analytics
router.get("/", protect, analyticsControllers.getWorkspaceAnalytics);
router.get("/workspace/:workspaceId", protect, analyticsControllers.getWorkspaceAnalytics);

module.exports = router;
