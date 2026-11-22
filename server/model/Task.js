const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
{
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ["todo", "in-progress", "done"],
        default: "todo"
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium"
    },
    assignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    meetingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meeting"
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace"
    },
    dueDate: {
        type: Date
    }
},
{
    timestamps: true
});

module.exports = mongoose.model("Task", taskSchema);
