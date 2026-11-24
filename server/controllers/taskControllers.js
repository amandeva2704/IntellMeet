const Task = require("../model/Task");
const Meeting = require("../model/Meeting");
const User = require("../model/User");
const Workspace = require("../model/Workspace");

exports.createTask = async (req, res) => {
    try {
        const { title, description, status, priority, assigneeId, meetingId, workspaceId, dueDate } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Task title is required"
            });
        }

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: "Workspace ID is required for task creation"
            });
        }

        const taskData = {
            title: title.trim(),
            description: description ? description.trim() : "",
            status: ["todo", "in-progress", "done"].includes(status) ? status : "todo",
            priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
            creator: req.user._id,
            workspaceId,
            dueDate: dueDate || undefined
        };

        if (assigneeId) taskData.assignee = assigneeId;
        if (meetingId) taskData.meetingId = meetingId;

        const task = await Task.create(taskData);
        
        // Populate assignee and creator details
        const populatedTask = await Task.findById(task._id)
            .populate("assignee", "fullName email avatar")
            .populate("creator", "fullName email")
            .populate("meetingId", "title roomId");

        // Broadcast real-time update via Socket.IO
        try {
            const io = req.app.get("io");
            if (io && workspaceId) {
                io.to(`workspace-${workspaceId}`).emit("task-created", { task: populatedTask, workspaceId });
                io.to(`workspace-${workspaceId}`).emit("refresh-kanban-board", { workspaceId });
                io.to(`workspace-${workspaceId}`).emit("analytics-updated", { workspaceId });
                io.emit("refresh-kanban-board", { workspaceId });
            }
        } catch (sockErr) {
            console.warn("Socket broadcast error in createTask:", sockErr.message);
        }

        res.status(201).json({
            success: true,
            task: populatedTask
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getTasksByWorkspace = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const tasks = await Task.find({ workspaceId })
            .populate("assignee", "fullName email avatar")
            .populate("creator", "fullName email")
            .populate("meetingId", "title roomId")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            tasks
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getTasksByUser = async (req, res) => {
    try {
        const tasks = await Task.find({
            $or: [
                { assignee: req.user._id },
                { creator: req.user._id }
            ]
        })
        .populate("assignee", "fullName email avatar")
        .populate("creator", "fullName email")
        .populate("workspaceId", "name")
        .populate("meetingId", "title roomId")
        .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            tasks
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.updateTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { title, description, status, priority, assigneeId, dueDate, workspaceId } = req.body;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (title !== undefined) task.title = title.trim();
        if (description !== undefined) task.description = description.trim();
        if (status !== undefined && ["todo", "in-progress", "done"].includes(status)) {
            task.status = status;
        }
        if (priority !== undefined && ["low", "medium", "high"].includes(priority)) {
            task.priority = priority;
        }
        if (dueDate !== undefined) task.dueDate = dueDate || null;
        if (workspaceId !== undefined && workspaceId) task.workspaceId = workspaceId;
        
        if (assigneeId !== undefined) {
            task.assignee = assigneeId || null;
        }

        await task.save();

        const updatedTask = await Task.findById(taskId)
            .populate("assignee", "fullName email avatar")
            .populate("creator", "fullName email")
            .populate("meetingId", "title roomId");

        // Broadcast real-time update via Socket.IO
        try {
            const io = req.app.get("io");
            const wsId = updatedTask.workspaceId || task.workspaceId;
            if (io && wsId) {
                io.to(`workspace-${wsId}`).emit("task-updated", { task: updatedTask, workspaceId: wsId });
                if (status !== undefined) {
                    io.to(`workspace-${wsId}`).emit("task-status-changed", { taskId: task._id, status: updatedTask.status, workspaceId: wsId });
                }
                if (assigneeId !== undefined) {
                    io.to(`workspace-${wsId}`).emit("task-assigned", { taskId: task._id, assignee: updatedTask.assignee, workspaceId: wsId });
                }
                io.to(`workspace-${wsId}`).emit("refresh-kanban-board", { workspaceId: wsId });
                io.to(`workspace-${wsId}`).emit("analytics-updated", { workspaceId: wsId });
                io.emit("refresh-kanban-board", { workspaceId: wsId });
            }
        } catch (sockErr) {
            console.warn("Socket broadcast error in updateTask:", sockErr.message);
        }

        res.status(200).json({
            success: true,
            task: updatedTask
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.deleteTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await Task.findByIdAndDelete(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        // Broadcast real-time update via Socket.IO
        try {
            const io = req.app.get("io");
            if (io && task.workspaceId) {
                io.to(`workspace-${task.workspaceId}`).emit("task-deleted", { taskId: task._id, workspaceId: task.workspaceId });
                io.to(`workspace-${task.workspaceId}`).emit("refresh-kanban-board", { workspaceId: task.workspaceId });
                io.to(`workspace-${task.workspaceId}`).emit("analytics-updated", { workspaceId: task.workspaceId });
                io.emit("refresh-kanban-board", { workspaceId: task.workspaceId });
            }
        } catch (sockErr) {
            console.warn("Socket broadcast error in deleteTask:", sockErr.message);
        }

        res.status(200).json({
            success: true,
            message: "Task deleted successfully"
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.createTasksFromMeetingActionItems = async (req, res) => {
    try {
        const { meetingId, workspaceId, actionItems } = req.body;
        // actionItems: array of { title: String, description?: String, priority?: String, assigneeName?: String, actionItemId?: String }

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: "Workspace ID is required to import action items"
            });
        }

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        // Fetch workspace members for smart assignee matching
        let workspaceMembers = [];
        try {
            const ws = await Workspace.findById(workspaceId).populate("members", "fullName email avatar");
            if (ws && ws.members) workspaceMembers = ws.members;
        } catch (e) {}

        const createdTasks = [];

        for (const item of (actionItems || [])) {
            if (!item.title || !item.title.trim()) continue;

            // 1. Prevent duplicate task creation:
            // Check if action item in meeting is already marked created
            const meetingActionItem = item.actionItemId ? meeting.actionItems.id(item.actionItemId) : null;
            if (meetingActionItem && meetingActionItem.status === "created") {
                continue;
            }

            // Check if task with identical title from this meeting already exists in this workspace
            const existingTask = await Task.findOne({
                meetingId,
                workspaceId,
                title: item.title.trim()
            });

            if (existingTask) {
                if (meetingActionItem) {
                    meetingActionItem.status = "created";
                }
                continue;
            }

            // 2. Identify responsible user matching assigneeName
            let assignee = null;
            if (item.assigneeName && item.assigneeName.trim()) {
                const targetName = item.assigneeName.trim().toLowerCase();
                const matchedMember = workspaceMembers.find(m => {
                    const fullName = m.fullName.toLowerCase();
                    const firstName = fullName.split(" ")[0];
                    return fullName.includes(targetName) || targetName.includes(fullName) || firstName === targetName;
                });

                if (matchedMember) {
                    assignee = matchedMember._id;
                } else {
                    const matchedUser = await User.findOne({
                        fullName: { $regex: new RegExp(`^${item.assigneeName.trim()}`, "i") }
                    });
                    if (matchedUser) assignee = matchedUser._id;
                }
            }

            // Determine priority and description
            const priority = ["low", "medium", "high"].includes(item.priority?.toLowerCase())
                ? item.priority.toLowerCase()
                : (meetingActionItem?.priority || "medium");

            const description = item.description 
                || meetingActionItem?.description 
                || `Automatically created from meeting: "${meeting.title}"`;

            // 3. Create the Task permanently in MongoDB
            const task = await Task.create({
                title: item.title.trim(),
                description,
                status: "todo",
                priority,
                creator: req.user._id,
                assignee,
                meetingId,
                workspaceId
            });

            // 4. Mark action item status as "created" in meeting schema
            if (meetingActionItem) {
                meetingActionItem.status = "created";
            }

            const populated = await Task.findById(task._id)
                .populate("assignee", "fullName email avatar")
                .populate("creator", "fullName email")
                .populate("meetingId", "title roomId");

            createdTasks.push(populated);
        }

        // Save meeting with updated actionItems statuses
        await meeting.save();

        // Broadcast real-time update via Socket.IO
        try {
            const io = req.app.get("io");
            if (io && workspaceId) {
                io.to(`workspace-${workspaceId}`).emit("task-created-batch", { tasks: createdTasks, workspaceId });
                io.to(`workspace-${workspaceId}`).emit("refresh-kanban-board", { workspaceId });
                io.to(`workspace-${workspaceId}`).emit("analytics-updated", { workspaceId });
                io.emit("refresh-kanban-board", { workspaceId });
            }
        } catch (sockErr) {
            console.warn("Socket broadcast error in createTasksFromMeetingActionItems:", sockErr.message);
        }

        res.status(201).json({
            success: true,
            createdCount: createdTasks.length,
            tasks: createdTasks,
            meeting
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
