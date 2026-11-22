const express = require("express");
const router = express.Router();
const taskControllers = require("../controllers/taskControllers");
const protect = require("../midlleware/authMiddleware");

router.post("/", protect, taskControllers.createTask);
router.get("/workspace/:workspaceId", protect, taskControllers.getTasksByWorkspace);
router.get("/user", protect, taskControllers.getTasksByUser);
router.put("/:taskId", protect, taskControllers.updateTask);
router.delete("/:taskId", protect, taskControllers.deleteTask);
router.post("/action-items", protect, taskControllers.createTasksFromMeetingActionItems);

module.exports = router;
