import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useStore } from "../store/store";
import { 
    ArrowLeft, Bot, Calendar, FileText, CheckCircle2, 
    CheckSquare, ListPlus, Loader2, Sparkles, Printer
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

    const [selectedActionItems, setSelectedActionItems] = useState<string[]>([]); // Action item titles/ids
    const [isLoading, setIsLoading] = useState(false);

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
            
            // Format selected items for API
            const itemsToImport = activeMeeting.actionItems
                .filter(item => selectedActionItems.includes(item._id))
                .map(item => ({
                    title: item.title,
                    assigneeName: item.assigneeName,
                    actionItemId: item._id
                }));

            await createTasksFromActionItems(activeMeeting._id, activeWorkspace._id, itemsToImport);
            setSelectedActionItems([]);
            toast.success("Action items imported as Kanban tasks successfully!");
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

    return (
        <div className="min-h-screen bg-[#08090c] text-white py-8 px-4 md:px-10 relative print:bg-white print:text-black">
            {/* Ambient glows */}
            <div className="absolute top-10 left-10 w-80 h-80 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none print:hidden"></div>

            <div className="max-w-4xl mx-auto space-y-8 relative z-10">
                {/* Back Link */}
                <div className="flex items-center justify-between print:hidden">
                    <Link to="/dashboard" className="text-neutral-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
                    </Link>
                    <button 
                        onClick={handlePrint}
                        className="bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-300 text-xs px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all"
                    >
                        <Printer className="w-3.5 h-3.5" /> Print Summary
                    </button>
                </div>

                {/* Cover Header */}
                <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 print:border-none print:bg-transparent print:p-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-wider print:text-violet-600">
                                <Bot className="w-4 h-4" /> AI Generated Meeting intelligence report
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">{activeMeeting.title}</h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-400 mt-2">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" /> 
                                    {new Date(activeMeeting.startTime).toLocaleDateString()} at {new Date(activeMeeting.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                <span>• Room ID: {activeMeeting.roomId}</span>
                                <span>• Host: Organizer</span>
                            </div>
                        </div>

                        <div className="flex items-center -space-x-2.5 print:hidden">
                            {activeMeeting.participants.map((p, idx) => (
                                <div 
                                    key={idx}
                                    className="w-9 h-9 rounded-full bg-violet-600 border-2 border-[#08090c] text-white text-[11px] font-bold uppercase flex items-center justify-center"
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
                        {activeMeeting.summary || "The AI is compiling the summary details. No transcripts were recorded during the call."}
                    </p>
                </div>

                {/* Action Items Import Panel */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    
                    {/* Left: Action Items list */}
                    <div className="lg:col-span-2 glass-panel rounded-3xl p-6 md:p-8 border border-white/10 print:border-none print:bg-transparent print:p-0">
                        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                            <h2 className="text-base font-bold flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-violet-400" /> Extracted Action Deliverables
                            </h2>
                            {pendingActionItems.length > 0 && (
                                <button 
                                    onClick={handleToggleAll}
                                    className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 transition-colors print:hidden"
                                >
                                    {selectedActionItems.length === pendingActionItems.length ? "Deselect All" : "Select All"}
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {activeMeeting.actionItems.length === 0 ? (
                                <div className="text-center py-8 text-neutral-500 text-xs">
                                    No action items were detected in this meeting transcript.
                                </div>
                            ) : (
                                activeMeeting.actionItems.map((item) => (
                                    <div 
                                        key={item._id}
                                        className={`flex items-start justify-between p-3 rounded-2xl border text-xs gap-3.5 transition-all ${
                                            item.status === "created" 
                                                ? "bg-white/5 border-white/5 opacity-60" 
                                                : "bg-[#101117] border-white/5 hover:border-violet-500/20"
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {item.status === "pending" ? (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedActionItems.includes(item._id)}
                                                    onChange={() => handleToggleActionItem(item._id)}
                                                    className="mt-0.5 rounded text-violet-600 focus:ring-violet-500 border-white/20 print:hidden"
                                                />
                                            ) : (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                                            )}
                                            <div>
                                                <p className="font-semibold text-white print:text-black leading-relaxed">
                                                    {item.title}
                                                </p>
                                                {item.assigneeName && (
                                                    <span className="text-[10px] text-neutral-400 block mt-1">
                                                        Suggested Owner: <strong className="text-violet-400 font-bold">{item.assigneeName}</strong>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${
                                            item.status === "created" 
                                                ? "bg-emerald-500/10 text-emerald-400" 
                                                : "bg-neutral-500/10 text-neutral-400"
                                        }`}>
                                            {item.status === "created" ? "Board Task" : "Pending Sync"}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right: Push to Kanban control Panel */}
                    {pendingActionItems.length > 0 && (
                        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4 print:hidden">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 block">Workspace Actions Sync</span>
                            <h3 className="font-bold text-sm">Send to Project Board</h3>
                            <p className="text-xs text-neutral-400 leading-relaxed">
                                Map selected items directly into Kanban cards. We will resolve assignment matching automatically.
                            </p>

                            <div className="space-y-3.5">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">
                                        Select Target Workspace
                                    </label>
                                    <select
                                        value={activeWorkspace?._id || ""}
                                        onChange={(e) => {
                                            const ws = workspaces.find((w) => w._id === e.target.value);
                                            if (ws) selectWorkspace(ws);
                                        }}
                                        className="w-full text-xs px-3 py-2 rounded-xl glass-input"
                                    >
                                        <option value="" disabled>-- Choose Workspace --</option>
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
                                    className="w-full glow-btn bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5"
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
                            </div>
                        </div>
                    )}
                </div>

                {/* Transcripts history dialog block */}
                <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10">
                    <h2 className="text-base font-bold flex items-center gap-2 mb-4">
                        <FileText className="w-4 h-4 text-neutral-400" /> Full Meeting Conversation Transcript
                    </h2>

                    <div className="space-y-3.5 max-h-72 overflow-y-auto pr-2">
                        {activeMeeting.transcript.length === 0 ? (
                            <div className="text-center py-6 text-neutral-500 text-xs italic">
                                No speaking audio/text messages were sent in this session.
                            </div>
                        ) : (
                            activeMeeting.transcript.map((line, idx) => (
                                <div key={idx} className="text-xs bg-white/5 border border-white/5 p-3 rounded-2xl flex flex-col gap-1">
                                    <div className="flex items-center justify-between text-[9px] font-bold text-neutral-400">
                                        <span className="text-violet-400">{line.sender}</span>
                                        <span>{new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-neutral-200 leading-relaxed">{line.text}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
