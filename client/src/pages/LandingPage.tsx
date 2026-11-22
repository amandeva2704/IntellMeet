import { Link } from "react-router-dom";
import { Video, Bot, MessageSquare, LayoutDashboard, Users, TrendingUp, ArrowRight, Shield } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#08090c] text-white overflow-hidden relative">
            {/* Glowing background circles */}
            <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-fuchsia-600/10 blur-[150px] pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/3 w-80 h-80 rounded-full bg-blue-600/5 blur-[120px] pointer-events-none"></div>

            {/* Navigation */}
            <header className="border-b border-white/5 backdrop-blur-md sticky top-0 z-50 bg-[#08090c]/70">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Video className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                            IntellMeet
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link to="/login" className="text-sm font-medium text-neutral-300 hover:text-white transition-colors px-4 py-2">
                            Log In
                        </Link>
                        <Link to="/register" className="glow-btn bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white px-5  py-2.5 rounded-xl transition-all">
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-6 pt-20 pb-24 relative z-10">
                <div className="text-center max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-8">
                        <Bot className="w-3.5 h-3.5" /> Introducing IntellMeet AI v2.0
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none mb-6">
                        Meetings are now
                        <span className="block mt-2 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent text-glow">
                            Actionable, Real-Time & Smart
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-neutral-400 font-medium leading-relaxed mb-10">
                        Stop wasting hours on meeting summaries and follow-ups. IntellMeet handles real-time video meetings, extracts smart action items, compiles automatic summaries, and updates your project board instantly.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/register" className="w-full sm:w-auto glow-btn bg-violet-600 hover:bg-violet-500 text-base font-semibold px-8 py-4 rounded-xl flex items-center justify-center gap-2 group">
                            Start Free Trial
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link to="/login" className="w-full sm:w-auto px-8 py-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-base font-semibold transition-all">
                            Join Guest Meeting
                        </Link>
                    </div>
                </div>

                {/* Dashboard Mockup Banner */}
                <div className="mt-20 glass-panel rounded-2xl p-3 border border-white/10 shadow-2xl relative">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-violet-600/10 to-indigo-600/10 pointer-events-none"></div>
                    <div className="bg-[#0b0c10]/90 rounded-xl overflow-hidden border border-white/5 p-6 md:p-8 flex flex-col md:flex-row items-stretch justify-between gap-8 min-h-[380px]">
                        <div className="flex-1 flex flex-col justify-center space-y-6">
                            <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Enterprise Ready Workspace</span>
                            <h2 className="text-3xl md:text-4xl font-bold leading-tight">Collaborative Project Kanban Sync</h2>
                            <p className="text-neutral-400 leading-relaxed text-sm">
                                Tasks generated directly from Whisper speech-to-text transcriptions mapped automatically to your developer boards. Click to assign, update progress, and coordinate with real-time sockets.
                            </p>
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                                    <Shield className="w-4 h-4 text-emerald-400" /> End-to-End Encryption
                                </div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                                    <Bot className="w-4 h-4 text-violet-400" /> GPT-4o Action Extractor
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 bg-gradient-to-br from-[#12131a] to-[#1c1d29] rounded-xl border border-white/5 p-4 flex flex-col gap-4 shadow-inner">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs text-neutral-400">
                                <span className="font-semibold text-white">Project Sprint Board</span>
                                <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 font-bold">Live Synced</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 h-full min-h-[160px]">
                                <div className="bg-black/20 rounded p-2 border border-white/5 space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-indigo-400">Todo</span>
                                    <div className="bg-[#1a1b26] p-2 rounded text-[11px] border border-white/5">Configure MongoDB URI</div>
                                    <div className="bg-[#1a1b26] p-2 rounded text-[11px] border border-white/5">Update User Model</div>
                                </div>
                                <div className="bg-black/20 rounded p-2 border border-white/5 space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-amber-400">In Progress</span>
                                    <div className="bg-[#1a1b26] p-2 rounded text-[11px] border border-amber-500/20 border-l-2 border-l-amber-400">Real-Time WebRTC</div>
                                </div>
                                <div className="bg-black/20 rounded p-2 border border-white/5 space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-emerald-400">Done</span>
                                    <div className="bg-[#1a1b26] p-2 rounded text-[11px] opacity-60 line-through border border-white/5">JWT Auth Routes</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features Section */}
                <div className="mt-32">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Core Platform Capabilities</h2>
                        <p className="text-neutral-400">Everything your remote and hybrid teams need to collaborate securely and efficiently in one workspace.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Feature 1 */}
                        <div className="glass-panel hover:border-violet-500/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1">
                            <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-5 shadow-inner">
                                <Video className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Real-Time Video Meetings</h3>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Low-latency video conferencing using WebRTC + Socket.io room matching. Share screen, mute inputs, and coordinate without meeting lags.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="glass-panel hover:border-violet-500/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1">
                            <div className="w-12 h-12 rounded-xl bg-fuchsia-600/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 mb-5 shadow-inner">
                                <Bot className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">AI Meeting Intelligence</h3>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Automatic AI transcripts, executive summaries, and action item extraction. Integrates seamlessly with OpenAI or runs local offline simulations.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="glass-panel hover:border-violet-500/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1">
                            <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-5 shadow-inner">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">In-Meeting Collaboration</h3>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Real-time room chat, collaborative markdown notes, typing indicators, and live member checklist synced across all active peers.
                            </p>
                        </div>

                        {/* Feature 4 */}
                        <div className="glass-panel hover:border-violet-500/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1">
                            <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5 shadow-inner">
                                <LayoutDashboard className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Post-Meeting Dashboard</h3>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Complete room history lookup. Inspect, search, and export transcribed text, generated summaries, and assigned deliverables.
                            </p>
                        </div>

                        {/* Feature 5 */}
                        <div className="glass-panel hover:border-violet-500/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1">
                            <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 shadow-inner">
                                <Users className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Team Workspaces</h3>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Create workspaces, invite teammates by email, manage team projects, and assign meeting-extracted actions directly to members.
                            </p>
                        </div>

                        {/* Feature 6 */}
                        <div className="glass-panel hover:border-violet-500/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1">
                            <div className="w-12 h-12 rounded-xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-5 shadow-inner">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Analytics & Insights</h3>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                Visual graphs detailing meeting volume, participation rates, and task completion metrics to optimize team performance.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 relative z-10 bg-[#08090c]">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-neutral-500">
                    <span className="font-semibold text-neutral-400">© 2026 IntellMeet. Industry Edition 2.0.</span>
                    <span>Crafted for Zidio Development Portfolio.</span>
                </div>
            </footer>
        </div>
    );
}
