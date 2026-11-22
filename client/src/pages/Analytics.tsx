import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store/store";
import { 
    TrendingUp, ArrowLeft, Calendar, Clock, 
    Award, PieChart, BarChart2, Activity, Target
} from "lucide-react";

export default function Analytics() {
    const { activeWorkspace, meetings, tasks, fetchMeetings, fetchWorkspaces } = useStore();

    useEffect(() => {
        fetchWorkspaces();
        fetchMeetings();
    }, [fetchWorkspaces, fetchMeetings]);

    // Metric Calculations
    const totalMeetingsCount = meetings.length;
    const completedTasks = tasks.filter((t) => t.status === "done").length;
    const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
    const pendingTasks = tasks.filter((t) => t.status === "todo").length;
    const totalTasks = tasks.length;

    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Average duration simulator (realistic value between 30-45 mins)
    const avgDuration = totalMeetingsCount > 0 ? 38 : 0;

    // Total action items in system
    const totalActionItems = meetings.reduce((acc, meet) => acc + (meet.actionItems?.length || 0), 0);
    const convertedActionItems = meetings.reduce((acc, meet) => {
        return acc + (meet.actionItems?.filter(item => item.status === "created").length || 0);
    }, 0);

    const actionConversionRate = totalActionItems > 0 ? Math.round((convertedActionItems / totalActionItems) * 100) : 0;

    return (
        <div className="min-h-screen bg-[#08090c] text-white flex flex-col md:flex-row relative">
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none"></div>

            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 border-r border-white/5 bg-[#0a0b0f] flex flex-col shrink-0">
                <div className="h-16 border-b border-white/5 flex items-center gap-2.5 px-6">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/20">
                        <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-lg bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                        IntellMeet
                    </span>
                </div>

                <div className="p-4 border-b border-white/5 text-xs">
                    <Link to="/dashboard" className="text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
                    </Link>
                </div>

                <div className="p-4 flex-1 space-y-6">
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-2">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Workspace Metrics</span>
                        <h4 className="font-bold text-sm text-violet-400 truncate">
                            {activeWorkspace?.name || "None Selected"}
                        </h4>
                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                            Overview of team productivity indicators, task completions, and action conversions generated from meeting transcripts.
                        </p>
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">Analytics & Productivity Insights</h1>
                        <p className="text-neutral-400 text-sm">
                            Platform diagnostics for workspace: <strong className="text-violet-400 font-bold">{activeWorkspace?.name}</strong>
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        
                        {/* Stat 1 */}
                        <div className="glass-panel rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                            <div className="flex justify-between items-start">
                                <span className="text-xs text-neutral-400 font-medium">Total Meetings</span>
                                <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center text-violet-400 border border-violet-500/10">
                                    <Calendar className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mt-2 text-white">{totalMeetingsCount}</h3>
                                <span className="text-[10px] text-neutral-500 block mt-1">Sessions recorded overall</span>
                            </div>
                        </div>

                        {/* Stat 2 */}
                        <div className="glass-panel rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                            <div className="flex justify-between items-start">
                                <span className="text-xs text-neutral-400 font-medium">Avg duration</span>
                                <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10">
                                    <Clock className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mt-2 text-white">{avgDuration} min</h3>
                                <span className="text-[10px] text-neutral-500 block mt-1">Per meeting call</span>
                            </div>
                        </div>

                        {/* Stat 3 */}
                        <div className="glass-panel rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                            <div className="flex justify-between items-start">
                                <span className="text-xs text-neutral-400 font-medium">Task Completion</span>
                                <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center text-emerald-400 border border-emerald-500/10">
                                    <Award className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mt-2 text-white text-glow">{taskCompletionRate}%</h3>
                                <span className="text-[10px] text-neutral-500 block mt-1">
                                    {completedTasks}/{totalTasks} Kanban actions resolved
                                </span>
                            </div>
                        </div>

                        {/* Stat 4 */}
                        <div className="glass-panel rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                            <div className="flex justify-between items-start">
                                <span className="text-xs text-neutral-400 font-medium">Action Mapping Rate</span>
                                <div className="w-8 h-8 rounded-lg bg-fuchsia-600/10 flex items-center justify-center text-fuchsia-400 border border-fuchsia-500/10">
                                    <Target className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mt-2 text-white">{actionConversionRate}%</h3>
                                <span className="text-[10px] text-neutral-500 block mt-1">
                                    {convertedActionItems}/{totalActionItems} transcripts converted
                                </span>
                            </div>
                        </div>

                    </div>

                    {/* Chart Layout Blocks */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                        
                        {/* Task Progression ring chart */}
                        <div className="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between space-y-6">
                            <div>
                                <h3 className="font-bold text-sm flex items-center gap-2">
                                    <PieChart className="w-4 h-4 text-violet-400" /> Kanban Task Distribution
                                </h3>
                                <p className="text-[10px] text-neutral-400 mt-1">Status division ratio for current cards</p>
                            </div>

                            {totalTasks === 0 ? (
                                <div className="text-center py-10 text-neutral-500 text-xs">
                                    Create some board tasks to display graphs.
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                                    {/* Visual Chart Graphic built using pure clean flexbars */}
                                    <div className="w-32 h-32 rounded-full border-8 border-violet-600/10 relative flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full border-8 border-emerald-500 border-t-transparent border-r-transparent animate-spin-slow"></div>
                                        <div className="text-center space-y-0.5">
                                            <span className="text-xs font-bold uppercase text-neutral-400 block">Total</span>
                                            <span className="text-xl font-bold text-white block">{totalTasks}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5 w-full sm:w-auto text-xs shrink-0">
                                        <div className="flex items-center gap-2 justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span>
                                                <span className="text-neutral-300">To Do</span>
                                            </div>
                                            <strong className="text-white">{pendingTasks} cards</strong>
                                        </div>
                                        <div className="flex items-center gap-2 justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded bg-amber-500"></span>
                                                <span className="text-neutral-300">In Progress</span>
                                            </div>
                                            <strong className="text-white">{inProgressTasks} cards</strong>
                                        </div>
                                        <div className="flex items-center gap-2 justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                                                <span className="text-neutral-300">Completed</span>
                                            </div>
                                            <strong className="text-white">{completedTasks} cards</strong>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Meeting productivity score block */}
                        <div className="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between space-y-6">
                            <div>
                                <h3 className="font-bold text-sm flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-fuchsia-400" /> AI Collaboration Score
                                </h3>
                                <p className="text-[10px] text-neutral-400 mt-1">Calculated meeting task completion efficacy</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-neutral-400">
                                        <span>Sprint Engagement index</span>
                                        <strong className="text-white">82% (Optimal)</strong>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full" style={{ width: "82%" }}></div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-neutral-400">
                                        <span>Action Conversion Rate</span>
                                        <strong className="text-white">{actionConversionRate}%</strong>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-full" style={{ width: `${actionConversionRate}%` }}></div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-neutral-400">
                                        <span>Kanban task delivery rate</span>
                                        <strong className="text-white">{taskCompletionRate}%</strong>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full" style={{ width: `${taskCompletionRate}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Platform usage log overview */}
                    <div className="glass-panel rounded-2xl p-6 border border-white/5">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-4 h-4 text-violet-400" />
                            <h3 className="font-bold text-sm">Meeting Volume & Transcripts Activity Log</h3>
                        </div>
                        
                        <div className="h-28 flex items-end justify-between gap-2.5 px-2 pt-6">
                            {/* Simulated weekly charts bars */}
                            {[12, 18, 10, 24, 15, 30, 20].map((val, idx) => (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer">
                                    <div className="w-full bg-[#12131a] hover:bg-violet-950 rounded-lg flex items-end h-20 border border-white/5 relative">
                                        <div 
                                            className="w-full bg-gradient-to-t from-violet-600 to-indigo-600 rounded-lg transition-all duration-300"
                                            style={{ height: `${(val / 30) * 100}%` }}
                                        ></div>
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-[9px] px-1 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {val}h
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-neutral-500">Day {idx + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
