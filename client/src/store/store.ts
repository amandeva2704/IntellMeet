import { create } from "zustand";
import api from "../services/api";
import { socket } from "../services/socket";

// Define Interfaces
export interface User {
    _id: string;
    fullName: string;
    email: string;
    avatar?: string;
    role: string;
    isVerified: boolean;
}

export interface Workspace {
    _id: string;
    name: string;
    description?: string;
    owner: User | string;
    members: User[];
    createdAt: string;
}

export interface Participant {
    user: User | string;
    name: string;
    joinedAt: string;
}

export interface TranscriptItem {
    sender: string;
    text: string;
    timestamp: string;
}

export interface ActionItem {
    _id: string;
    title: string;
    assigneeName?: string;
    status: "pending" | "created";
}

export interface Meeting {
    _id: string;
    roomId: string;
    title: string;
    host: User | string;
    participants: Participant[];
    status: "active" | "completed";
    startTime: string;
    endTime?: string;
    transcript: TranscriptItem[];
    summary?: string;
    actionItems: ActionItem[];
    createdAt: string;
}

export interface Task {
    _id: string;
    title: string;
    description?: string;
    status: "todo" | "in-progress" | "done";
    priority: "low" | "medium" | "high";
    assignee?: User;
    creator: User;
    meetingId?: any;
    workspaceId?: string;
    dueDate?: string;
    createdAt: string;
}

interface AppState {
    // Auth Slices
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    authLoading: boolean;
    setAuth: (user: User | null, token: string | null) => void;
    login: (credentials: any) => Promise<any>;
    register: (details: any) => Promise<any>;
    logout: () => Promise<void>;
    fetchProfile: () => Promise<void>;

    // Workspaces Slices
    workspaces: Workspace[];
    activeWorkspace: Workspace | null;
    workspacesLoading: boolean;
    fetchWorkspaces: () => Promise<void>;
    createWorkspace: (name: string, description?: string) => Promise<Workspace>;
    selectWorkspace: (workspace: Workspace | null) => void;
    inviteMember: (workspaceId: string, email: string) => Promise<void>;

    // Meetings Slices
    meetings: Meeting[];
    activeMeeting: Meeting | null;
    meetingsLoading: boolean;
    fetchMeetings: () => Promise<void>;
    createMeeting: (title: string) => Promise<Meeting>;
    joinMeeting: (roomId: string) => Promise<Meeting>;
    getMeetingDetails: (roomId: string) => Promise<Meeting>;
    updateMeetingDetails: (meeting: Meeting) => void;
    endMeeting: (roomId: string) => Promise<Meeting>;
    addTranscriptMessage: (roomId: string, sender: string, text: string) => Promise<void>;

    // Tasks Slices
    tasks: Task[];
    tasksLoading: boolean;
    fetchTasks: (workspaceId: string) => Promise<void>;
    createTask: (taskData: any) => Promise<Task>;
    updateTaskStatus: (taskId: string, status: "todo" | "in-progress" | "done") => Promise<void>;
    updateTaskDetails: (taskId: string, details: any) => Promise<Task>;
    deleteTask: (taskId: string) => Promise<void>;
    createTasksFromActionItems: (meetingId: string, workspaceId: string, actionItems: any[]) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
    // Auth State & Actions
    user: null,
    token: localStorage.getItem("token"),
    isAuthenticated: !!localStorage.getItem("token"),
    authLoading: false,

    setAuth: (user, token) => {
        if (token) {
            localStorage.setItem("token", token);
        } else {
            localStorage.removeItem("token");
        }
        set({ user, token, isAuthenticated: !!token });
    },

    login: async (credentials) => {
        set({ authLoading: true });
        try {
            const res = await api.post("/auth/login", credentials);
            const { user, token } = res.data;
            get().setAuth(user, token);
            set({ authLoading: false });
            return res.data;
        } catch (err: any) {
            set({ authLoading: false });
            throw new Error(err.response?.data?.message || "Login failed");
        }
    },

