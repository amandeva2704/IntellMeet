import { io, Socket } from "socket.io-client";

const rawUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SOCKET_URL = rawUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");

export const socket: Socket = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    auth: (cb) => {
        const token = localStorage.getItem("token");
        cb({ token });
    }
});
