import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useStore } from "../store/store";
import { 
    ArrowLeft, Bot, Calendar, FileText, CheckCircle2, 
    CheckSquare, ListPlus, Loader2, Sparkles, Printer,
    Mic, MessageSquare, ArrowRight, Kanban, Clock, ShieldCheck
} from "lucide-react";
import toast from "react-hot-toast";

export default function MeetingSummary() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { 
        activeMeeting, getMeetingDetails, 
        workspaces, fetchWorkspaces, activeWorkspace, selectWorkspace,
        createTasksFromActionItems
    } = useStore();

    const [selectedActionItems, setSelectedActionItems] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [summaryLogTab, setSummaryLogTab] = useState<"transcript" | "chats">("transcript");
    const [tasksImported, setTasksImported] = useState(false);

    useEffect(() => {
        if (roomId) {
            getMeetingDetails(roomId).catch(() => {
                toast.error("Failed to retrieve meeting summary details");
                navigate("/dashboard");
            });
        }
        fetchWorkspaces();
    }, [roomId, getMeetingDetails, fetchWorkspaces, navigate]);

    // Handle checkboxes for action items
    const handleToggleActionItem = (itemId: string) => {
        setSelectedActionItems((prev) => 
            prev.includes(itemId) 
                ? prev.filter((id) => id !== itemId) 
                : [...prev, itemId]
        );
    };

    // Toggle all items
    const handleToggleAll = () => {
        if (!activeMeeting) return;
        const pendingItems = activeMeeting.actionItems.filter(item => item.status === "pending");
        if (selectedActionItems.length === pendingItems.length) {
            setSelectedActionItems([]);
        } else {
            setSelectedActionItems(pendingItems.map(item => item._id));
        }
    };

    const handlePushToKanban = async () => {
        if (!activeMeeting || !activeWorkspace) {
            toast.error("Please select a workspace first");
            return;
        }

        if (selectedActionItems.length === 0) {
            toast.error("Please select at least one action item to import");
            return;
        }

        try {
            setIsLoading(true);
            
            // Format selected items for API with title, description, priority, assigneeName, and actionItemId
            const itemsToImport = activeMeeting.actionItems
                .filter(item => selectedActionItems.includes(item._id))
                .map(item => ({
                    title: item.title,
                    description: item.description || `Extracted from meeting "${activeMeeting.title}"`,
                    priority: item.priority || "medium",
                    assigneeName: item.assigneeName,
                    actionItemId: item._id
                }));

            await createTasksFromActionItems(activeMeeting._id, activeWorkspace._id, itemsToImport);
            setSelectedActionItems([]);
            setTasksImported(true);
            toast.success("Action items imported into Kanban board successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to import tasks");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (!activeMeeting) {
        return (
            <div className="min-h-screen bg-[#08090c] text-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
        );
    }

    const pendingActionItems = activeMeeting.actionItems.filter(item => item.status === "pending");
    const createdActionItems = activeMeeting.actionItems.filter(item => item.status === "created");

    // Calculate duration in minutes if startTime and endTime exist
    let durationText = "In progress / N/A";
    if (activeMeeting.startTime && activeMeeting.endTime) {
        const diffMinutes = Math.max(1, Math.round((new Date(activeMeeting.endTime).getTime() - new Date(activeMeeting.startTime).getTime()) / 60000));
        durationText = `${diffMinutes} mins`;
    }

    return (
        <div className="min-h-screen bg-[#08090c] text-white py-8 px-4 md:px-10 relative print:bg-white print:text-black">
            {/* Ambient glows */}
            <div className="absolute top-10 left-10 w-80 h-80 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none print:hidden"></div>

            <div className="max-w-4xl mx-auto space-y-8 relative z-10">
                {/* Back Link & Navigation */}
                <div className="flex items-center justify-between print:hidden">
                    <Link to="/dashboard" className="text-neutral-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
                    </Link>
                    <div className="flex items-center gap-3">
                        <Link 
                            to="/project-board"
                            className="bg-violet-600/10 border border-violet-500/20 hover:bg-violet-600/20 text-violet-300 text-xs px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all"
                        >
                            <Kanban className="w-3.5 h-3.5 text-violet-400" /> Go to Kanban Board
                        </Link>
                        <button 
                            onClick={handlePrint}
                            className="bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-300 text-xs px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all"
                        >
                            <Printer className="w-3.5 h-3.5" /> Print Summary
                        </button>
                    </div>
                </div>

                {/* Cover Header */}
                <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 print:border-none print:bg-transparent print:p-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-wider print:text-violet-600">
                                <Bot className="w-4 h-4" /> AI Generated Meeting Intelligence Report
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">{activeMeeting.title}</h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-400 mt-2">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" /> 
                                    {new Date(activeMeeting.startTime).toLocaleDateString()} at {new Date(activeMeeting.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" /> Duration: {durationText}
                                </span>
                                <span>• Room ID: {activeMeeting.roomId}</span>
                            </div>
                        </div>

                        <div className="flex items-center -space-x-2.5 print:hidden">
                            {activeMeeting.participants?.map((p, idx) => (
                                <div 
                                    key={idx}
                                    className="w-9 h-9 rounded-full bg-violet-600 border-2 border-[#08090c] text-white text-[11px] font-bold uppercase flex items-center justify-center shadow"
                                    title={p.name}
                                >
                                    {p.name.charAt(0)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* AI Executive Summary Block */}
                <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 relative overflow-hidden print:border-none print:bg-transparent print:p-0">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-fuchsia-600/5 blur-3xl pointer-events-none"></div>
                    
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4 text-fuchsia-400 print:text-fuchsia-600" /> Executive Summary
                    </h2>

                    <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-line print:text-neutral-800">
                        {activeMeeting.summary || "The meeting has concluded. No spoken transcripts were recorded during this call."}
                    </p>
                </div>

                {/* Action Items Import Panel */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    
                    {/* Left: Action Items list */}
                    <div className="lg:col-span-2 glass-panel rounded-3xl p-6 md:p-8 border border-white/10 print:border-none print:bg-transparent print:p-0 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <div className="flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-violet-400" />
                                <h2 className="text-base font-bold">AI Extracted Action Deliverables</h2>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                                    {activeMeeting.actionItems.length}
                                </span>
                            </div>
                            {pendingActionItems.length > 0 && (
                                <button 
                                    onClick={handleToggleAll}
                                    className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 transition-colors print:hidden"
                                >
                                    {selectedActionItems.length === pendingActionItems.length ? "Deselect All" : "Select All"}
                                </button>
                            )}
                        </div>

                        {tasksImported && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl flex items-center justify-between text-xs">
                                <span className="text-emerald-300 font-medium flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" /> Tasks successfully synced to Kanban board!
                                </span>
                                <Link 
                                    to="/project-board"
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
                                >
                                    Open Kanban <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        )}

                        <div className="space-y-3">
                            {activeMeeting.actionItems.length === 0 ? (
                                <div className="text-center py-8 text-neutral-500 text-xs">
                                    No action items were detected in this meeting conversation.
                                </div>
                            ) : (
                                activeMeeting.actionItems.map((item) => {
                                    const priorityTag = 
                                        item.priority === "high" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" :
                                        item.priority === "medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                                        "text-blue-400 bg-blue-500/10 border-blue-500/20";

                                    return (
                                        <div 
                                            key={item._id}
                                            className={`p-3.5 rounded-2xl border text-xs transition-all ${
                                                item.status === "created" 
                                                    ? "bg-white/[0.03] border-white/5 opacity-80" 
                                                    : "bg-[#101117] border-white/5 hover:border-violet-500/20"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1">
                                                    {item.status === "pending" ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedActionItems.includes(item._id)}
                                                            onChange={() => handleToggleActionItem(item._id)}
                                                            className="mt-1 rounded text-violet-600 focus:ring-violet-500 border-white/20 print:hidden cursor-pointer"
                                                        />
                                                    ) : (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                                                    )}
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-semibold text-white print:text-black leading-relaxed">
                                                                {item.title}
                                                            </p>
                                                            {item.priority && (
                                                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${priorityTag}`}>
                                                                    {item.priority}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {item.description && (
                                                            <p className="text-[11px] text-neutral-400 leading-relaxed">
                                                                {item.description}
                                                            </p>
                                                        )}

                                                        {item.assigneeName && (
                                                            <span className="text-[10px] text-neutral-400 block pt-0.5">
                                                                Suggested Assignee: <strong className="text-violet-400 font-bold">{item.assigneeName}</strong>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${
                                                    item.status === "created" 
                                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                                        : "bg-neutral-500/10 text-neutral-400"
                                                }`}>
                                                    {item.status === "created" ? "Board Task" : "Pending Sync"}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Push to Kanban Control Panel */}
                    <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4 print:hidden">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 block">Workspace Actions Sync</span>
                        <h3 className="font-bold text-sm">Send to Project Kanban Board</h3>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                            Convert selected meeting deliverables directly into Kanban cards. Assignee names are matched automatically to workspace members.
                        </p>

                        <div className="space-y-3.5">
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">
                                    Target Workspace
                                </label>
                                <select
                                    value={activeWorkspace?._id || ""}
                                    onChange={(e) => {
                                        const ws = workspaces.find((w) => w._id === e.target.value);
                                        if (ws) selectWorkspace(ws);
                                    }}
                                    className="w-full text-xs px-3 py-2.5 rounded-xl glass-input bg-[#14151f] text-white border border-white/10"
                                >
                                    {workspaces.length === 0 && <option value="">No workspaces available</option>}
                                    {workspaces.map((ws) => (
                                        <option key={ws._id} value={ws._id}>
                                            {ws.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handlePushToKanban}
                                disabled={isLoading || !activeWorkspace || selectedActionItems.length === 0}
                                className="w-full glow-btn bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <>
                                        <ListPlus className="w-3.5 h-3.5" />
                                        Import Tasks ({selectedActionItems.length})
                                    </>
                                )}
                            </button>

                            {createdActionItems.length > 0 && (
                                <Link
                                    to="/project-board"
                                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all block text-center"
                                >
                                    <Kanban className="w-3.5 h-3.5 text-violet-400" /> View Board ({createdActionItems.length} Synced)
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* Transcripts & Chat history blocks */}
                <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <FileText className="w-4 h-4 text-violet-400" /> Meeting Communications Log
                            </h2>
                            <span className="text-[11px] text-neutral-400">
                                (Stored separately under respective usernames)
                            </span>
                        </div>

                        {/* Switcher */}
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 print:hidden">
                            <button
                                onClick={() => setSummaryLogTab("transcript")}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    summaryLogTab === "transcript"
                                        ? "bg-violet-600 text-white shadow"
                                        : "text-neutral-400 hover:text-white"
                                  }`}
                            >
                                <Mic className="w-3.5 h-3.5" />
                                Voice Transcripts ({activeMeeting.transcript?.length || 0})
                            </button>
                            <button
                                onClick={() => setSummaryLogTab("chats")}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    summaryLogTab === "chats"
                                        ? "bg-violet-600 text-white shadow"
                                        : "text-neutral-400 hover:text-white"
                                  }`}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Room Chats ({activeMeeting.chats?.length || 0})
                            </button>
                        </div>
                    </div>

                    {/* Voice Transcripts View */}
                    {summaryLogTab === "transcript" && (
                        <div className="space-y-3.5 max-h-96 overflow-y-auto pr-2">
                            {(!activeMeeting.transcript || activeMeeting.transcript.length === 0) ? (
                                <div className="text-center py-8 text-neutral-500 text-xs italic">
                                    No spoken voice conversations were transcribed in this session.
                                </div>
                            ) : (
                                activeMeeting.transcript.map((line, idx) => (
                                    <div key={idx} className="text-xs bg-white/5 border border-white/5 p-3.5 rounded-2xl flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400">
                                            <span className="text-violet-400 flex items-center gap-1.5 font-semibold">
                                                <Mic className="w-3 h-3 text-emerald-400" />
                                                {line.sender}
                                            </span>
                                            <span>{new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-neutral-200 leading-relaxed font-mono text-[11px]">{line.text}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Room Chats View */}
                    {summaryLogTab === "chats" && (
                        <div className="space-y-3.5 max-h-96 overflow-y-auto pr-2">
                            {(!activeMeeting.chats || activeMeeting.chats.length === 0) ? (
                                <div className="text-center py-8 text-neutral-500 text-xs italic">
                                    No in-meeting chat messages were sent in this session.
                                </div>
                            ) : (
                                activeMeeting.chats.map((chat, idx) => (
                                    <div key={idx} className="text-xs bg-white/5 border border-white/5 p-3.5 rounded-2xl flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400">
                                            <span className="text-violet-300 flex items-center gap-1.5 font-semibold">
                                                <MessageSquare className="w-3 h-3 text-violet-400" />
                                                {chat.sender}
                                            </span>
                                            <span>{new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-neutral-200 leading-relaxed">{chat.text}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
