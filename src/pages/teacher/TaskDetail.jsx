import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Users, CheckCircle2, XCircle, Hourglass,
    Clock, Award, FileText, Filter, Ban, RefreshCw, X, Save, Edit2, Calendar, BookOpen, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, Paperclip, Download, Eye, Link2, ExternalLink,
    FileSpreadsheet, FileBarChart, Globe, Youtube, MoreHorizontal, MessageCircle, Send, Check
} from "lucide-react";
import { LinkifiedText } from '../../utils/linkify';
import DOMPurify from 'dompurify';

export default function TaskDetail({ task, classes = [], onBack }) {
    const [students, setStudents] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [showGradeModal, setShowGradeModal] = useState(false);
    const [currentSubmission, setCurrentSubmission] = useState(null);
    const [gradeData, setGradeData] = useState({ grade: '', feedback: '' });
    const [questionScores, setQuestionScores] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [filterClass, setFilterClass] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);

    // Validate task object
    if (!task) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-red-800 mb-2">Error: Task Not Found</h2>
                    <p className="text-red-600 mb-4">Task data is missing or undefined.</p>
                    <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
                        Back to Tasks
                    </button>
                </div>
            </div>
        );
    }

    // Add error boundary
    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Task Details</h2>
                    <p className="text-red-600 mb-4">{error.message}</p>
                    <pre className="text-xs bg-white p-4 rounded overflow-auto max-h-64">{error.stack}</pre>
                    <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
                        Back to Tasks
                    </button>
                </div>
            </div>
        );
    }

    useEffect(() => {
        let unsubscribeSubmissions = null;

        const loadData = async () => {
            setLoading(true);
            try {
                // Check if task has assigned classes
                if (!task.assignedClasses || task.assignedClasses.length === 0) {
                    setStudents([]);
                    setSubmissions({});
                    setLoading(false);
                    return;
                }

                // Get all students from assigned classes (Legacy: classId field)
                const legacyQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'student'),
                    where('classId', 'in', task.assignedClasses)
                );

                // Get all students from assigned classes (Modern: classIds array)
                const modernQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'student'),
                    where('classIds', 'array-contains-any', task.assignedClasses)
                );

                const [legacySnap, modernSnap] = await Promise.all([
                    getDocs(legacyQuery),
                    getDocs(modernQuery)
                ]);

                // Merge results by ID to remove duplicates
                const studentsMap = new Map();

                legacySnap.docs.forEach(doc => {
                    studentsMap.set(doc.id, { id: doc.id, ...doc.data() });
                });

                modernSnap.docs.forEach(doc => {
                    if (!studentsMap.has(doc.id)) {
                        studentsMap.set(doc.id, { id: doc.id, ...doc.data() });
                    }
                });

                const studentsList = Array.from(studentsMap.values());
                setStudents(studentsList);

                // Setup real-time listener for submissions
                const submissionsQuery = query(
                    collection(db, 'submissions'),
                    where('taskId', '==', task.id)
                );

                // Real-time listener - akan auto-update ketika ada perubahan
                unsubscribeSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
                    const submissionsMap = {};
                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        submissionsMap[data.studentId] = {
                            id: doc.id,
                            ...data
                        };
                    });
                    setSubmissions(submissionsMap);
                    setLoading(false);
                }, (error) => {
                    console.error('Error in submissions listener:', error);
                    setLoading(false);
                });

            } catch (error) {
                console.error('Error loading data:', error);
                setStudents([]);
                setSubmissions({});
                setLoading(false);
            }
        };

        loadData();

        // Cleanup listener when component unmounts
        return () => {
            if (unsubscribeSubmissions) {
                unsubscribeSubmissions();
            }
        };
    }, [task.id]);

    // Sync currentSubmission with real-time submissions map
    // This ensures that when a student updates/deletes attachments, the teacher sees it immediately
    useEffect(() => {
        if (showGradeModal && currentSubmission?.student && submissions) {
            const studentId = currentSubmission.student.uid || currentSubmission.student.id;
            const updatedSubmission = submissions[studentId];

            // Only update if there are actual changes to avoid loops, 
            // but checking deep equality is expensive. 
            // React's setState will skip re-render if object ref is same or value is same.
            // Since onSnapshot creates new object refs, this will trigger re-render.
            if (updatedSubmission) {
                // We keep the student object as is, just update the submission part
                setCurrentSubmission(prev => {
                    // Safety check to prevent infinite loops or unnecessary updates
                    if (prev?.submission?.revisedAt?.seconds === updatedSubmission.revisedAt?.seconds &&
                        prev?.submission?.attachments?.length === updatedSubmission.attachments?.length) {
                        // Simple heuristic to avoid spamming updates if timestamps and attachment counts match
                        // Use with caution, maybe deeper comparison is needed if content changes but not time?
                        // Actually, Firestore onSnapshot typically only fires on real change.
                        // Let's just update.
                        // return prev; 
                    }
                    return { ...prev, submission: updatedSubmission };
                });
            }
        }
    }, [submissions, showGradeModal]); // Dependencies: submissions (updated by snapshot), modal open state

    const handleGradeClick = (student) => {
        const submission = submissions[student.uid] || submissions[student.id];
        setCurrentSubmission({ student, submission });

        // Initialize question scores
        const initialScores = {};
        if (submission) {
            if (submission.scores) {
                Object.assign(initialScores, submission.scores);
            } else if (task.questions && task.questions.length > 0) {
                // Default based on correctness if no scores saved
                task.questions.forEach(q => {
                    const ans = submission.answers?.[q.id];
                    let points = 0;
                    if (ans) {
                        if (q.type === 'single_choice' || q.type === 'true_false') {
                            const isCorrect = q.options.find(o => o.isCorrect)?.id === ans;
                            if (isCorrect) points = parseInt(q.points) || 0;
                        } else if (q.type === 'multiple_choice') {
                            const correct = q.options.filter(o => o.isCorrect).map(o => o.id).sort().join(',');
                            const studentAns = (ans || []).sort().join(',');
                            if (correct === studentAns) points = parseInt(q.points) || 0;
                        }
                    }
                    initialScores[q.id] = points;
                });
            }
        }
        setQuestionScores(initialScores);

        setGradeData({
            grade: submission?.grade?.toString() || '',
            feedback: submission?.feedback || ''
        });
        setShowGradeModal(true);
    };

    const handleQuestionScoreChange = (qId, value) => {
        const val = value === '' ? '' : parseInt(value);
        const updatedScores = { ...questionScores, [qId]: val };
        setQuestionScores(updatedScores);

        // Auto-calculate total grade
        const total = Object.values(updatedScores).reduce((sum, score) => sum + (typeof score === 'number' ? score : 0), 0);
        setGradeData(prev => ({ ...prev, grade: total }));
    };

    const handleSaveGrade = async () => {
        if (!currentSubmission?.submission) {
            toast.error('Student has not submitted the task');
            return;
        }

        const grade = parseFloat(gradeData.grade);
        if (isNaN(grade) || grade < 0 || grade > 100) {
            toast.error('Grade must be between 0-100');
            return;
        }

        setSaving(true);
        try {
            await updateDoc(doc(db, 'submissions', currentSubmission.submission.id), {
                grade: grade,
                feedback: gradeData.feedback,
                gradedAt: serverTimestamp(),
                status: 'graded',
                scores: questionScores // Save individual question scores
            });

            toast.success('Grade saved successfully!');

            // Auto-navigate to next student needing grade
            setTimeout(() => {
                // Find students that need grading (submitted but not graded)
                const needsGrading = sortedStudents.filter(s => {
                    const submission = submissions[s.uid] || submissions[s.id];
                    return submission && (submission.grade === undefined || submission.grade === null) && submission.status !== 'needs_revision';
                });

                // Get current student index in needsGrading array
                const currentIndex = needsGrading.findIndex(s => s.id === currentSubmission.student.id);
                const nextStudent = currentIndex >= 0 && currentIndex < needsGrading.length - 1
                    ? needsGrading[currentIndex + 1]
                    : null;

                if (nextStudent) {
                    // Auto-navigate to next student
                    handleGradeClick(nextStudent);
                    toast.success(`Moving to ${nextStudent.name}`, { duration: 2000 });
                } else {
                    // No more students to grade
                    toast.success("All students graded! 🎉", { icon: '✅' });
                    setShowGradeModal(false); // Close modal
                }
            }, 500);
        } catch (error) {
            console.error('Error saving grade:', error);
            toast.error('Failed to save grade: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRequestRevision = async () => {
        if (!currentSubmission?.submission) return;

        if (!gradeData.feedback || gradeData.feedback.trim() === '') {
            toast.error('Please provide feedback/instructions for revision');
            return;
        }

        setSaving(true);
        try {
            await updateDoc(doc(db, 'submissions', currentSubmission.submission.id), {
                grade: null, // Clear any existing grade
                feedback: gradeData.feedback,
                status: 'needs_revision',
                gradedAt: null // Clear graded timestamp
            });

            setShowGradeModal(false);
            toast.success('Requested revision from student');
        } catch (error) {
            console.error('Error requesting revision:', error);
            toast.error('Failed to request revision: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePrevStudent = () => {
        const currentIndex = sortedStudents.findIndex(s => s.id === currentSubmission.student.id);
        if (currentIndex > 0) {
            handleGradeClick(sortedStudents[currentIndex - 1]);
        }
    };

    const handleNextStudent = () => {
        const currentIndex = sortedStudents.findIndex(s => s.id === currentSubmission.student.id);
        if (currentIndex < sortedStudents.length - 1) {
            handleGradeClick(sortedStudents[currentIndex + 1]);
        }
    };

    const getSubmissionStatus = (student) => {
        // Try both uid and id as fallback
        const submission = submissions[student.uid] || submissions[student.id];
        if (!submission) {
            return {
                status: 'not_submitted',
                label: 'Not Submitted',
                color: 'text-red-700',
                bgColor: 'bg-red-50',
                borderColor: 'border-red-200',
                icon: XCircle
            };
        }

        if (task.isMaterialOnly) {
            return {
                status: 'completed',
                label: 'Completed',
                color: 'text-emerald-700',
                bgColor: 'bg-emerald-50',
                borderColor: 'border-emerald-200',
                icon: CheckCircle2
            };
        }

        // Check for revision needed
        if (submission.status === 'needs_revision') {
            return {
                status: 'needs_revision',
                label: 'Needs Revision',
                color: 'text-pink-700',
                bgColor: 'bg-pink-50',
                borderColor: 'border-pink-200',
                icon: RefreshCw
            };
        }

        // Check if graded
        if (submission.grade !== undefined && submission.grade !== null) {
            return {
                status: 'graded',
                label: 'Graded',
                color: 'text-blue-700',
                bgColor: 'bg-blue-50',
                borderColor: 'border-blue-200',
                icon: CheckCircle2
            };
        }

        // Submitted but not graded
        const isLate = new Date(submission.submittedAt?.toDate?.() || submission.submittedAt) > new Date(task.deadline);

        return {
            status: 'ungraded',
            label: isLate ? 'Late & Not Graded' : 'Not Graded',
            color: 'text-amber-700',
            bgColor: 'bg-amber-50',
            borderColor: 'border-amber-200',
            icon: Hourglass
        };
    };

    const formatDate = (date) => {
        if (!date) return '-';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            if (isNaN(d.getTime())) return 'Invalid Date';
            return d.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            console.error("Error formatting date:", date, e);
            return 'Invalid Date';
        }
    };

    // Helper for submission time styling
    const getSubmissionTimeStyle = (submittedAt, deadline) => {
        if (!submittedAt || !deadline) return 'bg-slate-50 text-slate-600 border-slate-200';

        const submitDate = submittedAt.toDate ? submittedAt.toDate() : new Date(submittedAt);
        const deadlineDate = deadline.toDate ? deadline.toDate() : new Date(deadline);

        // Late submission
        if (submitDate > deadlineDate) {
            return 'bg-red-50 text-red-700 border-red-200';
        }

        // H-1 submission (within 24 hours before deadline)
        const oneDayBefore = new Date(deadlineDate.getTime() - (24 * 60 * 60 * 1000));
        if (submitDate >= oneDayBefore) {
            return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        }

        // Early submission
        return 'bg-green-50 text-green-700 border-green-200';
    };

    // Helper for date time (DD MMM YYYY, HH:mm)
    const formatDateTime = (date) => {
        if (!date) return '-';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            if (isNaN(d.getTime())) return 'Invalid Date';
            return d.toLocaleString('id-ID', {
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

    // Filter students based on selected class
    const filteredStudents = filterClass === 'all'
        ? students
        : students.filter(student => student.classId === filterClass);

    // Sorting Logic
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedStudents = [...filteredStudents].sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.key) {
            case 'name':
                aValue = a.name?.toLowerCase() || '';
                bValue = b.name?.toLowerCase() || '';
                break;
            case 'class':
                const classA = classes.find(c => c.id === a.classId)?.name || '';
                const classB = classes.find(c => c.id === b.classId)?.name || '';
                aValue = classA;
                bValue = classB;
                break;
            case 'status':
                // Sort by status priority: submitted > late > ungraded > not_submitted
                const getStatusPriority = (student) => {
                    const { status } = getSubmissionStatus(student);
                    if (status === 'ungraded') return 3;
                    if (status === 'submitted') return 2; // graded
                    if (status === 'late') return 1;
                    return 0; // not_submitted
                };
                aValue = getStatusPriority(a);
                bValue = getStatusPriority(b);
                break;
            case 'submittedAt':
                const subA = submissions[a.uid] || submissions[a.id];
                const subB = submissions[b.uid] || submissions[b.id];
                // Use a very old date for no submission so it goes to bottom/top
                aValue = subA?.submittedAt?.toMillis?.() || subA?.submittedAt || (subA ? new Date(subA.submittedAt).getTime() : 0);
                bValue = subB?.submittedAt?.toMillis?.() || subB?.submittedAt || (subB ? new Date(subB.submittedAt).getTime() : 0);
                break;
            case 'grade':
                const gradeA = (submissions[a.uid] || submissions[a.id])?.grade ?? -1;
                const gradeB = (submissions[b.uid] || submissions[b.id])?.grade ?? -1;
                aValue = gradeA;
                bValue = gradeB;
                break;
            default:
                return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Calculate statistics based on filtered students
    const filteredSubmissions = filteredStudents
        .map(student => submissions[student.uid] || submissions[student.id])
        .filter(Boolean);

    const stats = {
        total: filteredStudents.length,
        submitted: filteredSubmissions.length,
        graded: filteredSubmissions.filter(s => s.grade !== undefined && s.grade !== null).length,
        avgGrade: filteredSubmissions.filter(s => s.grade !== undefined && s.grade !== null).length > 0
            ? (filteredSubmissions.filter(s => s.grade !== undefined && s.grade !== null).reduce((sum, s) => sum + s.grade, 0) /
                filteredSubmissions.filter(s => s.grade !== undefined && s.grade !== null).length).toFixed(1)
            : 0
    };

    const SortIcon = ({ column }) => {
        return (
            <span className="ml-2 inline-block align-middle">
                {sortConfig.key === column ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                    <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-500" />
                )}
            </span>
        );
    };

    // Helper to extract URLs and determining metadata
    const extractUrls = (html) => {
        if (!html) return [];
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const text = doc.body.textContent || "";
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(urlRegex);
        if (!matches) return [];

        const uniqueUrls = [...new Set(matches.map(url => url.replace(/[.,:;)]+$/, '')))];

        return uniqueUrls.map(url => {
            let type = 'link';
            let title = 'External Link';
            let icon = Globe;
            let color = 'text-slate-500';
            let bg = 'bg-slate-50';
            let border = 'border-slate-200';

            if (url.includes('docs.google.com/spreadsheets')) {
                type = 'sheet';
                title = 'Google Spreadsheet';
                icon = FileSpreadsheet;
                color = 'text-emerald-600';
                bg = 'bg-emerald-50';
                border = 'border-emerald-200';
            } else if (url.includes('docs.google.com/document')) {
                type = 'doc';
                title = 'Google Document';
                icon = FileText;
                color = 'text-blue-600';
                bg = 'bg-blue-50';
                border = 'border-blue-200';
            } else if (url.includes('drive.google.com')) {
                type = 'drive';
                title = 'Google Drive File';
                icon = ExternalLink;
                color = 'text-sky-600';
                bg = 'bg-sky-50';
                border = 'border-sky-200';
            } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
                type = 'youtube';
                title = 'YouTube Video';
                icon = Youtube;
                color = 'text-red-600';
                bg = 'bg-red-50';
                border = 'border-red-200';
            }

            return { url, type, title, icon, color, bg, border };
        });
    };

    // Helper to handle file download manually to force download
    const handleDownload = async (e, url, filename) => {
        e.preventDefault();
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed:", error);
            window.open(url, '_blank'); // Fallback
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
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">{task?.title || 'Loading...'}</h1>
                </div>
                <button
                    onClick={() => setShowTaskDetailModal(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2"
                >
                    <FileText className="h-4 w-4" />
                    View Detail
                </button>
            </div>

            {/* Task Info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">Deadline: {task?.deadline ? formatDate(task.deadline) : '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                        <BookOpen className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">{task?.assignedClasses?.length || 0} Class</span>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Total Students</p>
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
                            <p className="text-xs text-slate-500 font-medium">Submitted</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.submitted}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                            <XCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Not Submitted</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.total - stats.submitted}</p>
                        </div>
                    </div>
                </div>
                {!task?.isMaterialOnly && (
                    <>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                                    <FileText className="h-6 w-6 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium">Graded</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.graded}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                                    <Award className="h-6 w-6 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium">Average</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.avgGrade}</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Student List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-lg font-bold text-slate-800">Student List</h2>

                    {/* Class Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="pl-10 pr-8 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm appearance-none bg-white cursor-pointer min-w-[200px]"
                        >
                            <option value="all">All Classes</option>
                            {task?.assignedClasses?.map(classId => {
                                const cls = classes.find(c => c.id === classId);
                                return cls ? (
                                    <option key={classId} value={classId}>{cls.name}</option>
                                ) : null;
                            })}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">No</th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    Siswa <SortIcon column="name" />
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('class')}
                                >
                                    Class <SortIcon column="class" />
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('status')}
                                >
                                    Status <SortIcon column="status" />
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('submittedAt')}
                                >
                                    Submitted At <SortIcon column="submittedAt" />
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('grade')}
                                >
                                    Nilai <SortIcon column="grade" />
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : sortedStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                                        Tidak ada siswa ditemukan untuk filter ini.
                                    </td>
                                </tr>
                            ) : (
                                sortedStudents.map((student, index) => {
                                    const { status, label, color, bgColor, borderColor, icon: StatusIcon } = getSubmissionStatus(student);
                                    const submission = submissions[student.uid] || submissions[student.id];
                                    const cls = classes.find(c => c.id === student.classId);

                                    // Highlight ungraded submissions
                                    const isUngraded = submission && (submission.grade === undefined || submission.grade === null) && submission.status !== 'needs_revision' && !task.isMaterialOnly;
                                    // Use solid yellow-50 for better visibility, but keep it subtle. Material Only tasks are always "graded" (completed) effectively.
                                    const rowBgClass = isUngraded ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-slate-50/50';

                                    return (
                                        <motion.tr
                                            key={student.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.03 }}
                                            onClick={() => handleGradeClick(student)}
                                            className={`${rowBgClass} transition-colors cursor-pointer`}
                                        >
                                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0 shadow-sm">
                                                        {student.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{student.name || 'Tidak Diketahui'}</p>
                                                        <p className="text-xs text-slate-500">{student.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200 font-medium">
                                                    {cls?.name || 'Unknown Class'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${bgColor} ${color} ${borderColor}`}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                {submission ? (
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getSubmissionTimeStyle(submission.submittedAt, task.deadline)}`}>
                                                        <Calendar className="h-3 w-3" />
                                                        {formatDateTime(submission.submittedAt)}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {submission?.grade !== undefined && submission?.grade !== null ? (
                                                    <div className={`inline-flex items-center gap-1.5 font-bold text-xs ${submission.grade >= 80 ? 'text-green-600' :
                                                        submission.grade >= 60 ? 'text-amber-600' :
                                                            'text-red-600'
                                                        }`}>
                                                        <Award className="h-4 w-4" />
                                                        {submission.grade}
                                                    </div>
                                                ) : task.isMaterialOnly && submission ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Done
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleGradeClick(student);
                                                    }}
                                                    disabled={!submission}
                                                    className={`p-2 rounded-xl transition-all ${submission
                                                        ? (task.isMaterialOnly
                                                            ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                                            : (submission?.grade !== undefined && submission?.grade !== null
                                                                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                                                : 'text-purple-600 bg-purple-50 hover:bg-purple-100'))
                                                        : 'text-slate-400 bg-slate-50 cursor-not-allowed'
                                                        }`}
                                                    title={task.isMaterialOnly ? 'Lihat Detail' : (submission?.grade !== undefined && submission?.grade !== null ? 'Edit nilai' : 'Beri nilai')}
                                                >
                                                    {task.isMaterialOnly ? (
                                                        <Eye className="h-4 w-4" />
                                                    ) : (
                                                        submission?.grade !== undefined && submission?.grade !== null ? (
                                                            <Edit2 className="h-4 w-4" />
                                                        ) : (
                                                            <Award className="h-4 w-4" />
                                                        )
                                                    )}
                                                </button>
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Grading Modal */}
            {createPortal(
                <AnimatePresence>
                    {showGradeModal && currentSubmission && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="bg-white rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col border border-slate-200"
                            >
                                {/* Header - fluent style */}
                                <div className="bg-white px-6 py-3 border-b border-slate-200 flex justify-between items-center flex-shrink-0 gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-semibold text-slate-800 tracking-tight truncate">Grade Submission</h2>
                                            <div className="flex items-center gap-2 text-slate-500 text-sm mt-0.5 min-w-0">
                                                <span className="font-medium text-slate-700 truncate">{currentSubmission.student.name}</span>
                                                <span className="text-slate-300 flex-shrink-0">•</span>
                                                <span className="text-slate-500 truncate">{currentSubmission.student.email}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Revision Status Badge */}
                                        {currentSubmission.submission?.status === 'needs_revision' && (
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-700 rounded-md border border-pink-100">
                                                <RefreshCw className="h-3.5 w-3.5" />
                                                <span className="text-xs font-semibold whitespace-nowrap">Revision Requested</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <div className="flex items-center bg-white rounded-md border border-slate-200 shadow-sm">
                                                <button
                                                    onClick={handlePrevStudent}
                                                    disabled={sortedStudents.findIndex(s => s.id === currentSubmission.student.id) <= 0}
                                                    className="p-1.5 hover:bg-slate-50 text-slate-500 disabled:opacity-30 transition-colors border-r border-slate-100"
                                                    title="Previous Student"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={handleNextStudent}
                                                    disabled={sortedStudents.findIndex(s => s.id === currentSubmission.student.id) >= sortedStudents.length - 1}
                                                    className="p-1.5 hover:bg-slate-50 text-slate-500 disabled:opacity-30 transition-colors"
                                                    title="Next Student"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <button onClick={() => setShowGradeModal(false)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all">
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Grid Layout -> Flex Layout */}
                                <div className="flex-1 min-h-0 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200">

                                    {/* Left Side: Answer Viewer */}
                                    <div className="flex-1 flex flex-col h-full min-h-0 bg-white min-w-0">
                                        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                                            <div className="min-h-full">
                                                {/* QUIZ RESULTS SECTION */}
                                                {task.questions && task.questions.length > 0 && currentSubmission.submission?.answers && (
                                                    <div className="mb-8 border-b border-slate-100 pb-8">
                                                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                            <CheckCircle2 className="h-5 w-5 text-purple-600" />
                                                            Quiz Results
                                                        </h4>
                                                        <div className="space-y-6">
                                                            {task.questions.map((q, idx) => {
                                                                const studentAns = currentSubmission.submission.answers[q.id];
                                                                // Determine correctness
                                                                let isCorrect = false;
                                                                let correctText = [];

                                                                if (q.type === 'single_choice' || q.type === 'true_false') {
                                                                    const correctOpt = q.options.find(o => o.isCorrect);
                                                                    isCorrect = correctOpt?.id === studentAns;
                                                                    correctText.push(correctOpt?.text || 'N/A');
                                                                } else if (q.type === 'multiple_choice') {
                                                                    const correctOpts = q.options.filter(o => o.isCorrect).map(o => o.id).sort();
                                                                    const studentOpts = (studentAns || []).sort();
                                                                    isCorrect = JSON.stringify(correctOpts) === JSON.stringify(studentOpts);
                                                                    correctText = q.options.filter(o => o.isCorrect).map(o => o.text);
                                                                } else {
                                                                    // Essay/Short Answer - manual review
                                                                    isCorrect = null; // Neutral
                                                                }

                                                                // Get text representation of student answer
                                                                let studentAnsText = '-';
                                                                if (q.type === 'essay' || q.type === 'short_answer') {
                                                                    studentAnsText = studentAns || '(No Answer)';
                                                                } else if (q.type === 'multiple_choice') {
                                                                    studentAnsText = (studentAns || []).map(id => q.options.find(o => o.id === id)?.text).join(', ') || '-';
                                                                } else {
                                                                    studentAnsText = q.options.find(o => o.id === studentAns)?.text || '-';
                                                                }

                                                                return (
                                                                    <div key={q.id} className={`p-4 rounded-xl border ${isCorrect === true ? 'bg-emerald-50/50 border-emerald-100' : isCorrect === false ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                                        <div className="flex gap-3">
                                                                            <span className="flex-none font-bold text-slate-500">{idx + 1}.</span>
                                                                            <div className="flex-1 space-y-2">
                                                                                <p className="font-medium text-slate-800 text-sm whitespace-pre-wrap">{q.text}</p>

                                                                                <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm">
                                                                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Student Answer:</p>
                                                                                    <div className={isCorrect === true ? 'text-emerald-700 font-medium' : isCorrect === false ? 'text-red-700 font-medium' : 'text-slate-700'}>
                                                                                        {studentAnsText}
                                                                                    </div>
                                                                                </div>

                                                                                {isCorrect === false && (q.type !== 'essay' && q.type !== 'short_answer') && (
                                                                                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-sm">
                                                                                        <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Correct Answer:</p>
                                                                                        <div className="text-emerald-800 font-medium">
                                                                                            {correctText.join(', ')}
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                <div className="mt-3 pt-3 border-t border-dashed border-slate-100 flex items-center justify-between gap-4">
                                                                                    <div className="flex items-center gap-2">
                                                                                        {isCorrect === true && (
                                                                                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                                                                                <CheckCircle2 className="h-3 w-3" /> Auto: Correct
                                                                                            </span>
                                                                                        )}
                                                                                        {isCorrect === false && (
                                                                                            <span className="text-xs font-bold text-red-500 flex items-center gap-1 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                                                                                                <XCircle className="h-3 w-3" /> Auto: Incorrect
                                                                                            </span>
                                                                                        )}
                                                                                        {isCorrect === null && (
                                                                                            <span className="text-xs font-bold text-amber-500 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                                                                                                <Hourglass className="h-3 w-3" /> Needs Grading
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                                        <label className="text-xs font-bold text-slate-400 uppercase">Score</label>
                                                                                        <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                                                                                            <input
                                                                                                type="number"
                                                                                                min="0"
                                                                                                max={q.points}
                                                                                                value={questionScores[q.id] ?? ''}
                                                                                                onChange={(e) => handleQuestionScoreChange(q.id, e.target.value)}
                                                                                                className="w-16 px-2 py-1 text-sm bg-white border border-slate-200 rounded-md text-right font-bold text-slate-700 outline-none"
                                                                                                placeholder="0"
                                                                                            />
                                                                                            <span className="text-xs font-bold text-slate-400 px-2">/ {q.points} pts</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {currentSubmission.submission?.content ? (
                                                    <div className="prose prose-slate max-w-none">
                                                        <div
                                                            className="text-slate-800 leading-relaxed text-sm break-words px-0 [&_ol]:!list-decimal [&_ul]:!list-disc [&_ol]:!pl-5 [&_ul]:!pl-5 [&_li]:!pl-1"
                                                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentSubmission.submission.content) }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                                        <FileText className="h-12 w-12 mb-3 opacity-20" />
                                                        <p>No content submitted</p>
                                                    </div>
                                                )}

                                                {/* Attachments Section */}
                                                {currentSubmission.submission?.attachments && currentSubmission.submission.attachments.length > 0 && (
                                                    <div className="mt-8 border-t border-slate-100 pt-6">
                                                        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                            <Paperclip className="h-4 w-4 text-blue-500" />
                                                            Attachments
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {currentSubmission.submission.attachments.map((att, idx) => (
                                                                <a
                                                                    key={idx}
                                                                    href={att.url}
                                                                    download={att.name}
                                                                    onClick={(e) => handleDownload(e, att.url, att.name)}
                                                                    className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all group cursor-pointer"
                                                                >
                                                                    <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                                                        <FileText className="h-5 w-5 text-blue-600" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-semibold text-slate-700 truncate" title={att.name}>
                                                                            {att.name}
                                                                        </p>
                                                                        <p className="text-xs text-slate-500">
                                                                            {(att.size / 1024).toFixed(1)} KB
                                                                        </p>
                                                                    </div>
                                                                    <Download className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                    {/* Right Side: Professional Grading Panel */}
                                    <div className="bg-slate-50/50 flex flex-col h-full min-h-0 w-full lg:w-96 shrink-0 border-l border-slate-200">

                                        <div className="flex-none p-6">

                                            {/* Minimalist Details Section */}
                                            <div className="flex-shrink-0 mb-6 space-y-4">
                                                <div>
                                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Submission Details</h3>
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-center group">
                                                            <span className="text-sm text-slate-500 font-medium">Current Status</span>
                                                            {(() => {
                                                                const isRevised = currentSubmission.submission?.status === 'needs_revision';
                                                                const isGraded = currentSubmission.submission?.grade !== undefined && currentSubmission.submission?.grade !== null;
                                                                const isLate = new Date(currentSubmission.submission?.submittedAt) > new Date(task.deadline);

                                                                let statusColor = 'bg-blue-100 text-blue-700 border-blue-200';
                                                                let statusText = 'Submitted';

                                                                if (isRevised) {
                                                                    statusColor = 'bg-pink-100 text-pink-700 border-pink-200';
                                                                    statusText = 'Needs Revision';
                                                                } else if (isGraded) {
                                                                    statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                                                                    statusText = 'Graded';
                                                                } else if (isLate) {
                                                                    statusColor = 'bg-red-100 text-red-700 border-red-200';
                                                                    statusText = 'Late Submission';
                                                                }

                                                                if (task.isMaterialOnly) {
                                                                    statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                                                                    statusText = 'Completed';
                                                                }

                                                                return (
                                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusColor}`}>
                                                                        {statusText}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>

                                                        {/* Revision History Section */}
                                                        <div className="max-h-40 overflow-y-auto pl-1 py-1 pr-1 custom-scrollbar">
                                                            <div className="relative pl-4 border-l-2 border-slate-200 ml-1 space-y-4">
                                                                {/* Initial Submission */}
                                                                <div className="relative">
                                                                    <div className="absolute -left-[21px] top-[5.5px] h-[2.2px] w-[7.6px] rounded-full bg-blue-500"></div>
                                                                    <p className="text-xs text-slate-500 font-medium mb-0.5">Submitted</p>
                                                                    <p className="text-xs text-slate-600 font-medium">
                                                                        {formatDate(currentSubmission.submission?.submittedAt)}
                                                                    </p>
                                                                </div>

                                                                {/* Revisions List (Fallback to single revisedAt if history array doesn't exist) */}
                                                                {currentSubmission.submission?.revisionHistory ? (
                                                                    currentSubmission.submission.revisionHistory.map((rev, idx) => (
                                                                        <div key={idx} className="relative">
                                                                            <div className="absolute -left-[21px] top-[5.5px] h-[2.2px] w-[7.6px] rounded-full bg-orange-500"></div>
                                                                            <p className="text-xs text-slate-500 font-medium mb-0.5">Revision {idx + 1}</p>
                                                                            <p className="text-xs text-slate-600 font-medium">
                                                                                {formatDate(rev.date || rev.submittedAt)}
                                                                            </p>
                                                                        </div>
                                                                    ))
                                                                ) : currentSubmission.submission?.revisedAt && (
                                                                    <div className="relative">
                                                                        <div className="absolute -left-[21px] top-[5.5px] h-[2.2px] w-[7.6px] rounded-full bg-orange-500"></div>
                                                                        <p className="text-xs text-slate-500 font-medium mb-0.5">Latest Revision</p>
                                                                        <p className="text-xs text-slate-600 font-medium">
                                                                            {formatDate(currentSubmission.submission.revisedAt)}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                        </div>

                                        {/* Grading Inputs */}
                                        {!task.isMaterialOnly && (
                                            <div className="flex-1 flex flex-col min-h-0 gap-5 px-6 pb-6">
                                                <div className="flex-shrink-0">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                        Grade <span className="text-slate-400 font-normal normal-case">/ 100</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        className="w-full px-3 py-2.5 rounded-md border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm font-semibold text-slate-900 bg-white placeholder-slate-400"
                                                        placeholder="0"
                                                        value={gradeData.grade}
                                                        onChange={(e) => setGradeData({ ...gradeData, grade: e.target.value })}
                                                    />
                                                </div>

                                                <div className="flex-1 flex flex-col min-h-0">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Feedback</label>
                                                        <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">Markdown</span>
                                                    </div>
                                                    <textarea
                                                        className="w-full flex-1 min-h-0 px-4 py-3 rounded-md border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-white text-sm text-slate-700 placeholder-slate-400 resize-none leading-relaxed"
                                                        placeholder="Write detailed feedback..."
                                                        value={gradeData.feedback}
                                                        onChange={(e) => setGradeData({ ...gradeData, feedback: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Material Only - Done Badge */}
                                        {task.isMaterialOnly && (
                                            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                                </div>
                                                <h3 className="text-lg font-bold text-emerald-800 mb-1">Review Completed</h3>
                                                <p className="text-sm text-emerald-600 text-center max-w-xs">
                                                    This student has marked the material as done. No grading is required.
                                                </p>
                                            </div>
                                        )}

                                    </div>
                                </div>

                                {/* Unified Footer */}
                                <div className="border-t border-slate-200 bg-white flex flex-col lg:flex-row flex-shrink-0 z-20 relative">
                                    {/* Left Part: Detected Links */}
                                    <div className="flex-1 p-4 flex flex-col justify-center min-w-0 bg-white">
                                        {currentSubmission.submission?.content && extractUrls(currentSubmission.submission.content).length > 0 && (
                                            <div className="w-full">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {extractUrls(currentSubmission.submission.content).map((link, idx) => {
                                                        const Icon = link.icon;
                                                        return (
                                                            <a
                                                                key={idx}
                                                                href={link.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-md group ${link.bg} ${link.border} bg-opacity-40 hover:bg-opacity-100`}
                                                            >
                                                                <div className={`p-2.5 rounded-lg bg-white border shadow-sm ${link.color} ${link.border}`}>
                                                                    <Icon className="h-5 w-5" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h5 className={`text-sm font-bold truncate ${link.color}`}>{link.title}</h5>
                                                                    <p className="text-xs text-slate-500 truncate mt-0.5">{link.url}</p>
                                                                </div>
                                                                <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0" />
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Part: Footer Actions */}
                                    <div className="w-full lg:w-96 p-4 flex-shrink-0 bg-white flex flex-col justify-center">
                                        {!task.isMaterialOnly && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={handleRequestRevision}
                                                    disabled={saving || !gradeData.feedback}
                                                    className="px-4 py-2.5 rounded-md text-orange-700 font-semibold bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                    Ask Revision
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={handleSaveGrade}
                                                    disabled={saving}
                                                    className="px-4 py-2.5 bg-blue-600 text-white rounded-md font-semibold text-sm hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {saving ? (
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    ) : (
                                                        <Save className="h-4 w-4" />
                                                    )}
                                                    Save Grade
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )
                    }
                </AnimatePresence >,
                document.body
            )}

            {/* Task Detail Modal */}
            <AnimatePresence>
                {showTaskDetailModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white flex justify-between items-center flex-shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold">Task Details</h2>
                                    <p className="text-blue-100 text-sm mt-1">{task?.title}</p>
                                </div>
                                <button onClick={() => setShowTaskDetailModal(false)} className="text-white/80 hover:text-white transition-colors">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="space-y-6">
                                    {/* Deadline and Class Info - Moved to top */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Calendar className="h-4 w-4 text-blue-600" />
                                                <p className="text-xs text-blue-700 font-bold uppercase tracking-wide">Deadline</p>
                                            </div>
                                            <p className="text-sm font-bold text-slate-800">{task?.deadline ? formatDate(task.deadline) : '-'}</p>
                                        </div>
                                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BookOpen className="h-4 w-4 text-purple-600" />
                                                <p className="text-xs text-purple-700 font-bold uppercase tracking-wide">Class</p>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {task?.assignedClasses?.length > 0 ? (
                                                    task.assignedClasses.map((classId) => {
                                                        const cls = classes.find(c => c.id === classId);
                                                        return cls ? (
                                                            <span key={classId} className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded-md font-medium">
                                                                {cls.name}
                                                            </span>
                                                        ) : null;
                                                    })
                                                ) : (
                                                    <span className="text-sm text-slate-500 italic">Tidak ada kelas</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-blue-600" />
                                            Material / Task Description
                                        </h3>
                                        <div
                                            className="bg-white p-6 rounded-xl border-2 border-slate-200 shadow-sm"
                                            style={{
                                                lineHeight: '1.8',
                                                fontSize: '14px'
                                            }}
                                        >
                                            <div
                                                dangerouslySetInnerHTML={{ __html: task?.description || '<p class="text-slate-400 italic">No description</p>' }}
                                                style={{
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    overflowWrap: 'break-word'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50 flex-shrink-0">
                                <button
                                    onClick={() => setShowTaskDetailModal(false)}
                                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-md hover:shadow-lg"
                                >
                                    Tutup
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
