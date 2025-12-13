import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    BookOpen,
    ClipboardList,
    GraduationCap,
    Menu,
    X,
    Flame,
    ClipboardCheck,
    Trophy,
    CheckCircle2,
    Clock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import ProfileDropdown from '../components/ProfileDropdown';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';

export default function DashboardLayout({ children }) {
    const { currentUser, logout, userRole } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showAutoSubmitNotif, setShowAutoSubmitNotif] = useState(false);
    const [autoSubmittedExam, setAutoSubmittedExam] = useState(null);

    // Detect mobile screen size
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            // Auto-open sidebar on desktop, closed on mobile
            setSidebarOpen(!mobile);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Check and auto-submit expired sessions periodically (student only)
    useEffect(() => {
        if (!currentUser || userRole !== 'student') return;

        const checkExpiredSessions = async () => {
            try {
                // Get all in_progress sessions for this student
                const sessionsQuery = query(
                    collection(db, 'exam_sessions'),
                    where('studentId', '==', currentUser.uid),
                    where('status', '==', 'in_progress')
                );
                const sessionsSnap = await getDocs(sessionsQuery);

                for (const sessionDoc of sessionsSnap.docs) {
                    const sessionData = sessionDoc.data();
                    const expiresAt = sessionData.expiresAt.toDate();
                    const now = new Date();

                    if (now > expiresAt) {
                        // Get exam details
                        const examDoc = await getDoc(doc(db, 'exams', sessionData.examId));
                        if (!examDoc.exists()) continue;

                        const examData = examDoc.data();

                        // Calculate score from saved answers
                        const savedAnswers = sessionData.answers || {};
                        let totalScore = 0;
                        const maxScore = examData.questions.reduce((acc, q) => acc + (q.points || 10), 0);

                        if (maxScore > 0) {
                            examData.questions.forEach(q => {
                                const studentAnswer = savedAnswers[q.id];
                                const qPoints = q.points || 10;
                                const partialEnabled = q.enablePartialScoring !== false;

                                if (!studentAnswer) return;

                                if (q.type === 'single_choice' || q.type === 'true_false') {
                                    const correctOpt = q.options.find(o => o.isCorrect);
                                    if (correctOpt && correctOpt.id === studentAnswer) {
                                        totalScore += qPoints;
                                    }
                                } else if (q.type === 'multiple_choice') {
                                    const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.id);
                                    if (!partialEnabled) {
                                        const studentSelection = Array.isArray(studentAnswer) ? studentAnswer : [];
                                        const isExactMatch = studentSelection.length === correctOptions.length &&
                                            studentSelection.every(id => correctOptions.includes(id));
                                        if (isExactMatch) totalScore += qPoints;
                                    } else {
                                        const weightPerOption = qPoints / q.options.length;
                                        let questionScore = 0;
                                        q.options.forEach(opt => {
                                            const isChecked = studentAnswer.includes(opt.id);
                                            if (opt.isCorrect === isChecked) {
                                                questionScore += weightPerOption;
                                            }
                                        });
                                        totalScore += questionScore;
                                    }
                                } else if (q.type === 'matching') {
                                    if (!partialEnabled) {
                                        const allCorrect = q.options.every((pair, idx) => {
                                            const studentRightVal = studentAnswer[idx];
                                            return studentRightVal && studentRightVal.trim().toLowerCase() === pair.right.trim().toLowerCase();
                                        });
                                        if (allCorrect) totalScore += qPoints;
                                    } else {
                                        const weightPerPair = qPoints / q.options.length;
                                        let questionScore = 0;
                                        q.options.forEach((pair, idx) => {
                                            const studentRightVal = studentAnswer[idx];
                                            if (studentRightVal && studentRightVal.trim().toLowerCase() === pair.right.trim().toLowerCase()) {
                                                questionScore += weightPerPair;
                                            }
                                        });
                                        totalScore += questionScore;
                                    }
                                }
                            });
                        }

                        const finalScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

                        // Complete session
                        await updateDoc(doc(db, 'exam_sessions', sessionDoc.id), {
                            status: 'completed',
                            submittedAt: serverTimestamp()
                        });

                        // Create exam result
                        await addDoc(collection(db, 'exam_results'), {
                            examId: sessionData.examId,
                            studentId: currentUser.uid,
                            answers: savedAnswers,
                            score: finalScore,
                            submittedAt: serverTimestamp(),
                            autoSubmitted: true,
                            autoSubmitNotified: false
                        });
                    }
                }
            } catch (error) {
                console.error('[Expired Sessions] Error:', error);
            }
        };

        // Check immediately on mount
        checkExpiredSessions();

        // Then check every 5 seconds
        const interval = setInterval(checkExpiredSessions, 5000);

        return () => clearInterval(interval);
    }, [currentUser, userRole]);

    // Auto-submit notification system (student only)
    useEffect(() => {
        if (!currentUser || userRole !== 'student') return;

        // Check for auto-submitted exams with real-time listener
        const resultsQuery = query(
            collection(db, 'exam_results'),
            where('studentId', '==', currentUser.uid)
        );

        const unsubscribe = onSnapshot(resultsQuery, async (resultsSnap) => {
            try {
                // Filter in code to avoid composite index requirement
                const autoSubmittedResults = resultsSnap.docs.filter(doc => {
                    const data = doc.data();
                    return data.autoSubmitted === true && data.autoSubmitNotified === false;
                });

                if (autoSubmittedResults.length > 0) {
                    // Get the first auto-submitted exam that hasn't been notified
                    const resultDoc = autoSubmittedResults[0];
                    const resultData = resultDoc.data();

                    // Get exam details
                    const examDoc = await getDoc(doc(db, 'exams', resultData.examId));
                    if (examDoc.exists()) {
                        setAutoSubmittedExam({
                            resultId: resultDoc.id,
                            examTitle: examDoc.data().title,
                            score: resultData.score
                        });
                        setShowAutoSubmitNotif(true);

                        // Update flag
                        await updateDoc(doc(db, 'exam_results', resultDoc.id), {
                            autoSubmitNotified: true
                        });
                    }
                }
            } catch (error) {
                console.error('[Auto-Submit Check] Error:', error);
            }
        });

        return () => unsubscribe();
    }, [currentUser, userRole]);

    const teacherMenuItems = [
        { path: '/teacher', icon: LayoutDashboard, label: 'Overview' },
        { path: '/teacher/classes', icon: Users, label: 'Classes' },
        { path: '/teacher/students', icon: GraduationCap, label: 'Students' },
        { path: '/teacher/tasks', icon: BookOpen, label: 'Tasks' },
        { path: '/teacher/exams', icon: ClipboardCheck, label: 'Exams' },
        { path: '/teacher/gradebook', icon: ClipboardList, label: 'Gradebook' },
    ];

    const studentMenuItems = [
        { path: '/student', icon: LayoutDashboard, label: 'Overview' },
        { path: '/student/tasks', icon: BookOpen, label: 'My Tasks' },
        { path: '/student/exams', icon: ClipboardCheck, label: 'Exams' },
        { path: '/student/grades', icon: ClipboardList, label: 'My Grades' },
    ];

    const menuItems = userRole === 'teacher' ? teacherMenuItems : studentMenuItems;

    // Close sidebar on navigation (mobile only)
    const handleNavClick = () => {
        if (isMobile) {
            setSidebarOpen(false);
        }
    };

    return (
        <div className="flex h-screen bg-sky-50 overflow-hidden">
            {/* Overlay for mobile */}
            <AnimatePresence>
                {sidebarOpen && isMobile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    x: sidebarOpen ? 0 : -300
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed left-0 top-0 h-full bg-white border-r border-blue-100 text-slate-600 w-64 shadow-2xl flex flex-col z-50`}
            >
                <div
                    className="px-6 pb-6 flex-1 overflow-y-auto"
                    style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
                >
                    {/* App Branding */}
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            {/* Firebase Icon */}
                            <img src="/favicon.png" alt="Logo" className="w-10 h-10 rounded-lg" />
                            <div className="flex-1">
                                <h1 className="text-lg font-bold text-slate-800 leading-tight">
                                    ICT Codehub
                                </h1>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    LMS Platform
                                </p>
                            </div>
                        </div>
                        {/* Role Badge - More subtle */}
                        <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-200">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="font-light">
                                {userRole === 'teacher' ? 'Teacher Dashboard' : 'Student Dashboard'}
                            </span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-200 mb-6"></div>

                    <nav className="space-y-2">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/teacher' || item.path === '/student'}
                                onClick={handleNavClick}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                        ? 'bg-blue-50 text-blue-600 shadow-sm font-semibold'
                                        : 'text-slate-500 hover:bg-blue-50/50 hover:text-blue-700'
                                    }`
                                }
                            >
                                <item.icon className="h-5 w-5" />
                                <span className="font-medium">{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                {/* Credits Section */}
                <div className="px-3 py-2 border-t border-slate-100">
                    <div className="text-center space-y-1">
                        <p className="text-xs text-slate-400 font-light leading-tight flex items-center justify-center gap-1">
                            Made with <Flame className="h-3 w-3 text-orange-500 fill-orange-500 animate-pulse" /> by <span className="font-normal text-slate-500">Mr. Tio</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-light leading-tight whitespace-nowrap">
                            Powered by Google Antigravity & Firebase
                        </p>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <div
                className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen && !isMobile ? 'lg:ml-64' : 'ml-0'
                    }`}
            >
                {/* Header */}
                <header
                    className="bg-white/80 backdrop-blur-md border-b border-blue-100 px-4 sm:px-6 pb-4 flex items-center justify-between sticky top-0 z-30 flex-shrink-0 transition-all"
                    style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
                >
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-slate-600"
                        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                    >
                        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>

                    <ProfileDropdown currentUser={currentUser} logout={logout} />
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {children || <Outlet />}
                </main>
            </div>

            {/* Auto-Submit Notification Modal (Student Only) */}
            <AnimatePresence>
                {showAutoSubmitNotif && autoSubmittedExam && userRole === 'student' && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-md" />

                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl p-10 max-w-lg w-full"
                        >
                            <div className="text-center space-y-6">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                    className="relative mx-auto"
                                >
                                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                        <Clock className="h-12 w-12 text-white" />
                                    </div>
                                    {/* Pulse effect */}
                                    <div className="absolute inset-0 w-24 h-24 bg-blue-400 rounded-full animate-ping opacity-20 mx-auto"></div>
                                </motion.div>

                                <div>
                                    <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-4">
                                        Exam Auto-Submitted
                                    </h3>
                                    <p className="text-slate-600 text-lg leading-relaxed">
                                        Time for exam <span className="font-bold text-slate-800">{autoSubmittedExam.examTitle}</span> has expired and the system has automatically submitted your answers.
                                    </p>
                                </div>

                                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <CheckCircle2 className="h-5 w-5 text-blue-700" />
                                        <p className="text-blue-700 font-semibold">All answers have been saved</p>
                                    </div>
                                    <div className="mt-3 bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 rounded-xl p-3">
                                        <p className="text-emerald-700 font-bold flex items-center justify-center gap-2 text-lg">
                                            <Trophy className="h-5 w-5" />
                                            Your Score: {Math.round(autoSubmittedExam.score)}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowAutoSubmitNotif(false)}
                                    className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-lg font-bold rounded-2xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl group"
                                >
                                    I Understand
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
