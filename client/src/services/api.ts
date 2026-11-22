import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, "");
const API_BASE_URL = cleanBaseUrl.endsWith("/api") ? cleanBaseUrl : `${cleanBaseUrl}/api`;

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    }
});

// Add a request interceptor to attach JWT token if stored in localStorage
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;