    register: async (details) => {
        set({ authLoading: true });
        try {
            const res = await api.post("/auth/register", details);
            const { user, token } = res.data;
            if (user && token) {
                get().setAuth(user, token);
            }
            set({ authLoading: false });
            return res.data;
        } catch (err: any) {
            set({ authLoading: false });
            throw new Error(err.response?.data?.message || "Registration failed");
        }
    },

    logout: async () => {
        try {
            await api.post("/auth/logout");
        } catch (e) {
            console.error("Logout error details:", e);
        } finally {
            get().setAuth(null, null);
            socket.disconnect();
            set({
                workspaces: [],
                activeWorkspace: null,
                meetings: [],
                activeMeeting: null,
                tasks: []
            });
        }
    },

    fetchProfile: async () => {
        if (!get().token) return;
        set({ authLoading: true });
        try {
            const res = await api.get("/auth/profile");
            set({ user: res.data.user, isAuthenticated: true, authLoading: false });
        } catch (err) {
            console.warn("Invalid profile token. Clearing auth.");
            get().setAuth(null, null);
            set({ authLoading: false });
        }
    },

    // Workspace State & Actions
    workspaces: [],
    activeWorkspace: null,
    workspacesLoading: false,

    fetchWorkspaces: async () => {
        set({ workspacesLoading: true });
        try {
            const res = await api.get("/workspaces");
            const workspaces = res.data.workspaces;
            set({ workspaces, workspacesLoading: false });
            
            // Auto select first workspace if none active
            if (workspaces.length > 0 && !get().activeWorkspace) {
                set({ activeWorkspace: workspaces[0] });
            }
        } catch (err) {
            set({ workspacesLoading: false });
        }
    },

    createWorkspace: async (name, description) => {
        try {
            const res = await api.post("/workspaces", { name, description });
            const workspace = res.data.workspace;
            set((state) => ({
                workspaces: [workspace, ...state.workspaces],
                activeWorkspace: state.activeWorkspace || workspace
            }));
            return workspace;
        } catch (err: any) {
            throw new Error(err.response?.data?.message || "Failed to create workspace");
        }
    },

    selectWorkspace: (workspace) => {
        set({ activeWorkspace: workspace });
    },

    inviteMember: async (workspaceId, email) => {
        try {
            const res = await api.post(`/workspaces/${workspaceId}/invite`, { email });
            const updatedWorkspace = res.data.workspace;
            set((state) => ({
                workspaces: state.workspaces.map((w) =>
                    w._id === workspaceId ? updatedWorkspace : w
                ),
                activeWorkspace:
                    state.activeWorkspace?._id === workspaceId ? updatedWorkspace : state.activeWorkspace
            }));
        } catch (err: any) {
            throw new Error(err.response?.data?.message || "Failed to invite member");
        }
    },

    // Meetings State & Actions
    meetings: [],
    activeMeeting: null,
    meetingsLoading: false,

    fetchMeetings: async () => {
        set({ meetingsLoading: true });
        try {
            const res = await api.get("/meetings/history");
            set({ meetings: res.data.meetings, meetingsLoading: false });
        } catch (err) {
            set({ meetingsLoading: false });
        }
    },

    createMeeting: async (title) => {
        try {
            const res = await api.post("/meetings", { title });
            const meeting = res.data.meeting;
            set((state) => ({
                meetings: [meeting, ...state.meetings],
                activeMeeting: meeting
            }));
            return meeting;
        } catch (err: any) {
            throw new Error(err.response?.data?.message || "Failed to create meeting");
        }
    },

    joinMeeting: async (roomId) => {
        try {
            const res = await api.post(`/meetings/${roomId}/join`);
            const meeting = res.data.meeting;
            set({ activeMeeting: meeting });
            return meeting;
        } catch (err: any) {
            throw new Error(err.response?.data?.message || "Failed to join meeting");
        }
    },

    getMeetingDetails: async (roomId) => {
        try {
            const res = await api.get(`/meetings/${roomId}`);
            const meeting = res.data.meeting;
            set({ activeMeeting: meeting });
            return meeting;
        } catch (err: any) {
            throw new Error(err.response?.data?.message || "Failed to fetch meeting details");
        }
    },

