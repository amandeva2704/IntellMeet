const Task = require("../model/Task");
const Meeting = require("../model/Meeting");
const User = require("../model/User");

exports.createTask = async (req, res) => {
    try {
        const { title, description, status, priority, assigneeId, meetingId, workspaceId, dueDate } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: "Task title is required"
            });
        }

        const taskData = {
            title,
            description,
            status: status || "todo",
            priority: priority || "medium",
            creator: req.user._id,
            dueDate
        };

        if (assigneeId) taskData.assignee = assigneeId;
        if (meetingId) taskData.meetingId = meetingId;
        if (workspaceId) taskData.workspaceId = workspaceId;

        const task = await Task.create(taskData);
        
        // Populate assignee details if they exist
        const populatedTask = await Task.findById(task._id)
            .populate("assignee", "fullName email avatar")
            .populate("creator", "fullName email");

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
        const { title, description, status, priority, assigneeId, dueDate } = req.body;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (title !== undefined) task.title = title;
        if (description !== undefined) task.description = description;
        if (status !== undefined) task.status = status;
        if (priority !== undefined) task.priority = priority;
        if (dueDate !== undefined) task.dueDate = dueDate;
        
        if (assigneeId !== undefined) {
            task.assignee = assigneeId || null;
        }

        await task.save();

        const updatedTask = await Task.findById(taskId)
            .populate("assignee", "fullName email avatar")
            .populate("creator", "fullName email")
            .populate("meetingId", "title roomId");

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
        // actionItems: array of { title: String, assigneeName: String, actionItemId: String }

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found"
            });
        }

        const createdTasks = [];

        for (const item of actionItems) {
            // Attempt to find a user in the workspace/system matching assigneeName
            let assignee = null;
            if (item.assigneeName) {
                const matchedUser = await User.findOne({
                    fullName: { $regex: new RegExp(item.assigneeName, "i") }
                });
                if (matchedUser) {
                    assignee = matchedUser._id;
                }
            }

            const task = await Task.create({
                title: item.title,
                description: `Automatically created from meeting: "${meeting.title}"`,
                status: "todo",
                priority: "medium",
                creator: req.user._id,
                assignee,
                meetingId,
                workspaceId
            });

            // Mark this action item as created in the meeting schema
            const meetingActionItem = meeting.actionItems.id(item.actionItemId);
            if (meetingActionItem) {
                meetingActionItem.status = "created";
            }

            createdTasks.push(task);
        }

        await meeting.save();

        res.status(201).json({
            success: true,
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
