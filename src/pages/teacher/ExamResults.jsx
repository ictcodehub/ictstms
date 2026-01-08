import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Calendar, CheckCircle, XCircle, RefreshCw, FileText, Search, ChevronRight, Award, Trash2, Edit3, Save, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext'; // Added useAuth
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
                        Simpan Nilai
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="max-w-4xl mx-auto space-y-6">
                    {gradedQuestions.map((q, idx) => {
                        const isManual = q.type === 'essay' || q.type === 'short_answer';

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
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Jawaban Siswa</p>
                                        <div className={`p-4 rounded-xl border-2 ${isManual ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                                            {q.type === 'essay' || q.type === 'short_answer' ? (
                                                <p className="whitespace-pre-wrap text-slate-800 font-medium font-serif leading-relaxed">
                                                    {q.answer || <span className="text-slate-400 italic">Tidak ada jawaban</span>}
                                                </p>
                                            ) : (
                                                <div className="text-slate-800 font-medium">
                                                    {/* Helper logic inline for readability or extracted */}
                                                    {(() => {
                                                        if (!q.answer) return <span className="text-slate-400 italic">Tidak ada jawaban</span>;

                                                        if (q.type === 'single_choice' || q.type === 'true_false') {
                                                            const opt = q.options?.find(o => o.id === q.answer);
                                                            return opt ? opt.text : <span className="text-red-400 text-xs">ID: {q.answer} (Option not found)</span>;
                                                        }

                                                        if (q.type === 'multiple_choice') {
                                                            const answers = Array.isArray(q.answer) ? q.answer : [];
                                                            if (answers.length === 0) return <span className="text-slate-400 italic">Tidak ada jawaban</span>;

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
                                                                                    {studentAnswer || "Tidak dijawab"}
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

                                        {/* Expected Answer for Teacher */}
                                        {isManual && (
                                            <div className="mt-4">
                                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Kunci / Referensi Jawaban</p>
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
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Berikan Nilai (0 - {q.points || 10})</label>
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
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Feedback Guru</label>
                                                    <textarea
                                                        className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[100px]"
                                                        placeholder="Tulis masukan untuk siswa..."
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
                                                <p className="text-sm text-slate-500">Nilai otomatis oleh sistem</p>
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
    const [students, setStudents] = useState([]); // Derived view model
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('all'); // 'all' or specific classId

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

    // 2. Listen to Real-time Results
    useEffect(() => {
        const resultsQuery = query(
            collection(db, 'exam_results'),
            where('examId', '==', examId)
        );

        const unsubscribe = onSnapshot(resultsQuery, (snapshot) => {
            const resList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setResults(resList);
            setLoading(false);
        }, (error) => {
            console.error("Error listening to results:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [examId]);

    // 3. Merge & Process Data (Derived State)
    useEffect(() => {
        const processedList = Object.values(studentMap).map(student => {
            // Find results for this student
            const studentResults = results.filter(r => r.studentId === student.id);

            // Sort attempts
            studentResults.sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));

            const latest = studentResults[0];
            const bestScore = studentResults.reduce((max, curr) => Math.max(max, curr.score), 0);

            // Status Logic
            let status = 'pending';
            if (latest) {
                if (latest.allowRetake) status = 'remedial';
                else if (latest.gradingStatus === 'pending') status = 'grading_pending';
                else status = 'completed';
            }

            return {
                ...student,
                attempts: studentResults,
                latestAttempt: latest,
                bestScore,
                status
            };
        });

        // Sort by Name
        processedList.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(processedList);

    }, [studentMap, results]);

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


    // Filtered list
    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = selectedClassId === 'all' || s.classId === selectedClassId;
        return matchesSearch && matchesClass;
    });

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
    const StudentDetailView = ({ student, onClose }) => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Kembali ke Daftar Siswa
                </button>

                {student.attempts.length > 0 && (
                    <button
                        onClick={() => handleResetStudent(student.id, student.name)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                    >
                        <Trash2 className="h-4 w-4" />
                        Reset Ujian Siswa Ini
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-3xl">
                        {student.name[0]}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{student.name}</h2>
                        <p className="text-slate-500">{student.email}</p>
                        <div className="flex gap-2 mt-2">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold border border-slate-200">
                                {student.attempts.length} Attempt
                            </span>
                            {student.bestScore !== undefined && (
                                <span className="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-200">
                                    Tertinggi: {Math.round(student.bestScore)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">Riwayat Pengerjaan</h3>

                {student.attempts.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-500">Siswa ini belum mengerjakan ujian.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {student.attempts.map((attempt, idx) => (
                            <div key={attempt.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-700">Attempt {student.attempts.length - idx}</span>
                                        {attempt.allowRetake ? (
                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold border border-orange-200">
                                                Remedial Active
                                            </span>
                                        ) : attempt.gradingStatus === 'pending' ? (
                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold border border-yellow-200 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" /> Butuh Penilaian
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">
                                                Selesai
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Calendar className="h-4 w-4" />
                                        {attempt.submittedAt?.toDate().toLocaleString('id-ID')}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <span className="block text-xs text-slate-400 font-bold uppercase">Nilai</span>
                                        <span className={`text-2xl font-bold ${attempt.score >= 70 ? 'text-green-600' : 'text-slate-800'}`}>
                                            {typeof attempt.score === 'number' ? Math.round(attempt.score) : '-'}
                                        </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleOpenGrading(attempt)}
                                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                            title="Buka Penilaian"
                                        >
                                            <Edit3 className="h-5 w-5" />
                                        </button>

                                        {idx === 0 && !attempt.allowRetake && (
                                            <button
                                                onClick={() => handleAllowRetake(attempt.id)}
                                                className="px-4 py-2 bg-white border border-slate-200 text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors shadow-sm text-sm"
                                            >
                                                Izinkan Remedial
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
    );

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

                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cari siswa..."
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <select
                                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                            >
                                <option value="all">Semua Kelas</option>
                                {uniqueClasses.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={handleResetAll}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                            >
                                <Trash2 className="h-4 w-4" />
                                Reset Semua
                            </button>
                        </div>
                    </div>

                    {/* Students Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence>
                            {filteredStudents.map(student => (
                                <motion.div
                                    key={student.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    onClick={() => setSelectedStudentId(student.id)}
                                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg group-hover:scale-110 transition-transform">
                                            {student.name[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 truncate">{student.name}</h3>
                                            <p className="text-sm text-slate-500 truncate">{classMap[student.classId]?.name || 'Unknown Class'}</p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </div>

                                    <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-400 font-bold uppercase">Status</span>
                                            {student.status === 'completed' && (
                                                <span className="text-green-600 text-sm font-bold flex items-center gap-1">
                                                    <CheckCircle className="h-4 w-4" /> Selesai
                                                </span>
                                            )}
                                            {student.status === 'grading_pending' && (
                                                <span className="text-yellow-600 text-sm font-bold flex items-center gap-1">
                                                    <AlertCircle className="h-4 w-4" /> Butuh Nilai
                                                </span>
                                            )}
                                            {student.status === 'remedial' && (
                                                <span className="text-orange-600 text-sm font-bold flex items-center gap-1">
                                                    <RefreshCw className="h-4 w-4" /> Remedial
                                                </span>
                                            )}
                                            {student.status === 'pending' && (
                                                <span className="text-slate-400 text-sm font-bold flex items-center gap-1">
                                                    <minus className="h-4 w-4" /> Belum
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-right">
                                            <span className="text-xs text-slate-400 font-bold uppercase">Highest</span>
                                            <span className="block text-xl font-bold text-slate-800">
                                                {student.bestScore !== undefined ? Math.round(student.bestScore) : '-'}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {filteredStudents.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            Tidak ada siswa ditemukan
                        </div>
                    )}
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
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Izinkan Remedial?</h3>
                            <p className="text-slate-600 mb-6">Siswa akan dapat mengerjakan ulang ujian ini. Nilai sebelumnya akan tetap tersimpan dalam riwayat.</p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setConfirmModal({ isOpen: false, resultId: null })}
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={confirmRemedialAction}
                                    className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Ya, Izinkan
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


            {/* Reset Modal */}
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
        </>
    );
}
