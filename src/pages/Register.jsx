import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, User, AlertCircle, School, ArrowRight, GraduationCap, BookOpen, Eye, EyeOff, Flame } from 'lucide-react';
import { sortClasses } from '../utils/classSort';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [role, setRole] = useState('student'); // 'student' or 'teacher'
    const [teacherCode, setTeacherCode] = useState('');
    const [showTeacherCode, setShowTeacherCode] = useState(false);
    const [classId, setClassId] = useState('');
    const [classes, setClasses] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        try {
            const classesSnap = await getDocs(collection(db, 'classes'));
            const classesData = classesSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setClasses(sortClasses(classesData));
        } catch (error) {
            console.error('Error loading classes:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (role === 'teacher' && teacherCode !== 'weLoveMB2!') {
            return setError('Kode guru salah');
        }

        if (role === 'student' && !classId) {
            return setError('Pilih kelas terlebih dahulu');
        }

        try {
            setError('');
            setLoading(true);
            await signup(email, password, name, role, classId);
            navigate(role === 'teacher' ? '/teacher' : '/student');
        } catch (err) {
            console.error("Registration Error Details:", err);
            let errorMessage = 'Gagal mendaftar. Coba lagi.';

            if (err.code === 'auth/email-already-in-use') {
                errorMessage = 'Email sudah terdaftar. Silakan login.';
            } else if (err.code === 'auth/weak-password') {
                errorMessage = 'Password terlalu lemah (min. 6 karakter).';
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Format email tidak valid.';
            } else if (err.message) {
                errorMessage = `Error: ${err.message}`;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 pt-16 pb-24 px-4 relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-400/20 rounded-full blur-3xl"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md relative z-10 border border-white/50"
            >
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                        className="bg-gradient-to-br from-orange-400 to-yellow-500 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200"
                    >
                        <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3.89 15.672L6.255.461A.542.542 0 017.27.288l2.543 4.771zm16.794 3.692l-2.25-14a.54.54 0 00-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 001.588 0zM14.3 7.147l-1.82-3.482a.542.542 0 00-.96 0L3.53 17.984z" />
                        </svg>
                    </motion.div>
                    <h2 className="text-3xl font-bold text-slate-800 mb-2">Create Account</h2>
                    <p className="text-slate-500">Start your learning journey today</p>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-xl mb-6 flex items-center gap-3"
                    >
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">{error}</span>
                    </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Full Name</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                required
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all group-hover:bg-white"
                                placeholder="Full Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    </div>

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
                                placeholder="name@school.id"
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

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Role</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setRole('student')}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${role === 'student'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                                    }`}
                            >
                                <GraduationCap className={`h-6 w-6 mb-2 ${role === 'student' ? 'text-blue-600' : 'text-gray-400'}`} />
                                <span className="font-medium">Student</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRole('teacher')}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${role === 'teacher'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                                    }`}
                            >
                                <BookOpen className={`h-6 w-6 mb-2 ${role === 'teacher' ? 'text-blue-600' : 'text-gray-400'}`} />
                                <span className="font-medium">Teacher</span>
                            </button>
                        </div>
                    </div>

                    {role === 'student' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-2"
                        >
                            <label className="text-sm font-semibold text-gray-700 ml-1">Select Class</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <School className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <select
                                    required
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all group-hover:bg-white appearance-none cursor-pointer"
                                    value={classId}
                                    onChange={(e) => setClassId(e.target.value)}
                                >
                                    <option value="">-- Select Class --</option>
                                    {classes.map((cls) => (
                                        <option key={cls.id} value={cls.id}>
                                            {cls.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </motion.div>
                    )}

                    {role === 'teacher' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-2"
                        >
                            <label className="text-sm font-semibold text-gray-700 ml-1">Teacher Code</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <School className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type={showTeacherCode ? "text" : "password"}
                                    required
                                    className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all group-hover:bg-white"
                                    placeholder="Enter teacher code"
                                    value={teacherCode}
                                    onChange={(e) => setTeacherCode(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowTeacherCode(!showTeacherCode)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors focus:outline-none"
                                >
                                    {showTeacherCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-6"
                    >
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Register Now <ArrowRight className="h-5 w-5" />
                            </>
                        )}
                    </motion.button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-gray-500">
                        Already have an account?{' '}
                        <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                            Login here
                        </Link>
                    </p>
                </div>
            </motion.div>

            {/* Credits Footer */}
            <div className="fixed bottom-0 left-0 w-full bg-white/60 backdrop-blur-md border-t border-white/40 py-4 text-center z-10">
                <p className="text-xs text-slate-600 font-medium flex items-center justify-center gap-1">
                    Made with <Flame className="h-3 w-3 text-orange-500 fill-orange-500 animate-pulse" /> by Mr. Tio • Powered by Google Antigravity & Firebase
                </p>
            </div>
        </div>
    );
}
