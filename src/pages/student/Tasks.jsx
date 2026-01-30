import { useState, useEffect, useRef } from 'react';
import { db, storage } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, onSnapshot, increment, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LinkifiedText } from '../../utils/linkify';
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, Send, FileText, ChevronDown, ChevronUp, Search, Filter, Hourglass, Pencil, X, Save, ChevronLeft, ChevronRight, Trophy, Upload, Download, Link2, ExternalLink, Image as ImageIcon, Video, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
    const [rawTasks, setRawTasks] = useState([]); // Store raw data for client-side sorting
    const [sortBy, setSortBy] = useState('deadline'); // 'deadline' | 'newest'
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
                    const fetchedTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setRawTasks(fetchedTasks);
                    setLoading(false);
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
                    setSubmissions(subs);
                });

            } catch (error) {
                console.error('Error setting up listener:', error);
                setLoading(false);
            }
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

    const [sortConfig, setSortConfig] = useState({ key: 'deadline', direction: 'asc' });

    // Use current tasks & submissions to build processed data
    useEffect(() => {
        if (!rawTasks.length) {
            setTasks([]);
            return;
        }

        const sorted = [...rawTasks].sort((a, b) => {
            const subA = submissions[a.id];
            const subB = submissions[b.id];

            // Primary: Status Grouping (Optional, but often desirable)
            // If the user explicitly sorting by Grade or Info, maybe we ignore Pending?
            // "Professional table sort" usually sorts strictly by the column clicked.
            // BUT for tasks, we almost always want Pending on top unless sorting by something else.
            // Let's implement Strict Column Sort when key != 'deadline' maybe?
            // Or just Strict Column Sort always?
            // User asked for "Quick Sort table header". Usually this implies strict column sort.
            // Let's do Strict Column Sort for consistency.

            let valA, valB;

            switch (sortConfig.key) {
                case 'title':
                    valA = a.title.toLowerCase();
                    valB = b.title.toLowerCase();
                    break;
                case 'status':
                    // Custom order: Overdue > Pending > Revision > Submitted > Graded
                    // We can map status to checks.
                    const getStatusWeight = (task, sub) => {
                        if (!sub) {
                            return task.deadline && new Date(task.deadline) < new Date() ? 0 : 1; // Overdue=0, Pending=1
                        }
                        if (sub.status === 'needs_revision') return 2;
                        if (sub.grade === null || sub.grade === undefined) return 3; // Submitted
                        return 4; // Graded
                    };
                    valA = getStatusWeight(a, subA);
                    valB = getStatusWeight(b, subB);
                    break;
                case 'deadline': // "Info" Column
                    valA = a.deadline ? new Date(a.deadline).getTime() : 9999999999999;
                    valB = b.deadline ? new Date(b.deadline).getTime() : 9999999999999;
                    break;
                case 'createdAt':
                    valA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    valB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    break;
                case 'grade':
                    valA = subA?.grade || -1;
                    valB = subB?.grade || -1;
                    break;
                default:
                    valA = 0;
                    valB = 0;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        setTasks(sorted);
    }, [rawTasks, submissions, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };



    const handleSubmit = async (taskId, specificContent, specificFile, answers) => {
        // Find current task to check type
        const currentTask = tasks.find(t => t.id === taskId);
        const isMaterialOnly = currentTask?.isMaterialOnly;

        // Check both desktop (submissionText) and mobile (comment) inputs, or specific arguments
        let content = specificContent || submissionText.trim() || comment.trim();
        const submissionFile = specificFile || file;

        if (isMaterialOnly) {
            content = "Marked as done successfully";
        } else if (!content) {
            showWarning('Please fill in your answer');
            return;
        }

        // Size check (5MB)
        if (!isMaterialOnly && submissionFile && submissionFile.size > 5 * 1024 * 1024) {
            showWarning("File limit is 5MB");
            return;
        }

        setSubmitting(taskId);

        try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
            const userData = userDoc.docs[0].data();

            let attachments = [];
            if (submissionFile) {
                try {

                    const storageRef = ref(storage, `task_submissions/${taskId}/${currentUser.uid}/${Date.now()}_${submissionFile.name}`);

                    // Promise wrapper for Resumable Upload
                    const uploadPromise = new Promise((resolve, reject) => {
                        const uploadTask = uploadBytesResumable(storageRef, submissionFile);

                        uploadTask.on('state_changed',
                            (snapshot) => {
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

                            },
                            (error) => {
                                reject(error);
                            },
                            async () => {
                                try {
                                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                                    resolve({
                                        name: submissionFile.name,
                                        url: downloadURL,
                                        type: submissionFile.type,
                                        size: submissionFile.size,
                                        uploadedAt: new Date().toISOString()
                                    });
                                } catch (err) {
                                    reject(err);
                                }
                            }
                        );
                    });

                    const attachment = await uploadPromise;
                    attachments.push(attachment);

                } catch (uploadError) {
                    console.error("Storage upload failed:", uploadError);
                    showError(`Upload failed: ${uploadError.message}.`);
                    setSubmitting(null);
                    return;
                }
            }

            let autoGrade = null;
            // Simple Auto-Grading Logic
            if (currentTask.questions && currentTask.questions.length > 0) {
                let totalPoints = 0;
                let earnedPoints = 0;
                let allObjective = true;

                currentTask.questions.forEach(q => {
                    totalPoints += (parseInt(q.points) || 0);
                    if (q.type === 'single_choice' || q.type === 'true_false') {
                        const correctOpt = q.options.find(o => o.isCorrect)?.id;
                        if (correctOpt && answers[q.id] === correctOpt) {
                            earnedPoints += (parseInt(q.points) || 0);
                        }
                    } else if (q.type === 'multiple_choice') {
                        // strictly match all correct options? or partial? Let's do strict for now.
                        const correctOpts = q.options.filter(o => o.isCorrect).map(o => o.id).sort().join(',');
                        const studentOpts = (answers[q.id] || []).sort().join(',');
                        if (correctOpts === studentOpts) {
                            earnedPoints += (parseInt(q.points) || 0);
                        }
                    } else {
                        // Essay/Short Answer cannot be auto-graded easily without AI or text match
                        allObjective = false;
                    }
                });

                if (allObjective && totalPoints > 0) {
                    // Calculate grade 0-100
                    autoGrade = Math.round((earnedPoints / totalPoints) * 100);
                }
            }

            await addDoc(collection(db, 'submissions'), {
                taskId,
                studentId: currentUser.uid,
                studentName: userData.name,
                content: content,
                submittedAt: serverTimestamp(),
                grade: autoGrade, // Set auto-grade if applicable
                teacherComment: '',
                attachments: attachments,
                answers: answers || {}
            });


            showSuccess('Task submitted successfully!');
            setSubmissionText('');
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

    const handleUpdate = async (taskId, submissionId, specificContent = null, newFile = null, keptAttachments = null, answers = null) => {
        const currentTask = tasks.find(t => t.id === taskId);
        const contentToSave = specificContent !== null ? specificContent : submissionText;

        if (!contentToSave.trim()) {
            showWarning('Please fill in your answer');
            return;
        }

        // Size check (5MB) if new file exists
        if (newFile && newFile.size > 5 * 1024 * 1024) {
            showWarning("File limit is 5MB");
            return;
        }

        setSubmitting(taskId);
        try {
            // Capture current submission data before update for history
            const currentSubmission = submissions[taskId];
            const historyEntry = currentSubmission ? {
                content: currentSubmission.content,
                submittedAt: currentSubmission.submittedAt,
                grade: currentSubmission.grade,
                feedback: currentSubmission.teacherComment,

                archivedAt: new Date(),
                answers: currentSubmission.answers || {}
            } : null;

            const submissionRef = doc(db, 'submissions', submissionId);

            let autoGrade = null;
            // Simple Auto-Grading Logic
            if (currentTask.questions && currentTask.questions.length > 0) {
                let totalPoints = 0;
                let earnedPoints = 0;
                let allObjective = true;

                currentTask.questions.forEach(q => {
                    totalPoints += (parseInt(q.points) || 0);
                    if (q.type === 'single_choice' || q.type === 'true_false') {
                        const correctOpt = q.options.find(o => o.isCorrect)?.id;
                        if (correctOpt && answers[q.id] === correctOpt) {
                            earnedPoints += (parseInt(q.points) || 0);
                        }
                    } else if (q.type === 'multiple_choice') {
                        const correctOpts = q.options.filter(o => o.isCorrect).map(o => o.id).sort().join(',');
                        const studentOpts = (answers[q.id] || []).sort().join(',');
                        if (correctOpts === studentOpts) {
                            earnedPoints += (parseInt(q.points) || 0);
                        }
                    } else {
                        allObjective = false;
                    }
                });

                if (allObjective && totalPoints > 0) {
                    autoGrade = Math.round((earnedPoints / totalPoints) * 100);
                }
            }

            const updateData = {
                content: contentToSave.trim(),
                revisedAt: serverTimestamp(),
                revisionCount: increment(1),
                submittedAt: serverTimestamp(),
                status: 'submitted',
                answers: answers || {},
                grade: autoGrade !== null ? autoGrade : (updateData?.grade || null) // Keep existing grade if not auto-graded? No, reset if not auto-grade? 
                // Actually if we edit, we should probably reset manual grade. 
                // But if auto-grade is null (essay), we might want to set grade to null?
                // Safe bet: If autoGrade is calculated, use it. If not, set to null (needs regrading).
            };

            if (autoGrade === null && currentTask.questions?.length > 0) {
                updateData.grade = null; // Reset grade if it requires manual review now
            }

            // Initialize attachments list with kept ones or empty
            let finalAttachments = keptAttachments || [];

            // Handle New File Upload if present
            if (newFile) {
                try {
                    const storageRef = ref(storage, `task_submissions/${taskId}/${currentUser.uid}/${Date.now()}_${newFile.name}`);

                    // Reuse upload logic (simplified for await)
                    const uploadSnapshot = await uploadBytesResumable(storageRef, newFile);
                    const downloadURL = await getDownloadURL(uploadSnapshot.ref);

                    const newAttachment = {
                        name: newFile.name,
                        url: downloadURL,
                        type: newFile.type,
                        size: newFile.size,
                        uploadedAt: new Date().toISOString()
                    };

                    finalAttachments.push(newAttachment);

                } catch (uploadError) {
                    console.error("Storage upload failed during update:", uploadError);
                    showError(`File upload failed: ${uploadError.message}`);
                    // Don't return, try to save text at least? Or fail? 
                    // Fail is safer to avoid partial state where user thinks file is sent
                    setSubmitting(null);
                    return;
                }
            }

            // Assign the final list of attachments to the update object
            updateData.attachments = finalAttachments;

            if (historyEntry) {
                updateData.revisionHistory = arrayUnion(historyEntry);
            }

            await updateDoc(submissionRef, updateData);

            showSuccess('Submission updated successfully!');
            setSubmissionText('');
            setSubmitting(null);
            setEditingTask(null);
            setFile(null); // Clear file state
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
            if (task.isMaterialOnly) {
                return { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border border-emerald-100', icon: CheckCircle, type: 'graded' };
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

    // Helper to strip HTML and decode entities
    const stripHtml = (html) => {
        if (!html) return '';
        const withSpaces = html.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, ' ');
        const doc = new DOMParser().parseFromString(withSpaces, 'text/html');
        return doc.body.textContent || "";
    };

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
                    <div className="hidden md:flex items-center gap-3">
                        <div className="relative min-w-[180px]">
                            <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                            <select
                                value={sortConfig.key === 'createdAt' ? 'newest' : 'deadline'}
                                onChange={(e) => {
                                    if (e.target.value === 'newest') {
                                        setSortConfig({ key: 'createdAt', direction: 'desc' });
                                    } else {
                                        setSortConfig({ key: 'deadline', direction: 'asc' });
                                    }
                                }}
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none bg-white font-medium text-slate-700"
                            >
                                <option value="deadline">Deadline (Urgent)</option>
                                <option value="newest">Newest Assigned</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4 pointer-events-none" />
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
                    {/* Mobile Filter - Custom Dropdown */}
                    <div className="md:hidden space-y-3">
                        <div className="relative">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className="w-full pl-9 pr-9 py-3 text-sm rounded-lg border border-slate-200 bg-white font-medium text-left relative"
                            >
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                                <span className="text-slate-700">
                                    {(sortConfig.key === 'createdAt') ? 'Newest' : 'Deadline'} • {filterStatus === 'all' ? 'All' : filterStatus === 'pending' ? 'Assigned' : filterStatus === 'submitted' ? 'Submitted' : 'Done'}
                                </span>
                                <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isFilterOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden p-2 space-y-2">
                                    <div>
                                        <p className="px-3 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Sort By</p>
                                        <button
                                            onClick={() => {
                                                setSortConfig({ key: 'deadline', direction: 'asc' });
                                                setIsFilterOpen(false);
                                            }}
                                            className={`w-full px-3 py-2 text-sm text-left rounded-md ${sortConfig.key === 'deadline' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            Deadline
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSortConfig({ key: 'createdAt', direction: 'desc' });
                                                setIsFilterOpen(false);
                                            }}
                                            className={`w-full px-3 py-2 text-sm text-left rounded-md ${sortConfig.key === 'createdAt' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            Newest
                                        </button>
                                    </div>
                                    <div className="border-t border-slate-100 pt-2">
                                        <p className="px-3 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Filter Status</p>
                                        <button onClick={() => { setFilterStatus('all'); setIsFilterOpen(false); }} className={`w-full px-3 py-2 text-sm text-left rounded-md ${filterStatus === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>All Status</button>
                                        <button onClick={() => { setFilterStatus('pending'); setIsFilterOpen(false); }} className={`w-full px-3 py-2 text-sm text-left rounded-md ${filterStatus === 'pending' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>Assigned</button>
                                        <button onClick={() => { setFilterStatus('submitted'); setIsFilterOpen(false); }} className={`w-full px-3 py-2 text-sm text-left rounded-md ${filterStatus === 'submitted' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>Submitted</button>
                                        <button onClick={() => { setFilterStatus('graded'); setIsFilterOpen(false); }} className={`w-full px-3 py-2 text-sm text-left rounded-md ${filterStatus === 'graded' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>Completed</button>
                                    </div>
                                </div>
                            )}
                        </div>
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
                                <div
                                    className="flex items-center gap-1 cursor-pointer group"
                                    onClick={() => handleSort('title')}
                                >
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Task Details</span>
                                    {sortConfig.key === 'title' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                    ) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-blue-400" />}
                                </div>
                            </div>
                            <div className="flex items-center gap-8 pl-4">
                                <div
                                    className="flex items-center justify-center gap-1 cursor-pointer group min-w-[100px]"
                                    onClick={() => handleSort('status')}
                                >
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Status</span>
                                    {sortConfig.key === 'status' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                    ) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-blue-400" />}
                                </div>

                                <div
                                    className="flex items-center justify-center gap-1 cursor-pointer group min-w-[120px]"
                                    onClick={() => handleSort('deadline')}
                                >
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Info</span>
                                    {sortConfig.key === 'deadline' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                    ) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-blue-400" />}
                                </div>

                                <div
                                    className="flex items-center justify-center gap-1 cursor-pointer group min-w-[60px]"
                                    onClick={() => handleSort('grade')}
                                >
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Grade</span>
                                    {sortConfig.key === 'grade' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                    ) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-blue-400" />}
                                </div>
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
                                    } else if (task.isMaterialOnly && submission) {
                                        // Material Only - Completed
                                        statusDisplay = (
                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                                                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                                <span className="text-xs font-bold text-emerald-700">Completed</span>
                                            </div>
                                        );
                                        infoDisplay = (
                                            <div className="flex w-full items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                                                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                                <span className="text-xs font-bold text-emerald-700">Done</span>
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
                                                        <p className="text-xs text-slate-500 line-clamp-1">{stripHtml(task.description)}</p>
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
                                const startIndex = (currentPage - 1) * itemsPerPage;
                                const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

                                return (
                                    <div className="bg-white px-6 py-4 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                                        <p className="text-sm text-slate-500">
                                            Showing <span className="font-medium">{totalItems === 0 ? 0 : startIndex + 1}</span> - <span className="font-medium">{endIndex}</span> of <span className="font-medium">{totalItems}</span> tasks
                                        </p>
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

