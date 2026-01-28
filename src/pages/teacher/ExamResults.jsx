import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Calendar, CheckCircle, XCircle, RefreshCw, FileText, Search, ChevronRight, Award, Trash2, Edit3, Save, AlertCircle, Clock, ArrowUpDown, ArrowUp, ArrowDown, School, Hash, CheckSquare, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { resetExamForAllClasses, resetExamForClass, resetExamForStudent } from '../../utils/examReset';
import ActiveExamsMonitor from './ActiveExamsMonitor';

// --- GRADING INTERFACE COMPONENT (Moved Outside) ---
const GradingInterface = ({
    result,
    exam,
    studentName,
    manualScores,
    setManualScores,
    feedbacks,
    setFeedbacks,
    onClose,
    onSave
}) => {
    if (!result || !exam) return null;

    // Merge questions with answers
    const gradedQuestions = exam.questions.map(q => {
        const answer = result.answers[q.id];
        return { ...q, answer };
    });

    // Calculate live preview score
    let currentManualTotal = 0;
    Object.values(manualScores).forEach(s => currentManualTotal += (parseFloat(s) || 0));
    const liveTotalScore = (result.autoGradedScore || 0) + currentManualTotal;
    const livePercentage = ((liveTotalScore / (result.maxScore || 100)) * 100).toFixed(1);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <ArrowLeft className="h-6 w-6 text-slate-500" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Grading: {studentName}</h2>
                        <p className="text-sm text-slate-500">Attempt submitted: {result.submittedAt?.toDate().toLocaleString()}</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">Total Score</p>
                        <p className="text-2xl font-bold text-blue-600">{livePercentage}% <span className="text-sm text-slate-400 font-normal">({liveTotalScore}/{result.maxScore})</span></p>
                    </div>
                    <button
                        onClick={onSave}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-200"
                    >
                        <Save className="h-5 w-5" />
                        Save Grade
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="max-w-4xl mx-auto space-y-6">
                    {gradedQuestions.map((q, idx) => {
                        const isManual = q.type === 'essay' || q.type === 'short_answer';

                        // Calculate correctness for auto-graded
                        let isCorrect = false;
                        if (!isManual) {
                            if (q.type === 'single_choice' || q.type === 'true_false') {
                                const correctOpt = q.options?.find(o => o.isCorrect);
                                isCorrect = correctOpt && q.answer === correctOpt.id;
                            } else if (q.type === 'multiple_choice') {
                                const correctOpts = q.options?.filter(o => o.isCorrect).map(o => o.id) || [];
                                const studentAnswers = Array.isArray(q.answer) ? q.answer : [];
                                isCorrect = studentAnswers.length === correctOpts.length &&
                                    studentAnswers.every(val => correctOpts.includes(val));
                            } else if (q.type === 'matching') {
                                // Matching logic remains tricky without storing correct Answer map
                                // Assuming 'matching' type might need special handling or isCorrect check on pairs
                                // If 'matching' options have 'left' and 'right', usually they are the correct pairs.
                                // Let's check how matching is stored.
                                // In ExamEditor: options = [{id, left, right}].
                                // Student answer: object { [index]: "user_right_value" } or similar?
                                // Actually, matching usually stores pairs.
                                // Let's assume strict JSON equality for now if structure matches.
                                // But wait, ExamEditor matching options ARE the correct pairs.
                                // So checks should be: Student's answer for index i === Option[i].right ?
                                // Let's leave matching as is for now or use JSON stringify if legacy.
                                // But better: compare answerObj with options right values.
                                const answerObj = q.answer || {};
                                isCorrect = q.options?.every((opt, idx) => answerObj[idx] === opt.right);
                            }
                        }

                        return (
                            <div key={q.id} className={`bg-white rounded-2xl shadow-sm border-2 p-6 ${isManual ? 'border-blue-100' : 'border-slate-100'}`}>
                                {/* Question Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3">
                                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-bold h-fit">
                                            No. {idx + 1}
                                        </span>
                                        <span className={`px-3 py-1 rounded-lg text-sm font-bold h-fit ${isManual ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                                            {q.type.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="text-slate-400 text-sm font-medium">Max Poin: {q.points || 10}</span>
                                </div>

                                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">{q.text}</h3>

                                {/* Answer Section */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Student Answer</p>
                                        <div className={`p-4 rounded-xl border-2 ${isManual
                                            ? 'bg-blue-50/50 border-blue-100'
                                            : isCorrect
                                                ? 'bg-green-50 border-green-100'
                                                : 'bg-red-50 border-red-100'
                                            }`}>
                                            {q.type === 'essay' || q.type === 'short_answer' ? (
                                                <p className="whitespace-pre-wrap text-slate-800 font-medium font-serif leading-relaxed">
                                                    {q.answer || <span className="text-slate-400 italic">No answer</span>}
                                                </p>
                                            ) : (
                                                <div className="text-slate-800 font-medium">
                                                    {(() => {
                                                        if (!q.answer) return <span className="text-slate-400 italic">No answer</span>;

                                                        if (q.type === 'single_choice' || q.type === 'true_false') {
                                                            const opt = q.options?.find(o => o.id === q.answer);
                                                            return opt ? opt.text : <span className="text-red-400 text-xs">ID: {q.answer} (Option not found)</span>;
                                                        }

                                                        if (q.type === 'multiple_choice') {
                                                            const answers = Array.isArray(q.answer) ? q.answer : [];
                                                            if (answers.length === 0) return <span className="text-slate-400 italic">No answer</span>;

                                                            return (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {answers.map(ansId => {
                                                                        const opt = q.options?.find(o => o.id === ansId);
                                                                        return opt ? (
                                                                            <span key={ansId} className="bg-slate-100 px-2 py-1 rounded border border-slate-200 text-sm">
                                                                                {opt.text}
                                                                            </span>
                                                                        ) : (
                                                                            <span key={ansId} className="text-red-400 text-xs">ID: {ansId}</span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        }

                                                        if (q.type === 'matching') {
                                                            const answerObj = q.answer;
                                                            if (typeof answerObj !== 'object') return JSON.stringify(answerObj);

                                                            return (
                                                                <div className="space-y-1">
                                                                    {q.options?.map((pair, idx) => {
                                                                        const studentAnswer = answerObj[idx];
                                                                        return (
                                                                            <div key={idx} className="flex items-center gap-2 text-sm">
                                                                                <span className="font-bold text-slate-600">{pair.left}</span>
                                                                                <span className="text-slate-400">➜</span>
                                                                                <span className={studentAnswer ? "text-blue-600 font-bold" : "text-slate-400 italic"}>
                                                                                    {studentAnswer || "No answer"}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        }

                                                        return JSON.stringify(q.answer);
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Correct Answer Display for Auto-graded (if enabled) */}
                                        {!isManual && !isCorrect && exam?.showResultToStudents && (
                                            <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Correct Answer</p>
                                                <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-sm text-green-800 font-medium">
                                                    {(() => {
                                                        if (q.type === 'single_choice' || q.type === 'true_false') {
                                                            const opt = q.options?.find(o => o.isCorrect);
                                                            return opt ? opt.text : 'Valid option not found';
                                                        }
                                                        if (q.type === 'multiple_choice') {
                                                            const correctOpts = q.options?.filter(o => o.isCorrect) || [];
                                                            return (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {correctOpts.map(opt => (
                                                                        <span key={opt.id} className="bg-white px-2 py-1 rounded border border-green-200">
                                                                            {opt.text}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            );
                                                        }
                                                        if (q.type === 'matching') {
                                                            // Show correct pairs
                                                            return (
                                                                <ul className="list-disc pl-4 space-y-1">
                                                                    {q.options?.map((opt, idx) => (
                                                                        <li key={idx}>
                                                                            {opt.left} ➜ {opt.right}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            );
                                                        }
                                                        return '-';
                                                    })()}
                                                </div>
                                            </div>
                                        )}

                                        {/* Expected Answer for Teacher */}
                                        {isManual && (
                                            <div className="mt-4">
                                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Answer Key / Reference</p>
                                                <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-sm text-green-800">
                                                    {q.expectedAnswer || '-'}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Grading Controls */}
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 h-fit">
                                        {isManual ? (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Score (0 - {q.points || 10})</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={q.points || 10}
                                                        className="w-full text-3xl font-bold p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-blue-600 outline-none"
                                                        value={manualScores[q.id] || ''}
                                                        onChange={(e) => {
                                                            const val = Math.min(Math.max(0, parseFloat(e.target.value) || 0), q.points || 10);
                                                            setManualScores(prev => ({ ...prev, [q.id]: val }));
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teacher Feedback</label>
                                                    <textarea
                                                        className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[100px]"
                                                        placeholder="Write feedback for student..."
                                                        value={feedbacks[q.id] || ''}
                                                        onChange={(e) => setFeedbacks(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-4">
                                                <div className="mb-2">
                                                    <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">Autograded</span>
                                                </div>
                                                <p className="text-sm text-slate-500">Automatically graded by system</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default function ExamResults() {
    const { currentUser } = useAuth(); // Get current user for gradedBy
    const { id: examId } = useParams();
    const navigate = useNavigate();

    const [exam, setExam] = useState(null);
    const [studentMap, setStudentMap] = useState({}); // Map of ID -> Student Profile
    const [classMap, setClassMap] = useState({}); // Map of classId -> Class data
    const [results, setResults] = useState([]); // Real-time results
    const [sessions, setSessions] = useState([]); // Real-time active sessions
    const [students, setStudents] = useState([]); // Derived view model
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('all'); // 'all' or specific classId
    const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' or specific status
    const [sortBy, setSortBy] = useState('name'); // 'name' | 'class' | 'status' | 'attempts' | 'score'
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

    // Selection state for Master-Detail view
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    // Grading State
    const [gradingResult, setGradingResult] = useState(null); // The result object being graded
    const [manualScores, setManualScores] = useState({}); // { questionId: score }
    const [feedbacks, setFeedbacks] = useState({}); // { questionId: feedbackText }

    // Derived selected student with latest data
    const selectedStudent = selectedStudentId ? students.find(s => s.id === selectedStudentId) : null;

    // 1. Fetch Static Data (Exam & Student Profiles)
    useEffect(() => {
        const fetchBaseData = async () => {
            setLoading(true);
            try {
                // Get Exam
                const examRef = doc(db, 'exams', examId);
                const examSnap = await getDoc(examRef);

                if (!examSnap.exists()) {
                    toast.error("Ujian tidak ditemukan");
                    navigate('/teacher/exams');
                    return;
                }
                const examData = { id: examSnap.id, ...examSnap.data() };
                setExam(examData);

                // Get Students
                const assignedClassIds = examData.assignedClasses || [];
                if (assignedClassIds.length === 0) {
                    setStudentMap({});
                    setClassMap({});
                    setLoading(false);
                    return;
                }

                // Fetch class data to get class names
                const classesQuery = query(
                    collection(db, 'classes'),
                    where('__name__', 'in', assignedClassIds.slice(0, 10))
                );
                const classesSnap = await getDocs(classesQuery);
                const cMap = {};
                classesSnap.docs.forEach(doc => {
                    cMap[doc.id] = { id: doc.id, ...doc.data() };
                });
                setClassMap(cMap);

                const studentsQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'student'),
                    where('classId', 'in', assignedClassIds.slice(0, 10))
                );
                const studentsSnap = await getDocs(studentsQuery);
                const sMap = {};
                studentsSnap.docs.forEach(doc => {
                    sMap[doc.id] = { id: doc.id, ...doc.data() };
                });
                setStudentMap(sMap);

            } catch (error) {
                console.error("Error loading base info:", error);
                toast.error("Failed to load class data");
            }
        };

        fetchBaseData();
    }, [examId]);

    // 2. Listen to Real-time Results AND Sessions
    useEffect(() => {
        const resultsQuery = query(
            collection(db, 'exam_results'),
            where('examId', '==', examId)
        );

        const sessionsQuery = query(
            collection(db, 'exam_sessions'),
            where('examId', '==', examId)
        );

        const unsubResults = onSnapshot(resultsQuery, (snapshot) => {
            const resList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setResults(resList);
            // Don't disable loading here, let initial fetch do it or if we want better UX
            setLoading(false);
        }, (error) => {
            console.error("Error listening to results:", error);
        });

        const unsubSessions = onSnapshot(sessionsQuery, (snapshot) => {
            const sessList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSessions(sessList);
        }, (error) => {
            console.error("Error listening to sessions:", error);
        });

        return () => {
            unsubResults();
            unsubSessions();
        };
    }, [examId]);

    // 3. Merge & Process Data (Derived State)
    useEffect(() => {
        // 1. Process Registered Students
        const processedRegistered = Object.values(studentMap).map(student => {
            // Find results for this student
            const studentResults = results.filter(r => r.studentId === student.id);
            const studentSessions = sessions.filter(s => s.studentId === student.id);

            // Check for active session (in_progress or paused)
            const activeSession = studentSessions.find(s => s.status === 'in_progress' || s.status === 'paused');

            // Sort attempts
            studentResults.sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));

            const latest = studentResults[0];
            const bestScore = studentResults.reduce((max, curr) => Math.max(max, curr.score), 0);

            // BACKFILL: If startedAt is missing in latest attempt, try to find it in sessions
            if (latest && !latest.startedAt && studentSessions.length > 0) {
                // Find session that closely matches or just use the latest session
                // Since this is "latest" attempt, we use the latest session
                const sortedSessions = [...studentSessions].sort((a, b) => (b.startedAt?.toMillis() || 0) - (a.startedAt?.toMillis() || 0));
                if (sortedSessions[0]) {
                    latest.startedAt = sortedSessions[0].startedAt;
                }
            }

            // Status Logic
            let status = 'pending';
            if (activeSession) {
                status = 'in_progress';
            } else if (latest) {
                if (latest.allowRetake) status = 'remedial';
                else if (latest.gradingStatus === 'pending') status = 'grading_pending';
                else status = 'completed';
            }

            return {
                ...student,
                attempts: studentResults,
                latestAttempt: latest,
                bestScore,
                status,
                activeSession,
                isGuest: false
            };
        });

        // 2. Process Guests (Orphaned Results & Sessions)
        const registeredIds = new Set(Object.keys(studentMap));
        const guestMap = {};

        // Collect guests from Results
        results.forEach(res => {
            if (!registeredIds.has(res.studentId)) {
                if (!guestMap[res.studentId]) {
                    guestMap[res.studentId] = {
                        id: res.studentId,
                        name: res.guestName || 'Guest User',
                        email: res.guestClass || 'Guest', // Fallback
                        classId: 'guest',
                        role: 'guest',
                        isGuest: true,
                        guestClass: res.guestClass,
                        guestAbsen: res.guestAbsen,
                        attempts: [],
                        activeSession: null
                    };
                }
                guestMap[res.studentId].attempts.push(res);
            }
        });

        // Collect guests from Active Sessions (if no result yet)
        sessions.forEach(sess => {
            if (!registeredIds.has(sess.studentId)) {
                if (!guestMap[sess.studentId]) {
                    guestMap[sess.studentId] = {
                        id: sess.studentId,
                        name: sess.studentName || 'Guest User',
                        email: 'Taking Exam...',
                        classId: 'guest',
                        role: 'guest',
                        isGuest: true,
                        guestClass: sess.guestClass,
                        guestAbsen: sess.guestAbsen, // Session might not have this unless we add it
                        attempts: [],
                        activeSession: null
                    };
                }
                guestMap[sess.studentId].activeSession = sess;
            }
        });

        const processedGuests = Object.values(guestMap).map(guest => {
            // Find all sessions for this guest (studentId = guestId)
            const guestSessions = sessions.filter(s => s.studentId === guest.id);

            // Find explicit active session
            const activeSession = guestSessions.find(s => s.status === 'in_progress' || s.status === 'paused');
            guest.activeSession = activeSession || null;

            // Sort attempts
            guest.attempts.sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));

            const latest = guest.attempts[0];
            const bestScore = guest.attempts.reduce((max, curr) => Math.max(max, curr.score), 0);

            // BACKFILL: If startedAt is missing in latest attempt, try to find it in sessions
            if (latest && !latest.startedAt && guestSessions.length > 0) {
                const sortedSessions = [...guestSessions].sort((a, b) => (b.startedAt?.toMillis() || 0) - (a.startedAt?.toMillis() || 0));
                if (sortedSessions[0]) {
                    latest.startedAt = sortedSessions[0].startedAt;
                }
            }

            // Status Logic
            let status = 'pending';
            if (guest.activeSession) {
                status = 'in_progress';
            } else if (latest) {
                if (latest.allowRetake) status = 'remedial';
                else if (latest.gradingStatus === 'pending') status = 'grading_pending';
                else status = 'completed';
            }

            return {
                ...guest,
                latestAttempt: latest,
                bestScore,
                status
            };
        });

        const combinedList = [...processedRegistered, ...processedGuests];

        // Sort by Name
        combinedList.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(combinedList);

    }, [results, classMap, sessions, studentMap]);

    // Handle sorting
    const handleSort = (column) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    // State for custom confirmation modal
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, resultId: null });

    const handleAllowRetake = (resultId) => {
        setConfirmModal({ isOpen: true, resultId });
    };

    const confirmRemedialAction = async () => {
        if (!confirmModal.resultId) return;

        try {
            const resultRef = doc(db, 'exam_results', confirmModal.resultId);
            await updateDoc(resultRef, {
                allowRetake: true
            });

            toast.success("Student allowed remedial");
            setConfirmModal({ isOpen: false, resultId: null });
        } catch (error) {
            console.error("Error updating result:", error);
            toast.error("Failed to update status");
        }
    };

    // Reset Modal State
    const [resetModal, setResetModal] = useState({
        isOpen: false,
        type: null,
        targetId: null,
        targetName: null,
        studentIds: null
    });

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState({
        isOpen: false,
        resultId: null,
        resultIds: null, // For batch delete
        studentName: null,
        attemptNumber: null,
        isBatch: false,
        count: 0
    });

    // Batch Delete State
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedResults, setSelectedResults] = useState(new Set());

    const handleResetAll = () => setResetModal({
        isOpen: true, type: 'all', targetId: null, targetName: `semua kelas (${students.length} siswa)`, studentIds: null
    });

    const handleResetClass = (classId, className, classStudents) => setResetModal({
        isOpen: true, type: 'class', targetId: classId, targetName: `kelas ${className} (${classStudents.length} siswa)`, studentIds: classStudents.map(s => s.id)
    });

    const handleResetStudent = (studentId, studentName) => setResetModal({
        isOpen: true, type: 'student', targetId: studentId, targetName: studentName, studentIds: null
    });

    const confirmReset = async () => {
        try {
            let result;
            if (resetModal.type === 'all') {
                result = await resetExamForAllClasses(examId);
                toast.success(`Reset berhasil! ${result.results} hasil ujian dihapus.`);
            } else if (resetModal.type === 'class') {
                result = await resetExamForClass(examId, resetModal.targetId, resetModal.studentIds);
                toast.success(`Reset kelas berhasil! ${result.results} hasil ujian dihapus.`);
            } else if (resetModal.type === 'student') {
                result = await resetExamForStudent(examId, resetModal.targetId);
                toast.success(`Reset siswa berhasil! ${result.results} hasil ujian dihapus.`);
            }
            setResetModal({ isOpen: false, type: null, targetId: null, targetName: null, studentIds: null });
        } catch (error) {
            console.error('Error resetting exam:', error);
            toast.error('Gagal reset ujian');
        }
    };

    // Delete Single Result Handler
    const handleDeleteResult = (resultId, studentName, attemptNum) => {
        setDeleteModal({
            isOpen: true,
            resultId,
            studentName,
            attemptNumber: attemptNum
        });
    };

    const confirmDeleteResult = async () => {
        if (deleteModal.isBatch) {
            // Batch delete
            try {
                const deletePromises = deleteModal.resultIds.map(id =>
                    deleteDoc(doc(db, 'exam_results', id))
                );
                await Promise.all(deletePromises);

                toast.success(`${deleteModal.count} hasil ujian berhasil dihapus`);
                setDeleteModal({ isOpen: false, resultId: null, resultIds: null, studentName: null, attemptNumber: null, isBatch: false, count: 0 });
                setSelectedResults(new Set());
                setIsBatchMode(false);
            } catch (error) {
                console.error('Error batch deleting results:', error);
                toast.error('Gagal menghapus beberapa hasil ujian');
            }
        } else {
            // Single delete
            if (!deleteModal.resultId) return;

            try {
                await deleteDoc(doc(db, 'exam_results', deleteModal.resultId));
                toast.success('Hasil ujian berhasil dihapus');
                setDeleteModal({ isOpen: false, resultId: null, resultIds: null, studentName: null, attemptNumber: null, isBatch: false, count: 0 });
            } catch (error) {
                console.error('Error deleting result:', error);
                toast.error('Gagal menghapus hasil ujian');
            }
        }
    };

    // --- GRADING SYSTEM START ---
    const handleOpenGrading = (result) => {
        setGradingResult(result);
        setManualScores(result.manualScores || {});
        setFeedbacks(result.feedbacks || {});
    };

    const handleSaveGrading = async () => {
        if (!gradingResult) return;

        try {
            // Calculate totals
            let manualTotal = 0;
            Object.values(manualScores).forEach(score => manualTotal += (parseFloat(score) || 0));

            const newTotalScore = (gradingResult.autoGradedScore || 0) + manualTotal;
            const maxScore = gradingResult.maxScore || 100;
            const finalPercentage = (newTotalScore / maxScore) * 100;

            const resultRef = doc(db, 'exam_results', gradingResult.id);
            await updateDoc(resultRef, {
                manualScores,
                feedbacks,
                manualGradedScore: manualTotal,
                totalScore: newTotalScore,
                score: finalPercentage,
                gradingStatus: 'complete',
                gradedAt: serverTimestamp(),
                gradedBy: currentUser.uid
            });

            toast.success("Nilai berhasil disimpan!");
            setGradingResult(null); // Close grading view
        } catch (error) {
            console.error("Error saving grades:", error);
            toast.error("Gagal menyimpan nilai");
        }
    };
    // --- GRADING SYSTEM END ---


    // Filtered and sorted list
    const filteredStudents = useMemo(() => {
        const filtered = students.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesClass = selectedClassId === 'all' || s.classId === selectedClassId;
            const matchesStatus = selectedStatus === 'all' || s.status === selectedStatus;
            return matchesSearch && matchesClass && matchesStatus;
        });

        // Sort
        return filtered.sort((a, b) => {
            let compareA, compareB;

            switch (sortBy) {
                case 'name':
                    compareA = a.name.toLowerCase();
                    compareB = b.name.toLowerCase();
                    break;
                case 'duration':
                    const getDurationMs = (s) => {
                        if (s.latestAttempt?.startedAt && s.latestAttempt?.submittedAt) {
                            return s.latestAttempt.submittedAt.toMillis() - s.latestAttempt.startedAt.toMillis();
                        }
                        return 0;
                    };
                    compareA = getDurationMs(a);
                    compareB = getDurationMs(b);
                    break;
                case 'status':
                    const statusOrder = { 'in_progress': 0, 'grading_pending': 1, 'completed': 2, 'remedial': 3, 'pending': 4 };
                    compareA = statusOrder[a.status] || 999;
                    compareB = statusOrder[b.status] || 999;
                    break;
                case 'attempts':
                    compareA = a.attempts.length;
                    compareB = b.attempts.length;
                    break;
                case 'score':
                    compareA = a.bestScore;
                    compareB = b.bestScore;
                    break;
                default:
                    return 0;
            }

            if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
            if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [students, searchTerm, selectedClassId, selectedStatus, sortBy, sortOrder, classMap]);

    const uniqueClasses = useMemo(() => {
        const classIds = new Set();
        students.forEach(student => {
            if (student.classId) classIds.add(student.classId);
        });
        return Array.from(classIds).map(classId => ({
            id: classId,
            name: classMap[classId]?.name || classId
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [students, classMap]);

    if (loading) return <div className="flex justify-center py-12">Loading...</div>;

    // Detail View Component
    const StudentDetailView = ({ student, onClose }) => {
        const latestScore = student.latestAttempt?.score;
        const bestScore = student.bestScore;

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium bg-white px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 shadow-sm"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Student List
                    </button>

                    {student.attempts.length > 0 && (
                        <button
                            onClick={() => handleResetStudent(student.id, student.name)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors border border-red-200 text-sm"
                        >
                            <Trash2 className="h-4 w-4" />
                            Reset Student Exam
                        </button>
                    )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8 mb-8">
                        {/* Student Profile */}
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-3xl shadow-inner">
                                {student.name[0]}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-1">{student.name}</h2>
                                {student.isGuest ? (
                                    <div className="flex items-center gap-3 mb-3 text-slate-500 font-medium">
                                        <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 text-sm">
                                            <School className="w-3.5 h-3.5" />
                                            {student.guestClass || 'Unknown Class'}
                                        </span>
                                        {student.guestAbsen && (
                                            <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 text-sm">
                                                <Hash className="w-3.5 h-3.5" />
                                                Absen: {student.guestAbsen}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-slate-500 font-medium mb-3">{student.email}</p>
                                )}
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 uppercase tracking-wide">
                                    {student.attempts.length} Attempt{student.attempts.length > 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>

                        {/* Stat Cards */}
                        <div className="flex flex-wrap gap-4 w-full xl:w-auto">
                            {bestScore !== undefined && (
                                <div className="flex-1 xl:flex-none min-w-[160px] bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-100 relative group overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                                    <div className="flex items-center gap-2 mb-1 relative z-10">
                                        <Award className="h-4 w-4 text-emerald-500" />
                                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Highest Score</p>
                                    </div>
                                    <div className="flex items-baseline gap-1 relative z-10">
                                        <span className="text-4xl font-black text-emerald-700">
                                            {Math.round(bestScore)}
                                        </span>
                                        <span className="text-sm font-bold text-emerald-400">/100</span>
                                    </div>
                                </div>
                            )}

                            {latestScore !== undefined && (
                                <div className="flex-1 xl:flex-none min-w-[160px] bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100 relative group overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 relative z-10">Final Score</p>
                                    <div className="flex items-baseline gap-1 relative z-10">
                                        <span className="text-4xl font-black text-blue-700">
                                            {Math.round(latestScore)}
                                        </span>
                                        <span className="text-sm font-bold text-blue-400">/100</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-8">
                        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-slate-400" />
                            Attempt History
                        </h3>

                        {student.attempts.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                    <FileText className="h-8 w-8" />
                                </div>
                                <p className="text-slate-500 font-medium">Student has not taken the exam yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {[...student.attempts]
                                    .sort((a, b) => (a.submittedAt?.seconds || 0) - (b.submittedAt?.seconds || 0))
                                    .map((attempt, idx) => (
                                        <div key={attempt.id} className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-all p-4 group">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 border ${attempt.score >= 70 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                        <span className="text-sm">#{idx + 1}</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                                Attempt {idx + 1}
                                                            </span>
                                                            {attempt.allowRetake ? (
                                                                <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold border border-orange-200 uppercase tracking-wide">
                                                                    Remedial Active
                                                                </span>
                                                            ) : attempt.gradingStatus === 'pending' ? (
                                                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold border border-yellow-200 uppercase tracking-wide flex items-center gap-1">
                                                                    <AlertCircle className="h-3 w-3" /> Needs Grading
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200 uppercase tracking-wide">
                                                                    Completed
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                                                            {attempt.submittedAt?.toDate().toLocaleString('en-US', {
                                                                weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 pl-4 md:pl-0 border-t md:border-t-0 border-slate-50 pt-4 md:pt-0">
                                                    <button
                                                        onClick={() => handleOpenGrading(attempt)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 transition-colors text-sm"
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                        Review
                                                    </button>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteResult(attempt.id, student.name, idx + 1);
                                                        }}
                                                        className="p-2 bg-white border border-red-200 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
                                                        title="Delete this attempt"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>

                                                    {idx === 0 && !attempt.allowRetake && (
                                                        <button
                                                            onClick={() => handleAllowRetake(attempt.id)}
                                                            className="p-2 bg-white border border-slate-200 text-slate-500 rounded-lg hover:text-blue-600 hover:border-blue-300 transition-colors"
                                                            title="Allow Remedial"
                                                        >
                                                            <RefreshCw className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {gradingResult ? (
                <GradingInterface
                    result={gradingResult}
                    exam={exam}
                    studentName={selectedStudent?.name}
                    manualScores={manualScores}
                    setManualScores={setManualScores}
                    feedbacks={feedbacks}
                    setFeedbacks={setFeedbacks}
                    onClose={() => setGradingResult(null)}
                    onSave={handleSaveGrading}
                />
            ) : selectedStudent ? (
                <StudentDetailView student={selectedStudent} onClose={() => setSelectedStudentId(null)} />
            ) : (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/teacher/exams')}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">{exam?.title || 'Exam Results'}</h1>
                            <p className="text-slate-500 text-sm">Manage student results and grading</p>
                        </div>
                    </div>

                    {/* Active Exam Sessions Monitor */}
                    <ActiveExamsMonitor examId={examId} onStudentClick={setSelectedStudentId} />

                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-4 w-full md:w-auto flex-wrap">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search student..."
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <select
                                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-700"
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                            >
                                <option value="all">All Classes</option>
                                {uniqueClasses.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>

                            <select
                                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-700"
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                            >
                                <option value="all">All Status</option>
                                <option value="in_progress">In Progress</option>
                                <option value="grading_pending">Needs Grading</option>
                                <option value="completed">Completed</option>
                                <option value="remedial">Remedial</option>
                                <option value="pending">Not Started</option>
                            </select>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={() => {
                                    setIsBatchMode(!isBatchMode);
                                    setSelectedResults(new Set());
                                }}
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 font-bold rounded-xl transition-colors border text-sm ${isBatchMode
                                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <CheckSquare className="h-4 w-4" />
                                {isBatchMode ? 'Cancel Selection' : 'Batch Delete'}
                            </button>

                            <button
                                onClick={handleResetAll}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors border border-red-200 text-sm"
                            >
                                <Trash2 className="h-4 w-4" />
                                Reset All
                            </button>
                        </div>
                    </div>

                    {/* Students Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-xs uppercase tracking-wider text-slate-500">
                                        {isBatchMode && (
                                            <th className="px-6 py-4 font-bold">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedResults.size === filteredStudents.filter(s => s.latestAttempt).length && selectedResults.size > 0}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            const allIds = new Set(filteredStudents.filter(s => s.latestAttempt).map(s => s.latestAttempt.id));
                                                            setSelectedResults(allIds);
                                                        } else {
                                                            setSelectedResults(new Set());
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </th>
                                        )}
                                        <th className="px-6 py-4 font-bold">No</th>
                                        <th className="px-6 py-4 font-bold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                                            <div className="flex items-center gap-2">
                                                Student Name
                                                {sortBy === 'name' ? (
                                                    sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                                ) : (
                                                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-bold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('duration')}>
                                            <div className="flex items-center gap-2">
                                                Duration
                                                {sortBy === 'duration' ? (
                                                    sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                                ) : (
                                                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-bold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                                            <div className="flex items-center gap-2">
                                                Status
                                                {sortBy === 'status' ? (
                                                    sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                                ) : (
                                                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('attempts')}>
                                            <div className="flex items-center justify-center gap-2">
                                                Attempts
                                                {sortBy === 'attempts' ? (
                                                    sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                                ) : (
                                                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('score')}>
                                            <div className="flex items-center justify-center gap-2">
                                                Highest Score
                                                {sortBy === 'score' ? (
                                                    sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                                ) : (
                                                    <ArrowUpDown className="h-4 w-4 opacity-30" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-bold text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <AnimatePresence>
                                        {filteredStudents.length > 0 ? (
                                            filteredStudents.map((student, idx) => (
                                                <motion.tr
                                                    key={student.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    onClick={() => setSelectedStudentId(student.id)}
                                                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                                                >
                                                    {/* Checkbox */}
                                                    {isBatchMode && (
                                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                            {student.latestAttempt && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedResults.has(student.latestAttempt.id)}
                                                                    onChange={(e) => {
                                                                        const newSelected = new Set(selectedResults);
                                                                        if (e.target.checked) {
                                                                            newSelected.add(student.latestAttempt.id);
                                                                        } else {
                                                                            newSelected.delete(student.latestAttempt.id);
                                                                        }
                                                                        setSelectedResults(newSelected);
                                                                    }}
                                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                />
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* No */}
                                                    <td className="px-6 py-4 text-slate-500 text-sm">{idx + 1}</td>

                                                    {/* Student Name */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                                {student.name[0]}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{student.name}</p>
                                                                    {student.isGuest && (
                                                                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold border border-purple-200 uppercase tracking-wide">
                                                                            GUEST
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-500">{student.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Class */}
                                                    {/* Duration */}
                                                    <td className="px-6 py-4">
                                                        <span className="text-slate-700 text-sm font-medium">
                                                            {(() => {
                                                                if (student.status === 'in_progress') return <span className="text-blue-600 italic">Running...</span>;
                                                                if (student.latestAttempt?.startedAt && student.latestAttempt?.submittedAt) {
                                                                    const start = student.latestAttempt.startedAt.toMillis();
                                                                    const end = student.latestAttempt.submittedAt.toMillis();
                                                                    const diffMs = end - start;
                                                                    const mins = Math.floor(diffMs / 60000);
                                                                    const secs = Math.floor((diffMs % 60000) / 1000);
                                                                    return `${mins}m ${secs}s`;
                                                                }
                                                                return '-';
                                                            })()}
                                                        </span>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="px-6 py-4">
                                                        {student.status === 'in_progress' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                                                                In Progress
                                                            </span>
                                                        )}
                                                        {student.status === 'completed' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                                                                <CheckCircle className="h-3.5 w-3.5" />
                                                                Completed
                                                            </span>
                                                        )}
                                                        {student.status === 'grading_pending' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">
                                                                <AlertCircle className="h-3.5 w-3.5" />
                                                                Needs Grading
                                                            </span>
                                                        )}
                                                        {student.status === 'remedial' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                                                <RefreshCw className="h-3.5 w-3.5" />
                                                                Remedial
                                                            </span>
                                                        )}
                                                        {student.status === 'pending' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                                <Clock className="h-3.5 w-3.5" />
                                                                Not Started
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Attempts */}
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-slate-700 text-sm">{student.attempts.length}</span>
                                                    </td>

                                                    {/* Highest Score */}
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-slate-800 text-sm">
                                                            {student.bestScore > 0 ? Math.round(student.bestScore) : '0'}
                                                        </span>
                                                        <span className="text-slate-400 text-xs ml-0.5">/100</span>
                                                    </td>

                                                    {/* Action */}
                                                    <td className="px-6 py-4 text-center">
                                                        <button className="p-2 hover:bg-blue-100 rounded-lg transition-colors">
                                                            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-20">
                                                    <div className="text-center">
                                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                                                            <Search className="h-8 w-8" />
                                                        </div>
                                                        <p className="text-slate-500 font-bold text-lg">No students found.</p>
                                                        <p className="text-slate-400 text-sm">Try adjusting your search or filters.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
                        >
                            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-4">
                                <AlertCircle className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Izinkan Remedial?</h3>
                            <p className="text-slate-600 mb-6">
                                Siswa akan dapat mengerjakan ujian ini kembali. Nilai sebelumnya akan tetap tersimpan di riwayat.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setConfirmModal({ isOpen: false, resultId: null })}
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={confirmRemedialAction}
                                    className="px-4 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200"
                                >
                                    Ya, Izinkan
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Reset Confirmation Modal */}
            <AnimatePresence>
                {resetModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
                        >
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                                <AlertCircle className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Reset Ujian?</h3>
                            <p className="text-slate-600 mb-2">
                                Anda akan mereset ujian untuk <strong className="text-slate-800">{resetModal.targetName}</strong>.
                            </p>
                            <p className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-100">
                                Perhatian: Semua data nilai dan riwayat pengerjaan akan dihapus permanen!
                            </p>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setResetModal({ isOpen: false, type: null, targetId: null, targetName: null, studentIds: null })}
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={confirmReset}
                                    className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Ya, Hapus Permanen
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal - Consistent with System Style */}
            <AnimatePresence>
                {deleteModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-lg max-w-md w-full shadow-2xl overflow-hidden"
                        >
                            {/* Red Header */}
                            <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Trash2 className="h-5 w-5 text-white" />
                                    <h3 className="text-lg font-bold text-white">
                                        {deleteModal.isBatch
                                            ? `Delete ${deleteModal.count} Exam Result${deleteModal.count > 1 ? 's' : ''}?`
                                            : 'Delete Exam Result?'
                                        }
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setDeleteModal({ isOpen: false, resultId: null, resultIds: null, studentName: null, attemptNumber: null, isBatch: false, count: 0 })}
                                    className="text-white hover:bg-red-700 p-1 rounded transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                {/* WARNING Section */}
                                <div className="mb-4">
                                    <p className="text-red-600 font-bold text-sm mb-2">WARNING:</p>
                                    <p className="text-gray-700 text-sm leading-relaxed mb-2">
                                        {deleteModal.isBatch
                                            ? `You are about to delete ${deleteModal.count} exam result${deleteModal.count > 1 ? 's' : ''} from multiple students.`
                                            : `You are about to delete Attempt ${deleteModal.attemptNumber} from "${deleteModal.studentName}".`
                                        }
                                    </p>
                                    <p className="text-gray-600 text-sm">
                                        All student submissions for {deleteModal.isBatch ? 'these exams' : 'this exam'} will also be permanently deleted.
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="px-6 pb-6 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setDeleteModal({ isOpen: false, resultId: null, resultIds: null, studentName: null, attemptNumber: null, isBatch: false, count: 0 })}
                                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteResult}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors shadow-sm flex items-center gap-2"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Yes, Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Floating Action Bar for Batch Delete */}
            <AnimatePresence>
                {isBatchMode && selectedResults.size > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
                    >
                        <div className="bg-white rounded-full shadow-2xl border border-gray-200 px-6 py-4 flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-blue-600" />
                                <span className="font-semibold text-gray-900">
                                    {selectedResults.size} selected
                                </span>
                            </div>
                            <div className="h-6 w-px bg-gray-300"></div>
                            <button
                                onClick={() => setSelectedResults(new Set())}
                                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => {
                                    setDeleteModal({
                                        isOpen: true,
                                        isBatch: true,
                                        resultIds: Array.from(selectedResults),
                                        count: selectedResults.size,
                                        resultId: null,
                                        studentName: null,
                                        attemptNumber: null
                                    });
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-semibold transition-colors shadow-lg"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Selected
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
