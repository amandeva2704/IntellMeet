import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store/store";
import type { Task, WorkspaceMember } from "../store/store";
import { socket } from "../services/socket";
import { 
    Layout, ArrowLeft, Plus, Trash2, 
    ArrowRight, ArrowLeft as ArrowLeftIcon,
    Search, Users, 
    Sparkles, ExternalLink, Edit3, Filter,
    UserPlus, FolderPlus, X
} from "lucide-react";
import toast from "react-hot-toast";

export default function ProjectBoard() {
    const { 
        workspaces, activeWorkspace, selectWorkspace, createWorkspace, inviteMember, fetchWorkspaces,
        tasks, fetchTasks, createTask, updateTaskStatus, updateTaskDetails, deleteTask
    } = useStore();

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showCreateWsModal, setShowCreateWsModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Selected task for detail/editing
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // Filters and search
    const [searchQuery, setSearchQuery] = useState("");
    const [filterAssignee, setFilterAssignee] = useState("all");
    const [filterPriority, setFilterPriority] = useState("all");

    // Create task inputs
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
    const [assigneeId, setAssigneeId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit task inputs
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");
    const [editStatus, setEditStatus] = useState<"todo" | "in-progress" | "done">("todo");
    const [editAssigneeId, setEditAssigneeId] = useState("");
    const [editDueDate, setEditDueDate] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Workspace modal inputs
    const [newWsName, setNewWsName] = useState("");
    const [newWsDesc, setNewWsDesc] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    useEffect(() => {
        if (activeWorkspace) {
            fetchTasks(activeWorkspace._id);

            // Connect socket room sync
            socket.connect();
            socket.emit("join-workspace", { workspaceId: activeWorkspace._id });
            
            // Listen for multi-user sync triggers
            const handleSync = (payload: any) => {
                const wsId = payload?.workspaceId;
                if (!wsId || wsId === activeWorkspace._id) {
                    fetchTasks(activeWorkspace._id);
                }
            };

            socket.on("task-created", handleSync);
            socket.on("task-updated", handleSync);
            socket.on("task-deleted", handleSync);
            socket.on("task-status-changed", handleSync);
            socket.on("task-assigned", handleSync);
            socket.on("task-created-batch", handleSync);
            socket.on("refresh-kanban-board", handleSync);

            return () => {
                socket.emit("leave-workspace", { workspaceId: activeWorkspace._id });
                socket.off("task-created", handleSync);
                socket.off("task-updated", handleSync);
                socket.off("task-deleted", handleSync);
                socket.off("task-status-changed", handleSync);
                socket.off("task-assigned", handleSync);
                socket.off("task-created-batch", handleSync);
                socket.off("refresh-kanban-board", handleSync);
            };
        }
    }, [activeWorkspace, fetchTasks]);

    // Populate Edit modal when selectedTask changes
    const openEditModal = (task: Task) => {
        setSelectedTask(task);
        setEditTitle(task.title);
        setEditDescription(task.description || "");
        setEditPriority(task.priority || "medium");
        setEditStatus(task.status);
        setEditAssigneeId(task.assignee?._id || "");
        setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "");
        setShowEditModal(true);
    };

    // Move task function
    const handleMoveTask = async (task: Task, direction: "left" | "right") => {
        let newStatus: "todo" | "in-progress" | "done" = "todo";
        
        if (task.status === "todo" && direction === "right") newStatus = "in-progress";
        else if (task.status === "in-progress" && direction === "right") newStatus = "done";
        else if (task.status === "in-progress" && direction === "left") newStatus = "todo";
        else if (task.status === "done" && direction === "left") newStatus = "in-progress";

        try {
            await updateTaskStatus(task._id, newStatus);
            toast.success(`Task moved to ${newStatus.replace("-", " ")}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to update status");
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !activeWorkspace) return;

        try {
            setIsSubmitting(true);
            await createTask({
                title: title.trim(),
                description: description.trim(),
                priority,
                assigneeId: assigneeId || undefined,
                dueDate: dueDate || undefined,
                workspaceId: activeWorkspace._id
            });

            setTitle("");
            setDescription("");
            setPriority("medium");
            setAssigneeId("");
            setDueDate("");
            setShowCreateModal(false);
            toast.success("Task created on Kanban board!");
        } catch (err: any) {
            toast.error(err.message || "Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveTaskEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTask || !editTitle.trim()) return;

        try {
            setIsSavingEdit(true);
            const updated = await updateTaskDetails(selectedTask._id, {
                title: editTitle.trim(),
                description: editDescription.trim(),
                priority: editPriority,
                status: editStatus,
                assigneeId: editAssigneeId || null,
                dueDate: editDueDate || null
            });
            setSelectedTask(updated);
            setShowEditModal(false);
            toast.success("Task updated successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to update task");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        const confirm = window.confirm("Are you sure you want to delete this task?");
        if (!confirm) return;

        try {
            await deleteTask(taskId);
            setShowEditModal(false);
            setSelectedTask(null);
            toast.success("Task deleted permanently");
        } catch (err: any) {
            toast.error("Failed to delete task");
        }
    };

    const handleCreateWs = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWsName.trim()) return;
        try {
            await createWorkspace(newWsName.trim(), newWsDesc.trim() || "Collaborative Project Workspace");
            setNewWsName("");
            setNewWsDesc("");
            setShowCreateWsModal(false);
            toast.success("Workspace created and selected!");
        } catch (err: any) {
            toast.error(err.message || "Failed to create workspace");
        }
    };

    const handleInviteMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !activeWorkspace) return;
        try {
            await inviteMember(activeWorkspace._id, inviteEmail.trim());
            setInviteEmail("");
            setShowInviteModal(false);
            toast.success(`Invite sent to ${inviteEmail}!`);
        } catch (err: any) {
            toast.error(err.message || "Failed to invite member");
        }
    };

    // Filter Tasks
    const filteredTasks = tasks.filter((t) => {
        const matchSearch = searchQuery === "" || 
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchAssignee = 
            filterAssignee === "all" || 
            (filterAssignee === "unassigned" && !t.assignee) ||
            (t.assignee && (t.assignee._id === filterAssignee || t.assignee._id?.toString() === filterAssignee));

        const matchPriority = filterPriority === "all" || t.priority === filterPriority;
        
        return matchSearch && matchAssignee && matchPriority;
    });

    const todoTasks = filteredTasks.filter((t) => t.status === "todo");
    const inProgressTasks = filteredTasks.filter((t) => t.status === "in-progress");
    const doneTasks = filteredTasks.filter((t) => t.status === "done");

    return (
        <div className="min-h-screen bg-[#08090c] text-white flex flex-col md:flex-row relative">
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none"></div>

            {/* Sidebar Navigation */}
            <aside className="w-full md:w-72 border-r border-white/5 bg-[#0a0b0f] flex flex-col shrink-0">
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-6">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/20">
                            <Layout className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-lg bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                            IntellMeet
                        </span>
                    </div>
                </div>

                <div className="p-4 border-b border-white/5 text-xs flex items-center justify-between">
                    <Link to="/dashboard" className="text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
                    </Link>
                    <Link to="/analytics" className="text-violet-400 hover:text-violet-300 transition-colors">
                        Analytics →
                    </Link>
                </div>

                <div className="p-4 flex-1 space-y-6 overflow-y-auto">
                    {/* Workspace Selector */}
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Active Workspace</span>
                            <button
                                onClick={() => setShowCreateWsModal(true)}
                                className="text-[10px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1"
                                title="Create new workspace"
                            >
                                <FolderPlus className="w-3 h-3" /> New
                            </button>
                        </div>

                        <select
                            value={activeWorkspace?._id || ""}
                            onChange={(e) => {
                                const found = workspaces.find((w) => w._id === e.target.value);
                                if (found) selectWorkspace(found);
                            }}
                            className="w-full text-xs px-3 py-2.5 rounded-xl glass-input font-medium bg-[#14151f] text-white border border-white/10"
                        >
                            {workspaces.length === 0 && <option value="">No workspaces available</option>}
                            {workspaces.map((ws) => (
                                <option key={ws._id} value={ws._id}>
                                    {ws.name}
                                </option>
                            ))}
                        </select>

                        {activeWorkspace && (
                            <p className="text-[10px] text-neutral-400 leading-relaxed">
                                {activeWorkspace.description || "Real-time task synchronization for this workspace."}
                            </p>
                        )}
                    </div>

                    {/* Workspace Members list */}
                    {activeWorkspace && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-violet-400" /> Team Members ({activeWorkspace.members?.length || 0})
                                </span>
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1"
                                >
                                    <UserPlus className="w-3 h-3" /> Invite
                                </button>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {activeWorkspace.members?.map((member: WorkspaceMember) => (
                                    <div 
                                        key={member._id}
                                        className="flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] p-2 rounded-xl text-xs transition-colors"
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="w-6 h-6 rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/20 flex items-center justify-center font-bold text-[10px] shrink-0">
                                                {member.fullName?.charAt(0).toUpperCase() || "?"}
                                            </div>
                                            <div className="truncate">
                                                <p className="font-medium text-white text-[11px] truncate">{member.fullName}</p>
                                                <p className="text-[9px] text-neutral-500 truncate">{member.email}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Filter controls */}
                    <div className="space-y-3.5 pt-2 border-t border-white/5">
                        <span className="block text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                            <Filter className="w-3 h-3" /> Board Filters
                        </span>
                        
                        <div>
                            <label className="block text-[10px] text-neutral-400 mb-1.5 uppercase font-medium">Assignee</label>
                            <select
                                value={filterAssignee}
                                onChange={(e) => setFilterAssignee(e.target.value)}
                                className="w-full text-xs px-3 py-2 rounded-xl glass-input bg-[#14151f]"
                            >
                                <option value="all">All Members</option>
                                <option value="unassigned">Unassigned</option>
                                {activeWorkspace?.members?.map((m) => (
                                    <option key={m._id} value={m._id}>
                                        {m.fullName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] text-neutral-400 mb-1.5 uppercase font-medium">Priority</label>
                            <select
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="w-full text-xs px-3 py-2 rounded-xl glass-input bg-[#14151f]"
                            >
                                <option value="all">All Priorities</option>
                                <option value="low">Low Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="high">High Priority</option>
                            </select>
                        </div>

                        {(filterAssignee !== "all" || filterPriority !== "all" || searchQuery !== "") && (
                            <button
                                onClick={() => {
                                    setFilterAssignee("all");
                                    setFilterPriority("all");
                                    setSearchQuery("");
                                }}
                                className="text-[10px] text-neutral-400 hover:text-white transition-colors block w-full text-center py-1"
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:px-10">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">Collaborative Kanban Sync</h1>
                            <p className="text-neutral-400 text-xs sm:text-sm">
                                Real-time task board for workspace: <strong className="text-violet-400 font-bold">{activeWorkspace?.name || "No workspace"}</strong>
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Search Bar */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                                <input
                                    type="text"
                                    placeholder="Search tasks..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="text-xs pl-8 pr-3 py-2 rounded-xl glass-input w-40 sm:w-56"
                                />
                            </div>

                            <button
                                onClick={() => setShowCreateModal(true)}
                                disabled={!activeWorkspace}
                                className="glow-btn bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" /> Add Custom Task
                            </button>
                        </div>
                    </div>

                    {/* Columns grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start min-h-[500px]">
                        
                        {/* Todo Column */}
                        <div className="glass-panel rounded-2xl p-4 border border-white/5 flex flex-col min-h-[420px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4 text-xs">
                                <div className="flex items-center gap-2 font-bold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                                    <span>To Do</span>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-bold text-indigo-300">
                                    {todoTasks.length}
                                </span>
                            </div>

                            <div className="space-y-3 flex-1">
                                {todoTasks.length === 0 ? (
                                    <div className="text-center py-12 text-neutral-500 text-xs italic">
                                        No tasks in queue
                                    </div>
                                ) : (
                                    todoTasks.map((task) => (
                                        <CardComponent 
                                            key={task._id} 
                                            task={task} 
                                            onMove={handleMoveTask} 
                                            onSelect={openEditModal} 
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* In Progress Column */}
                        <div className="glass-panel rounded-2xl p-4 border border-white/5 flex flex-col min-h-[420px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4 text-xs">
                                <div className="flex items-center gap-2 font-bold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                                    <span>In Progress</span>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-300">
                                    {inProgressTasks.length}
                                </span>
                            </div>

                            <div className="space-y-3 flex-1">
                                {inProgressTasks.length === 0 ? (
                                    <div className="text-center py-12 text-neutral-500 text-xs italic">
                                        No tasks active
                                    </div>
                                ) : (
                                    inProgressTasks.map((task) => (
                                        <CardComponent 
                                            key={task._id} 
                                            task={task} 
                                            onMove={handleMoveTask} 
                                            onSelect={openEditModal} 
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Done Column */}
                        <div className="glass-panel rounded-2xl p-4 border border-white/5 flex flex-col min-h-[420px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4 text-xs">
                                <div className="flex items-center gap-2 font-bold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                                    <span>Done</span>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-300">
                                    {doneTasks.length}
                                </span>
                            </div>

                            <div className="space-y-3 flex-1">
                                {doneTasks.length === 0 ? (
                                    <div className="text-center py-12 text-neutral-500 text-xs italic">
                                        No tasks completed
                                    </div>
                                ) : (
                                    doneTasks.map((task) => (
                                        <CardComponent 
                                            key={task._id} 
                                            task={task} 
                                            onMove={handleMoveTask} 
                                            onSelect={openEditModal} 
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            {/* Create Task Modal Overlay */}
            {showCreateModal && activeWorkspace && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg glass-panel-heavy rounded-3xl p-6 md:p-8 border border-white/10 relative">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold flex items-center gap-2 text-white">
                                <Plus className="w-4 h-4 text-violet-400" /> Create Workspace Task
                            </h2>
                            <button 
                                onClick={() => setShowCreateModal(false)}
                                className="text-neutral-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTask} className="space-y-4">
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Task Title *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Implement user authentication & token refresh"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full text-xs px-3 py-2.5 rounded-xl glass-input"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Description</label>
                                <textarea
                                    placeholder="Provide detailed instructions or acceptance criteria..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full text-xs p-3 rounded-xl glass-input h-20 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Priority</label>
                                    <select
                                        value={priority}
                                        onChange={(e: any) => setPriority(e.target.value)}
                                        className="w-full text-xs px-3 py-2.5 rounded-xl glass-input bg-[#14151f]"
                                    >
                                        <option value="low">Low Priority</option>
                                        <option value="medium">Medium Priority</option>
                                        <option value="high">High Priority</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Due Date</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full text-xs px-3 py-2 rounded-xl glass-input bg-[#14151f]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Assign User</label>
                                <select
                                    value={assigneeId}
                                    onChange={(e) => setAssigneeId(e.target.value)}
                                    className="w-full text-xs px-3 py-2.5 rounded-xl glass-input bg-[#14151f]"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {activeWorkspace.members?.map((m) => (
                                        <option key={m._id} value={m._id}>
                                            {m.fullName} ({m.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 justify-end pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-xs text-neutral-400 px-4 py-2 hover:bg-white/5 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="glow-btn bg-violet-600 hover:bg-violet-500 text-xs font-semibold px-5 py-2 rounded-xl"
                                >
                                    {isSubmitting ? "Creating..." : "Save Card"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Task Details & Edit Modal Overlay */}
            {showEditModal && selectedTask && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg glass-panel-heavy rounded-3xl p-6 md:p-8 border border-white/10 relative max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
                            <div className="flex items-center gap-2">
                                <Edit3 className="w-4 h-4 text-violet-400" />
                                <span className="font-bold text-sm text-white">Edit Task</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleDeleteTask(selectedTask._id)}
                                    className="text-red-400 hover:text-red-300 font-bold transition-all p-1.5 hover:bg-red-500/10 rounded-lg"
                                    title="Delete Task"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="text-neutral-400 hover:text-white p-1"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSaveTaskEdit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Task Title *</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full text-xs px-3 py-2.5 rounded-xl glass-input"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Description</label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full text-xs p-3 rounded-xl glass-input h-24 resize-none leading-relaxed"
                                    placeholder="Task details and acceptance criteria..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Status</label>
                                    <select
                                        value={editStatus}
                                        onChange={(e: any) => setEditStatus(e.target.value)}
                                        className="w-full text-xs px-3 py-2.5 rounded-xl glass-input bg-[#14151f]"
                                    >
                                        <option value="todo">To Do</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="done">Done</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Priority</label>
                                    <select
                                        value={editPriority}
                                        onChange={(e: any) => setEditPriority(e.target.value)}
                                        className="w-full text-xs px-3 py-2.5 rounded-xl glass-input bg-[#14151f]"
                                    >
                                        <option value="low">Low Priority</option>
                                        <option value="medium">Medium Priority</option>
                                        <option value="high">High Priority</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Assignee</label>
                                    <select
                                        value={editAssigneeId}
                                        onChange={(e) => setEditAssigneeId(e.target.value)}
                                        className="w-full text-xs px-3 py-2.5 rounded-xl glass-input bg-[#14151f]"
                                    >
                                        <option value="">-- Unassigned --</option>
                                        {activeWorkspace?.members?.map((m) => (
                                            <option key={m._id} value={m._id}>
                                                {m.fullName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Due Date</label>
                                    <input
                                        type="date"
                                        value={editDueDate}
                                        onChange={(e) => setEditDueDate(e.target.value)}
                                        className="w-full text-xs px-3 py-2 rounded-xl glass-input bg-[#14151f]"
                                    />
                                </div>
                            </div>

                            {/* Meeting Reference Origin */}
                            {selectedTask.meetingId && (
                                <div className="bg-violet-600/10 border border-violet-500/20 p-3 rounded-2xl flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                        <div>
                                            <span className="text-[10px] text-neutral-400 block font-medium">Generated from Meeting:</span>
                                            <span className="font-semibold text-white">
                                                {typeof selectedTask.meetingId === "object" 
                                                    ? (selectedTask.meetingId as any).title 
                                                    : "Meeting Action Item"}
                                            </span>
                                        </div>
                                    </div>
                                    {typeof selectedTask.meetingId === "object" && (selectedTask.meetingId as any).roomId && (
                                        <Link
                                            to={`/meeting/${(selectedTask.meetingId as any).roomId}/summary`}
                                            className="text-[10px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1"
                                            target="_blank"
                                        >
                                            View Summary <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 justify-end pt-3 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="text-xs text-neutral-400 px-4 py-2 hover:bg-white/5 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="glow-btn bg-violet-600 hover:bg-violet-500 text-xs font-semibold px-5 py-2.5 rounded-xl"
                                >
                                    {isSavingEdit ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Workspace Modal */}
            {showCreateWsModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md glass-panel-heavy rounded-3xl p-6 border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <FolderPlus className="w-4 h-4 text-violet-400" /> Create Workspace
                            </h3>
                            <button onClick={() => setShowCreateWsModal(false)} className="text-neutral-400 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateWs} className="space-y-3.5">
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Core Engineering"
                                    value={newWsName}
                                    onChange={(e) => setNewWsName(e.target.value)}
                                    className="w-full text-xs px-3 py-2 rounded-xl glass-input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Description</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Sprints and meeting task sync"
                                    value={newWsDesc}
                                    onChange={(e) => setNewWsDesc(e.target.value)}
                                    className="w-full text-xs px-3 py-2 rounded-xl glass-input"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateWsModal(false)}
                                    className="text-xs text-neutral-400 px-3 py-1.5 hover:bg-white/5 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-violet-600 hover:bg-violet-500 text-xs font-semibold px-4 py-2 rounded-xl"
                                >
                                    Create Workspace
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Invite Member Modal */}
            {showInviteModal && activeWorkspace && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md glass-panel-heavy rounded-3xl p-6 border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-violet-400" /> Invite to {activeWorkspace.name}
                            </h3>
                            <button onClick={() => setShowInviteModal(false)} className="text-neutral-400 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleInviteMember} className="space-y-3.5">
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">User Email *</label>
                                <input
                                    type="email"
                                    placeholder="colleague@example.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="w-full text-xs px-3 py-2 rounded-xl glass-input"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="text-xs text-neutral-400 px-3 py-1.5 hover:bg-white/5 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-violet-600 hover:bg-violet-500 text-xs font-semibold px-4 py-2 rounded-xl"
                                >
                                    Send Invite
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// Kanban Card Component
interface CardProps {
    task: Task;
    onMove: (task: Task, direction: "left" | "right") => void;
    onSelect: (task: Task) => void;
}

function CardComponent({ task, onMove, onSelect }: CardProps) {
    const priorityColor = 
        task.priority === "high" ? "bg-rose-500" :
        task.priority === "medium" ? "bg-amber-500" :
        "bg-blue-500";

    const priorityBadge = 
        task.priority === "high" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" :
        task.priority === "medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
        "text-blue-400 bg-blue-500/10 border-blue-500/20";

    return (
        <div 
            onClick={() => onSelect(task)}
            className="bg-[#12131a] hover:bg-[#161824] border border-white/5 hover:border-violet-500/30 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
            {/* Priority Indicator strip */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${priorityColor}`}></div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${priorityBadge}`}>
                        {task.priority || "medium"}
                    </span>
                    {task.meetingId && (
                        <span className="text-[9px] font-semibold text-violet-400 flex items-center gap-1 bg-violet-500/10 px-1.5 py-0.5 rounded">
                            <Sparkles className="w-2.5 h-2.5" /> Meeting
                        </span>
                    )}
                </div>

                <h4 className="font-semibold text-xs text-white leading-snug group-hover:text-violet-300 transition-colors">
                    {task.title}
                </h4>

                {task.description && (
                    <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                        {task.description}
                    </p>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-1 text-[10px]">
                {/* Assignee badge */}
                <div className="flex items-center gap-1.5 text-neutral-400">
                    <div className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/30 flex items-center justify-center font-bold text-[9px] uppercase">
                        {task.assignee ? task.assignee.fullName?.charAt(0) || "?" : "?"}
                    </div>
                    <span className="truncate max-w-[85px] font-medium text-[10px] text-neutral-300">
                        {task.assignee ? task.assignee.fullName : "Unassigned"}
                    </span>
                </div>

                {/* Move card controls */}
                <div 
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1"
                >
                    {task.status !== "todo" && (
                        <button
                            onClick={() => onMove(task, "left")}
                            className="bg-white/5 hover:bg-white/15 border border-white/5 p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
                            title="Move Left"
                        >
                            <ArrowLeftIcon className="w-3 h-3" />
                        </button>
                    )}
                    {task.status !== "done" && (
                        <button
                            onClick={() => onMove(task, "right")}
                            className="bg-white/5 hover:bg-white/15 border border-white/5 p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
                            title="Move Right"
                        >
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
