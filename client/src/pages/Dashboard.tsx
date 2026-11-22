import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useStore } from "../store/store";
import { 
    Video, Plus, LogOut, Layout, Users, 
    ClipboardList, CheckSquare, PlusCircle, 
    UserPlus, ArrowRight, VideoOff, History, Bot, Copy
} from "lucide-react";
import toast from "react-hot-toast";

const normalizeRoomId = (input: string): string => {
    if (!input) return "";
    let clean = input.trim();
    if (clean.includes("/")) {
        clean = clean.split("/").filter(Boolean).pop() || clean;
    }
    clean = clean.split("?")[0].split("#")[0].trim().toLowerCase();
    const alphanumeric = clean.replace(/[^a-z0-9]/g, "");
    if (alphanumeric.length === 9) {
        return `${alphanumeric.substring(0, 3)}-${alphanumeric.substring(3, 6)}-${alphanumeric.substring(6, 9)}`;
    }
    return clean;
};

export default function Dashboard() {
    const navigate = useNavigate();
    const { 
        user, logout, 
        workspaces, activeWorkspace, createWorkspace, selectWorkspace, inviteMember, fetchWorkspaces,
        meetings, createMeeting, joinMeeting, fetchMeetings,
        tasks, fetchTasks
    } = useStore();

    const [newWsName, setNewWsName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [meetingTitle, setMeetingTitle] = useState("");
    const [joinRoomId, setJoinRoomId] = useState("");
    const [isCreatingWs, setIsCreatingWs] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [isLoadingMeeting, setIsLoadingMeeting] = useState(false);

    useEffect(() => {
        fetchWorkspaces();
        fetchMeetings();
    }, [fetchWorkspaces, fetchMeetings]);

    useEffect(() => {
        if (activeWorkspace) {
            fetchTasks(activeWorkspace._id);
        }
    }, [activeWorkspace, fetchTasks]);

    const handleCreateWorkspace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWsName.trim()) return;
        try {
            await createWorkspace(newWsName, "Workspace created via Dashboard");
            setNewWsName("");
            setIsCreatingWs(false);
            toast.success("Workspace created successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to create workspace");
        }
    };

    const handleInviteMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !activeWorkspace) return;
        try {
            setIsInviting(true);
            await inviteMember(activeWorkspace._id, inviteEmail);
            setInviteEmail("");
            toast.success(`Invite sent successfully to ${inviteEmail}!`);
        } catch (err: any) {
            toast.error(err.message || "Failed to invite member");
        } finally {
            setIsInviting(false);
        }
    };

    const handleStartMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!meetingTitle.trim()) {
            toast.error("Please enter a meeting title");
            return;
        }
        try {
            setIsLoadingMeeting(true);
            const meeting = await createMeeting(meetingTitle);
            toast.success("Meeting room created!");
            navigate(`/meeting/${meeting.roomId}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to start meeting");
        } finally {
            setIsLoadingMeeting(false);
        }
    };

    const handleJoinMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanedRoomId = normalizeRoomId(joinRoomId);
        if (!cleanedRoomId) {
            toast.error("Please enter a valid Meeting ID or invite link");
            return;
        }
        try {
            setIsLoadingMeeting(true);
            const meeting = await joinMeeting(cleanedRoomId);
            toast.success("Joined room lobby");
            navigate(`/meeting/${meeting.roomId}`);
        } catch (err: any) {
            toast.error(err.message || "Meeting room not found");
        } finally {
            setIsLoadingMeeting(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        toast.success("Logged out successfully");
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-[#08090c] text-white flex flex-col md:flex-row relative">
            {/* Ambient glows */}
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none"></div>

            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 border-r border-white/5 bg-[#0a0b0f] flex flex-col shrink-0">
                {/* Brand */}
                <div className="h-16 border-b border-white/5 flex items-center gap-2.5 px-6">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/20">
                        <Video className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-lg bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                        IntellMeet
                    </span>
                </div>

                {/* User Card */}
                <div className="p-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center font-bold text-violet-400 uppercase text-sm">
                            {user?.fullName.charAt(0) || "U"}
                        </div>
                        <div className="overflow-hidden">
                            <h4 className="font-semibold text-sm truncate text-white">{user?.fullName || "User Profile"}</h4>
                            <span className="text-[10px] text-neutral-400 block truncate">{user?.email}</span>
                        </div>
                    </div>
                </div>

                {/* Workspace Switcher */}
                <div className="p-4 flex-1 space-y-4">
                    <div>
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                            <span>Workspaces</span>
                            <button 
                                onClick={() => setIsCreatingWs(!isCreatingWs)} 
                                className="text-violet-400 hover:text-violet-300 transition-colors"
                                title="Create Workspace"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {isCreatingWs && (
                            <form onSubmit={handleCreateWorkspace} className="mb-3 space-y-2">
                                <input
                                    type="text"
                                    placeholder="Workspace Name"
                                    value={newWsName}
                                    onChange={(e) => setNewWsName(e.target.value)}
                                    className="w-full text-xs px-2.5 py-1.5 rounded-lg glass-input"
                                    required
                                    autoFocus
                                />
                                <div className="flex gap-1.5 justify-end">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsCreatingWs(false)} 
                                        className="text-[10px] text-neutral-400 px-2 py-1 hover:bg-white/5 rounded"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="text-[10px] bg-violet-600 hover:bg-violet-500 text-white px-2.5 py-1 rounded"
                                    >
                                        Create
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {workspaces.map((ws) => (
                                <button
                                    key={ws._id}
                                    onClick={() => selectWorkspace(ws)}
                                    className={`w-full text-left text-xs px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                                        activeWorkspace?._id === ws._id 
                                            ? "bg-violet-600/10 text-violet-300 border border-violet-500/20 font-medium" 
                                            : "hover:bg-white/5 text-neutral-400"
                                    }`}
                                >
                                    <span className="truncate">{ws.name}</span>
                                    <span className="text-[10px] opacity-60">
                                        ({ws.members?.length || 1})
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Navigation</span>
                        <Link 
                            to="/dashboard" 
                            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-white/5 text-white border border-white/5 font-semibold"
                        >
                            <Layout className="w-3.5 h-3.5" /> Dashboard
                        </Link>
                        <Link 
                            to="/project" 
                            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg hover:bg-white/5 text-neutral-400 transition-colors"
                        >
                            <ClipboardList className="w-3.5 h-3.5" /> Project Board
                        </Link>
                        <Link 
                            to="/analytics" 
                            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg hover:bg-white/5 text-neutral-400 transition-colors"
                        >
                            <History className="w-3.5 h-3.5" /> Productivity Report
                        </Link>
                    </div>
                </div>

                {/* Logout Button */}
                <div className="p-4 border-t border-white/5">
                    <button 
                        onClick={handleLogout} 
                        className="w-full flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-400 transition-colors"
                    >
                        <LogOut className="w-3.5 h-3.5" /> Log Out
                    </button>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-white">Dashboard Portal</h1>
                        <p className="text-neutral-400 text-sm">
                            Manage meetings, collaborate on tasks, and sync with your team in workspace:{" "}
                            <span className="text-violet-400 font-bold">{activeWorkspace?.name || "No workspace selected"}</span>
                        </p>
                    </div>

                    {/* Room control boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Start instant meeting */}
                        <div className="glass-panel rounded-2xl p-6 border border-white/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-violet-600/5 blur-2xl"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-400 border border-violet-500/20">
                                    <PlusCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">Start Instant Meeting</h3>
                                    <p className="text-xs text-neutral-400">Launch a new session and invite peers</p>
                                </div>
                            </div>
                            <form onSubmit={handleStartMeeting} className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Meeting Subject (e.g. Sprint Checkin)"
                                    value={meetingTitle}
                                    onChange={(e) => setMeetingTitle(e.target.value)}
                                    className="w-full text-xs px-3 py-2.5 rounded-xl glass-input"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isLoadingMeeting}
                                    className="w-full glow-btn bg-violet-600 hover:bg-violet-500 text-xs font-semibold py-2.5 rounded-xl transition-all"
                                >
                                    {isLoadingMeeting ? "Launching..." : "Start Meeting Now"}
                                </button>
                            </form>
                        </div>

                        {/* Join meeting via ID */}
                        <div className="glass-panel rounded-2xl p-6 border border-white/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-600/5 blur-2xl"></div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                                    <Video className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">Join via Meeting ID</h3>
                                    <p className="text-xs text-neutral-400">Enter a code to connect to an ongoing call</p>
                                </div>
                            </div>
                            <form onSubmit={handleJoinMeeting} className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Meeting Room ID or Link (e.g. 351-c4d-c01)"
                                    value={joinRoomId}
                                    onChange={(e) => setJoinRoomId(e.target.value)}
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="w-full text-xs px-3 py-2.5 rounded-xl glass-input"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isLoadingMeeting}
                                    className="w-full glow-btn bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold py-2.5 rounded-xl transition-all"
                                >
                                    {isLoadingMeeting ? "Connecting..." : "Join Meeting Lobby"}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Workspace Collaboration section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                        {/* Invite teammate box */}
                        <div className="glass-panel rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                        <UserPlus className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">Add Members</h3>
                                        <p className="text-xs text-neutral-400">Invite developers to your board</p>
                                    </div>
                                </div>
                                <form onSubmit={handleInviteMember} className="space-y-3">
                                    <input
                                        type="email"
                                        placeholder="colleague@domain.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        className="w-full text-xs px-3 py-2.5 rounded-xl glass-input"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={isInviting || !activeWorkspace}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold py-2.5 rounded-xl transition-all"
                                    >
                                        {isInviting ? "Inviting..." : "Send Invitation"}
                                    </button>
                                </form>
                            </div>

                            {activeWorkspace && (
                                <div className="mt-6 border-t border-white/5 pt-4">
                                    <span className="block text-xs font-semibold text-neutral-400 mb-2.5">
                                        Active Workspace Members ({activeWorkspace.members?.length || 1})
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        {activeWorkspace.members?.map((m) => (
                                            <div 
                                                key={m._id} 
                                                className="flex items-center gap-1.5 bg-[#12131a] border border-white/5 px-2.5 py-1 rounded-full text-xs"
                                                title={m.email}
                                            >
                                                <div className="w-3.5 h-3.5 rounded-full bg-violet-600/20 text-violet-400 font-bold text-[9px] flex items-center justify-center">
                                                    {m.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="truncate max-w-[80px] text-neutral-300 font-medium">
                                                    {m.fullName}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Recent tasks preview */}
                        <div className="glass-panel rounded-2xl p-6 border border-white/10 lg:col-span-2 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-600/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                                            <CheckSquare className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">My Kanban Actions</h3>
                                            <p className="text-xs text-neutral-400">Assigned deliverables for this workspace</p>
                                        </div>
                                    </div>
                                    <Link to="/project" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                                        View Board <ArrowRight className="w-3 h-3" />
                                    </Link>
                                </div>

                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {tasks.length === 0 ? (
                                        <div className="text-center py-8 text-neutral-500 text-xs flex flex-col items-center gap-2">
                                            <ClipboardList className="w-8 h-8 opacity-30" />
                                            <span>No tasks created yet in this workspace.</span>
                                        </div>
                                    ) : (
                                        tasks.slice(0, 4).map((task) => (
                                            <div 
                                                key={task._id} 
                                                className="bg-[#101117] border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs"
                                            >
                                                <div className="space-y-1">
                                                    <span className="font-semibold text-white">{task.title}</span>
                                                    <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                                                        <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                                                            task.priority === "high" ? "bg-rose-500/10 text-rose-400" :
                                                            task.priority === "medium" ? "bg-amber-500/10 text-amber-400" :
                                                            "bg-blue-500/10 text-blue-400"
                                                        }`}>
                                                            {task.priority}
                                                        </span>
                                                        <span>• Status: {task.status}</span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-neutral-500">
                                                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* History grid */}
                    <div className="glass-panel rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-400 border border-violet-500/20">
                                <History className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Meeting History & AI summaries</h3>
                                <p className="text-xs text-neutral-400">Search transcripts and reviews for past sessions</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {meetings.length === 0 ? (
                                <div className="col-span-full text-center py-10 text-neutral-500 text-xs flex flex-col items-center gap-2">
                                    <VideoOff className="w-8 h-8 opacity-30" />
                                    <span>No meetings recorded. Create or join a call to get started!</span>
                                </div>
                            ) : (
                                meetings.map((meet) => (
                                    <div 
                                        key={meet._id} 
                                        className="bg-[#101117] border border-white/5 p-4 rounded-xl flex flex-col justify-between gap-4"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                    meet.status === "active" 
                                                        ? "bg-emerald-500/10 text-emerald-400 animate-pulse" 
                                                        : "bg-neutral-500/10 text-neutral-400"
                                                }`}>
                                                    {meet.status === "active" ? "Live" : "Ended"}
                                                </span>
                                                <span className="text-[10px] text-neutral-500">
                                                    {new Date(meet.startTime).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-sm text-white truncate">{meet.title}</h4>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-[11px] text-neutral-400 font-mono block truncate">
                                                    ID: {meet.roomId}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const url = `${window.location.origin}/meeting/${meet.roomId}`;
                                                        navigator.clipboard.writeText(url);
                                                        toast.success("Meeting link copied!", { icon: "📋" });
                                                    }}
                                                    title="Copy Meeting Invite Link"
                                                    className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 bg-violet-500/10 hover:bg-violet-500/20 px-2 py-0.5 rounded border border-violet-500/20 cursor-pointer transition-all"
                                                >
                                                    <Copy className="w-2.5 h-2.5" /> Copy Link
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                                                <Users className="w-3.5 h-3.5" />
                                                <span>{meet.participants?.length || 1} peers</span>
                                            </div>
                                            {meet.status === "active" ? (
                                                <Link 
                                                    to={`/meeting/${meet.roomId}`}
                                                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition-all"
                                                >
                                                    Rejoin Call
                                                </Link>
                                            ) : (
                                                <Link 
                                                    to={`/meeting/${meet.roomId}/summary`}
                                                    className="text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-0.5"
                                                >
                                                    <Bot className="w-3.5 h-3.5" /> View Report
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