    updateMeetingDetails: (meeting) => {
        set({ activeMeeting: meeting });
    },

    endMeeting: async (roomId) => {
        try {
            const res = await api.post(`/meetings/${roomId}/end`);
            const meeting = res.data.meeting;
            set((state) => ({
                meetings: state.meetings.map((m) => (m.roomId === roomId ? meeting : m)),
                activeMeeting: state.activeMeeting?.roomId === roomId ? meeting : state.activeMeeting
            }));
            return meeting;
        } catch (err: any) {
            throw new Error(err.response?.data?.message || "Failed to end meeting");
        }
    },

    addTranscriptMessage: async (roomId, sender, text) => {
        try {
            const res = await api.put(`/meetings/${roomId}/transcript`, { sender, text });
            const meeting = res.data.meeting;
            set({ activeMeeting: meeting });
        } catch (err) {
            console.error("Failed to post transcript message", err);
        }
    },

    // Tasks State & Actions
    tasks: [],
    tasksLoading: false,

    fetchTasks: async (workspaceId) => {
        set({ tasksLoading: true });
        try {
            const res = await api.get(`/tasks/workspace/${workspaceId}`);
            set({ tasks: res.data.tasks, tasksLoading: false });
        } catch (err) {
            set({ tasksLoading: false });
        }
    },

    createTask: async (taskData) => {
        try {
            const res = await api.post("/tasks", taskData);
            const task = res.data.task;
            set((state) => ({
                tasks: [task, ...state.tasks]
            }));
            // Trigger socket board refresh sync
            if (task.workspaceId) {
                socket.emit("kanban-task-change", { workspaceId: task.workspaceId });
            }
            return task;
        } catch (err: any) {
            throw new Error(err.response?.data?.message || "Failed to create task");
        }
    },

    updateTaskStatus: async (taskId, status) => {
        // Optimistic update
        set((state) => ({
            tasks: state.tasks.map((t) => (t._id === taskId ? { ...t, status } : t))
        }));

        try {
            const res = await api.put(`/tasks/${taskId}`, { status });
            const updatedTask = res.data.task;

            set((state) => ({
                tasks: state.tasks.map((t) => (t._id === taskId ? updatedTask : t))
            }));

            // Sync
            if (updatedTask.workspaceId) {
                socket.emit("kanban-task-change", { workspaceId: updatedTask.workspaceId });
            }
        } catch (err) {
            console.error("Failed to update task status", err);
        }
    },

    updateTaskDetails: async (taskId, details) => {
        try {
            const res = await api.put(`/tasks/${taskId}`, details);
            const updatedTask = res.data.task;
            set((state) => ({
                tasks: state.tasks.map((t) => (t._id === taskId ? updatedTask : t))
            }));

            if (updatedTask.workspaceId) {
                socket.emit("kanban-task-change", { workspaceId: updatedTask.workspaceId });
            }
            return updatedTask;
        } catch (err: any) {
            throw new Error(err.response?.data?.message || "Failed to update task details");
        }
    },

    deleteTask: async (taskId) => {
        const taskToDelete = get().tasks.find((t) => t._id === taskId);
        set((state) => ({
            tasks: state.tasks.filter((t) => t._id !== taskId)
        }));

        try {
            await api.delete(`/tasks/${taskId}`);
            if (taskToDelete && taskToDelete.workspaceId) {
                socket.emit("kanban-task-change", { workspaceId: taskToDelete.workspaceId });
            }
        } catch (err) {
            console.error("Failed to delete task", err);
        }
    },

    createTasksFromActionItems: async (meetingId, workspaceId, actionItems) => {
        try {
            const res = await api.post("/tasks/action-items", {
                meetingId,
                workspaceId,
                actionItems
            });
            
            // Update active meeting action items status (they become 'created')
            const updatedMeeting = res.data.meeting;
            set({ activeMeeting: updatedMeeting });

            // Fetch workspace tasks again to refresh Kanban board
            await get().fetchTasks(workspaceId);
        } catch (err: any) {
            throw new Error(err.response?.data?.message || "Failed to import tasks");
        }
    }
}));
