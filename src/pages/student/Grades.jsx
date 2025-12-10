import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Award, BookOpen, TrendingUp, Star, ChevronLeft, ChevronRight, Calendar, MessageCircle } from 'lucide-react';
import Pagination from '../../components/Pagination';

export default function Grades() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [grades, setGrades] = useState([]);
    const [average, setAverage] = useState(0);
    const [tasks, setTasks] = useState({});
    const [exams, setExams] = useState({});
    const [submissions, setSubmissions] = useState([]);
    const [examResults, setExamResults] = useState([]);
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

    // 1. Fetch Tasks & Exams (Metadata)
    useEffect(() => {
        const unsubscribeTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
            const tasksMap = {};
            snapshot.forEach(doc => tasksMap[doc.id] = doc.data());
            setTasks(tasksMap);
        });

        const unsubscribeExams = onSnapshot(collection(db, 'exams'), (snapshot) => {
            const examsMap = {};
            snapshot.forEach(doc => examsMap[doc.id] = doc.data());
            setExams(examsMap);
        });

        return () => {
            unsubscribeTasks();
            unsubscribeExams();
        };
    }, []);

    // 2. Fetch Student Submissions & Exam Results
    useEffect(() => {
        if (!currentUser) return;

        setLoading(true);

        const qSubmissions = query(collection(db, 'submissions'), where('studentId', '==', currentUser.uid));
        const unsubscribeSubmissions = onSnapshot(qSubmissions, (snapshot) => {
            setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qExamResults = query(collection(db, 'exam_results'), where('studentId', '==', currentUser.uid));
        const unsubscribeExamResults = onSnapshot(qExamResults, (snapshot) => {
            setExamResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeSubmissions();
            unsubscribeExamResults();
        };
    }, [currentUser]);

    // 3. Merge & Process Data
    useEffect(() => {
        if (!currentUser) return;

        const processedGrades = [];

        // Process Task Submissions
        submissions.forEach(sub => {
            if (sub.grade !== null && sub.grade !== undefined) {
                const task = tasks[sub.taskId];
                if (task) {
                    processedGrades.push({
                        id: sub.id,
                        type: 'task',
                        sourceId: sub.taskId, // For grouping
                        taskTitle: task.title,
                        submittedAt: sub.submittedAt,
                        grade: sub.grade,
                        feedback: sub.feedback || sub.teacherComment
                    });
                }
            }
        });

        // Process Exam Results
        examResults.forEach(res => {
            // Exam results usually have a 'score' field, let's normalize to 'grade'
            // Check your ExamTaker.jsx or database to be sure. Usually it is 'score' or 'grade'. 
            // Based on previous context, it seems to be 'score' in exam_results.
            const exam = exams[res.examId];
            const grade = res.score !== undefined ? res.score : res.grade;

            if (exam && grade !== undefined) {
                processedGrades.push({
                    id: res.id,
                    type: 'exam',
                    sourceId: res.examId, // For grouping
                    taskTitle: exam.title, // Standardized key
                    submittedAt: res.completedAt || res.submittedAt, // Exam results usually have completedAt
                    grade: parseFloat(grade),
                    feedback: null // Exams might not have manual feedback yet
                });
            }
        });

        // Deduplicate: Keep highest grade per Source ID
        const uniqueGradesMap = new Map();

        processedGrades.forEach(item => {
            // Use sourceId (taskId/examId) or fallback to item.id if missing
            // For tasks we also need to add sourceId in the loop above or infer it
            // Let's ensure tasks have sourceId too.
            const uniqueKey = item.sourceId || item.id;

            if (!uniqueGradesMap.has(uniqueKey)) {
                uniqueGradesMap.set(uniqueKey, item);
            } else {
                const existing = uniqueGradesMap.get(uniqueKey);
                if (item.grade > existing.grade) {
                    uniqueGradesMap.set(uniqueKey, item);
                }
            }
        });

        const finalGrades = Array.from(uniqueGradesMap.values());

        // Sort by date desc
        finalGrades.sort((a, b) => {
            const dateA = a.submittedAt?.seconds || 0;
            const dateB = b.submittedAt?.seconds || 0;
            return dateB - dateA;
        });

        setGrades(finalGrades);

        // Calculate Stats
        const validGrades = finalGrades.filter(g => typeof g.grade === 'number');
        if (validGrades.length > 0) {
            const total = validGrades.reduce((sum, g) => sum + g.grade, 0);
            setAverage((total / validGrades.length).toFixed(2));
        } else {
            setAverage(0);
        }

        // Only unset loading if we have initialized listeners. 
        // We can use a simple timeout or check if data is populated to avoid flash, 
        // but essentially if we are here, we have processed the initial snapshots.
        setLoading(false);

    }, [tasks, exams, submissions, examResults, currentUser]);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                    My Grades
                </h1>
                <p className="text-slate-500 mt-1">Track your learning results and keep improving your performance.</p>
            </div>


            {
                loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-blue-500 to-cyan-500 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group"
                            >
                                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500"></div>
                                <div className="relative z-10 flex items-center justify-between">
                                    <div>
                                        <p className="text-white/80 text-sm font-medium mb-1">Average Grade</p>
                                        <p className="text-3xl font-bold">{average}</p>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        <TrendingUp className="h-8 w-8 text-white" />
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-gradient-to-br from-emerald-500 to-teal-500 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group"
                            >
                                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500"></div>
                                <div className="relative z-10 flex items-center justify-between">
                                    <div>
                                        <p className="text-white/80 text-sm font-medium mb-1">Graded Tasks</p>
                                        <p className="text-3xl font-bold">{grades.length}</p>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        <Award className="h-8 w-8 text-white" />
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-gradient-to-br from-amber-500 to-orange-500 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group"
                            >
                                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500"></div>
                                <div className="relative z-10 flex items-center justify-between">
                                    <div>
                                        <p className="text-white/80 text-sm font-medium mb-1">Highest Grade</p>
                                        <p className="text-3xl font-bold">{grades.length > 0 ? Math.max(...grades.map(g => g.grade)) : 0}</p>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        <Star className="h-8 w-8 text-white" />
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Mobile Cards View - Shown only on mobile */}
                        {!loading && grades.length > 0 && (
                            <div className="md:hidden bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden mb-6">
                                <div className="p-5 border-b border-slate-100">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <BookOpen className="h-5 w-5 text-blue-500" />
                                        Grade History
                                    </h3>
                                </div>

                                <div className="p-5 space-y-4">
                                    {(() => {
                                        const startIndex = (currentPage - 1) * itemsPerPage;
                                        const endIndex = startIndex + itemsPerPage;
                                        const paginatedGrades = grades.slice(startIndex, endIndex);

                                        return paginatedGrades.map((grade, index) => (
                                            <motion.div
                                                key={`mobile-grade-${index}`}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100"
                                            >
                                                {/* Header: Title + Date */}
                                                <div className="mb-3">
                                                    <h4 className="text-sm font-bold text-slate-800 line-clamp-2 mb-1.5" title={grade.taskTitle}>
                                                        {grade.taskTitle}
                                                    </h4>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {grade.submittedAt?.toDate().toLocaleDateString('en-US', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Grade Display - Full Width */}
                                                <div className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 mb-3 border ${grade.grade >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    grade.grade >= 80 ? 'bg-teal-50 text-teal-700 border-teal-100' :
                                                        grade.grade >= 70 ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            grade.grade >= 60 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                                'bg-red-50 text-red-700 border-red-100'
                                                    }`}>
                                                    <Award className="h-4 w-4" />
                                                    <span className="text-sm font-bold">Grade: {grade.grade}</span>
                                                </div>

                                                {/* Feedback Section */}
                                                {grade.feedback && (
                                                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                                                        <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                            <MessageCircle className="h-3 w-3" />
                                                            Feedback
                                                        </div>
                                                        <p className="text-xs text-slate-600 italic leading-relaxed">
                                                            "{grade.feedback}"
                                                        </p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        ));
                                    })()}
                                </div>

                                {/* Mobile Pagination */}
                                <div className="px-5 pb-5 pt-0 flex justify-center border-t border-slate-100 bg-slate-50/30">
                                    <div className="mt-4 w-full">
                                        {(() => {
                                            const totalItems = grades.length;
                                            const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

                                            // if (totalPages <= 1) return null;

                                            return (
                                                <Pagination
                                                    currentPage={currentPage}
                                                    totalPages={totalPages}
                                                    onPageChange={setCurrentPage}
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Desktop Table View - Hidden on mobile */}
                        <div className={`${grades.length === 0 ? 'block' : 'hidden md:block'} bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden`}>
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-blue-500" />
                                    Grade History
                                </h3>
                            </div>

                            {grades.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">
                                    <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Award className="h-10 w-10 text-blue-300" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">No grades yet</h3>
                                    <p className="text-slate-500">Complete your tasks and wait for the teacher to grade them.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50/50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider w-16">
                                                    No
                                                </th>
                                                <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider">
                                                    Task
                                                </th>
                                                <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider">
                                                    Submitted At
                                                </th>
                                                <th className="px-6 py-4 text-center text-sm font-bold text-slate-500 uppercase tracking-wider">
                                                    Grade
                                                </th>
                                                <th className="px-6 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider">
                                                    Feedback
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100" style={{ minHeight: '650px' }}>
                                            {(() => {
                                                const startIndex = (currentPage - 1) * itemsPerPage;
                                                const endIndex = startIndex + itemsPerPage;
                                                const paginatedGrades = grades.slice(startIndex, endIndex);

                                                return paginatedGrades.map((grade, index) => (
                                                    <motion.tr
                                                        key={`desktop-grade-${index}`}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ delay: index * 0.03 }}
                                                        className="hover:bg-blue-50/30 transition-colors"
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500">
                                                            {startIndex + index + 1}
                                                        </td>
                                                        <td className="px-6 py-4 max-w-[300px]">
                                                            <div className="text-sm font-bold text-slate-800 line-clamp-2" title={grade.taskTitle}>
                                                                {grade.taskTitle}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                            {grade.submittedAt?.toDate().toLocaleDateString('en-US', {
                                                                weekday: 'short',
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                            <span className={`px-4 py-1.5 inline-flex text-[13px] leading-5 font-bold rounded-xl ${grade.grade >= 90 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                                grade.grade >= 80 ? 'bg-teal-50 text-teal-600 border border-teal-100' :
                                                                    grade.grade >= 70 ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                                        grade.grade >= 60 ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                                            'bg-red-50 text-red-600 border border-red-100'
                                                                }`}>
                                                                {grade.grade}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 max-w-[300px]">
                                                            {grade.feedback ? (
                                                                <div className="text-sm text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-100 line-clamp-2" title={grade.feedback}>
                                                                    "{grade.feedback}"
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm text-slate-400">-</span>
                                                            )}
                                                        </td>
                                                    </motion.tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>

                                    {/* Pagination Footer */}
                                    {(() => {
                                        const totalItems = grades.length;
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
                            )}
                        </div>
                    </>
                )}
        </div>
    );
}

