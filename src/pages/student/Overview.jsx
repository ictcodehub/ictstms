import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CheckCircle, Clock, AlertCircle, Calendar, TrendingUp, ChevronRight, Hourglass, Send, ClipboardCheck, PlayCircle, ClipboardList, ChevronLeft, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Pagination from '../../components/Pagination';
import NewExamsBanner from '../../components/NewExamsBanner';
import { useNewExams } from '../../hooks/useNewExams';

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
    const [examSessions, setExamSessions] = useState({}); // Track active exam sessions
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [userClass, setUserClass] = useState(null);
    const [classId, setClassId] = useState(null); // Add classId state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth < 768 ? 5 : 10);

    // New exams notification - use classId state
    const { newExams, markAsRead } = useNewExams('student', classId);


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

                // DATA MODEL UPDATE: Support both single classId (legacy) and multiple classIds
                const myClassIds = [
                    ...(userData.classIds || []),
                    userData.classId
                ].filter(id => id); // Remove null/undefined/empty strings

                const uniqueClassIds = [...new Set(myClassIds)];
                setClassId(uniqueClassIds[0]); // Set primary/first classId state for hooks if needed

                if (uniqueClassIds.length > 0) {
                    // We just need to set this to something truthy so the "Not assigned" UI doesn't show
                    // Or fetch the first class details for display if we really want to show "Class Name" somewhere
                    const classDoc = await getDocs(query(collection(db, 'classes'), where('__name__', 'in', uniqueClassIds.slice(0, 10))));
                    if (!classDoc.empty) {
                        setUserClass(classDoc.docs[0].data());
                    } else {
                        // Fallback object to prevent null
                        setUserClass({ id: 'enrolled', count: uniqueClassIds.length });
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
                    where('assignedClasses', 'array-contains-any', uniqueClassIds)
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
                    where('assignedClasses', 'array-contains-any', uniqueClassIds),
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

                // Setup real-time listener for exam sessions
                const sessionsQuery = query(
                    collection(db, 'exam_sessions'),
                    where('studentId', '==', currentUser.uid),
                    where('status', '==', 'in_progress')
                );
                const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
                    const sessions = {};
                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        sessions[data.examId] = { id: doc.id, ...data };
                    });
                    setExamSessions(sessions);
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

            // Count COMPLETED exams (submitted) - only count exams that still exist
            const completedExamIds = resultsList
                .filter(r => examsList.some(exam => exam.id === r.examId)) // Only count if exam still exists
                .map(r => r.examId);
            const uniqueCompletedExamIds = new Set(completedExamIds);
            const completedExamsCount = uniqueCompletedExamIds.size;

            // Merge results into exams list for display
            const examsWithResults = examsList.map(exam => {
                const specificResults = resultsList.filter(r => r.examId === exam.id);
                // Sort by submittedAt desc to get latest attempt
                specificResults.sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));
                const result = specificResults[0];
                return { ...exam, userResult: result };
            });

            setExams(examsWithResults);

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                        Student Dashboard
                    </h1>
                    <p className="text-slate-500 mt-1">Welcome, track your learning progress today.</p>
                </div>


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

            {/* New Exams Notification Banner */}
            <NewExamsBanner newExams={newExams} onDismiss={markAsRead} />

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
                                            <span className="w-6 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">No</span>
                                            <div className="w-10"></div>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Activity Details</span>
                                        </div>
                                        <div className="flex items-center gap-8 pl-4">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Assigned</span>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Status</span>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[60px] text-center">Grade</span>
                                        </div>
                                    </div>

                                    {/* TABLE BODY - Unified List */}
                                    <div className="space-y-3 md:space-y-0">
                                        {(() => {
                                            // 1. COMBINE & SORT
                                            const allActivities = [
                                                ...exams.map(e => ({ type: 'exam', ...e })),
                                                ...tasks.map(t => ({ type: 'task', ...t }))
                                            ];

                                            allActivities.sort((a, b) => {
                                                // Priority: Pending/Active > Submitted/Completed > Graded
                                                // For Exams:
                                                // - Active: !isCompleted && !isExpired
                                                // - Completed: isCompleted
                                                // For Tasks:
                                                // - Pending: !submission
                                                // - Submitted: submission && !graded
                                                // - Graded: submission && graded

                                                // Helper to get status weight (Lower = Higher Priority)
                                                const getWeight = (item) => {
                                                    if (item.type === 'task') {
                                                        const sub = submissions[item.id];
                                                        const isGraded = sub && sub.grade !== null && sub.grade !== undefined;
                                                        if (!sub) return 1; // Pending
                                                        if (sub && !isGraded) return 2; // Submitted
                                                        return 3; // Graded
                                                    } else {
                                                        // Exam
                                                        // We need to check if it's completed for the current user
                                                        // Since we don't have easy access to results inside this sort function without passing it down or using context/props efficiently,
                                                        // We'll rely on a simpler heuristic or the data we have.
                                                        // Actually, we can check availability if we had the results list here, but we don't in this scope easily.
                                                        // However, 'stats.activeExams' logic separated them.
                                                        // A simpler approach for exams:
                                                        // If it's in the 'availableExams' list (which we don't strictly have as a separate list variable here, but we can infer or simpler: sort all by date)
                                                        // Let's stick to a robust date sort, but prioritize "Action Needed".
                                                        return 1; // Treat all exams as high priority or sort purely by date?
                                                        // Let's sort purely by Date (Deadline or Created) for a true "Timeline" feel, 
                                                        // BUT bubbling active stuff to top is usually better.

                                                        // Let's refine:
                                                        // 1. Unfinished Tasks & Active Exams
                                                        // 2. Finished stuff
                                                    }
                                                    return 2;
                                                };

                                                // SIMPLIFIED SORT: 
                                                // 1. Sort by Date (Deadline for tasks, Created/Scheduled for exams) DESCENDING (Newest first) or Ascending for deadlines?
                                                // Usually "Upcoming Deadlines" are Ascending. "Recent Activity" (History) is Descending.
                                                // Let's mix: If it's pending, sort by deadline (Asc). If completed, sort by completion date (Desc).
                                                // This is complex.
                                                // Let's stick to the user's implicit need: "See what I need to do".
                                                // So: Pending items first (sorted by deadline/urgency). Then Completed items (sorted by recency).

                                                const getSortDate = (item) => {
                                                    // Use createdAt for both tasks and exams to show newest first
                                                    if (item.type === 'task') {
                                                        return item.createdAt ? item.createdAt.toDate() : new Date(0);
                                                    }
                                                    return item.createdAt ? item.createdAt.toDate() : new Date();
                                                };

                                                const dateA = getSortDate(a);
                                                const dateB = getSortDate(b);

                                                return dateB - dateA; // Descending Order (Newest first)
                                            });

                                            // Items are now sorted by createdAt (newest first) only

                                            // 2. PAGINATE
                                            const totalPages = Math.ceil(allActivities.length / itemsPerPage);
                                            const startIndex = (currentPage - 1) * itemsPerPage;
                                            const paginatedItems = allActivities.slice(startIndex, startIndex + itemsPerPage);

                                            return (
                                                <>
                                                    {paginatedItems.map((item, index) => {
                                                        const displayIndex = startIndex + index + 1;

                                                        if (item.type === 'exam') {
                                                            // EXAM CARD
                                                            const result = item.userResult;
                                                            const isInProgress = !!examSessions[item.id]; // Check if exam has active session
                                                            const isRemedial = result && result.allowRetake;
                                                            const isCompleted = !!result && !isRemedial;

                                                            let cardBg = isCompleted ? 'bg-slate-100 hover:bg-slate-200 md:bg-white md:hover:bg-slate-50' :
                                                                isRemedial ? 'bg-orange-100 hover:bg-orange-200 md:bg-orange-50/70 md:hover:bg-orange-50' :
                                                                    isInProgress ? 'bg-yellow-100 hover:bg-yellow-200 md:bg-yellow-50/70 md:hover:bg-yellow-50' :
                                                                        'bg-purple-100 hover:bg-purple-200 md:bg-purple-50/70 md:hover:bg-purple-50';

                                                            let iconBg = isCompleted ? 'bg-white border-emerald-100 text-emerald-600' :
                                                                isRemedial ? 'bg-white border-orange-100 text-orange-600' :
                                                                    isInProgress ? 'bg-white border-yellow-100 text-yellow-600' :
                                                                        'bg-white border-purple-100 text-purple-600';

                                                            return (
                                                                <motion.div
                                                                    key={`exam-${item.id}`}
                                                                    initial={{ opacity: 0, x: -20 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ delay: index * 0.05 }}
                                                                    onClick={() => navigate('/student/exams')}
                                                                    className={`flex flex-col md:flex-row md:items-center md:justify-between py-4 px-4 md:px-6 cursor-pointer transition-all group gap-3 rounded-xl md:rounded-none md:border-b md:border-slate-100 ${cardBg}`}
                                                                >
                                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                        <span className="hidden md:block w-6 text-center text-xs font-bold text-slate-600">{displayIndex}</span>
                                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border-2 ${iconBg}`}>
                                                                            <ClipboardCheck className="h-5 w-5" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <h4 className={`text-sm font-bold transition-colors line-clamp-1 mb-1 ${isRemedial ? 'text-slate-800 group-hover:text-orange-600' : isInProgress ? 'text-slate-800 group-hover:text-yellow-600' : isCompleted ? 'text-slate-700' : 'text-slate-800 group-hover:text-purple-600'}`}>{item.title}</h4>
                                                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                                                <span className="flex items-center gap-1">
                                                                                    <Clock className="h-3 w-3" /> {item.duration} Minutes
                                                                                </span>
                                                                                <span className="hidden md:inline text-slate-400">•</span>
                                                                                <span className="hidden md:flex items-center gap-1">
                                                                                    <ClipboardCheck className="h-3 w-3" /> {item.questions?.length || 0} Questions
                                                                                </span>
                                                                            </div>
                                                                            <div className="md:hidden mt-1.5 text-xs text-slate-500">
                                                                                <span className="font-medium">Assigned: </span>
                                                                                <span>
                                                                                    {item.createdAt ? item.createdAt.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 md:gap-8 md:pl-4">
                                                                        <div className="hidden md:block text-center min-w-[100px]">
                                                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-cyan-50 border border-cyan-100">
                                                                                <Calendar className="h-3.5 w-3.5 text-cyan-600" />
                                                                                <span className="text-xs font-bold text-cyan-700">
                                                                                    {item.createdAt ? item.createdAt.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex-1 md:flex-none md:text-center md:min-w-[100px]">
                                                                            {isInProgress ? (
                                                                                <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-yellow-100 border border-yellow-200">
                                                                                    <Clock className="h-3.5 w-3.5 text-yellow-600 animate-pulse" />
                                                                                    <span className="text-xs font-bold text-yellow-700">In Progress</span>
                                                                                </div>
                                                                            ) : isRemedial ? (
                                                                                <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-orange-100 border border-orange-200">
                                                                                    <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
                                                                                    <span className="text-xs font-bold text-orange-700">Remedial</span>
                                                                                </div>
                                                                            ) : isCompleted ? (
                                                                                <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-emerald-100 border border-emerald-200">
                                                                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                                                                    <span className="text-xs font-bold text-emerald-700">Completed</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-purple-100 border border-purple-200">
                                                                                    <PlayCircle className="h-3.5 w-3.5 text-purple-600" />
                                                                                    <span className="text-xs font-bold text-purple-700">Available</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-center min-w-[60px]">
                                                                            {isCompleted || isRemedial ? (
                                                                                <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg border text-sm font-bold ${(result.score !== undefined ? result.score : 0) >= 90 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                                    (result.score !== undefined ? result.score : 0) >= 80 ? 'bg-teal-50 text-teal-600 border-teal-100' :
                                                                                        (result.score !== undefined ? result.score : 0) >= 70 ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                                            (result.score !== undefined ? result.score : 0) >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                                                'bg-red-50 text-red-600 border-red-100'
                                                                                    }`}>
                                                                                    {result.score !== undefined ? result.score : '-'}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-sm font-bold text-slate-400">–</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            );
                                                        } else {
                                                            // TASK CARD
                                                            const task = item;
                                                            const submission = submissions[task.id];
                                                            const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;

                                                            let statusColor = "";
                                                            if (submission && submission.grade !== null && submission.grade !== undefined) {
                                                                // Sudah dinilai - Abu-abu -> Desktop: White
                                                                statusColor = "bg-slate-100 hover:bg-slate-200 md:bg-white md:hover:bg-slate-50";
                                                            } else if (submission) {
                                                                // Menunggu dinilai - Kuning -> Desktop: White (Submitted = Done)
                                                                statusColor = "bg-amber-50 hover:bg-amber-100/50 md:bg-white md:hover:bg-slate-50";
                                                            } else {
                                                                // Belum dikerjakan - Merah -> Desktop: Faint Red/Blue
                                                                statusColor = isOverdue ? "bg-red-100/50 hover:bg-red-100 md:bg-red-50/70 md:hover:bg-red-50" : "bg-red-50 hover:bg-red-100/50 md:bg-blue-50/70 md:hover:bg-blue-50";
                                                            }

                                                            // Handle Grade Display
                                                            let gradeValue = "-";
                                                            const isGraded = submission && submission.grade !== null && submission.grade !== undefined;
                                                            if (isGraded) gradeValue = submission.grade;

                                                            // Handle Status Display
                                                            let statusDisplay = null;
                                                            const deadlineDate = task.deadline ? new Date(task.deadline) : null;

                                                            if (submission) {
                                                                if (isGraded) {
                                                                    const isEarly = submission.submittedAt && deadlineDate ? submission.submittedAt.toDate() <= deadlineDate : true;
                                                                    statusDisplay = (
                                                                        <div className={`flex w-full items-center gap-2 px-3 py-2 rounded-lg border ${isEarly ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                                                            {isEarly ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
                                                                            <span className={`text-xs font-bold ${isEarly ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                                {isEarly ? 'Completed' : 'Done Late'}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    statusDisplay = (
                                                                        <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                                                                            <Send className="h-3.5 w-3.5 text-amber-600" />
                                                                            <span className="text-xs font-bold text-amber-700">Submitted</span>
                                                                        </div>
                                                                    );
                                                                }
                                                            } else if (deadlineDate) {
                                                                const dateText = deadlineDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                                                                statusDisplay = (
                                                                    <div className={`flex w-full items-center gap-2 px-3 py-2 rounded-lg border ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                                                                        {isOverdue ? <AlertCircle className="h-3.5 w-3.5 text-red-600" /> : <Calendar className="h-3.5 w-3.5 text-blue-600" />}
                                                                        <span className={`text-xs font-bold ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>
                                                                            {isOverdue ? 'Overdue' : `Due: ${dateText}`}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            } else {
                                                                statusDisplay = <span className="text-xs text-slate-400">-</span>;
                                                            }

                                                            const isLateSubmission = submission && submission.submittedAt && deadlineDate
                                                                ? submission.submittedAt.toDate() > deadlineDate
                                                                : false;

                                                            return (
                                                                <motion.div
                                                                    key={task.id}
                                                                    initial={{ opacity: 0, x: -20 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ delay: index * 0.05 }}
                                                                    onClick={() => navigate('/student/tasks')}
                                                                    className={`flex flex-col md:flex-row md:items-center md:justify-between py-4 px-4 md:px-6 transition-colors cursor-pointer group ${statusColor} gap-3 rounded-xl md:rounded-none md:border-b md:border-slate-100`}
                                                                >
                                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                        <span className="hidden md:block text-slate-400 font-medium w-6 text-center flex-shrink-0 text-xs">{displayIndex}</span>
                                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border-2 bg-white ${(isOverdue && !submission) || isLateSubmission ? 'border-red-100 text-red-600' :
                                                                            'border-blue-100 text-blue-600'
                                                                            }`}>
                                                                            <BookOpen className="h-5 w-5" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <h4 className={`font-bold text-slate-800 transition-colors line-clamp-2 text-sm mb-1 ${(isOverdue && !submission) || isLateSubmission ? 'group-hover:text-red-600' :
                                                                                submission ? 'group-hover:text-slate-900' :
                                                                                    'group-hover:text-blue-700'
                                                                                }`} title={task.title}>{task.title}</h4>
                                                                            <p className="text-xs text-slate-500 line-clamp-1">{task.description}</p>
                                                                            <div className="md:hidden mt-1.5 text-xs text-slate-500">
                                                                                <span className="font-medium">Assigned: </span>
                                                                                <span>
                                                                                    {task.createdAt ? task.createdAt.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 md:gap-8 md:pl-4 flex-shrink-0">
                                                                        <div className="hidden md:block text-center min-w-[100px]">
                                                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-cyan-50 border border-cyan-100">
                                                                                <Calendar className="h-3.5 w-3.5 text-cyan-600" />
                                                                                <span className="text-xs font-bold text-cyan-700">
                                                                                    {task.createdAt ? task.createdAt.toDate().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex-1 md:flex-none md:text-center md:min-w-[100px]">
                                                                            {statusDisplay}
                                                                        </div>
                                                                        <div className="text-center min-w-[60px]">
                                                                            {gradeValue === "-" ? (
                                                                                <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-sm font-bold text-slate-400">–</span>
                                                                            ) : (
                                                                                <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg border text-sm font-bold ${gradeValue >= 90 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                                    gradeValue >= 80 ? 'bg-teal-50 text-teal-600 border-teal-100' :
                                                                                        gradeValue >= 70 ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                                            gradeValue >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                                                'bg-red-50 text-red-600 border-red-100'
                                                                                    }`}>
                                                                                    {gradeValue}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            );
                                                        }
                                                    })}
                                                    {/* Hidden Pagination Component Injection to force update if needed, but Pagination component is outside */}
                                                    <div className="hidden" data-total-pages={totalPages}></div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pagination Footer */}
                        {(() => {
                            // Fix Pagination Calculation
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
