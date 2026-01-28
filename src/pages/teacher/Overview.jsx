import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Users, BookOpen, ClipboardList, AlertCircle, Calendar, CheckCircle, Clock, UserPlus, Plus, ClipboardCheck, Globe, Lock, ChevronLeft, ChevronRight } from 'lucide-react';

export default function TeacherOverview() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalClasses: 0,
        activeTasks: 0,
        needsGrading: 0,
        totalExams: 0
    });
    const [recentActivities, setRecentActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        if (currentUser) {
            loadData();
        }
    }, [currentUser]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Load Classes created by this teacher
            const classesQuery = query(
                collection(db, 'classes'),
                where('createdBy', '==', currentUser.uid)
            );
            const classesSnap = await getDocs(classesQuery);
            const teacherClassIds = classesSnap.docs.map(doc => doc.id);

            // 2. Load Students in these classes
            let studentsSnap = { size: 0, docs: [] };
            if (teacherClassIds.length > 0) {
                const allStudentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
                const allStudentsSnap = await getDocs(allStudentsQuery);
                // Filter client-side for simplicity as 'in' query has limits
                const filteredStudents = allStudentsSnap.docs.filter(doc =>
                    teacherClassIds.includes(doc.data().classId)
                );
                studentsSnap = { size: filteredStudents.length, docs: filteredStudents };
            }
            // 3. Load Tasks created by this teacher
            const tasksQuery = query(
                collection(db, 'tasks'),
                where('createdBy', '==', currentUser.uid)
            );
            const tasksSnap = await getDocs(tasksQuery);
            const teacherTaskIds = tasksSnap.docs.map(doc => doc.id);
            const activeTasks = tasksSnap.docs.filter(doc => {
                const deadline = doc.data().deadline;
                return deadline && new Date(deadline) > new Date();
            });
            // 4. Load Submissions for these tasks
            let submissionsSnap = { docs: [] };
            if (teacherTaskIds.length > 0) {
                const allSubmissionsSnap = await getDocs(collection(db, 'submissions'));
                // Filter by teacher tasks
                let filteredSubmissions = allSubmissionsSnap.docs.filter(doc =>
                    teacherTaskIds.includes(doc.data().taskId)
                );

                // Deduplicate: Keep only the latest submission per student per task
                // Improved Logic: Prioritize GRADED submissions. 
                // If a student has a graded submission, that's the one we show (assuming resubmissions are duplicates or irrelevant until graded)
                // If multiple graded or multiple ungraded, sort by date (newest first).
                filteredSubmissions.sort((a, b) => {
                    const dataA = a.data();
                    const dataB = b.data();

                    const isGradedA = dataA.grade !== null && dataA.grade !== undefined;
                    const isGradedB = dataB.grade !== null && dataB.grade !== undefined;

                    // Prioritize Graded
                    if (isGradedA && !isGradedB) return -1;
                    if (!isGradedA && isGradedB) return 1;

                    // If same status, sort by date (Newest First)
                    const dateA = dataA.submittedAt?.toDate ? dataA.submittedAt.toDate() : new Date(dataA.submittedAt);
                    const dateB = dataB.submittedAt?.toDate ? dataB.submittedAt.toDate() : new Date(dataB.submittedAt);
                    return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
                });

                // Then keep only the first occurrence for each student-task pair
                const uniqueSubMap = new Map();
                for (const doc of filteredSubmissions) {
                    const data = doc.data();
                    const key = `${data.taskId}_${data.studentId}`;
                    if (!uniqueSubMap.has(key)) {
                        uniqueSubMap.set(key, doc);
                    }
                }
                filteredSubmissions = Array.from(uniqueSubMap.values());

                submissionsSnap = { docs: filteredSubmissions };
            }
            const needsGrading = submissionsSnap.docs.filter(doc => {
                const grade = doc.data().grade;
                return grade === null || grade === undefined;
            });

            // 5. Load Exams
            const examsQuery = query(
                collection(db, 'exams'),
                where('createdBy', '==', currentUser.uid)
            );
            const examsSnap = await getDocs(examsQuery);

            // Helper to parse date from Firestore Timestamp or String
            const parseDate = (dateField) => {
                if (!dateField) return null;
                if (typeof dateField.toDate === 'function') return dateField.toDate();
                if (typeof dateField.toMillis === 'function') return new Date(dateField.toMillis());
                if (typeof dateField === 'string') return new Date(dateField);
                if (dateField instanceof Date) return dateField;
                return null;
            };

            // Collect all activities
            const allActivities = [];

            // 1. Submission Activities (always include these)
            const recentSubs = submissionsSnap.docs
                .filter(doc => doc.data().submittedAt)
                .sort((a, b) => {
                    const dateA = parseDate(a.data().submittedAt);
                    const dateB = parseDate(b.data().submittedAt);
                    return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
                });

            for (const subDoc of recentSubs) {
                const sub = subDoc.data();
                let studentName = 'Unknown Student';
                let className = '';

                const studentDocs = studentsSnap.docs.find(doc => doc.id === sub.studentId || doc.data().uid === sub.studentId);
                if (studentDocs) {
                    const studentData = studentDocs.data();
                    studentName = studentData.name || studentData.email?.split('@')[0] || 'Unknown Student';
                    if (studentData.classId) {
                        const classDoc = classesSnap.docs.find(c => c.id === studentData.classId);
                        className = classDoc?.data()?.name || '';
                    }
                }

                const taskDoc = tasksSnap.docs.find(t => t.id === sub.taskId);
                const taskTitle = taskDoc?.data()?.title || 'Unknown Task';

                allActivities.push({
                    id: subDoc.id,
                    type: 'submission',
                    timestamp: parseDate(sub.submittedAt),
                    taskId: sub.taskId,
                    studentName,
                    className,
                    taskTitle,
                    hasGrade: sub.grade !== null && sub.grade !== undefined,
                    grade: sub.grade,
                    initial: studentName.charAt(0).toUpperCase()
                });
            }

            // 2. New Student Activities (within 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            studentsSnap.docs.forEach(doc => {
                const student = doc.data();
                const createdAt = parseDate(student.createdAt);

                if (createdAt && createdAt.getTime() > sevenDaysAgo) {
                    const classDoc = classesSnap.docs.find(c => c.id === student.classId);
                    const className = classDoc?.data()?.name || 'Unknown Class';

                    allActivities.push({
                        id: `student-${doc.id}`,
                        type: 'new_student',
                        timestamp: createdAt,
                        studentName: student.name || student.email?.split('@')[0] || 'Unknown Student',
                        className,
                        classId: student.classId,
                        initial: (student.name || 'U').charAt(0).toUpperCase()
                    });
                }
            });

            // 3. Deadline Reminder Activities (within 3 days)
            const now = new Date();
            const threeDaysLater = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
            tasksSnap.docs.forEach(doc => {
                const task = doc.data();
                const deadline = parseDate(task.deadline);

                if (deadline && deadline > now && deadline <= threeDaysLater) {
                    const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

                    allActivities.push({
                        id: `deadline-${doc.id}`,
                        type: 'deadline',
                        timestamp: deadline,
                        taskTitle: task.title,
                        taskId: doc.id,
                        daysUntilDeadline: daysUntil,
                        initial: '⏰'
                    });
                }
            });

            // 4. New Task Activities (within 7 days)
            tasksSnap.docs.forEach(doc => {
                const task = doc.data();
                const createdAt = parseDate(task.createdAt);

                if (createdAt && createdAt.getTime() > sevenDaysAgo) {
                    allActivities.push({
                        id: `newtask-${doc.id}`,
                        type: 'new_task',
                        timestamp: createdAt,
                        taskTitle: task.title,
                        taskId: doc.id,
                        initial: '➕'
                    });
                }
            });

            // 5. New Exam Activities (within 7 days)
            examsSnap.docs.forEach(doc => {
                const exam = doc.data();
                const createdAt = parseDate(exam.createdAt);

                if (createdAt && createdAt.getTime() > sevenDaysAgo) {
                    allActivities.push({
                        id: `newexam-${doc.id}`,
                        type: 'new_exam',
                        timestamp: createdAt,
                        examTitle: exam.title,
                        examId: doc.id,
                        isGuestAllowed: exam.isGuestAllowed,
                        initial: '📝'
                    });
                }
            });

            // Sort all activities by timestamp (most recent first) and limit to 10
            const sortedActivities = allActivities
                .filter(activity => activity.timestamp) // Filter out activities without timestamp
                .sort((a, b) => b.timestamp - a.timestamp);

            // ==========================================
            // STORAGE CALCULATION LOGIC
            // ==========================================
            let totalSizeBytes = 0;

            // 1. Calculate Teacher's Task Attachments
            tasksSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.attachments && Array.isArray(data.attachments)) {
                    data.attachments.forEach(file => {
                        // Safe parsing for size (handle strings or numbers)
                        const size = parseInt(file.size || 0);
                        totalSizeBytes += size;
                    });
                }
            });

            // 2. Calculate Student Submissions (for tasks created by this teacher)
            submissionsSnap.docs.forEach(doc => {
                const data = doc.data();
                // Count legacy 'fileUrl' (assume avg 5MB if size unknown? No, better skip or minimal)
                // Modern submissions use 'attachments' array
                if (data.attachments && Array.isArray(data.attachments)) {
                    data.attachments.forEach(file => {
                        const size = parseInt(file.size || 0);
                        totalSizeBytes += size;
                    });
                } else if (data.fileUrl) {
                    // Fallback for old single-file structure (Estimate or if size saved)
                    // If size not present, ignore to be safe or add nominal
                    totalSizeBytes += parseInt(data.fileSize || 0);
                }
            });



            setStats({
                totalStudents: studentsSnap.size,
                totalClasses: classesSnap.size,
                activeTasks: activeTasks.length,
                needsGrading: needsGrading.length,
                totalExams: examsSnap.size,
                storageUsed: totalSizeBytes // Add to state
            });
            setRecentActivities(sortedActivities);
        } catch (error) {
            console.error('Error loading overview data:', error);
        } finally {
            setLoading(false);
        }
    };

    const statsCards = [
        { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'from-blue-500 to-cyan-500', path: '/teacher/students' },
        { label: 'Total Classes', value: stats.totalClasses, icon: BookOpen, color: 'from-sky-500 to-indigo-500', path: '/teacher/classes' },
        { label: 'Total Exams', value: stats.totalExams, icon: ClipboardCheck, color: 'from-pink-500 to-rose-500', path: '/teacher/exams' },
        { label: 'Active Tasks', value: stats.activeTasks, icon: ClipboardList, color: 'from-cyan-500 to-teal-500', path: '/teacher/tasks' },
        { label: 'Needs Grading', value: stats.needsGrading, icon: AlertCircle, color: 'from-indigo-500 to-purple-500', path: '/teacher/gradebook' },
    ];

    const getTimeAgo = (date) => {
        if (!date) return '';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Baru saja';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} menit yang lalu`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam yang lalu`;
        return `${Math.floor(seconds / 86400)} hari yang lalu`;
    };

    const handleActivityClick = (activity) => {
        switch (activity.type) {
            case 'submission':
            case 'deadline':
            case 'new_task':
                // Navigate to tasks page with the selected task ID
                navigate('/teacher/tasks', {
                    state: {
                        selectedTaskId: activity.taskId
                    }
                });
                break;
            case 'new_student':
                // Navigate to classes page with the selected class ID
                navigate('/teacher/classes', {
                    state: {
                        selectedClassId: activity.classId
                    }
                });
                break;
            case 'new_exam':
                navigate('/teacher/exams');
                break;
            default:
                break;
        }
    };

    const getActivityStyles = (activity) => {
        switch (activity.type) {
            case 'submission':
            case 'new_student':
                return 'bg-blue-50 border-2 border-blue-100 text-blue-600';
            case 'deadline':
                return 'bg-gradient-to-br from-orange-500 to-amber-500 text-white';
            case 'new_task':
                return 'bg-gradient-to-br from-cyan-500 to-teal-500 text-white';
            case 'new_exam':
                return 'bg-gradient-to-br from-pink-500 to-rose-500 text-white';
            default:
                return 'bg-gradient-to-br from-slate-500 to-gray-500 text-white';
        }
    };

    const getActivityMessage = (activity) => {
        switch (activity.type) {
            case 'submission':
                return (
                    <>
                        <span className="text-blue-600 font-bold">{activity.studentName}</span> mengumpulkan tugas
                    </>
                );
            case 'new_student':
                return (
                    <>
                        New student <span className="text-purple-600 font-bold">{activity.studentName}</span> joined Class {activity.className}
                    </>
                );
            case 'deadline':
                return (
                    <>
                        Deadline tugas dalam <span className="text-orange-600 font-bold">{activity.daysUntilDeadline} hari</span>
                    </>
                );
            case 'new_task':
                return (
                    <>
                        New task created
                    </>
                );
            case 'new_exam':
                return (
                    <>
                        Ujian baru <span className="text-pink-600 font-bold">{activity.examTitle}</span> dibuat
                    </>
                );
            default:
                return 'Aktivitas';
        }
    };

    const getActivityBadge = (activity) => {
        switch (activity.type) {
            case 'submission':
                return activity.hasGrade ? (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">
                        Nilai: {activity.grade}
                    </span>
                ) : (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                        Needs Grading
                    </span>
                );
            case 'new_student':
                return (
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                        Siswa Baru
                    </span>
                );
            case 'deadline':
                return (
                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold">
                        Mendesak
                    </span>
                );
            case 'new_task':
                return (
                    <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded font-semibold">
                        Baru
                    </span>
                );
            case 'new_exam':
                return (
                    <div className="flex gap-1" title={activity.isGuestAllowed ? "Guest Access" : "Class Access"}>
                        {activity.isGuestAllowed ? (
                            <span className="p-1 bg-indigo-100 text-indigo-700 rounded-full">
                                <Globe className="h-3 w-3" />
                            </span>
                        ) : (
                            <span className="p-1 bg-pink-100 text-pink-700 rounded-full">
                                <Users className="h-3 w-3" />
                            </span>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    // Pagination Logic
    const totalPages = Math.ceil(recentActivities.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentActivities = recentActivities.slice(startIndex, endIndex);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        Dashboard Guru
                    </h1>
                    <p className="text-slate-500 mt-1">Selamat datang kembali, {currentUser?.email}</p>
                </div>
                <div className="flex items-center">
                    {/* Cool Horizontal Storage Widget */}
                    <div className="group relative bg-white/50 backdrop-blur-sm border border-white/60 hover:border-blue-200 pr-5 pl-2 py-1.5 rounded-full flex items-center gap-3 transition-all hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5">
                        {/* Animated Server Icon Container */}
                        <div className={`relative w-10 h-10 rounded-full flex items-center justify-center ${stats.storageUsed > 4 * 1024 * 1024 * 1024 ? 'bg-red-50' : 'bg-blue-50'} overflow-hidden`}>
                            <motion.div
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className={`absolute inset-0 ${stats.storageUsed > 4 * 1024 * 1024 * 1024 ? 'bg-red-200' : 'bg-blue-200'} blur-md opacity-50`}
                            />
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="relative z-10"
                            >
                                <div className={`p-1.5 rounded-full ${stats.storageUsed > 4 * 1024 * 1024 * 1024 ? 'text-red-500' : 'text-blue-600'}`}>
                                    {/* Using Hard Drive icon for 'Storage' feel */}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="12" x2="2" y2="12"></line>
                                        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                                        <line x1="6" y1="16" x2="6.01" y2="16"></line>
                                        <line x1="10" y1="16" x2="10.01" y2="16"></line>
                                    </svg>
                                </div>
                            </motion.div>
                        </div>

                        {/* Text & Bar Section */}
                        <div className="flex flex-col justify-center min-w-[160px]">
                            <div className="flex flex-col mb-1.5">
                                <span className="text-[10px] font-medium tracking-wide text-slate-500 mb-1">Firebase Storage</span>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${stats.storageUsed > 4 * 1024 * 1024 * 1024 ? 'bg-red-500' : stats.storageUsed > 2.5 * 1024 * 1024 * 1024 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                    <span className="text-xs font-medium text-slate-600">
                                        {stats.storageUsed < 1024 * 1024
                                            ? `${(stats.storageUsed / 1024).toFixed(1)} KB`
                                            : stats.storageUsed < 1024 * 1024 * 1024
                                                ? `${(stats.storageUsed / (1024 * 1024)).toFixed(1)} MB`
                                                : `${(stats.storageUsed / (1024 * 1024 * 1024)).toFixed(2)} GB`}
                                        <span className="text-slate-400 ml-1">/ 5 GB</span>
                                    </span>
                                </div>
                            </div>

                            {/* Sleek Progress Bar */}
                            <div className="relative w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min((stats.storageUsed / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className={`absolute top-0 left-0 h-full rounded-full ${stats.storageUsed > 4 * 1024 * 1024 * 1024
                                        ? 'bg-gradient-to-r from-red-500 to-orange-500'
                                        : stats.storageUsed > 2.5 * 1024 * 1024 * 1024
                                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                                            : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                                        }`}
                                >
                                    {/* Shimmer Effect */}
                                    <motion.div
                                        animate={{ x: ['-100%', '100%'] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                        className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                    />
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {statsCards.map((stat, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => navigate(stat.path)}
                                className={`bg-gradient-to-br ${stat.color} p-5 rounded-2xl shadow-lg text-white relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1`}
                            >
                                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500"></div>

                                <div className="relative z-10 flex items-center justify-between">
                                    <div>
                                        <p className="text-white/80 text-sm font-medium mb-1">{stat.label}</p>
                                        <p className="text-3xl font-bold">{stat.value}</p>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        <stat.icon className="h-8 w-8 text-white" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="bg-white rounded-3xl shadow-lg border border-blue-100 overflow-hidden">
                        <div className="p-6 border-b border-blue-50 bg-gradient-to-r from-white to-blue-50/30">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-blue-500" />
                                Aktivitas Terbaru
                            </h2>
                        </div>
                        <div className="p-6">
                            {recentActivities.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <p>Belum ada aktivitas terbaru</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {currentActivities.map((activity) => (
                                        <motion.div
                                            key={activity.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            onClick={() => handleActivityClick(activity)}
                                            className="flex gap-3 p-3 rounded-xl hover:bg-blue-50 transition-all border border-slate-100 cursor-pointer hover:shadow-md hover:border-blue-200 items-center"
                                        >
                                            <div className={`w-10 h-10 rounded-full ${getActivityStyles(activity)} flex items-center justify-center flex-shrink-0 font-bold text-base shadow-sm`}>
                                                {activity.initial}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-slate-700 truncate">
                                                            {getActivityMessage(activity)}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            {activity.className && (
                                                                <>
                                                                    <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold border border-slate-200 flex-shrink-0">
                                                                        {activity.className}
                                                                    </span>
                                                                    <span className="text-slate-300">•</span>
                                                                </>
                                                            )}
                                                            <p className="text-xs text-slate-500 truncate">{activity.taskTitle}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                        <p className="text-xs text-slate-400 whitespace-nowrap">{getTimeAgo(activity.timestamp)}</p>
                                                        {getActivityBadge(activity)}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {/* Pagination UI */}
                                    {totalPages > 1 && (
                                        <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between">
                                            <div className="text-sm text-slate-500">
                                                Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> - <span className="font-bold text-slate-800">{Math.min(endIndex, recentActivities.length)}</span> of <span className="font-bold text-slate-800">{recentActivities.length}</span> activities
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                    disabled={currentPage === 1}
                                                    className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium text-slate-600 bg-white"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                    Previous
                                                </button>
                                                <div className="flex items-center gap-1">
                                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                        let pageNum;
                                                        if (totalPages <= 5) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage <= 3) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage >= totalPages - 2) {
                                                            pageNum = totalPages - 4 + i;
                                                        } else {
                                                            pageNum = currentPage - 2 + i;
                                                        }

                                                        return (
                                                            <button
                                                                key={pageNum}
                                                                onClick={() => setCurrentPage(pageNum)}
                                                                className={`w-10 h-10 rounded-xl transition-all font-medium text-sm ${currentPage === pageNum
                                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                                                    : 'text-slate-600 hover:bg-white bg-white hover:shadow-sm border border-slate-200'
                                                                    }`}
                                                            >
                                                                {pageNum}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <button
                                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium text-slate-600 bg-white"
                                                >
                                                    Next
                                                    <ChevronRight className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
