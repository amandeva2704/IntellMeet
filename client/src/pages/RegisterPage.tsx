import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../store/store";
import { Video, Mail, Lock, User as UserIcon, Loader2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

export default function RegisterPage() {
    const { register, authLoading } = useStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectParam = searchParams.get("redirect");
    const loginTarget = redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : "/login";

    const [isSlow, setIsSlow] = useState(false);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: ""
    });

    React.useEffect(() => {
        let timer: any;
        if (authLoading) {
            timer = setTimeout(() => setIsSlow(true), 3000);
        } else {
            setIsSlow(false);
        }
        return () => clearTimeout(timer);
    }, [authLoading]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.email || !formData.password) {
            toast.error("Please fill in all fields");
            return;
        }

        if (formData.password.length < 6) {
            toast.error("Password must be at least 6 characters long");
            return;
        }

        try {
            await register(formData);
            toast.success("Account created and signed in successfully!");
            const target = redirectParam ? decodeURIComponent(redirectParam) : "/dashboard";
            navigate(target);
        } catch (error: any) {
            toast.error(error.message || "Failed to register account");
        }
    };

    return (
        <div className="min-h-screen bg-[#08090c] text-white flex items-center justify-center relative px-4">
            {/* Background ambient lighting */}
            <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-violet-600/10 blur-[130px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-fuchsia-600/10 blur-[130px] pointer-events-none"></div>

            <div className="w-full max-w-md glass-panel rounded-3xl p-8 md:p-10 border border-white/10 shadow-2xl relative z-10">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 mb-4">
                        <Video className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Create Account</h2>
                    <p className="text-neutral-400 text-sm mt-1.5">Set up your secure profile portal</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                            Full Name
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                                <UserIcon className="w-4 h-4" />
                            </span>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="Aman Devatwal"
                                className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm font-medium glass-input"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                            Email Address
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                                <Mail className="w-4 h-4" />
                            </span>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@company.com"
                                className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm font-medium glass-input"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                                <Lock className="w-4 h-4" />
                            </span>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm font-medium glass-input"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full glow-btn bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all mt-8"
                    >
                        {authLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                Register Account
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>

                    {isSlow && (
                        <p className="text-xs text-amber-400/90 text-center animate-pulse pt-2">
                            Connecting to cloud server... this may take up to 30 seconds if the free server is waking up.
                        </p>
                    )}
                </form>

                <div className="mt-8 text-center text-sm text-neutral-400">
                    Already have an account?{" "}
                    <Link to={loginTarget} className="text-violet-400 hover:text-violet-300 font-semibold hover:underline">
                        Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
