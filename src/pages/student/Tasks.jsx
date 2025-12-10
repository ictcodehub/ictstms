import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LinkifiedText } from '../../utils/linkify';
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, Send, FileText, ChevronDown, ChevronUp, Search, Filter, Hourglass, Pencil, X, Save } from 'lucide-react';
import ToastContainer from '../../components/ToastContainer';
import { useToast } from '../../hooks/useToast';

export default function Tasks() {
    const { currentUser } = useAuth();
    const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(null);
    const [submissionText, setSubmissionText] = useState('');
    const [expandedTask, setExpandedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null); // Track which task is being edited
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [userClass, setUserClass] = useState(null);

    useEffect(() => {
        let unsubscribeSubmissions = null;
        let unsubscribeTasks = null;

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
                    updateTasksList(currentTasks, currentSubmissions);
                });

                // Setup real-time listener for submissions
                const submissionsQuery = query(
                    collection(db, 'submissions'),
                    where('studentId', '==', currentUser.uid)
                );

                unsubscribeSubmissions = onSnapshot(submissionsQuery, (submissionsSnap) => {
                    const subs = {};
                    submissionsSnap.forEach(doc => {
                        subs[doc.data().taskId] = { id: doc.id, ...doc.data() };
                    });
                    currentSubmissions = subs;
                    setSubmissions(subs);
                    updateTasksList(currentTasks, currentSubmissions);
                });

            } catch (error) {
                console.error('Error setting up listener:', error);
                setLoading(false);
            }
        };

        const updateTasksList = (tasksList, subs) => {
            // Sort tasks
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
            setLoading(false);
        };


        loadData();

        return () => {
            if (unsubscribeSubmissions) {
                unsubscribeSubmissions();
            }
            if (unsubscribeTasks) {
                unsubscribeTasks();
            }
        };
    }, [currentUser]);



    const handleSubmit = async (taskId) => {
        if (!submissionText.trim()) {
            showWarning('Please fill in your answer');
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

            showSuccess('Task submitted successfully!');
            setSubmissionText('');
            setSubmitting(null);
            setExpandedTask(null);
        } catch (error) {
            console.error('Error submitting task:', error);
            showError('Failed to submit task: ' + error.message);
            setSubmitting(null);
        }
    };

    const handleUpdate = async (taskId, submissionId) => {
        if (!submissionText.trim()) {
            showWarning('Please fill in your answer');
            return;
        }

        setSubmitting(taskId);
        try {
            const submissionRef = doc(db, 'submissions', submissionId);
            await updateDoc(submissionRef, {
                content: submissionText.trim(),
                revisedAt: serverTimestamp(),
                // We update submittedAt to current time to reflect the "latest" submission time for deadline checks
                submittedAt: serverTimestamp()
            });

            showSuccess('Submission updated successfully!');
            setSubmissionText('');
            setSubmitting(null);
            setEditingTask(null);
        } catch (error) {
            console.error('Error updating submission:', error);
            showError('Failed to update submission: ' + error.message);
            setSubmitting(null);
        }
    };

    const startEditing = (task, submission) => {
        setEditingTask(task.id);
        setSubmissionText(submission.content);
    };

    const cancelEditing = () => {
        setEditingTask(null);
        setSubmissionText('');
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
                return { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border border-emerald-100', icon: CheckCircle, type: 'graded' };
            }
            return { label: 'Submitted', color: 'bg-amber-50 text-amber-700 border border-amber-100', icon: Send, type: 'submitted' };
        } else if (isOverdue) {
            return { label: 'Overdue', color: 'bg-red-50 text-red-700 border border-red-100', icon: AlertCircle, type: 'overdue' };
        }
        return { label: 'Assigned', color: 'bg-blue-50 text-blue-700 border border-blue-100', icon: Calendar, type: 'pending' };
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
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                    My Tasks
                </h1>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-slate-500">Manage and complete your tasks here.</p>
                    {userClass && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                            {userClass.name}
                        </span>
                    )}
                </div>
            </div>

            {!loading && !userClass && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                    <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                    <div>
                        <h3 className="text-lg font-bold text-amber-800">You are not assigned to any class</h3>
                        <p className="text-amber-700 mt-1">Please contact your teacher to be added to a class so you can see your tasks.</p>
                    </div>
                </div>
            )}

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
                        <option value="all">All Status</option>
                        <option value="pending">Assigned</option>
                        <option value="submitted">Submitted</option>
                        <option value="graded">Completed</option>
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
                    {/* TABLE HEADER */}
                    <div className="flex items-center justify-between py-4 px-6 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-3 flex-1">
                            <span className="w-6 text-center text-[13px] font-bold text-slate-500 uppercase tracking-wider">No</span>
                            <div className="w-10"></div>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Task Details</span>
                        </div>
                        <div className="flex items-center gap-8 pl-4">
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Status</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[120px] text-center">Info</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[60px] text-center">Grade</span>
                            <span className="w-5"></span> {/* Space for expand icon */}
                        </div>
                    </div>

                    {/* TABLE BODY */}
                    <div className="divide-y divide-slate-100">
                        {filteredTasks.map((task, index) => {
                            const status = getTaskStatus(task);
                            const submission = submissions[task.id];
                            const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;
                            const isExpanded = expandedTask === task.id;
                            const isSubmitting = submitting === task.id;

                            // Row background color based on status
                            let statusColor = "bg-white hover:bg-slate-50";
                            const isGraded = submission && submission.grade !== null && submission.grade !== undefined;

                            if (isGraded) {
                                statusColor = "bg-white hover:bg-slate-50";
                            } else if (submission) {
                                statusColor = "bg-amber-50 hover:bg-amber-100/50";
                            } else {
                                statusColor = isOverdue ? "bg-red-100/50 hover:bg-red-100" : "bg-red-50 hover:bg-red-100/50";
                            }

                            // Grade display
                            let gradeValue = "-";
                            let gradeColor = "text-slate-400";

                            if (isGraded) {
                                gradeValue = submission.grade;
                                gradeColor = "text-emerald-600";
                            } else if (submission) {
                                gradeColor = "text-amber-600";
                            }

                            // Status info box (similar to Overview)
                            let statusDisplay = null;
                            let infoDisplay = null;
                            const deadlineDate = task.deadline ? new Date(task.deadline) : null;

                            if (submission && submission.submittedAt && deadlineDate) {
                                const submittedDate = submission.submittedAt.toDate();
                                const diffMs = deadlineDate - submittedDate;
                                const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
                                const isEarly = diffMs > 0;

                                let timingText = '';
                                if (isEarly) {
                                    if (diffDays > 0) timingText = `${diffDays} day${diffDays > 1 ? 's' : ''} early`;
                                    else timingText = `On Time`;
                                } else {
                                    if (diffDays > 0) timingText = `${diffDays} day${diffDays > 1 ? 's' : ''} late`;
                                    else timingText = `Late`;
                                }

                                if (!isGraded) {
                                    // Submitted but not graded
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
                                    // Graded
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
                                // Submitted without deadline
                                if (!isGraded) {
                                    statusDisplay = (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
                                            <Send className="h-3.5 w-3.5 text-amber-600" />
                                            <span className="text-xs font-bold text-amber-700">Submitted</span>
                                        </div>
                                    );
                                    infoDisplay = (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
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
                                // Not submitted (Pending/Overdue)
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
                                <div key={task.id} className="group">
                                    <div
                                        onClick={() => toggleExpand(task.id)}
                                        className={`flex items-center justify-between py-4 px-6 cursor-pointer transition-all ${statusColor}`}
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="text-slate-400 font-medium w-6 text-center flex-shrink-0 text-sm">{index + 1}</span>

                                            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-sm">
                                                <BookOpen className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors line-clamp-2 text-[13px]" title={task.title}>{task.title}</h4>
                                                <p className="text-sm text-slate-500 line-clamp-1">{task.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8 pl-4 flex-shrink-0">
                                            <div className="text-center min-w-[100px]">
                                                {statusDisplay}
                                            </div>
                                            <div className="text-center min-w-[120px]">
                                                {infoDisplay}
                                            </div>
                                            <div className="text-center min-w-[60px]">
                                                {gradeValue === "-" ? (
                                                    <span className="text-slate-400 text-sm font-bold">{gradeValue}</span>
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
                                                        editingTask === task.id ? (
                                                            // EDIT MODE
                                                            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                                                                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                                                    <Pencil className="h-4 w-4 text-blue-500" />
                                                                    Edit Answer
                                                                </h4>
                                                                <textarea
                                                                    value={submissionText}
                                                                    onChange={(e) => setSubmissionText(e.target.value)}
                                                                    placeholder="Update your answer..."
                                                                    className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[150px] text-sm mb-4"
                                                                />
                                                                <div className="flex justify-end gap-3">
                                                                    <button
                                                                        onClick={cancelEditing}
                                                                        disabled={isSubmitting}
                                                                        className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center gap-2"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleUpdate(task.id, submission.id)}
                                                                        disabled={isSubmitting || !submissionText.trim()}
                                                                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                                    >
                                                                        {isSubmitting ? (
                                                                            <>
                                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                                                Saving...
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Save className="h-4 w-4" />
                                                                                Save Revision
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            // VIEW MODE
                                                            <>
                                                                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                                                        <p className="text-sm font-bold text-slate-700">Your Answer</p>
                                                                    </div>
                                                                    <p className="text-slate-600 text-sm whitespace-pre-wrap mb-4 pl-7">
                                                                        <LinkifiedText text={submission.content} />
                                                                    </p>

                                                                    {submission.revisedAt && (
                                                                        <div className="pl-7 mb-2">
                                                                            <p className="text-xs text-slate-400 italic flex items-center gap-1">
                                                                                <Clock className="h-3 w-3" />
                                                                                Last revised: {submission.revisedAt.toDate().toLocaleDateString('en-US', {
                                                                                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                                                })}
                                                                            </p>
                                                                        </div>
                                                                    )}

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

                                                                {!submission.grade && (
                                                                    <div className="flex justify-end mt-4">
                                                                        <button
                                                                            onClick={() => startEditing(task, submission)}
                                                                            className="px-6 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors flex items-center gap-2"
                                                                        >
                                                                            <Pencil className="h-4 w-4" />
                                                                            Edit Answer
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )
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
