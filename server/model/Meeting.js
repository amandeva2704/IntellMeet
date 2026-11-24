const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
{
    roomId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace"
    },
    participants: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            name: String,
            joinedAt: {
                type: Date,
                default: Date.now
            },
            leftAt: {
                type: Date
            }
        }
    ],
    status: {
        type: String,
        enum: ["active", "completed"],
        default: "active"
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    transcript: [
        {
            sender: {
                type: String,
                required: true
            },
            senderUser: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            text: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }
    ],
    chats: [
        {
            sender: {
                type: String,
                required: true
            },
            senderUser: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            text: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }
    ],
    summary: {
        type: String,
        default: ""
    },
    notes: {
        type: String,
        default: ""
    },
    actionItems: [
        {
            title: {
                type: String,
                required: true
            },
            description: {
                type: String,
                default: ""
            },
            priority: {
                type: String,
                enum: ["low", "medium", "high"],
                default: "medium"
            },
            assigneeName: {
                type: String,
                default: ""
            },
            status: {
                type: String,
                enum: ["pending", "created"],
                default: "pending"
            }
        }
    ]
},
{
    timestamps: true
});

module.exports = mongoose.model("Meeting", meetingSchema);
