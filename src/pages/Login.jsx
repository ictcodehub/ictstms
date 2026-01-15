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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccessLoader, setShowSuccessLoader] = useState(false);
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
            }, 1000);
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
                {/* Main Container - Fluid Responsive */}
                <div
                    className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 relative overflow-hidden"
                    style={{
                        padding: 'clamp(0.75rem, 2vw, 2rem) clamp(1rem, 3vw, 1.5rem)'
                    }}
                >
                    {/* Decorative Background Elements - Adaptive Size */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                        <div
                            className="absolute bg-blue-400/20 rounded-full blur-3xl"
                            style={{
                                top: '-10%',
                                left: '-10%',
                                width: 'clamp(200px, 40vw, 600px)',
                                height: 'clamp(200px, 40vh, 600px)'
                            }}
                        ></div>
                        <div
                            className="absolute bg-cyan-400/20 rounded-full blur-3xl"
                            style={{
                                bottom: '-10%',
                                right: '-10%',
                                width: 'clamp(200px, 40vw, 600px)',
                                height: 'clamp(200px, 40vh, 600px)'
                            }}
                        ></div>
                    </div>

                    {/* Login Card - Vertical Rectangle (Portrait) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-[90vw] sm:max-w-md md:max-w-xl lg:max-w-lg relative z-10 border border-white/50"
                        style={{
                            padding: 'clamp(1.5rem, 4vw, 2.5rem)',
                            marginBottom: 'clamp(3rem, 8vh, 5rem)'
                        }}
                    >
                        {/* Header Section - Fluid Typography & Spacing */}
                        <div
                            className="text-center"
                            style={{
                                marginBottom: 'clamp(1.25rem, 4vh, 3rem)' // More breathing room
                            }}
                        >
                            <motion.img
                                src="/favicon.png"
                                alt="Logo"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                                className="mx-auto rounded-xl"
                                style={{
                                    width: 'clamp(72px, 15vw, 104px)', // 72px mobile → 104px desktop (reduced from 120px)
                                    height: 'clamp(72px, 15vw, 104px)',
                                    marginBottom: 'clamp(0.75rem, 2.5vh, 2rem)'
                                }}
                            />
                            <h2
                                className="font-bold text-slate-800 mb-1"
                                style={{
                                    fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', // Bigger: 28px → 40px (was 20px → 32px)
                                    lineHeight: '1.2'
                                }}
                            >
                                ICT Codehub
                            </h2>
                            <p
                                className="text-slate-500"
                                style={{
                                    fontSize: 'clamp(0.875rem, 2.5vw, 1.125rem)' // Bigger: 14px → 18px (was 12px → 16px)
                                }}
                            >
                                Learning Management System
                            </p>
                        </div>

                        {/* Form - Fluid Spacing */}
                        <form
                            onSubmit={handleLogin}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'clamp(0.75rem, 2.5vh, 1.5rem)'
                            }}
                        >
                            {/* Inline validation error */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-red-50 text-red-600 rounded-xl flex items-center gap-2 border border-red-100"
                                    style={{
                                        padding: 'clamp(0.75rem, 2vw, 1rem)',
                                        fontSize: 'clamp(0.875rem, 2vw, 1rem)'
                                    }}
                                >
                                    <AlertCircle
                                        className="flex-shrink-0"
                                        style={{
                                            width: 'clamp(18px, 3vw, 20px)',
                                            height: 'clamp(18px, 3vw, 20px)'
                                        }}
                                    />
                                    <p>{error}</p>
                                </motion.div>
                            )}

                            {/* Email Field */}
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'clamp(0.5rem, 1vh, 0.75rem)'
                                }}
                            >
                                <label
                                    className="font-semibold text-gray-700 ml-1"
                                    style={{
                                        fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
                                    }}
                                >
                                    Email
                                </label>
                                <div className="relative group">
                                    <div
                                        className="absolute inset-y-0 left-0 flex items-center pointer-events-none"
                                        style={{
                                            paddingLeft: 'clamp(0.875rem, 2vw, 1rem)'
                                        }}
                                    >
                                        <Mail
                                            className="text-gray-400 group-focus-within:text-blue-500 transition-colors"
                                            style={{
                                                width: 'clamp(18px, 3vw, 20px)',
                                                height: 'clamp(18px, 3vw, 20px)'
                                            }}
                                        />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        className={`w-full bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all group-hover:bg-white ${error ? 'border-red-300 focus:ring-red-200' : 'border-gray-200'}`}
                                        placeholder="email@mutiarabangsa.sch.id"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (error) setError('');
                                        }}
                                        onBlur={() => {
                                            if (email && !email.endsWith('@mutiarabangsa.sch.id')) {
                                                setError('Email harus menggunakan domain @mutiarabangsa.sch.id');
                                            }
                                        }}
                                        style={{
                                            paddingLeft: 'clamp(2.5rem, 8vw, 2.75rem)',
                                            paddingRight: 'clamp(1rem, 3vw, 1rem)',
                                            paddingTop: 'clamp(0.75rem, 2vh, 1rem)',
                                            paddingBottom: 'clamp(0.75rem, 2vh, 1rem)',
                                            fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'clamp(0.5rem, 1vh, 0.75rem)'
                                }}
                            >
                                <label
                                    className="font-semibold text-gray-700 ml-1"
                                    style={{
                                        fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
                                    }}
                                >
                                    Password
                                </label>
                                <div className="relative group">
                                    <div
                                        className="absolute inset-y-0 left-0 flex items-center pointer-events-none"
                                        style={{
                                            paddingLeft: 'clamp(0.875rem, 2vw, 1rem)'
                                        }}
                                    >
                                        <Lock
                                            className="text-gray-400 group-focus-within:text-blue-500 transition-colors"
                                            style={{
                                                width: 'clamp(18px, 3vw, 20px)',
                                                height: 'clamp(18px, 3vw, 20px)'
                                            }}
                                        />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all group-hover:bg-white"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{
                                            paddingLeft: 'clamp(2.5rem, 8vw, 2.75rem)',
                                            paddingRight: 'clamp(2.75rem, 9vw, 3rem)',
                                            paddingTop: 'clamp(0.75rem, 2vh, 1rem)',
                                            paddingBottom: 'clamp(0.75rem, 2vh, 1rem)',
                                            fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 flex items-center text-gray-400 hover:text-blue-600 transition-colors focus:outline-none"
                                        style={{
                                            paddingRight: 'clamp(0.875rem, 2vw, 1rem)'
                                        }}
                                    >
                                        {showPassword ?
                                            <EyeOff style={{ width: 'clamp(18px, 3vw, 20px)', height: 'clamp(18px, 3vw, 20px)' }} /> :
                                            <Eye style={{ width: 'clamp(18px, 3vw, 20px)', height: 'clamp(18px, 3vw, 20px)' }} />
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me & Forgot Password */}
                            <div
                                className="flex items-center justify-between"
                                style={{
                                    paddingTop: 'clamp(0.25rem, 1vh, 0.5rem)'
                                }}
                            >
                                <label className="flex items-center cursor-pointer group"
                                    style={{
                                        gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
                                    }}
                                >
                                    <div
                                        className={`rounded-md border flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white group-hover:border-blue-400'}`}
                                        style={{
                                            width: 'clamp(18px, 3vw, 20px)',
                                            height: 'clamp(18px, 3vw, 20px)'
                                        }}
                                    >
                                        {rememberMe && <CheckCircle className="text-white" style={{ width: '70%', height: '70%' }} />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                    <span
                                        className="text-slate-600 font-medium group-hover:text-blue-600 transition-colors"
                                        style={{
                                            fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
                                        }}
                                    >
                                        Remember Me
                                    </span>
                                </label>
                                <Link
                                    to="/forgot-password"
                                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                                    style={{
                                        fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
                                    }}
                                >
                                    Forgot Password?
                                </Link>
                            </div>

                            {/* Submit Button */}
                            <button
                                disabled={isSubmitting}
                                type="submit"
                                style={{
                                    backgroundColor: '#2563eb',
                                    color: 'white',
                                    paddingTop: 'clamp(0.75rem, 2.5vh, 1rem)',
                                    paddingBottom: 'clamp(0.75rem, 2.5vh, 1rem)',
                                    fontSize: 'clamp(1rem, 3vw, 1.125rem)',
                                    gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
                                }}
                                className="w-full rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center disabled:opacity-70"
                            >
                                {isSubmitting ? (
                                    <div
                                        className="border-2 border-white/30 border-t-white rounded-full animate-spin"
                                        style={{
                                            width: 'clamp(20px, 4vw, 24px)',
                                            height: 'clamp(20px, 4vw, 24px)'
                                        }}
                                    />
                                ) : (
                                    <>
                                        Login <LogIn style={{ width: 'clamp(18px, 3vw, 20px)', height: 'clamp(18px, 3vw, 20px)' }} />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Register Link */}
                        <div
                            className="text-center"
                            style={{
                                marginTop: 'clamp(1rem, 3vh, 1.75rem)',
                                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
                            }}
                        >
                            <p className="text-gray-500">
                                Don't have an account?{' '}
                                <Link to="/register" className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                                    Register here
                                </Link>
                            </p>
                        </div>
                    </motion.div>

                    {/* Credits Footer - Fluid Sizing */}
                    <div
                        className="absolute bottom-0 left-0 w-full bg-white/60 backdrop-blur-md border-t border-white/40 text-center z-10"
                        style={{
                            padding: 'clamp(0.75rem, 2vh, 1rem) clamp(1rem, 3vw, 1.5rem)'
                        }}
                    >
                        <p
                            className="text-slate-600 font-medium flex items-center justify-center flex-wrap"
                            style={{
                                fontSize: 'clamp(0.625rem, 1.5vw, 0.75rem)',
                                gap: 'clamp(0.25rem, 0.5vw, 0.375rem)'
                            }}
                        >
                            <span>Made with</span>
                            <Flame
                                className="text-orange-500 fill-orange-500 animate-pulse inline-block"
                                style={{
                                    width: 'clamp(10px, 2vw, 12px)',
                                    height: 'clamp(10px, 2vw, 12px)'
                                }}
                            />
                            <span>by Mr. Tio • Powered by Google Antigravity & Firebase</span>
                        </p>
                    </div>
                </div>
            </PullToRefresh>

            {/* Full-Screen Loading Overlay */}
            <AnimatePresence>
                {showSuccessLoader && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm"
                    >
                        <div
                            className="mb-6 relative"
                            style={{
                                marginBottom: 'clamp(1.5rem, 4vh, 2.5rem)'
                            }}
                        >
                            {/* Glow effect */}
                            <div
                                className="absolute inset-0 bg-blue-400/30 blur-2xl rounded-full scale-150 animate-pulse"
                            ></div>
                            <img
                                src="/favicon.png"
                                alt="ICT Codehub"
                                className="rounded-2xl shadow-2xl relative z-10"
                                style={{
                                    width: 'clamp(80px, 15vw, 112px)',
                                    height: 'clamp(80px, 15vw, 112px)'
                                }}
                            />
                        </div>
                        <div className="text-center relative z-10">
                            <h1
                                className="font-bold text-slate-800 tracking-tight mb-1"
                                style={{
                                    fontSize: 'clamp(1.5rem, 5vw, 2rem)'
                                }}
                            >
                                ICT Codehub
                            </h1>
                            <p
                                className="text-slate-500 font-medium"
                                style={{
                                    fontSize: 'clamp(0.875rem, 2.5vw, 1rem)'
                                }}
                            >
                                Welcome back!
                            </p>
                        </div>
                        {/* Loading Indicator */}
                        <div
                            style={{
                                marginTop: 'clamp(1.5rem, 4vh, 2rem)'
                            }}
                        >
                            <div
                                className="border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"
                                style={{
                                    width: 'clamp(28px, 5vw, 32px)',
                                    height: 'clamp(28px, 5vw, 32px)'
                                }}
                            ></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Error Modal */}
            <AnimatePresence>
                {showErrorModal && (
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center"
                        style={{
                            padding: 'clamp(1rem, 3vw, 1.5rem)'
                        }}
                    >
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
                            className="bg-white rounded-3xl shadow-2xl w-full relative z-10"
                            style={{
                                maxWidth: 'clamp(320px, 90vw, 400px)',
                                padding: 'clamp(1.5rem, 5vw, 2rem)'
                            }}
                        >
                            <div className="flex flex-col items-center text-center">
                                {/* Icon Wrapper with Pulse Effect */}
                                <div
                                    className="relative"
                                    style={{
                                        marginBottom: 'clamp(1rem, 3vh, 1.5rem)'
                                    }}
                                >
                                    <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-75"></div>
                                    <div
                                        className="relative bg-red-50 rounded-full flex items-center justify-center border border-red-100"
                                        style={{
                                            width: 'clamp(64px, 12vw, 80px)',
                                            height: 'clamp(64px, 12vw, 80px)'
                                        }}
                                    >
                                        <X
                                            className="text-red-500"
                                            strokeWidth={2.5}
                                            style={{
                                                width: 'clamp(32px, 6vw, 40px)',
                                                height: 'clamp(32px, 6vw, 40px)'
                                            }}
                                        />
                                    </div>
                                </div>

                                <h3
                                    className="font-bold text-slate-800 mb-2"
                                    style={{
                                        fontSize: 'clamp(1.25rem, 4vw, 1.5rem)'
                                    }}
                                >
                                    Login Failed
                                </h3>
                                <p
                                    className="text-slate-500 leading-relaxed"
                                    style={{
                                        marginBottom: 'clamp(1.5rem, 4vh, 2rem)',
                                        fontSize: 'clamp(0.875rem, 2.5vw, 0.875rem)'
                                    }}
                                >
                                    {errorMessage || 'Invalid email or password. Please try again.'}
                                </p>

                                <button
                                    onClick={() => setShowErrorModal(false)}
                                    className="w-full bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200 active:scale-[0.98]"
                                    style={{
                                        paddingTop: 'clamp(0.75rem, 2.5vh, 0.875rem)',
                                        paddingBottom: 'clamp(0.75rem, 2.5vh, 0.875rem)',
                                        fontSize: 'clamp(1rem, 3vw, 1rem)'
                                    }}
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
