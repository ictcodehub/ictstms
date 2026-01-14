import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import PullToRefresh from '../components/PullToRefresh';
import { Mail, Lock, AlertCircle, ArrowRight, LogIn, Eye, EyeOff, CheckCircle, Flame, X } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false); // For button loading
    const [showSuccessLoader, setShowSuccessLoader] = useState(false); // For full screen success loading
    const { login, currentUser } = useAuth();
    const navigate = useNavigate();

    if (currentUser) {
        return <Navigate to="/" />;
    }

    const handleLogin = async (e) => {
        e.preventDefault();

        // Email Domain Validation
        if (!email.endsWith('@mutiarabangsa.sch.id')) {
            setError('Email harus menggunakan domain @mutiarabangsa.sch.id');
            return;
        }

        try {
            setError('');
            setIsSubmitting(true);
            await login(email, password, rememberMe);

            // On success, show full screen loader before navigating
            setIsSubmitting(false);
            setShowSuccessLoader(true);

            setTimeout(() => {
                navigate('/');
            }, 1000); // Give a small delay for the success sensation
        } catch (err) {
            console.error(err);
            setIsSubmitting(false);
            setErrorMessage('Invalid email or password. Please try again.');
            setShowErrorModal(true);
        }
    };

    return (
        <div className="h-screen w-full overflow-hidden">
            <PullToRefresh onRefresh={() => window.location.reload()}>
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 py-3 sm:py-4 xl:py-8 px-4 relative">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-400/20 rounded-full blur-3xl"></div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white/80 backdrop-blur-xl p-6 sm:p-7 xl:p-10 rounded-3xl shadow-2xl w-full max-w-md xl:max-w-lg 2xl:max-w-xl mb-2 sm:mb-3 xl:mb-6 relative z-10 border border-white/50"
                    >
                        <div className="text-center mb-3 sm:mb-4 xl:mb-7">
                            <motion.img
                                src="/favicon.png"
                                alt="Logo"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                                className="w-14 h-14 sm:w-16 sm:h-16 xl:w-24 xl:h-24 mx-auto mb-2 sm:mb-3 xl:mb-5 rounded-xl"
                            />
                            <h2 className="text-xl sm:text-2xl xl:text-3xl font-bold text-slate-800 mb-1">ICT Codehub</h2>
                            <p className="text-xs sm:text-sm xl:text-base text-slate-500">Learning Management System</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4 xl:space-y-6">
                            {/* Inline validation error (Domain check) */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-red-50 text-red-600 p-3 xl:p-4 rounded-xl flex items-center gap-2 text-sm xl:text-base border border-red-100"
                                >
                                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                    <p>{error}</p>
                                </motion.div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm xl:text-base font-semibold text-gray-700 ml-1">Email</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        className={`w-full pl-11 pr-4 py-3 xl:py-4 text-sm xl:text-base bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all group-hover:bg-white ${error ? 'border-red-300 focus:ring-red-200' : 'border-gray-200'}`}
                                        placeholder="email@mutiarabangsa.sch.id"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (error) setError(''); // Clear error when typing
                                        }}
                                        onBlur={() => {
                                            if (email && !email.endsWith('@mutiarabangsa.sch.id')) {
                                                setError('Email harus menggunakan domain @mutiarabangsa.sch.id');
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm xl:text-base font-semibold text-gray-700 ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="w-full pl-11 pr-12 py-3 xl:py-4 text-sm xl:text-base bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all group-hover:bg-white"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white group-hover:border-blue-400'}`}>
                                        {rememberMe && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                    <span className="text-sm xl:text-base text-slate-600 font-medium group-hover:text-blue-600 transition-colors">Remember Me</span>
                                </label>
                                <Link to="/forgot-password" className="text-sm xl:text-base font-medium text-blue-600 hover:text-blue-700 hover:underline">
                                    Forgot Password?
                                </Link>
                            </div>

                            <button
                                disabled={isSubmitting}
                                type="submit"
                                style={{ backgroundColor: '#2563eb', color: 'white' }}
                                className="w-full bg-blue-600 text-white py-3 xl:py-4 text-base xl:text-lg rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {isSubmitting ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Login <LogIn className="h-5 w-5" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-4 sm:mt-5 xl:mt-7 text-center text-sm xl:text-base">
                            <p className="text-gray-500">
                                Don't have an account?{' '}
                                <Link to="/register" className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                                    Register here
                                </Link>
                            </p>
                        </div>
                    </motion.div>

                    {/* Credits Footer */}
                    <div className="absolute bottom-0 left-0 w-full bg-white/60 backdrop-blur-md border-t border-white/40 py-3 px-4 text-center z-10">
                        <p className="text-xs text-slate-600 font-medium flex items-center justify-center gap-1">
                            Made with <Flame className="h-3 w-3 text-orange-500 fill-orange-500 animate-pulse" /> by Mr. Tio • Powered by Google Antigravity & Firebase
                        </p>
                    </div>
                </div>
            </PullToRefresh>

            {/* Full-Screen Loading Overlay - Shown ONLY after successful login */}
            <AnimatePresence>
                {showSuccessLoader && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm"
                    >
                        <div className="mb-6 relative">
                            {/* Glow effect */}
                            <div className="absolute inset-0 bg-blue-400/30 blur-2xl rounded-full scale-150 animate-pulse"></div>
                            <img src="/favicon.png" alt="ICT Codehub" className="w-28 h-28 rounded-2xl shadow-2xl relative z-10" />
                        </div>
                        <div className="text-center relative z-10">
                            <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-1">ICT Codehub</h1>
                            <p className="text-sm text-slate-500 font-medium">Welcome back!</p>
                        </div>
                        {/* Loading Indicator */}
                        <div className="mt-8">
                            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Error Modal */}
            <AnimatePresence>
                {showErrorModal && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowErrorModal(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-md"
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm relative z-10"
                        >
                            <div className="flex flex-col items-center text-center">
                                {/* Icon Wrapper with Pulse Effect */}
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-75"></div>
                                    <div className="relative w-20 h-20 bg-red-50 rounded-full flex items-center justify-center border border-red-100">
                                        <X className="h-10 w-10 text-red-500" strokeWidth={2.5} />
                                    </div>
                                </div>

                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Login Failed</h3>
                                <p className="text-slate-500 mb-8 leading-relaxed text-sm">
                                    {errorMessage || 'Invalid email or password. Please try again.'}
                                </p>

                                <button
                                    onClick={() => setShowErrorModal(false)}
                                    className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200 active:scale-[0.98]"
                                >
                                    Try Again
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
