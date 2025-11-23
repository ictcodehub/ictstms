import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, Send, FileText, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react';

export default function Tasks() {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(null);
    const [submissionText, setSubmissionText] = useState('');
    const [expandedTask, setExpandedTask] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

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

            const tasksQuery = query(
                collection(db, 'tasks'),
                where('assignedClasses', 'array-contains', classId)
            );
            const tasksSnap = await getDocs(tasksQuery);
            let tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            tasksList.sort((a, b) => {
                const subA = subs[a.id];
                const subB = subs[b.id];
                if (!subA && subB) return -1;
                if (subA && !subB) return 1;
                if (!subA && !subB) {
                    return new Date(a.deadline) - new Date(b.deadline);
                }
                return subB.submittedAt?.toMillis() - subA.submittedAt?.toMillis();
            });

            setTasks(tasksList);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (taskId) => {
        if (!submissionText.trim()) {
            alert('Please fill in your answer');
            return;
        }

        setSubmitting(taskId);
        try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
            const userData = userDoc.docs[0].data();

            await addDoc(collection(db, 'submissions'), {
                taskId,
                studentId: currentUser.uid,
                studentName: userData.name,
                content: submissionText.trim(),
                submittedAt: serverTimestamp(),
                grade: null,
                teacherComment: ''
            });

            alert('Task submitted successfully!');
            setSubmissionText('');
            setSubmitting(null);
            setExpandedTask(null);
            loadData();
        } catch (error) {
            console.error('Error submitting task:', error);
            alert('Failed to submit task: ' + error.message);
            setSubmitting(null);
        }
    };

    const toggleExpand = (taskId) => {
        if (expandedTask === taskId) {
            setExpandedTask(null);
        } else {
            setExpandedTask(taskId);
            setSubmissionText('');
        }
    };

    const getTaskStatus = (task) => {
        const submission = submissions[task.id];
        const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;

        if (submission) {
            if (submission.grade !== null && submission.grade !== undefined) {
                return { label: 'Selesai', color: 'bg-emerald-50 text-emerald-700 border border-emerald-100', icon: CheckCircle, type: 'graded' };
            }
            return { label: 'Diserahkan', color: 'bg-amber-50 text-amber-700 border border-amber-100', icon: Send, type: 'submitted' };
        } else if (isOverdue) {
            return { label: 'Terlewat', color: 'bg-red-50 text-red-700 border border-red-100', icon: AlertCircle, type: 'overdue' };
        }
        return { label: 'Ditugaskan', color: 'bg-blue-50 text-blue-700 border border-blue-100', icon: Calendar, type: 'pending' };
    };

    const filteredTasks = tasks.filter(task => {
        const status = getTaskStatus(task);
        const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.description.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesFilter = true;
        if (filterStatus === 'pending') matchesFilter = status.type === 'pending' || status.type === 'overdue';
        if (filterStatus === 'submitted') matchesFilter = status.type === 'submitted';
        if (filterStatus === 'graded') matchesFilter = status.type === 'graded';

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                    Tugas Saya
                </h1>
                <p className="text-slate-500 mt-1">Manage and complete your tasks here.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                </div>
                <div className="relative min-w-[200px]">
                    <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none bg-white"
                    >
                        <option value="all">Semua Status</option>
                        <option value="pending">Ditugaskan</option>
                        <option value="submitted">Diserahkan</option>
                        <option value="graded">Selesai</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4 pointer-events-none" />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl shadow-lg border border-slate-100">
                    <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <BookOpen className="h-10 w-10 text-blue-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No tasks found</h3>
                    <p className="text-slate-500">Try changing your filter or search keywords.</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                    <div className="divide-y divide-slate-100">
                        {filteredTasks.map((task, index) => {
                            const status = getTaskStatus(task);
                            const submission = submissions[task.id];
                            const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;
                            const isExpanded = expandedTask === task.id;
                            const isSubmitting = submitting === task.id;

                            let rowClass = "bg-white hover:bg-slate-50";
                            let gradeDisplay = null;

                            if (submission) {
                                if (submission.grade !== null && submission.grade !== undefined) {
                                    // Graded: White background
                                    rowClass = "bg-white hover:bg-slate-50";
                                    gradeDisplay = (
                                        <div className="text-right">
                                            <span className="block text-xs font-bold text-emerald-600 uppercase tracking-wider">Grade</span>
                                            <span className="text-sm font-bold text-emerald-700">{submission.grade}</span>
                                        </div>
                                    );
                                } else {
                                    // Submitted but not graded: Stronger yellow
                                    rowClass = "bg-amber-100/70 hover:bg-amber-100";
                                    gradeDisplay = (
                                        <div className="text-right">
                                            <span className="block text-xs font-bold text-amber-700 uppercase tracking-wider">Grade</span>
                                            <span className="text-sm font-bold text-amber-700">-</span>
                                        </div>
                                    );
                                }
                            } else if (isOverdue) {
                                // Overdue: Stronger red
                                rowClass = "bg-red-100/80 hover:bg-red-100";
                            } else {
                                // Pending: Stronger red (lighter)
                                rowClass = "bg-red-100/60 hover:bg-red-100/80";
                            }

                            if (isExpanded) rowClass += " bg-opacity-100";

                            return (
                                <div key={task.id} className="group">
                                    <div
                                        onClick={() => toggleExpand(task.id)}
                                        className={`p-5 flex items-center justify-between cursor-pointer transition-all ${rowClass}`}
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <span className="text-slate-400 font-medium w-6 text-center">{index + 1}</span>

                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors bg-white/80 shadow-sm text-blue-600`}>
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="font-bold text-slate-800 truncate text-sm">
                                                        {task.title}
                                                    </h3>
                                                    {status.type === 'overdue' && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 uppercase tracking-wide">
                                                            Overdue
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <div className={`flex items-center gap-1.5 ${isOverdue && !submission ? 'text-red-500 font-medium' : ''}`}>
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {task.deadline ? new Date(task.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 pl-4">
                                            <div className="flex items-center gap-3">
                                                <span className={`hidden md:flex px-3 py-1 rounded-full text-xs font-bold items-center gap-1.5 ${status.color}`}>
                                                    <status.icon className="h-3.5 w-3.5" />
                                                    {status.label}
                                                </span>
                                            </div>

                                            {gradeDisplay}

                                            {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="bg-slate-50/50 border-t border-slate-100"
                                            >
                                                <div className="p-6 md:pl-[4.5rem]">
                                                    <div className="mb-6">
                                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Description</h4>
                                                        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{task.description}</p>
                                                    </div>

                                                    {submission ? (
                                                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                                                <p className="text-sm font-bold text-slate-700">Your Answer</p>
                                                            </div>
                                                            <p className="text-slate-600 text-sm whitespace-pre-wrap mb-4 pl-7">{submission.content}</p>

                                                            {submission.grade !== null && submission.grade !== undefined && (
                                                                <div className="mt-4 pt-4 border-t border-slate-100 pl-7">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <div className="bg-emerald-100 p-1 rounded">
                                                                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                                                                        </div>
                                                                        <span className="text-sm font-bold text-emerald-700">Grade: {submission.grade}</span>
                                                                    </div>
                                                                    {submission.teacherComment && (
                                                                        <p className="text-slate-600 text-sm italic">"{submission.teacherComment}"</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                                                            <h4 className="text-sm font-bold text-slate-700 mb-3">Submit Task</h4>
                                                            <textarea
                                                                value={submissionText}
                                                                onChange={(e) => setSubmissionText(e.target.value)}
                                                                placeholder="Write your answer here..."
                                                                className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[150px] text-sm mb-4"
                                                            />
                                                            <div className="flex justify-end">
                                                                <button
                                                                    onClick={() => handleSubmit(task.id)}
                                                                    disabled={isSubmitting || !submissionText.trim()}
                                                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                                >
                                                                    {isSubmitting ? (
                                                                        <>
                                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                                            Submitting...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Send className="h-4 w-4" />
                                                                            Submit Answer
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
