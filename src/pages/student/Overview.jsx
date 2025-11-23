import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle, Clock, AlertCircle, Calendar, TrendingUp, ChevronRight, Hourglass, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Overview() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalTasks: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        weeklyProgress: 0
    });
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [currentUser]);

    const loadData = async () => {
        if (!currentUser) return;

        setLoading(true);
        try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
            if (userDoc.empty) return;

            const userData = userDoc.docs[0].data();
            const classId = userData.classId;

            // Get submissions first
            const submissionsQuery = query(
                collection(db, 'submissions'),
                where('studentId', '==', currentUser.uid)
            );
            const submissionsSnap = await getDocs(submissionsQuery);
            const subs = {};
            submissionsSnap.forEach(doc => {
                subs[doc.data().taskId] = doc.data();
            });
            setSubmissions(subs);

            // Get tasks
            const tasksQuery = query(
                collection(db, 'tasks'),
                where('assignedClasses', 'array-contains', classId)
            );
            const tasksSnap = await getDocs(tasksQuery);
            let tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort tasks: Pending -> Submitted -> Graded
            tasksList.sort((a, b) => {
                const subA = subs[a.id];
                const subB = subs[b.id];

                // 1. Pending (no submission) first
                if (!subA && subB) return -1;
                if (subA && !subB) return 1;

                // 2. If both pending, sort by deadline (earliest first)
                if (!subA && !subB) {
                    return new Date(a.deadline) - new Date(b.deadline);
                }

                // 3. If both submitted
                // Prioritize ungraded over graded
                const isGradedA = subA.grade !== null && subA.grade !== undefined;
                const isGradedB = subB.grade !== null && subB.grade !== undefined;

                if (!isGradedA && isGradedB) return -1;
                if (isGradedA && !isGradedB) return 1;

                // If both same status, sort by submission time (newest first)
                return subB.submittedAt?.toMillis() - subA.submittedAt?.toMillis();
            });

            setTasks(tasksList);

            // Calculate stats
            let completed = 0;
            let pending = 0;
            let overdue = 0;

            tasksList.forEach(task => {
                const submission = subs[task.id];
                const isOverdue = new Date(task.deadline) < new Date();

                if (submission) {
                    completed++;
                } else if (isOverdue) {
                    overdue++;
                } else {
                    pending++;
                }
            });

            const totalTasks = tasksList.length;
            const weeklyProgress = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

            setStats({
                totalTasks,
                completed,
                pending,
                overdue,
                weeklyProgress
            });
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { label: 'Total Tasks', value: stats.totalTasks, icon: BookOpen, color: 'from-blue-500 to-cyan-500', link: '/student/tasks' },
        { label: 'Selesai', value: stats.completed, icon: CheckCircle, color: 'from-emerald-500 to-teal-500', link: '/student/tasks' },
        { label: 'Pending', value: stats.pending, icon: Clock, color: 'from-amber-500 to-orange-500', link: '/student/tasks' },
        { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: 'from-red-500 to-pink-500', link: '/student/tasks' },
    ];

    const CircularProgress = ({ value }) => {
        const radius = 50;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (value / 100) * circumference;

        return (
            <div className="relative w-40 h-40 flex-shrink-0 flex items-center justify-center">
                {/* Outer Glow Effect */}
                <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl transform scale-75"></div>

                <svg className="w-full h-full transform -rotate-90 drop-shadow-xl" viewBox="0 0 120 120">
                    {/* Background Circle */}
                    <circle
                        className="text-slate-800/50"
                        strokeWidth="10"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="60"
                        cy="60"
                    />
                    {/* Progress Circle */}
                    <circle
                        className="text-cyan-400 transition-all duration-1000 ease-out"
                        strokeWidth="10"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="60"
                        cy="60"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <span className="text-3xl font-bold tracking-tight">{value}%</span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                    Student Dashboard
                </h1>
                <p className="text-slate-500 mt-1">Selamat datang, lihat progress belajarmu hari ini.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {statCards.map((card, index) => (
                            <motion.div
                                key={card.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => navigate(card.link)}
                                className={`bg-gradient-to-br ${card.color} p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1`}
                            >
                                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500"></div>

                                <div className="relative z-10 flex items-center justify-between">
                                    <div>
                                        <p className="text-white/80 text-sm font-medium mb-1">{card.label}</p>
                                        <p className="text-4xl font-bold">{card.value}</p>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        <card.icon className="h-8 w-8 text-white" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-2 bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-blue-500" />
                                    Recent Tasks
                                </h3>
                                <button
                                    onClick={() => navigate('/student/tasks')}
                                    className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                                >
                                    View All <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-6">
                                {tasks.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <BookOpen className="h-8 w-8 text-blue-300" />
                                        </div>
                                        <p>No tasks assigned yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-0">
                                        {/* TABLE HEADER */}
                                        <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-t-xl border-b border-slate-200">
                                            <div className="flex items-center gap-3 flex-1">
                                                <span className="w-6 text-center text-sm font-semibold text-slate-600">No</span>
                                                <div className="w-10"></div>
                                                <span className="text-sm font-semibold text-slate-600">Task Details</span>
                                            </div>
                                            <div className="flex items-center gap-4 pl-4">
                                                <span className="text-sm font-semibold text-slate-600 min-w-[160px] text-center">Status</span>
                                                <span className="text-sm font-semibold text-slate-600 min-w-[45px] text-center">Grade</span>
                                            </div>
                                        </div>

                                        {/* TABLE BODY */}
                                        <div className="divide-y divide-slate-100">
                                            {tasks.slice(0, 5).map((task, index) => {
                                                const submission = submissions[task.id];
                                                const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;

                                                let statusColor = "bg-white hover:bg-slate-50";

                                                if (submission && submission.grade !== null && submission.grade !== undefined) {
                                                    statusColor = "bg-white hover:bg-slate-50";
                                                } else if (submission) {
                                                    statusColor = "bg-amber-100/70 hover:bg-amber-100";
                                                } else {
                                                    statusColor = isOverdue ? "bg-red-100/80 hover:bg-red-100" : "bg-red-100/60 hover:bg-red-100/80";
                                                }

                                                // Grade display
                                                let gradeValue = "-";
                                                let gradeColor = "text-slate-400";
                                                const isGraded = submission && submission.grade !== null && submission.grade !== undefined;

                                                if (isGraded) {
                                                    gradeValue = submission.grade;
                                                    gradeColor = "text-emerald-600";
                                                } else if (submission) {
                                                    gradeColor = "text-amber-600";
                                                }

                                                // Deadline/Status info
                                                let statusInfo = null;
                                                const deadlineDate = task.deadline ? new Date(task.deadline) : null;

                                                if (submission && submission.submittedAt && deadlineDate) {
                                                    const submittedDate = submission.submittedAt.toDate();
                                                    const diffMs = deadlineDate - submittedDate;
                                                    const diffHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
                                                    const diffDays = Math.floor(diffHours / 24);

                                                    const isEarly = diffMs > 0;

                                                    // Format timing text
                                                    let timingText = '';
                                                    if (isEarly) {
                                                        if (diffDays > 0) timingText = `Lebih Cepat ${diffDays} hari`;
                                                        else timingText = `On Time`;
                                                    } else {
                                                        if (diffDays > 0) timingText = `Telat ${diffDays} hari`;
                                                        else timingText = `Late`;
                                                    }

                                                    if (!isGraded) {
                                                        // SUDAH SUBMIT TAPI BELUM DINILAI
                                                        statusInfo = (
                                                            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl w-full border bg-amber-50 border-amber-100 h-[52px]">
                                                                <div className="p-1.5 rounded-lg flex-shrink-0 bg-amber-100 text-amber-600">
                                                                    <Send className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex flex-col items-end min-w-0 text-right">
                                                                    <span className="text-xs font-bold text-amber-700 truncate w-full">Submitted</span>
                                                                    <span className="text-[10px] font-medium text-amber-600 truncate w-full">Awaiting Grade</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else {
                                                        // SUDAH DINILAI
                                                        statusInfo = (
                                                            <div className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl w-full border h-[52px] ${isEarly ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                                                <div className={`p-1.5 rounded-lg flex-shrink-0 ${isEarly ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                                    {isEarly ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                                                </div>
                                                                <div className="flex flex-col items-end min-w-0 text-right">
                                                                    <span className={`text-xs font-bold truncate w-full ${isEarly ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                        Selesai
                                                                    </span>
                                                                    <span className={`text-[10px] font-medium truncate w-full ${isEarly ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                        {timingText}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                } else if (submission && submission.submittedAt) {
                                                    // SUBMIT TANPA DEADLINE
                                                    if (!isGraded) {
                                                        statusInfo = (
                                                            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl w-full border bg-amber-50 border-amber-100 h-[52px]">
                                                                <div className="p-1.5 rounded-lg flex-shrink-0 bg-amber-100 text-amber-600">
                                                                    <Send className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex flex-col items-end min-w-0 text-right">
                                                                    <span className="text-xs font-bold text-amber-700 truncate w-full">Submitted</span>
                                                                    <span className="text-[10px] font-medium text-amber-600 truncate w-full">Awaiting Grade</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else {
                                                        statusInfo = (
                                                            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl w-full border bg-emerald-50 border-emerald-100 h-[52px]">
                                                                <div className="p-1.5 rounded-lg flex-shrink-0 bg-emerald-100 text-emerald-600">
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex flex-col items-end min-w-0 text-right">
                                                                    <span className="text-xs font-bold text-emerald-700 truncate w-full">Selesai</span>
                                                                    <span className="text-[10px] font-medium text-emerald-600 truncate w-full">On Time</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                } else if (deadlineDate) {
                                                    // BELUM MENGERJAKAN (PENDING)
                                                    const dateText = deadlineDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

                                                    statusInfo = (
                                                        <div className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl w-full border h-[52px] ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                                                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                {isOverdue ? <AlertCircle className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                                                            </div>
                                                            <div className="flex flex-col items-end min-w-0 text-right">
                                                                <span className={`text-xs font-bold truncate w-full ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>
                                                                    {isOverdue ? 'Terlewat' : 'Ditugaskan'}
                                                                </span>
                                                                <span className={`text-[10px] font-medium truncate w-full ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                                                                    Deadline: {dateText}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                } else {
                                                    statusInfo = <span className="text-xs text-slate-400">-</span>;
                                                }

                                                return (
                                                    <motion.div
                                                        key={task.id}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        onClick={() => navigate('/student/tasks')}
                                                        className={`flex items-center justify-between py-3.5 px-4 transition-colors cursor-pointer group ${statusColor}`}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <span className="text-slate-400 font-medium w-6 text-center flex-shrink-0 text-sm">{index + 1}</span>

                                                            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-sm">
                                                                <BookOpen className="h-5 w-5" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors truncate text-sm">{task.title}</h4>
                                                                <p className="text-sm text-slate-500 line-clamp-1">{task.description}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 pl-4 flex-shrink-0">
                                                            <div className="text-center min-w-[160px]">
                                                                {statusInfo}
                                                            </div>
                                                            <div className="text-center min-w-[45px]">
                                                                <span className={`font-bold text-sm ${gradeColor}`}>
                                                                    {gradeValue}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-900 to-slate-900 rounded-3xl shadow-lg text-white p-6 relative overflow-hidden h-fit">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -ml-16 -mb-16"></div>

                            <div className="relative z-10 flex flex-col space-y-8">
                                <div>
                                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-cyan-400" />
                                        Progress Belajar
                                    </h3>
                                    <p className="text-blue-100 text-sm">
                                        {stats.weeklyProgress === 100
                                            ? "Excellent! All tasks completed. 🎉"
                                            : stats.weeklyProgress >= 75
                                                ? "Sedikit lagi! Kamu hampir menyelesaikan semua tugas. 🚀"
                                                : stats.weeklyProgress >= 50
                                                    ? "Bagus! Kamu sudah setengah jalan. Terus semangat! 💪"
                                                    : "Ayo mulai kerjakan tugasmu satu per satu! ✨"}
                                    </p>
                                </div>

                                <div className="flex flex-col items-center justify-center flex-shrink-0">
                                    <CircularProgress value={stats.weeklyProgress} />
                                    <div className="mt-4 text-center">
                                        <p className="text-2xl font-bold text-white">{stats.completed} / {stats.totalTasks}</p>
                                        <p className="text-sm font-medium text-blue-200">Tasks Completed</p>
                                    </div>
                                </div>

                                <div>
                                    <button
                                        onClick={() => navigate('/student/tasks')}
                                        className="w-full py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/10 transition-all font-medium text-sm flex items-center justify-center gap-2"
                                    >
                                        Lanjutkan Belajar <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )
            }
        </div >
    );
}
