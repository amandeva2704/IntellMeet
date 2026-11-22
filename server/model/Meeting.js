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
    actionItems: [
        {
            title: {
                type: String,
                required: true
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
