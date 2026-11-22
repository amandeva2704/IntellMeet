import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useStore } from "./store/store";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import MeetingRoom from "./pages/MeetingRoom";
import MeetingSummary from "./pages/MeetingSummary";
import ProjectBoard from "./pages/ProjectBoard";
import Analytics from "./pages/Analytics";

// Protected Route Guard
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, fetchProfile, token, user } = useStore();
    const [checking, setChecking] = useState(true);
    const location = useLocation();

    useEffect(() => {
        const verifyUser = async () => {
            if (token && !user) {
                try {
                    await fetchProfile();
                } catch (e) {
                    console.error("Token verification failed", e);
                }
            }
            setChecking(false);
        };
        verifyUser();
    }, [token, user, fetchProfile]);

    if (checking) {
        return (
            <div className="min-h-screen bg-[#08090c] text-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
        );
    }

    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return isAuthenticated ? <>{children}</> : <Navigate to={`/login?redirect=${redirectPath}`} replace />;
}

// Public Route Guard (Redirects to dashboard if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useStore();
    return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function App() {
    const { fetchProfile, token } = useStore();

    useEffect(() => {
        if (token) {
            fetchProfile();
        }
    }, [token, fetchProfile]);

    return (
        <BrowserRouter>
            <Toaster 
                position="top-right"
                toastOptions={{
                    style: {
                        background: "#0e0f14",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.08)"
                    }
                }}
            />
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route 
                    path="/login" 
                    element={
                        <PublicRoute>
                            <LoginPage />
                        </PublicRoute>
                    } 
                />
                <Route 
                    path="/register" 
                    element={
                        <PublicRoute>
                            <RegisterPage />
                        </PublicRoute>
                    } 
                />

                {/* Protected Enterprise Portal Routes */}
                <Route 
                    path="/dashboard" 
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/meeting/:roomId" 
                    element={
                        <ProtectedRoute>
                            <MeetingRoom />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/meeting/:roomId/summary" 
                    element={
                        <ProtectedRoute>
                            <MeetingSummary />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/project" 
                    element={
                        <ProtectedRoute>
                            <ProjectBoard />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/analytics" 
                    element={
                        <ProtectedRoute>
                            <Analytics />
                        </ProtectedRoute>
                    } 
                />

                {/* Catch All Redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
