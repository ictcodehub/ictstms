import { useState, useEffect, useRef } from 'react';
import { db, storage } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, onSnapshot, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LinkifiedText } from '../../utils/linkify';
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, Send, FileText, ChevronDown, ChevronUp, Search, Filter, Hourglass, Pencil, X, Save, ChevronLeft, ChevronRight, Trophy, Upload, Download, Link2, ExternalLink, Image as ImageIcon, Video } from 'lucide-react';
import ToastContainer from '../../components/ToastContainer';
import { useToast } from '../../hooks/useToast';
import TasksMobile from './TasksMobile';
import Pagination from '../../components/Pagination';
import FileUpload from '../../components/FileUpload';
import StudentTaskModal from './StudentTaskModal';

export default function Tasks() {
    const { currentUser } = useAuth();
    const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(null);
    const [submissionText, setSubmissionText] = useState('');

    const [selectedTask, setSelectedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null); // Track which task is being edited
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
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

    // Mobile submission states
    const [comment, setComment] = useState('');
    const [file, setFile] = useState(null);

    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Sync selectedTask with real-time updates
    useEffect(() => {
        if (selectedTask) {
            const updatedTask = tasks.find(t => t.id === selectedTask.id);
            if (updatedTask) {
                // Update selectedTask with the fresh object from the new tasks array
                setSelectedTask(updatedTask);
            } else {
                // Task might have been deleted or unassigned
                // Optional: handleCloseTask();
            }
        }
    }, [tasks]);

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


                // DATA MODEL UPDATE: Support both single classId (legacy) and multiple classIds
                const myClassIds = [
                    ...(userData.classIds || []),
                    userData.classId
                ].filter(id => id); // Remove null/undefined/empty strings

                // Deduplicate
                const uniqueClassIds = [...new Set(myClassIds)];

                if (uniqueClassIds.length > 0) {
                    // We just need to set this to something truthy so the "Not assigned" UI doesn't show
                    setUserClass({ id: 'enrolled', count: uniqueClassIds.length });
                } else {
                    setUserClass(null);
                    setLoading(false);
                    return;
                }

                let currentTasks = [];
                let currentSubmissions = {};

                // Setup real-time listener for tasks
                // Note: array-contains-any has a limit (usually 10 or 30). 
                // For a student enrolled in >10 classes, this might need batching, but sufficient for now.
                const tasksQuery = query(
                    collection(db, 'tasks'),
                    where('assignedClasses', 'array-contains-any', uniqueClassIds)
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
        // Check both desktop (submissionText) and mobile (comment) inputs
        const content = submissionText.trim() || comment.trim();

        if (!content) {
            showWarning('Please fill in your answer');
            return;
        }

        setSubmitting(taskId);
        try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
            const userData = userDoc.docs[0].data();

            let attachments = [];
            if (file) {
                try {
                    const storageRef = ref(storage, `task_submissions/${taskId}/${currentUser.uid}/${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    const downloadURL = await getDownloadURL(snapshot.ref);

                    attachments.push({
                        name: file.name,
                        url: downloadURL,
                        type: file.type,
                        size: file.size,
                        uploadedAt: new Date().toISOString()
                    });
                } catch (uploadError) {
                    console.error("File upload failed:", uploadError);
                    showError("File upload failed, but proceeding with text submission.");
                    // Optional: return here if file is mandatory
                }
            }

            await addDoc(collection(db, 'submissions'), {
                taskId,
                studentId: currentUser.uid,
                studentName: userData.name,
                content: content,
                submittedAt: serverTimestamp(),
                grade: null,
                teacherComment: '',
                attachments: attachments
            });

            showSuccess('Task submitted successfully!');
            setSubmissionText('');
            setComment(''); // Clear mobile input too
            setFile(null);
            setSubmitting(null);
            setComment(''); // Clear mobile input too
            setFile(null);
            setSubmitting(null);
            if (selectedTask && selectedTask.id === taskId) {
                // Keep modal open or close? User usually expects to see result.
                // Let's keep it open in "View Mode" as the logic handles render.
            }
        } catch (error) {
            console.error('Error submitting task:', error);
            showError('Failed to submit task: ' + error.message);
            setSubmitting(null);
        }
    };

    const handleUpdate = async (taskId, submissionId, specificContent = null) => {
        const contentToSave = specificContent !== null ? specificContent : submissionText;

        if (!contentToSave.trim()) {
            showWarning('Please fill in your answer');
            return;
        }

        setSubmitting(taskId);
        try {
            const submissionRef = doc(db, 'submissions', submissionId);
            await updateDoc(submissionRef, {
                content: contentToSave.trim(),
                revisedAt: serverTimestamp(),
                revisionCount: increment(1),
                // We update submittedAt to current time to reflect the "latest" submission time for deadline checks
                submittedAt: serverTimestamp(),
                status: 'submitted' // Reset status so teacher sees it as a new submission
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

    const handleOpenTask = (task) => {
        setSelectedTask(task);
        // Pre-fill existing submission text if any
        const submission = submissions[task.id];
        if (submission && !submission.grade) {
            // If they are revisiting a submitted task (not graded), maybe they want to see/edit it.
            // But usually we just show view mode. Edit mode is triggered by button.
        }
        setSubmissionText('');
        setFile(null);
        setEditingTask(null);
    };

    const handleCloseTask = () => {
        setSelectedTask(null);
        setSubmissionText('');
        setFile(null);
        setEditingTask(null);
    };

    const getTaskStatus = (task) => {
        const submission = submissions[task.id];
        const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;

        if (submission) {
            if (submission.status === 'needs_revision') {
                return { label: 'Revision Needed', color: 'bg-pink-50 text-pink-700 border border-pink-100', icon: AlertCircle, type: 'revision' };
            }
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
        if (filterStatus === 'pending') matchesFilter = status.type === 'pending' || status.type === 'overdue' || status.type === 'revision';
        if (filterStatus === 'submitted') matchesFilter = status.type === 'submitted';
        if (filterStatus === 'graded') matchesFilter = status.type === 'graded';

        return matchesSearch && matchesFilter;
    });

    return (
        <>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                        My Tasks
                    </h1>
                    <p className="text-slate-500 mt-1">Manage and complete your tasks here.</p>
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
                    {/* Desktop Filter */}
                    <div className="hidden md:block relative min-w-[200px]">
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
                    {/* Mobile Filter - Custom Dropdown */}
                    <div className="md:hidden relative">
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="w-full pl-9 pr-9 py-3 text-sm rounded-lg border border-slate-200 bg-white font-medium text-left relative"
                        >
                            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                            <span className="text-slate-700">
                                {filterStatus === 'all' ? 'All Status' :
                                    filterStatus === 'pending' ? 'Assigned' :
                                        filterStatus === 'submitted' ? 'Submitted' : 'Completed'}
                            </span>
                            <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isFilterOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                                <button
                                    onClick={() => { setFilterStatus('all'); setIsFilterOpen(false); }}
                                    className={`w-full px-3 py-2.5 text-sm text-left hover:bg-blue-50 transition-colors ${filterStatus === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'}`}
                                >
                                    All Status
                                </button>
                                <button
                                    onClick={() => { setFilterStatus('pending'); setIsFilterOpen(false); }}
                                    className={`w-full px-3 py-2.5 text-sm text-left hover:bg-blue-50 transition-colors ${filterStatus === 'pending' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'}`}
                                >
                                    Assigned
                                </button>
                                <button
                                    onClick={() => { setFilterStatus('submitted'); setIsFilterOpen(false); }}
                                    className={`w-full px-3 py-2.5 text-sm text-left hover:bg-blue-50 transition-colors ${filterStatus === 'submitted' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'}`}
                                >
                                    Submitted
                                </button>
                                <button
                                    onClick={() => { setFilterStatus('graded'); setIsFilterOpen(false); }}
                                    className={`w-full px-3 py-2.5 text-sm text-left hover:bg-blue-50 transition-colors ${filterStatus === 'graded' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'}`}
                                >
                                    Completed
                                </button>
                            </div>
                        )}
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
                        {/* TABLE HEADER - Desktop Only */}
                        <div className="hidden md:flex items-center justify-between py-4 px-6 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-3 flex-1">
                                <span className="w-6 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">No</span>
                                <div className="w-10"></div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Task Details</span>
                            </div>
                            <div className="flex items-center gap-8 pl-4">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Status</span>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[120px] text-center">Info</span>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[60px] text-center">Grade</span>
                                <span className="w-5"></span> {/* Space for expand icon */}
                            </div>
                        </div>

                        {/* TABLE BODY - Desktop View */}
                        <div className="hidden md:block divide-y divide-slate-100" style={{ minHeight: '650px' }}>
                            {(() => {
                                const startIndex = (currentPage - 1) * itemsPerPage;
                                const endIndex = startIndex + itemsPerPage;
                                const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

                                return paginatedTasks.map((task, index) => {
                                    const status = getTaskStatus(task);
                                    const submission = submissions[task.id];
                                    const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;

                                    const isSubmitting = submitting === task.id;

                                    // Row background color based on status
                                    let statusColor = "bg-blue-50/70 hover:bg-blue-50"; // Default: Pending (Faint Blue)
                                    const isGraded = submission && submission.grade !== null && submission.grade !== undefined;

                                    if (isGraded) {
                                        // Graded -> White (Default)
                                        statusColor = "bg-white hover:bg-slate-50";
                                    } else if (submission) {
                                        if (submission.status === 'needs_revision') {
                                            // Badges will be pink, keep row neutral or very subtle
                                            statusColor = "bg-white hover:bg-slate-50";
                                        } else {
                                            // Submitted -> White (Default, considered done by user)
                                            statusColor = "bg-white hover:bg-slate-50";
                                        }
                                    } else {
                                        // Not Submitted
                                        statusColor = isOverdue ? "bg-red-50/70 hover:bg-red-50" : "bg-blue-50/70 hover:bg-blue-50";
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

                                    if (submission && submission.status === 'needs_revision') {
                                        // Revision needed - PRIORITY CHECK
                                        statusDisplay = (
                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-pink-50 border border-pink-100">
                                                <AlertCircle className="h-3.5 w-3.5 text-pink-600" />
                                                <span className="text-xs font-bold text-pink-700">Revision</span>
                                            </div>
                                        );
                                        infoDisplay = (
                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-pink-50 border border-pink-100">
                                                <Pencil className="h-3.5 w-3.5 text-pink-600" />
                                                <span className="text-xs font-bold text-pink-700">Action Req.</span>
                                            </div>
                                        );
                                    } else if (submission && submission.submittedAt && deadlineDate) {
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
                                                    <span className={`text-xs font-bold ${isEarly ? 'text-emerald-700' : 'text-red-700'}`}>
                                                        {isEarly ? 'Completed' : 'Done Late'}
                                                    </span>
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

                                    // Determine late submission
                                    const isLateSubmission = submission && submission.submittedAt && deadlineDate
                                        ? submission.submittedAt.toDate() > deadlineDate
                                        : false;

                                    return (
                                        <div key={task.id} className="group">
                                            <div
                                                onClick={() => handleOpenTask(task)}
                                                className={`flex items-center justify-between py-4 px-6 cursor-pointer transition-all ${statusColor}`}
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <span className="text-slate-400 font-medium w-6 text-center flex-shrink-0 text-xs">{index + 1}</span>

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
                                                            <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-sm font-bold text-slate-400">–</span>
                                                        ) : isGraded ? (
                                                            <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg border text-sm font-bold ${gradeValue >= 90 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                gradeValue >= 80 ? 'bg-teal-50 text-teal-600 border-teal-100' :
                                                                    gradeValue >= 70 ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                        gradeValue >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                            'bg-red-50 text-red-600 border-red-100'
                                                                }`}>
                                                                {gradeValue}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-sm font-bold text-amber-700">
                                                                {gradeValue}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-400" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div >
                        {/* Task Modal - Desktop */}
                        {selectedTask && (
                            <StudentTaskModal
                                task={selectedTask}
                                onClose={handleCloseTask}
                                submission={submissions[selectedTask.id]}
                                onSubmit={handleSubmit}
                                onUpdate={handleUpdate}
                                isSubmitting={submitting === selectedTask.id}
                                submissionText={submissionText}
                                setSubmissionText={setSubmissionText}
                                file={file}
                                setFile={setFile}
                                editingTask={editingTask}
                                startEditing={startEditing}
                                cancelEditing={cancelEditing}
                            />
                        )}

                        {/* MOBILE VIEW - Separate Component */}
                        <div className="md:hidden">
                            <TasksMobile
                                tasks={filteredTasks}
                                submissions={submissions}
                                currentPage={currentPage}
                                itemsPerPage={itemsPerPage}
                                expandedTask={selectedTask ? selectedTask.id : null}
                                submitting={submitting}
                                comment={comment}
                                setComment={setComment}
                                file={file}
                                setFile={setFile}
                                toggleExpand={(taskId) => {
                                    const task = tasks.find(t => t.id === taskId);
                                    if (task) handleOpenTask(task);
                                }}
                                handleSubmit={handleSubmit}
                                handleUpdate={handleUpdate}
                                setCurrentPage={setCurrentPage}
                            />
                        </div>

                        {/* Pagination Footer */}
                        {
                            (() => {
                                const totalItems = filteredTasks.length;
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
                            })()
                        }
                    </div >
                )
                }
            </div >
        </>
    );
}

