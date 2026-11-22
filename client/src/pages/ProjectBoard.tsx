import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store/store";
import type { Task } from "../store/store";
import { socket } from "../services/socket";
import { 
    Layout, ArrowLeft, Plus, Trash2, 
    ArrowRight, ArrowLeft as ArrowLeftIcon
} from "lucide-react";
import toast from "react-hot-toast";

export default function ProjectBoard() {
    const { 
        activeWorkspace, fetchWorkspaces,
        tasks, fetchTasks, createTask, updateTaskStatus, deleteTask
    } = useStore();

    // Board configuration/input states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [filterAssignee, setFilterAssignee] = useState("all");
    const [filterPriority, setFilterPriority] = useState("all");

    // Create task inputs
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
    const [assigneeId, setAssigneeId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    useEffect(() => {
        if (activeWorkspace) {
            fetchTasks(activeWorkspace._id);

            // Connect socket room sync
            socket.connect();
            
            // Listen for sync triggers
            socket.on("refresh-kanban-board", ({ workspaceId }) => {
                if (workspaceId === activeWorkspace._id) {
                    fetchTasks(workspaceId);
                    toast.success("Board synced in real time", { icon: "🔄" });
                }
            });
        }

        return () => {
            socket.off("refresh-kanban-board");
        };
    }, [activeWorkspace, fetchTasks]);

    // Move task function
    const handleMoveTask = async (task: Task, direction: "left" | "right") => {
        let newStatus: "todo" | "in-progress" | "done" = "todo";
        
        if (task.status === "todo" && direction === "right") newStatus = "in-progress";
        else if (task.status === "in-progress" && direction === "right") newStatus = "done";
        else if (task.status === "in-progress" && direction === "left") newStatus = "todo";
        else if (task.status === "done" && direction === "left") newStatus = "in-progress";

        await updateTaskStatus(task._id, newStatus);
        toast.success(`Task moved to ${newStatus.replace("-", " ")}`);
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

    const handleDeleteTask = async (taskId: string) => {
        const confirm = window.confirm("Are you sure you want to delete this task?");
        if (!confirm) return;

        try {
            await deleteTask(taskId);
            setSelectedTask(null);
            toast.success("Task deleted");
        } catch (err) {
            toast.error("Failed to delete task");
        }
    };

    // Filter Tasks
    const filteredTasks = tasks.filter((t) => {
        const matchAssignee = 
            filterAssignee === "all" || 
            (filterAssignee === "unassigned" && !t.assignee) ||
            (t.assignee && t.assignee._id === filterAssignee);

        const matchPriority = filterPriority === "all" || t.priority === filterPriority;
        
        return matchAssignee && matchPriority;
    });

    const todoTasks = filteredTasks.filter((t) => t.status === "todo");
    const inProgressTasks = filteredTasks.filter((t) => t.status === "in-progress");
    const doneTasks = filteredTasks.filter((t) => t.status === "done");

    return (
        <div className="min-h-screen bg-[#08090c] text-white flex flex-col md:flex-row relative">
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none"></div>

            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 border-r border-white/5 bg-[#0a0b0f] flex flex-col shrink-0">
                <div className="h-16 border-b border-white/5 flex items-center gap-2.5 px-6">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow shadow-violet-500/20">
                        <Layout className="w-4 h-4 text-white" />
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
                    {/* Active Workspace Info */}
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-2">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Current Workspace</span>
                        <h4 className="font-bold text-sm text-violet-400 truncate">
                            {activeWorkspace?.name || "None Selected"}
                        </h4>
                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                            All tasks created on this Kanban board are visible and synced in real time to all active members of this workspace.
                        </p>
                    </div>

                    {/* Filter controls */}
                    <div className="space-y-4">
                        <span className="block text-xs font-bold uppercase tracking-wider text-neutral-500">Board Filters</span>
                        
                        <div>
                            <label className="block text-[10px] text-neutral-400 mb-1.5 uppercase font-medium">Assignee</label>
                            <select
                                value={filterAssignee}
                                onChange={(e) => setFilterAssignee(e.target.value)}
                                className="w-full text-xs px-3 py-2 rounded-xl glass-input"
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
                                className="w-full text-xs px-3 py-2 rounded-xl glass-input"
                            >
                                <option value="all">All Priorities</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">Project Kanban Board</h1>
                            <p className="text-neutral-400 text-sm">
                                Sync actions and tasks for workspace: <strong className="text-violet-400 font-bold">{activeWorkspace?.name}</strong>
                            </p>
                        </div>

                        <button
                            onClick={() => setShowCreateModal(true)}
                            disabled={!activeWorkspace}
                            className="glow-btn bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 self-start sm:self-auto"
                        >
                            <Plus className="w-4 h-4" /> Add Custom Task
                        </button>
                    </div>

                    {/* Columns grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start min-h-[500px]">
                        
                        {/* Todo Column */}
                        <div className="glass-panel rounded-2xl p-4 border border-white/5 flex flex-col min-h-[400px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4 text-xs">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                                    <span>To Do</span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-semibold text-neutral-400">
                                    {todoTasks.length}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {todoTasks.length === 0 ? (
                                    <div className="text-center py-10 text-neutral-500 text-xs italic">
                                        No tasks in queue
                                    </div>
                                ) : (
                                    todoTasks.map((task) => (
                                        <CardComponent 
                                            key={task._id} 
                                            task={task} 
                                            onMove={handleMoveTask} 
                                            onSelect={setSelectedTask} 
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* In Progress Column */}
                        <div className="glass-panel rounded-2xl p-4 border border-white/5 flex flex-col min-h-[400px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4 text-xs">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                    <span>In Progress</span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-semibold text-neutral-400">
                                    {inProgressTasks.length}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {inProgressTasks.length === 0 ? (
                                    <div className="text-center py-10 text-neutral-500 text-xs italic">
                                        No tasks active
                                    </div>
                                ) : (
                                    inProgressTasks.map((task) => (
                                        <CardComponent 
                                            key={task._id} 
                                            task={task} 
                                            onMove={handleMoveTask} 
                                            onSelect={setSelectedTask} 
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Done Column */}
                        <div className="glass-panel rounded-2xl p-4 border border-white/5 flex flex-col min-h-[400px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4 text-xs">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                    <span>Done</span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-semibold text-neutral-400">
                                    {doneTasks.length}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {doneTasks.length === 0 ? (
                                    <div className="text-center py-10 text-neutral-500 text-xs italic text-glow">
                                        No tasks completed
                                    </div>
                                ) : (
                                    doneTasks.map((task) => (
                                        <CardComponent 
                                            key={task._id} 
                                            task={task} 
                                            onMove={handleMoveTask} 
                                            onSelect={setSelectedTask} 
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg glass-panel-heavy rounded-3xl p-6 md:p-8 border border-white/10 relative">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <PlusCircleIcon className="w-5 h-5 text-violet-400" /> Create Workspace Task
                        </h2>

                        <form onSubmit={handleCreateTask} className="space-y-4">
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Task Title</label>
                                <input
                                    type="text"
                                    placeholder="Task summary/title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full text-xs px-3 py-2.5 rounded-xl glass-input"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Description</label>
                                <textarea
                                    placeholder="Enter task specs..."
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
                                        className="w-full text-xs px-3 py-2.5 rounded-xl glass-input"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Due Date</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full text-xs px-3 py-2 rounded-xl glass-input"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1.5">Assign User</label>
                                <select
                                    value={assigneeId}
                                    onChange={(e) => setAssigneeId(e.target.value)}
                                    className="w-full text-xs px-3 py-2.5 rounded-xl glass-input"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {activeWorkspace.members?.map((m) => (
                                        <option key={m._id} value={m._id}>
                                            {m.fullName}
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

            {/* Task Details Dialog Modal Overlay */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg glass-panel-heavy rounded-3xl p-6 md:p-8 border border-white/10 relative">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                selectedTask.status === "todo" ? "bg-indigo-500/10 text-indigo-400" :
                                selectedTask.status === "in-progress" ? "bg-amber-500/10 text-amber-400" :
                                "bg-emerald-500/10 text-emerald-400"
                            }`}>
                                {selectedTask.status.replace("-", " ").toUpperCase()}
                            </span>
                            <button
                                onClick={() => handleDeleteTask(selectedTask._id)}
                                className="text-red-400 hover:text-red-300 font-bold transition-all p-1 hover:bg-red-500/5 rounded"
                                title="Delete Task"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-bold text-white leading-tight">{selectedTask.title}</h3>
                                <p className="text-neutral-400 text-xs mt-2 whitespace-pre-line leading-relaxed">
                                    {selectedTask.description || "No description provided."}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 text-xs text-neutral-400">
                                <div>
                                    <span className="block text-[9px] uppercase font-bold text-neutral-500 mb-1">Priority</span>
                                    <span className={`font-semibold uppercase ${
                                        selectedTask.priority === "high" ? "text-rose-400" :
                                        selectedTask.priority === "medium" ? "text-amber-400" :
                                        "text-blue-400"
                                    }`}>
                                        {selectedTask.priority}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[9px] uppercase font-bold text-neutral-500 mb-1">Due Date</span>
                                    <span className="font-semibold text-white">
                                        {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : "No due date"}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[9px] uppercase font-bold text-neutral-500 mb-1">Assigned Owner</span>
                                    <span className="font-semibold text-white">
                                        {selectedTask.assignee?.fullName || "Unassigned"}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[9px] uppercase font-bold text-neutral-500 mb-1">Creator</span>
                                    <span className="font-semibold text-white">
                                        {selectedTask.creator?.fullName || "System"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6">
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="bg-violet-600 hover:bg-violet-500 text-xs px-5 py-2.5 rounded-xl font-bold transition-all"
                            >
                                Close Details
                            </button>
                        </div>
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
    return (
        <div 
            onClick={() => onSelect(task)}
            className="bg-[#12131a] hover:bg-[#151620] border border-white/5 hover:border-violet-500/20 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow transition-all cursor-pointer relative overflow-hidden group"
        >
            {/* Priority Indicator strip */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                task.priority === "high" ? "bg-rose-500" :
                task.priority === "medium" ? "bg-amber-500" :
                "bg-blue-500"
            }`}></div>

            <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white leading-snug group-hover:text-violet-300 transition-colors">
                    {task.title}
                </h4>
                <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                    {task.description || "No description specs..."}
                </p>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-1 text-[10px]">
                {/* Assignee initials badge */}
                <div className="flex items-center gap-1.5 text-neutral-400">
                    <div className="w-4 h-4 rounded-full bg-violet-600/10 text-violet-400 border border-violet-500/20 flex items-center justify-center font-bold text-[8px] uppercase">
                        {task.assignee ? task.assignee.fullName?.charAt(0) || "?" : "?"}
                    </div>
                    <span className="truncate max-w-[80px] font-medium text-[9px]">
                        {task.assignee ? task.assignee.fullName : "Unassigned"}
                    </span>
                </div>

                {/* Move card controls (only show on desktop/click) */}
                <div 
                    onClick={(e) => e.stopPropagation()} // Stop modal from opening
                    className="flex gap-1.5 print:hidden"
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

// Inline sub-icon helpers
function PlusCircleIcon(props: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={props.className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}
