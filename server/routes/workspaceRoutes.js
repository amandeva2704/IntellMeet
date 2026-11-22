const express = require("express");
const router = express.Router();
const workspaceControllers = require("../controllers/workspaceControllers");
const protect = require("../midlleware/authMiddleware");

router.post("/", protect, workspaceControllers.createWorkspace);
router.get("/", protect, workspaceControllers.getWorkspaces);
router.get("/:workspaceId", protect, workspaceControllers.getWorkspaceDetails);
router.post("/:workspaceId/invite", protect, workspaceControllers.inviteMember);

module.exports = router;
