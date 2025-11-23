import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, CheckCircle2, Clock, XCircle, BookOpen, Award, TrendingUp, FileText } from 'lucide-react';

export default function StudentDetail({ student, onBack }) {
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
            // Try both uid and id for backward compatibility
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
                if (isSubmitted) status = isLate ? 'late' : 'submitted';
                else if (!isOverdue) status = 'pending';

                return {
                    ...task,
                    submission,
                    status,
                    isLate
                };
            });

            // Sort by deadline (newest first)
            mergedTasks.sort((a, b) => new Date(b.deadline) - new Date(a.deadline));

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
            return d.toLocaleDateString('id-ID', {
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
            case 'submitted':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Tepat Waktu
                    </span>
                );
            case 'late':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                        <Clock className="h-3 w-3" />
                        Terlambat
                    </span>
                );
            case 'missing':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        <XCircle className="h-3 w-3" />
                        Belum Submit
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <Clock className="h-3 w-3" />
                        Belum Tenggat
                    </span>
                );
        }
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
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Judul Tugas</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tenggat</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Waktu Submit</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Nilai</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : tasks.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        Belum ada tugas untuk siswa ini.
                                    </td>
                                </tr>
                            ) : (
                                tasks.map((task, index) => (
                                    <motion.tr
                                        key={task.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="hover:bg-slate-50/50 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800">{task.title}</div>
                                            <div className="text-xs text-slate-500 line-clamp-1">{task.description}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {formatDate(task.deadline)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(task.status)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {task.submission ? formatDate(task.submission.submittedAt) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {task.submission?.grade !== undefined && task.submission?.grade !== null ? (
                                                <span className={`font-bold ${task.submission.grade >= 80 ? 'text-green-600' :
                                                    task.submission.grade >= 60 ? 'text-amber-600' : 'text-red-600'
                                                    }`}>
                                                    {task.submission.grade}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
