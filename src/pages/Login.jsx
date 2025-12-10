import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Mail, Lock, AlertCircle, ArrowRight, LogIn, Eye, EyeOff, CheckCircle, Flame } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, currentUser } = useAuth();
    const navigate = useNavigate();

    if (currentUser) {
        return <Navigate to="/" />;
    }

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setError('');
            setLoading(true);
            await login(email, password, rememberMe);
            toast.success('Login berhasil!');
            navigate('/');
        } catch (err) {
            toast.error('Login gagal. Periksa email dan password Anda.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 pt-16 pb-24 px-4 relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-400/20 rounded-full blur-3xl"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md relative z-10 border border-white/50"
            >
                <div className="text-center mb-8">
                    <motion.img
                        src="/favicon.png"
                        alt="Logo"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                        className="w-24 h-24 mx-auto mb-6 rounded-xl"
                    />
                    <h2 className="text-3xl font-bold text-slate-800 mb-2">ICT Codehub</h2>
                    <p className="text-slate-500">Learning Management System</p>
                </div>



                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Email</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="email"
                                required
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all group-hover:bg-white"
                                placeholder="nama@sekolah.id"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Password</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all group-hover:bg-white"
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
                            <span className="text-sm text-slate-600 font-medium group-hover:text-blue-600 transition-colors">Remember Me</span>
                        </label>
                        <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
                            Forgot Password?
                        </Link>
                    </div>

                    <button
                        disabled={loading}
                        type="submit"
                        style={{ backgroundColor: '#2563eb', color: 'white' }}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Login <LogIn className="h-5 w-5" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-gray-500">
                        Don't have an account?{' '}
                        <Link to="/register" className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                            Register here
                        </Link>
                    </p>
                </div>
            </motion.div>

            {/* Credits Footer */}
            <div className="absolute bottom-0 left-0 w-full bg-white/60 backdrop-blur-md border-t border-white/40 py-4 text-center z-10">
                <p className="text-xs text-slate-600 font-medium flex items-center justify-center gap-1">
                    Made with <Flame className="h-3 w-3 text-orange-500 fill-orange-500 animate-pulse" /> by Mr. Tio • Powered by Google Antigravity & Firebase
                </p>
            </div>
        </div>
    );
}
