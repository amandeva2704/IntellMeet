import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store/store";
import { socket } from "../services/socket";
import { 
    TrendingUp, ArrowLeft, Calendar, Clock, 
    Award, PieChart, BarChart2, Activity, Target,
    Users, Mic, ExternalLink, Kanban,
    Sparkles, RefreshCw
} from "lucide-react";

export default function Analytics() {
    const { 
        workspaces, activeWorkspace, selectWorkspace, fetchWorkspaces,
        analyticsData, analyticsLoading, fetchAnalytics
    } = useStore();

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    useEffect(() => {
        fetchAnalytics(activeWorkspace?._id);

        // Real-time synchronization for analytics
        socket.connect();
        if (activeWorkspace?._id) {
            socket.emit("join-workspace", { workspaceId: activeWorkspace._id });
        }

        const handleAnalyticsSync = () => {
            fetchAnalytics(activeWorkspace?._id);
        };

        socket.on("analytics-updated", handleAnalyticsSync);
        socket.on("refresh-kanban-board", handleAnalyticsSync);
        socket.on("meeting-ended-sync", handleAnalyticsSync);

        return () => {
            socket.off("analytics-updated", handleAnalyticsSync);
            socket.off("refresh-kanban-board", handleAnalyticsSync);
            socket.off("meeting-ended-sync", handleAnalyticsSync);
        };
    }, [activeWorkspace, fetchAnalytics]);

    const m = analyticsData || {
        totalMeetings: 0,
        completedMeetings: 0,
        avgDurationMinutes: 0,
        totalTasks: 0,
        todoTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
        taskCompletionRate: 0,
        totalActionItems: 0,
        convertedActionItems: 0,
        actionConversionRate: 0,
        totalTranscripts: 0,
        meetingsWithTranscripts: 0,
        engagementRate: 0,
        aiCollaborationScore: 0,
        dailyVolume: [],
        recentMeetings: []
    };

    const todoRate = m.totalTasks > 0 ? Math.round((m.todoTasks / m.totalTasks) * 100) : 0;
    const inProgressRate = m.totalTasks > 0 ? Math.round((m.inProgressTasks / m.totalTasks) * 100) : 0;

    return (
        <div className="min-h-screen bg-[#08090c] text-white flex flex-col md:flex-row relative">
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none"></div>

            {/* Sidebar Navigation */}
            <aside className="w-full md:w-72 border-r border-white/5 bg-[#0a0b0f] flex flex-col shrink-0">
                <div className="h-16 border-b border-white/5 flex items-center gap-2.5 px-6">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/20">
                        <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-lg bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                        IntellMeet
                    </span>
                </div>

                <div className="p-4 border-b border-white/5 text-xs flex items-center justify-between">
                    <Link to="/dashboard" className="text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
                    </Link>
                    <Link to="/project-board" className="text-violet-400 hover:text-violet-300 transition-colors">
                        Kanban Board →
                    </Link>
                </div>

                <div className="p-4 flex-1 space-y-6 overflow-y-auto">
                    {/* Workspace Selector */}
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Target Workspace</span>
                        <select
                            value={activeWorkspace?._id || ""}
                            onChange={(e) => {
                                const found = workspaces.find((w) => w._id === e.target.value);
                                if (found) selectWorkspace(found);
                            }}
                            className="w-full text-xs px-3 py-2.5 rounded-xl glass-input bg-[#14151f] text-white border border-white/10"
                        >
                            {workspaces.map((ws) => (
                                <option key={ws._id} value={ws._id}>
                                    {ws.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                            Real-time platform metrics dynamically aggregated from MongoDB records for the selected workspace.
                        </p>
                    </div>

                    {/* Score Formula Insight */}
                    <div className="bg-gradient-to-br from-violet-950/30 to-indigo-950/20 border border-violet-500/20 p-4 rounded-2xl space-y-2">
                        <span className="text-[10px] uppercase font-bold text-violet-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> MongoDB Metrics Calculation
                        </span>
                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                            Live weighted productivity score derived from MongoDB aggregation:
                        </p>
                        <ul className="text-[10px] text-neutral-300 space-y-1 list-disc pl-3">
                            <li>40% Kanban Delivery Rate ({m.taskCompletionRate}%)</li>
                            <li>35% Action Item Conversion ({m.actionConversionRate}%)</li>
                            <li>25% Meeting Engagement ({m.engagementRate}%)</li>
                        </ul>
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:px-10">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
                                Analytics & Productivity Insights
                            </h1>
                            <p className="text-neutral-400 text-xs sm:text-sm">
                                Platform diagnostics for workspace: <strong className="text-violet-400 font-bold">{activeWorkspace?.name || "All Workspaces"}</strong>
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchAnalytics(activeWorkspace?._id)}
                                disabled={analyticsLoading}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                                title="Refresh metrics"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? "animate-spin text-violet-400" : ""}`} />
                                Refresh
                            </button>
                            <Link
                                to="/project-board"
                                className="bg-violet-600/10 border border-violet-500/20 hover:bg-violet-600/20 text-violet-300 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                            >
                                <Kanban className="w-3.5 h-3.5" /> Project Board
                            </Link>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        
                        {/* Stat 1: Total Meetings */}
                        <div className="glass-panel rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[125px]">
                            <div className="flex justify-between items-start">
                                <span className="text-xs text-neutral-400 font-medium">Total Meetings</span>
                                <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center text-violet-400 border border-violet-500/20">
                                    <Calendar className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mt-2 text-white">{m.totalMeetings}</h3>
                                <span className="text-[10px] text-neutral-500 block mt-1">
                                    {m.completedMeetings} completed session(s)
                                </span>
                            </div>
                        </div>

                        {/* Stat 2: Avg Duration */}
                        <div className="glass-panel rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[125px]">
                            <div className="flex justify-between items-start">
                                <span className="text-xs text-neutral-400 font-medium">Average Duration</span>
                                <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                                    <Clock className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mt-2 text-white">{m.avgDurationMinutes} min</h3>
                                <span className="text-[10px] text-neutral-500 block mt-1">Calculated from start & end timestamps</span>
                            </div>
                        </div>

                        {/* Stat 3: Task Completion */}
                        <div className="glass-panel rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[125px]">
                            <div className="flex justify-between items-start">
                                <span className="text-xs text-neutral-400 font-medium">Task Completion</span>
                                <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                    <Award className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mt-2 text-white text-glow">{m.taskCompletionRate}%</h3>
                                <span className="text-[10px] text-neutral-500 block mt-1">
                                    {m.completedTasks}/{m.totalTasks} Kanban cards done
                                </span>
                            </div>
                        </div>

                        {/* Stat 4: Action Mapping Rate */}
                        <div className="glass-panel rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[125px]">
                            <div className="flex justify-between items-start">
                                <span className="text-xs text-neutral-400 font-medium">Action Mapping Rate</span>
                                <div className="w-8 h-8 rounded-lg bg-fuchsia-600/10 flex items-center justify-center text-fuchsia-400 border border-fuchsia-500/20">
                                    <Target className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mt-2 text-white">{m.actionConversionRate}%</h3>
                                <span className="text-[10px] text-neutral-500 block mt-1">
                                    {m.convertedActionItems}/{m.totalActionItems} action items converted
                                </span>
                            </div>
                        </div>

                    </div>

                    {/* Chart Layout Blocks */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                        
                        {/* Task Progression distribution */}
                        <div className="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between space-y-6">
                            <div>
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-sm flex items-center gap-2">
                                        <PieChart className="w-4 h-4 text-violet-400" /> Kanban Task Distribution
                                    </h3>
                                    <span className="text-[10px] text-neutral-400">Total: {m.totalTasks} tasks</span>
                                </div>
                                <p className="text-[10px] text-neutral-400 mt-1">Dynamic status ratio for current workspace tasks</p>
                            </div>

                            {m.totalTasks === 0 ? (
                                <div className="text-center py-12 text-neutral-500 text-xs italic">
                                    No tasks in this workspace. Create tasks or import meeting action items to view distribution.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Multi-segment Progress Bar */}
                                    <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden flex shadow-inner">
                                        <div 
                                            style={{ width: `${todoRate}%` }} 
                                            className="bg-indigo-500 hover:opacity-90 transition-all" 
                                            title={`To Do: ${m.todoTasks} (${todoRate}%)`}
                                        ></div>
                                        <div 
                                            style={{ width: `${inProgressRate}%` }} 
                                            className="bg-amber-500 hover:opacity-90 transition-all" 
                                            title={`In Progress: ${m.inProgressTasks} (${inProgressRate}%)`}
                                        ></div>
                                        <div 
                                            style={{ width: `${m.taskCompletionRate}%` }} 
                                            className="bg-emerald-500 hover:opacity-90 transition-all" 
                                            title={`Done: ${m.completedTasks} (${m.taskCompletionRate}%)`}
                                        ></div>
                                    </div>

                                    {/* Breakdown Details */}
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl">
                                            <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block mr-1.5"></span>
                                            <span className="text-[11px] text-neutral-300 font-semibold block">To Do</span>
                                            <span className="text-base font-bold text-indigo-300 block mt-1">{m.todoTasks}</span>
                                            <span className="text-[9px] text-neutral-500">{todoRate}%</span>
                                        </div>

                                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block mr-1.5"></span>
                                            <span className="text-[11px] text-neutral-300 font-semibold block">In Progress</span>
                                            <span className="text-base font-bold text-amber-300 block mt-1">{m.inProgressTasks}</span>
                                            <span className="text-[9px] text-neutral-500">{inProgressRate}%</span>
                                        </div>

                                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block mr-1.5"></span>
                                            <span className="text-[11px] text-neutral-300 font-semibold block">Done</span>
                                            <span className="text-base font-bold text-emerald-300 block mt-1">{m.completedTasks}</span>
                                            <span className="text-[9px] text-neutral-500">{m.taskCompletionRate}%</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Meeting productivity score block */}
                        <div className="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between space-y-6">
                            <div>
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-sm flex items-center gap-2">
                                        <BarChart2 className="w-4 h-4 text-fuchsia-400" /> AI Collaboration Score
                                    </h3>
                                    <span className="text-xs font-extrabold text-violet-400 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                                        {m.aiCollaborationScore}% Overall
                                    </span>
                                </div>
                                <p className="text-[10px] text-neutral-400 mt-1">Calculated directly from MongoDB aggregation records</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-neutral-300">
                                        <span>Kanban Delivery Rate (40%)</span>
                                        <strong className="text-emerald-400">{m.taskCompletionRate}%</strong>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-500" 
                                            style={{ width: `${m.taskCompletionRate}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-neutral-300">
                                        <span>Action Conversion Rate (35%)</span>
                                        <strong className="text-fuchsia-400">{m.actionConversionRate}%</strong>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-fuchsia-600 to-pink-500 rounded-full transition-all duration-500" 
                                            style={{ width: `${m.actionConversionRate}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-neutral-300">
                                        <span>Meeting Transcript Engagement (25%)</span>
                                        <strong className="text-indigo-400">{m.engagementRate}%</strong>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-500" 
                                            style={{ width: `${m.engagementRate}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Daily Meeting Volume from MongoDB */}
                    {m.dailyVolume && m.dailyVolume.length > 0 && (
                        <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-sm flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-violet-400" /> Daily Meeting Volume Trend
                                </h3>
                                <span className="text-[10px] text-neutral-400">Past 14 active days</span>
                            </div>

                            <div className="h-24 flex items-end gap-2 pt-4">
                                {m.dailyVolume.map((item, idx) => {
                                    const maxCount = Math.max(...m.dailyVolume.map(v => v.count), 1);
                                    const heightPct = Math.max(15, Math.round((item.count / maxCount) * 100));

                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer">
                                            <div className="w-full bg-[#12131a] hover:bg-violet-950/40 rounded-lg flex items-end h-16 border border-white/5 relative">
                                                <div 
                                                    className="w-full bg-gradient-to-t from-violet-600 to-indigo-600 rounded-lg transition-all duration-300"
                                                    style={{ height: `${heightPct}%` }}
                                                ></div>
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-[9px] px-1.5 py-0.5 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {item.count} session(s)
                                                </div>
                                            </div>
                                            <span className="text-[9px] text-neutral-500 font-mono truncate max-w-full">
                                                {item._id.split("-").slice(1).join("/")}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Meeting Volume & Transcript Activity Log */}
                    <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-violet-400" />
                                <h3 className="font-bold text-sm">Meeting Volume & Transcript Activity Log</h3>
                            </div>
                            <span className="text-[11px] text-neutral-400">
                                Showing {m.recentMeetings.length} recorded session(s)
                            </span>
                        </div>

                        {m.recentMeetings.length === 0 ? (
                            <div className="text-center py-12 text-neutral-500 text-xs italic">
                                No meetings recorded in this workspace yet. Start a meeting to log voice transcripts and action items.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {m.recentMeetings.map((meet: any) => (
                                    <div 
                                        key={meet._id}
                                        className="bg-[#101117] hover:bg-[#141520] border border-white/5 hover:border-violet-500/20 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                                    >
                                        <div className="space-y-1.5 flex-1">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <h4 className="font-bold text-xs text-white">
                                                    {meet.title}
                                                </h4>
                                                <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3 text-neutral-500" />
                                                    {new Date(meet.startTime).toLocaleDateString()} at {new Date(meet.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-neutral-500" />
                                                    {meet.durationMinutes} min
                                                </span>
                                            </div>

                                            {/* Transcript Activity Preview */}
                                            {meet.latestTranscript ? (
                                                <div className="text-[11px] bg-white/[0.02] border border-white/5 p-2 rounded-xl flex items-center gap-2 text-neutral-300">
                                                    <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
                                                    <span className="text-violet-400 font-bold shrink-0">{meet.latestTranscript.sender}:</span>
                                                    <span className="truncate italic text-neutral-400 font-mono text-[10px]">
                                                        "{meet.latestTranscript.text}"
                                                    </span>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-neutral-500 italic">
                                                    No spoken transcripts recorded
                                                </p>
                                            )}
                                        </div>

                                        {/* Participants & Summary button */}
                                        <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                                            <div className="flex items-center gap-2 text-neutral-400 text-xs">
                                                <Users className="w-3.5 h-3.5" />
                                                <span className="text-[11px]">{meet.participantsCount} participant(s)</span>
                                            </div>

                                            <div className="flex items-center gap-1 text-[11px] text-violet-300 bg-violet-600/10 border border-violet-500/20 px-2 py-0.5 rounded-lg">
                                                <span>{meet.actionItemsCount} Actions</span>
                                            </div>

                                            <Link
                                                to={`/meeting/${meet.roomId}/summary`}
                                                className="bg-white/5 hover:bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition-all"
                                            >
                                                Summary <ExternalLink className="w-3 h-3" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
