import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle, Clock, AlertCircle, Calendar, TrendingUp, ChevronRight, Hourglass, Send, ClipboardCheck, PlayCircle, ClipboardList, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Pagination from '../../components/Pagination';

export default function Overview() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalTasks: 0,
        completedTasks: 0,
        completedExams: 0,
        pending: 0,
        overdue: 0,
        activeExams: 0,
        totalExams: 0
    });
    const [tasks, setTasks] = useState([]);
    const [exams, setExams] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [userClass, setUserClass] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth < 768 ? 5 : 10);

    // Responsive itemsPerPage
    useEffect(() => {
        const handleResize = () => {
            setItemsPerPage(window.innerWidth < 768 ? 5 : 10);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        let unsubscribeSubmissions = null;
        let unsubscribeTasks = null;
        let unsubscribeExams = null;
        let unsubscribeExamResults = null;

        const loadData = async () => {
            if (!currentUser) return;

            setLoading(true);
            try {
                const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
                if (userDoc.empty) {
                    setLoading(false);
                    return;
                }

                const userData = userDoc.docs[0].data();
                const classId = userData.classId;

                if (classId) {
                    const classDoc = await getDocs(query(collection(db, 'classes'), where('__name__', '==', classId)));
                    if (!classDoc.empty) {
                        setUserClass(classDoc.docs[0].data());
                    }
                } else {
                    setUserClass(null);
                    setLoading(false);
                    return;
                }

                let currentTasks = [];
                let currentSubmissions = {};

                // Setup real-time listener for tasks
                const tasksQuery = query(
                    collection(db, 'tasks'),
                    where('assignedClasses', 'array-contains', classId)
                );

                unsubscribeTasks = onSnapshot(tasksQuery, (tasksSnap) => {
                    currentTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    updateTasksAndStats(currentTasks, currentSubmissions);
                });

                // Listen to Exams & Results for stats
                let currentExams = [];
                let currentExamResults = [];

                const examsQuery = query(
                    collection(db, 'exams'),
                    where('assignedClasses', 'array-contains', classId),
                    where('status', '==', 'published')
                );

                unsubscribeExams = onSnapshot(examsQuery, (snap) => {
                    currentExams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    updateExamStats(currentExams, currentExamResults);
                });

                const examResultsQuery = query(
                    collection(db, 'exam_results'),
                    where('studentId', '==', currentUser.uid)
                );
                unsubscribeExamResults = onSnapshot(examResultsQuery, (snap) => {
                    currentExamResults = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    updateExamStats(currentExams, currentExamResults);
                });

                // Setup real-time listener for submissions
                const submissionsQuery = query(
                    collection(db, 'submissions'),
                    where('studentId', '==', currentUser.uid)
                );

                unsubscribeSubmissions = onSnapshot(submissionsQuery, (submissionsSnap) => {
                    const subs = {};
                    submissionsSnap.forEach(doc => {
                        subs[doc.data().taskId] = doc.data();
                    });
                    currentSubmissions = subs;
                    setSubmissions(subs);
                    updateTasksAndStats(currentTasks, currentSubmissions);
                });

            } catch (error) {
                console.error('Error setting up listener:', error);
                setLoading(false);
            }
        };

        const updateExamStats = (examsList, resultsList) => {
            // Count exams that are available (not completed or expired)
            const availableExams = examsList.filter(exam => {
                // Find latest completed result
                const completedResults = resultsList.filter(r =>
                    r.examId === exam.id &&
                    (r.submittedAt || r.completedAt) &&
                    !r.allowRetake
                );

                // Available if no completed result OR latest allows retake
                return completedResults.length === 0 ||
                    completedResults.some(r => r.allowRetake);
            });

            // Count COMPLETED exams (submitted)
            // Use Set to handle multiple results if any, though usually 1 per exam unless retake.
            // We count 'exams completed', so if an exam has a result, it is completed (partially or fully).
            const uniqueCompletedExamIds = new Set(resultsList.map(r => r.examId));
            const completedExamsCount = uniqueCompletedExamIds.size;

            setExams(availableExams);

            setStats(prev => ({
                ...prev,
                activeExams: availableExams.length,
                totalExams: examsList.length,
                completedExams: completedExamsCount
            }));
        };

        const updateTasksAndStats = (tasksList, subs) => {
            // Sort tasks logic remains same
            tasksList.sort((a, b) => {
                const subA = subs[a.id];
                const subB = subs[b.id];
                if (!subA && subB) return -1;
                if (subA && !subB) return 1;
                if (!subA && !subB) {
                    return new Date(a.deadline) - new Date(b.deadline);
                }
                const isGradedA = subA.grade !== null && subA.grade !== undefined;
                const isGradedB = subB.grade !== null && subB.grade !== undefined;
                if (!isGradedA && isGradedB) return -1;
                if (isGradedA && !isGradedB) return 1;
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

            setStats(prev => ({
                ...prev,
                totalTasks,
                completedTasks: completed,
                pending,
                overdue
            }));
            setLoading(false);
        };

        loadData();

        return () => {
            if (unsubscribeSubmissions) unsubscribeSubmissions();
            if (unsubscribeTasks) unsubscribeTasks();
            if (unsubscribeExams) unsubscribeExams();
            if (unsubscribeExamResults) unsubscribeExamResults();
        };
    }, [currentUser]);

    // Derived totals for display
    const totalActivities = stats.totalTasks + stats.totalExams;
    const totalCompleted = stats.completedTasks + stats.completedExams;
    const weeklyProgress = totalActivities > 0 ? Math.round((totalCompleted / totalActivities) * 100) : 0;

    const statCards = [
        { label: 'Total Activities', value: totalActivities, icon: BookOpen, color: 'from-blue-500 to-cyan-500', link: '/student/tasks' },
        { label: 'Active Exams', value: stats.activeExams ?? 0, icon: ClipboardCheck, color: 'from-purple-500 to-pink-500', link: '/student/exams' },
        { label: 'Completed', value: totalCompleted, icon: CheckCircle, color: 'from-emerald-500 to-teal-500', link: '/student/tasks' },
        { label: 'Pending Tasks', value: stats.pending, icon: Clock, color: 'from-amber-500 to-orange-500', link: '/student/tasks' },
        { label: 'Overdue Tasks', value: stats.overdue, icon: AlertCircle, color: 'from-red-500 to-pink-500', link: '/student/tasks' },
    ];

    const CircularProgress = ({ value }) => {
        const radius = 50;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (value / 100) * circumference;

        return (
            <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
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
                    <span className="text-2xl font-bold tracking-tight">{value}%</span>
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
                <p className="text-slate-500 mt-1">Welcome, track your learning progress today.</p>
            </div>

            {!loading && !userClass && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                    <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                    <div>
                        <h3 className="text-lg font-bold text-amber-800">You are not assigned to any class</h3>
                        <p className="text-amber-700 mt-1">Please contact your teacher to be added to a class so you can see your tasks and exams.</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        {statCards.map((card, index) => {
                            // Logic to hide specific cards on mobile/tablet if value is 0
                            // Desktop (lg breakpoint) will always show them due to 'lg:block'
                            const hideOnMobile = ['Active Exams', 'Pending Tasks', 'Overdue Tasks'].includes(card.label) && card.value === 0;

                            return (
                                <motion.div
                                    key={card.label}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    onClick={() => navigate(card.link)}
                                    className={`bg-gradient-to-br ${card.color} p-5 rounded-2xl shadow-lg text-white relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1 ${hideOnMobile ? 'hidden lg:block' : ''}`}
                                >
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500"></div>

                                    <div className="relative z-10 flex items-center justify-between">
                                        <div>
                                            <p className="text-white/80 text-sm font-medium mb-1">{card.label}</p>
                                            <p className="text-3xl font-bold">{card.value}</p>
                                        </div>
                                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                            <card.icon className="h-8 w-8 text-white" />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Recent Activity - Full Width */}
                    <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-blue-500" />
                                Recent Activity
                            </h3>
                            <button
                                onClick={() => navigate('/student/tasks')}
                                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                            >
                                View All <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-6">
                            {tasks.length === 0 && exams.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <BookOpen className="h-8 w-8 text-blue-300" />
                                    </div>
                                    <p>No recent activity yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-0" style={{ minHeight: '650px' }}>
                                    {/* TABLE HEADER - Hidden on mobile */}
                                    <div className="hidden md:flex items-center justify-between py-4 px-6 bg-slate-50 rounded-t-xl border-b border-slate-200">
                                        <div className="flex items-center gap-3 flex-1">
                                            <span className="w-6 text-center text-[13px] font-bold text-slate-500 uppercase tracking-wider">No</span>
                                            <div className="w-10"></div>
                                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Activity Details</span>
                                        </div>
                                        <div className="flex items-center gap-8 pl-4">
                                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Status</span>
                                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[60px] text-center">Grade</span>
                                        </div>
                                    </div>

                                    {/* TABLE BODY - Combined Tasks and Exams */}
                                    <div className="space-y-0">
                                        {/* Show Exams First */}
                                        {exams.slice(0, 3).map((exam, index) => (
                                            <motion.div
                                                key={`exam-${exam.id}`}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                onClick={() => navigate(`/student/exams/${exam.id}`)}
                                                className="flex flex-col md:flex-row md:items-center md:justify-between py-4 px-4 md:px-6 bg-purple-50/30 hover:bg-purple-50 cursor-pointer transition-all group gap-3 rounded-xl mb-4 md:mb-0"
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <span className="hidden md:block w-6 text-center text-sm font-bold text-slate-600">{index + 1}</span>
                                                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0 shadow-sm">
                                                        <ClipboardCheck className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-800 line-clamp-1 group-hover:text-purple-600 transition-colors">{exam.title}</h4>
                                                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" /> {exam.duration} Minutes
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <ClipboardCheck className="h-3 w-3" /> {exam.questions?.length || 0} Questions
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 md:gap-8 md:pl-4">
                                                    <div className="flex-1 md:flex-none md:text-center md:min-w-[100px]">
                                                        <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-purple-100 border border-purple-200">
                                                            <PlayCircle className="h-3.5 w-3.5 text-purple-600" />
                                                            <span className="text-xs font-bold text-purple-700">Available</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-center min-w-[60px]">
                                                        <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-sm font-bold text-slate-400">–</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}

                                        {/* Then Show Tasks */}
                                        {(() => {
                                            const examCount = exams.slice(0, 3).length;
                                            const startIndex = (currentPage - 1) * itemsPerPage;
                                            const endIndex = startIndex + itemsPerPage;
                                            const allItems = [...exams.slice(0, 3), ...tasks];
                                            const paginatedItems = allItems.slice(startIndex, endIndex);
                                            const tasksToShow = paginatedItems.filter((item, idx) => idx >= examCount || startIndex >= examCount);

                                            return tasks.slice(Math.max(0, startIndex - examCount), Math.max(0, endIndex - examCount)).map((task, index) => {
                                                const submission = submissions[task.id];
                                                const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;

                                                let statusColor = "bg-white hover:bg-slate-50";

                                                if (submission && submission.grade !== null && submission.grade !== undefined) {
                                                    statusColor = "bg-white hover:bg-slate-50";
                                                } else if (submission) {
                                                    statusColor = "bg-amber-50 hover:bg-amber-100/50";
                                                } else {
                                                    statusColor = isOverdue ? "bg-red-100/50 hover:bg-red-100" : "bg-red-50 hover:bg-red-100/50";
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
                                                let statusDisplay = null;
                                                let infoDisplay = null;
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
                                                        if (diffDays > 0) timingText = `${diffDays} day${diffDays > 1 ? 's' : ''} early`;
                                                        else timingText = `On Time`;
                                                    } else {
                                                        if (diffDays > 0) timingText = `${diffDays} day${diffDays > 1 ? 's' : ''} late`;
                                                        else timingText = `Late`;
                                                    }

                                                    if (!isGraded) {
                                                        // SUDAH SUBMIT TAPI BELUM DINILAI
                                                        statusDisplay = (
                                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                                                                <Send className="h-3.5 w-3.5 text-amber-600" />
                                                                <span className="text-xs font-bold text-amber-700">Submitted</span>
                                                            </div>
                                                        );
                                                        infoDisplay = (
                                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                                                                <Hourglass className="h-3.5 w-3.5 text-amber-600" />
                                                                <span className="text-xs font-bold text-amber-700">Awaiting Grade</span>
                                                            </div>
                                                        );
                                                    } else {
                                                        // SUDAH DINILAI
                                                        statusDisplay = (
                                                            <div className={`flex w-full items-center gap-2 px-3 py-2 rounded-lg border ${isEarly ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                                                {isEarly ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
                                                                <span className={`text-xs font-bold ${isEarly ? 'text-emerald-700' : 'text-red-700'}`}>Completed</span>
                                                            </div>
                                                        );
                                                        infoDisplay = (
                                                            <div className={`flex w-full items-center gap-2 px-3 py-2 rounded-lg border ${isEarly ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                                                <Clock className={`h-3.5 w-3.5 ${isEarly ? 'text-emerald-600' : 'text-red-600'}`} />
                                                                <span className={`text-xs font-bold ${isEarly ? 'text-emerald-700' : 'text-red-700'}`}>{timingText}</span>
                                                            </div>
                                                        );
                                                    }
                                                } else if (submission && submission.submittedAt) {
                                                    // SUBMIT TANPA DEADLINE
                                                    if (!isGraded) {
                                                        statusDisplay = (
                                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                                                                <Send className="h-3.5 w-3.5 text-amber-600" />
                                                                <span className="text-xs font-bold text-amber-700">Submitted</span>
                                                            </div>
                                                        );
                                                        infoDisplay = (
                                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                                                                <Hourglass className="h-3.5 w-3.5 text-amber-600" />
                                                                <span className="text-xs font-bold text-amber-700">Awaiting Grade</span>
                                                            </div>
                                                        );
                                                    } else {
                                                        statusDisplay = (
                                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                                                                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                                                <span className="text-xs font-bold text-emerald-700">Completed</span>
                                                            </div>
                                                        );
                                                        infoDisplay = (
                                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                                                                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                                                                <span className="text-xs font-bold text-emerald-700">On Time</span>
                                                            </div>
                                                        );
                                                    }
                                                } else if (deadlineDate) {
                                                    // BELUM MENGERJAKAN (PENDING)
                                                    const dateText = deadlineDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

                                                    statusDisplay = (
                                                        <div className={`flex w-full items-center gap-2 px-3 py-2 rounded-lg border ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                                                            {isOverdue ? <AlertCircle className="h-3.5 w-3.5 text-red-600" /> : <Calendar className="h-3.5 w-3.5 text-blue-600" />}
                                                            <span className={`text-xs font-bold ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>
                                                                {isOverdue ? 'Overdue' : 'Assigned'}
                                                            </span>
                                                        </div>
                                                    );
                                                    infoDisplay = (
                                                        <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                                                            {isOverdue ? <AlertCircle className="h-3.5 w-3.5 text-red-600" /> : <Calendar className="h-3.5 w-3.5 text-red-600" />}
                                                            <span className="text-xs font-bold text-red-700">
                                                                {dateText}
                                                            </span>
                                                        </div>
                                                    );
                                                } else {
                                                    statusDisplay = <span className="text-xs text-slate-400">-</span>;
                                                    infoDisplay = <span className="text-xs text-slate-400">-</span>;
                                                }

                                                return (
                                                    <motion.div
                                                        key={task.id}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        onClick={() => navigate('/student/tasks')}
                                                        className={`flex flex-col md:flex-row md:items-center md:justify-between py-4 px-4 md:px-6 transition-colors cursor-pointer group ${statusColor} gap-3 rounded-xl mb-4 md:mb-0`}
                                                        title="Click to view details"
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <span className="hidden md:block text-slate-400 font-medium w-6 text-center flex-shrink-0 text-sm">{exams.slice(0, 3).length + index + 1}</span>

                                                            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-sm">
                                                                <BookOpen className="h-5 w-5" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors line-clamp-2 text-[13px]" title={task.title}>{task.title}</h4>
                                                                <p className="text-sm text-slate-500 line-clamp-1">{task.description}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 md:gap-8 md:pl-4 flex-shrink-0">
                                                            <div className="flex-1 md:flex-none md:text-center md:min-w-[100px]">
                                                                {statusDisplay}
                                                            </div>
                                                            <div className="text-center min-w-[60px]">
                                                                {gradeValue === "-" ? (
                                                                    <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-sm font-bold text-slate-400">–</span>
                                                                ) : isGraded ? (
                                                                    <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-sm font-bold text-emerald-700">
                                                                        {gradeValue}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-sm font-bold text-amber-700">
                                                                        {gradeValue}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pagination Footer */}
                        {(() => {
                            const totalItems = exams.length + tasks.length;
                            const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

                            return (
                                <div className="bg-white px-6 py-5 border-t border-slate-200">
                                    <Pagination
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        onPageChange={setCurrentPage}
                                    />
                                </div>
                            );
                        })()}
                    </div>
                </>
            )}
        </div>
    );
}
