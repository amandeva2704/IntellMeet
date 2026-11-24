const mongoose = require("mongoose");
const Meeting = require("../model/Meeting");
const Task = require("../model/Task");
const Workspace = require("../model/Workspace");

/**
 * Controller to provide real MongoDB aggregation-based analytics
 */
exports.getWorkspaceAnalytics = async (req, res) => {
    try {
        const workspaceId = req.params.workspaceId || req.query.workspaceId;
        let matchMeeting = {};
        let matchTask = {};

        if (workspaceId && workspaceId !== "all" && mongoose.Types.ObjectId.isValid(workspaceId)) {
            const wsOid = new mongoose.Types.ObjectId(workspaceId);
            matchMeeting = { workspaceId: wsOid };
            matchTask = { workspaceId: wsOid };
        } else {
            // Default to user-accessible meetings & tasks
            matchMeeting = {
                $or: [
                    { host: req.user._id },
                    { "participants.user": req.user._id }
                ]
            };
            matchTask = {
                $or: [
                    { creator: req.user._id },
                    { assignee: req.user._id }
                ]
            };
        }

        // 1. Total Meetings count
        const totalMeetings = await Meeting.countDocuments(matchMeeting);
        const completedMeetings = await Meeting.countDocuments({ ...matchMeeting, status: "completed" });

        // 2. Average Meeting Duration via MongoDB Aggregation
        const durationAggregation = await Meeting.aggregate([
            {
                $match: {
                    ...matchMeeting,
                    startTime: { $exists: true, $ne: null },
                    endTime: { $exists: true, $ne: null }
                }
            },
            {
                $project: {
                    durationMinutes: {
                        $max: [
                            1,
                            {
                                $round: [
                                    {
                                        $divide: [
                                            { $subtract: ["$endTime", "$startTime"] },
                                            60000
                                        ]
                                    },
                                    0
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgDuration: { $avg: "$durationMinutes" },
                    totalDuration: { $sum: "$durationMinutes" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const avgDurationMinutes = durationAggregation.length > 0 
            ? Math.round(durationAggregation[0].avgDuration) 
            : 0;

        // 3. Action Items and Transcript Statistics via Aggregation
        const actionAggregation = await Meeting.aggregate([
            { $match: matchMeeting },
            {
                $project: {
                    totalActions: { $size: { $ifNull: ["$actionItems", []] } },
                    convertedActions: {
                        $size: {
                            $filter: {
                                input: { $ifNull: ["$actionItems", []] },
                                as: "item",
                                cond: { $eq: ["$$item.status", "created"] }
                            }
                        }
                    },
                    transcriptCount: { $size: { $ifNull: ["$transcript", []] } }
                }
            },
            {
                $group: {
                    _id: null,
                    totalActionItems: { $sum: "$totalActions" },
                    convertedActionItems: { $sum: "$convertedActions" },
                    totalTranscripts: { $sum: "$transcriptCount" },
                    meetingsWithTranscripts: {
                        $sum: { $cond: [{ $gt: ["$transcriptCount", 0] }, 1, 0] }
                    }
                }
            }
        ]);

        const totalActionItems = actionAggregation[0]?.totalActionItems || 0;
        const convertedActionItems = actionAggregation[0]?.convertedActionItems || 0;
        const actionConversionRate = totalActionItems > 0 
            ? Math.round((convertedActionItems / totalActionItems) * 100) 
            : 0;
        const totalTranscripts = actionAggregation[0]?.totalTranscripts || 0;
        const meetingsWithTranscripts = actionAggregation[0]?.meetingsWithTranscripts || 0;

        // 4. Kanban Task Metrics via Aggregation
        const taskAggregation = await Task.aggregate([
            { $match: matchTask },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        let todoTasks = 0;
        let inProgressTasks = 0;
        let doneTasks = 0;

        for (const item of taskAggregation) {
            if (item._id === "todo") todoTasks = item.count;
            else if (item._id === "in-progress") inProgressTasks = item.count;
            else if (item._id === "done") doneTasks = item.count;
        }

        const totalTasks = todoTasks + inProgressTasks + doneTasks;
        const taskCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

        // 5. AI Collaboration Score Calculation
        const engagementRate = totalMeetings > 0 ? Math.round((meetingsWithTranscripts / totalMeetings) * 100) : 0;
        const rawScore = (totalMeetings === 0 && totalTasks === 0)
            ? 0
            : Math.round((taskCompletionRate * 0.40) + (actionConversionRate * 0.35) + (engagementRate * 0.25));
        const aiCollaborationScore = Math.min(100, Math.max(0, rawScore));

        // 6. Daily Meeting Volume Trend
        const dailyVolume = await Meeting.aggregate([
            { $match: matchMeeting },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $limit: 14 }
        ]);

        // 7. Recent Meetings & Transcripts Activity Log
        const recentMeetings = await Meeting.find(matchMeeting)
            .populate("host", "fullName email")
            .select("title roomId startTime endTime status participants actionItems transcript workspaceId")
            .sort({ startTime: -1 })
            .limit(10)
            .lean();

        const formattedRecentMeetings = recentMeetings.map(m => {
            let durationMinutes = 0;
            if (m.startTime && m.endTime) {
                durationMinutes = Math.max(1, Math.round((new Date(m.endTime) - new Date(m.startTime)) / 60000));
            }

            const latestTranscript = m.transcript && m.transcript.length > 0 
                ? m.transcript[m.transcript.length - 1] 
                : null;

            return {
                _id: m._id,
                roomId: m.roomId,
                title: m.title,
                startTime: m.startTime,
                endTime: m.endTime,
                durationMinutes,
                status: m.status,
                participantsCount: m.participants?.length || 1,
                actionItemsCount: m.actionItems?.length || 0,
                transcriptsCount: m.transcript?.length || 0,
                latestTranscript: latestTranscript ? {
                    sender: latestTranscript.sender,
                    text: latestTranscript.text,
                    timestamp: latestTranscript.timestamp
                } : null
            };
        });

        res.status(200).json({
            success: true,
            metrics: {
                totalMeetings,
                completedMeetings,
                avgDurationMinutes,
                totalTasks,
                todoTasks,
                inProgressTasks,
                completedTasks: doneTasks,
                taskCompletionRate,
                totalActionItems,
                convertedActionItems,
                actionConversionRate,
                totalTranscripts,
                meetingsWithTranscripts,
                engagementRate,
                aiCollaborationScore,
                dailyVolume,
                recentMeetings: formattedRecentMeetings
            }
        });
    } catch (err) {
        console.error("Analytics Aggregation Error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
