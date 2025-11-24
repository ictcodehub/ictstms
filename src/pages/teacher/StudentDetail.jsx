import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, CheckCircle2, Clock, XCircle, BookOpen, Award, TrendingUp, FileText, Send, AlertCircle, CheckCircle, Hourglass } from 'lucide-react';

export default function StudentDetail({ student, onBack, onTaskClick, hideSubmissionTime }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        submitted: 0,
        late: 0,
        missing: 0,
        avgGrade: 0
    });

    useEffect(() => {
        loadStudentData();
    }, [student]);

    const loadStudentData = async () => {
        setLoading(true);
        try {
            // 1. Get all tasks assigned to this student's class
            const tasksQuery = query(
                collection(db, 'tasks'),
                where('assignedClasses', 'array-contains', student.classId)
            );
            const tasksSnap = await getDocs(tasksQuery);
            const tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 2. Get all submissions by this student
            const submissionsQuery = query(
                collection(db, 'submissions')
            );
            const submissionsSnap = await getDocs(submissionsQuery);
            const allSubmissions = submissionsSnap.docs.map(doc => doc.data());

            const studentSubmissions = allSubmissions.filter(sub =>
                sub.studentId === student.uid || sub.studentId === student.id
            );

            // 3. Merge data
            const mergedTasks = tasksList.map(task => {
                const submission = studentSubmissions.find(sub => sub.taskId === task.id);
                const isSubmitted = !!submission;
                const isLate = isSubmitted && new Date(submission.submittedAt?.toDate?.() || submission.submittedAt) > new Date(task.deadline);
                const isOverdue = !isSubmitted && new Date(task.deadline) < new Date();

                let status = 'missing';
                if (submission?.grade !== undefined && submission?.grade !== null) status = 'graded';
                else if (isSubmitted) status = isLate ? 'late' : 'submitted';
                else if (!isOverdue) status = 'pending';

                return {
                    ...task,
                    submission,
                    status,
                    isLate
                };
            });

            // Sort by priority: not submitted (missing/pending) > ungraded > graded
            mergedTasks.sort((a, b) => {
                // Priority 1: Not submitted tasks (missing or pending)
                const aNotSubmitted = a.status === 'missing' || a.status === 'pending';
                const bNotSubmitted = b.status === 'missing' || b.status === 'pending';
                if (aNotSubmitted && !bNotSubmitted) return -1;
                if (!aNotSubmitted && bNotSubmitted) return 1;

                // Priority 2: Ungraded submissions
                const aUngraded = a.submission && (a.submission.grade === undefined || a.submission.grade === null);
                const bUngraded = b.submission && (b.submission.grade === undefined || b.submission.grade === null);
                if (aUngraded && !bUngraded) return -1;
                if (!aUngraded && bUngraded) return 1;

                // Priority 3: Sort by deadline (newest first)
                return new Date(b.deadline) - new Date(a.deadline);
            });

            setTasks(mergedTasks);

            // Calculate stats
            const gradedSubmissions = studentSubmissions.filter(s => s.grade !== undefined && s.grade !== null);
            const totalGrade = gradedSubmissions.reduce((sum, s) => sum + s.grade, 0);

            setStats({
                total: tasksList.length,
                submitted: studentSubmissions.length,
                late: mergedTasks.filter(t => t.status === 'late').length,
                missing: mergedTasks.filter(t => t.status === 'missing').length,
                avgGrade: gradedSubmissions.length > 0 ? (totalGrade / gradedSubmissions.length).toFixed(1) : 0
            });

        } catch (error) {
            console.error("Error loading student details:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return d.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '-';
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'graded':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <CheckCircle className="h-3 w-3" />
                        Dinilai
                    </span>
                );
            case 'submitted':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                        <Hourglass className="h-3 w-3" />
                        Diserahkan
                    </span>
                );
            case 'late':
            case 'missing':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                        <AlertCircle className="h-3 w-3" />
                        Terlambat
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        <Calendar className="h-3 w-3" />
                        Ditugaskan
                    </span>
                );
        }
    };

    const getDeadlineStyle = (deadline) => {
        if (!deadline) return 'bg-slate-50 text-slate-700 border-slate-200';

        const deadlineDate = deadline.toDate ? deadline.toDate() : new Date(deadline);
        const now = new Date();
        const diffTime = deadlineDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Overdue
        if (diffDays < 0) {
            return 'bg-red-50 text-red-700 border-red-200';
        }

        // Due soon (within 3 days)
        if (diffDays <= 3) {
            return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        }

        // Safe (more than 3 days)
        return 'bg-green-50 text-green-700 border-green-200';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{student.name}</h1>
                    <p className="text-slate-500 text-sm mt-1">{student.email}</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Total Tugas</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Diserahkan</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.submitted}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                            <Award className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Rata-rata Nilai</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.avgGrade}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                            <XCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Belum/Telat</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.missing + stats.late}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tasks List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">Riwayat Tugas</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">No</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Judul Tugas</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Tenggat</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                                {!hideSubmissionTime && (
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Waktu Submit</th>
                                )}
                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Nilai</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : tasks.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                        Belum ada tugas untuk siswa ini.
                                    </td>
                                </tr>
                            ) : (
                                tasks.map((task, index) => {
                                    const isUngraded = task.submission && (task.submission.grade === undefined || task.submission.grade === null);
                                    const isNotSubmitted = task.status === 'missing' || task.status === 'pending';
                                    const rowBgClass = isNotSubmitted ? 'bg-red-50 hover:bg-red-100' :
                                        isUngraded ? 'bg-yellow-50 hover:bg-yellow-100' :
                                            'hover:bg-slate-50/50';

                                    return (
                                        <motion.tr
                                            key={task.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.03 }}
                                            onClick={() => onTaskClick && onTaskClick(task)}
                                            className={`${rowBgClass} transition-colors cursor-pointer`}
                                        >
                                            <td className="px-6 py-4 text-sm text-slate-500 font-medium whitespace-nowrap">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="max-w-md">
                                                    <div className="font-medium text-slate-800 line-clamp-1 text-[13px]" title={task.title}>{task.title}</div>
                                                    <div className="text-xs text-slate-500 line-clamp-1">{task.description}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100">
                                                    <Calendar className="h-3 w-3" />
                                                    {task.deadline ? new Date(task.deadline.toDate ? task.deadline.toDate() : task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getStatusBadge(task.status)}
                                            </td>
                                            {!hideSubmissionTime && (
                                                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                                    {task.submission ? formatDate(task.submission.submittedAt) : '-'}
                                                </td>
                                            )}
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                {task.submission?.grade !== undefined && task.submission?.grade !== null ? (
                                                    <span className={`font-bold text-[13px] ${task.submission.grade >= 80 ? 'text-green-600' :
                                                        task.submission.grade >= 60 ? 'text-amber-600' : 'text-red-600'
                                                        }`}>
                                                        {task.submission.grade}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
