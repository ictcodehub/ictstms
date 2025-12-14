import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Calendar, CheckCircle, XCircle, RefreshCw, FileText, Search, ChevronRight, Award, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { resetExamForAllClasses, resetExamForClass, resetExamForStudent } from '../../utils/examReset';
import ActiveExamsMonitor from './ActiveExamsMonitor';

export default function ExamResults() {
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
    // Store only ID so we can derive the latest data from 'students' list
    const [selectedStudentId, setSelectedStudentId] = useState(null);

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
            // Note: We don't turn off loading here, we wait for results listener
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
            setLoading(false); // Valid to stop loading once we have initial results
        }, (error) => {
            console.error("Error listening to results:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [examId]);

    // 3. Merge & Process Data (Derived State)
    useEffect(() => {
        // Need both base data (students) and results to proceed effectively
        // but even if results are empty, we should show students.
        // studentMap might be empty if still fetching, but that's ok.

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
        type: null, // 'all', 'class', 'student'
        targetId: null, // classId or studentId
        targetName: null, // for display
        studentIds: null // for class reset
    });

    // Reset Handlers
    const handleResetAll = () => {
        setResetModal({
            isOpen: true,
            type: 'all',
            targetId: null,
            targetName: `semua kelas (${students.length} siswa)`,
            studentIds: null
        });
    };

    const handleResetClass = (classId, className, classStudents) => {
        setResetModal({
            isOpen: true,
            type: 'class',
            targetId: classId,
            targetName: `kelas ${className} (${classStudents.length} siswa)`,
            studentIds: classStudents.map(s => s.id)
        });
    };

    const handleResetStudent = (studentId, studentName) => {
        setResetModal({
            isOpen: true,
            type: 'student',
            targetId: studentId,
            targetName: studentName,
            studentIds: null
        });
    };

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


    // Filtered list
    const filteredStudents = students.filter(s => {
        // Search filter
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email.toLowerCase().includes(searchTerm.toLowerCase());

        // Class filter
        const matchesClass = selectedClassId === 'all' || s.classId === selectedClassId;

        return matchesSearch && matchesClass;
    });

    // Get unique classes from students
    const uniqueClasses = useMemo(() => {
        const classIds = new Set();
        students.forEach(student => {
            if (student.classId) {
                classIds.add(student.classId);
            }
        });

        return Array.from(classIds).map(classId => ({
            id: classId,
            name: classMap[classId]?.name || classId
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [students, classMap]);

    if (loading) {
        return <div className="flex justify-center py-12">Loading...</div>;
    }

    // Detail View Component (Inline for simplicity or split)
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

                {/* Reset Student Button */}
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
                                        {attempt.allowRetake && (
                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold border border-orange-200">
                                                Remedial Active
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Calendar className="h-4 w-4" />
                                        {attempt.submittedAt?.toDate().toLocaleString('id-ID')}
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <span className="block text-xs text-slate-400 font-bold uppercase">Nilai</span>
                                        <span className={`text-2xl font-bold ${attempt.score >= 70 ? 'text-green-600' : 'text-red-500'}`}>
                                            {Math.round(attempt.score)}
                                        </span>
                                    </div>

                                    {/* Allow Retake Button - Only for the LATEST attempt if it's not already allowed */}
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
                        ))}
                    </div>
                )}
            </div>

            {/* Custom Confirmation Modal */}
            <AnimatePresence>
                {confirmModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <RefreshCw className="h-8 w-8 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Izinkan Remedial?</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Siswa akan dapat mengerjakan ulang ujian ini. Nilai sebelumnya akan tetap tersimpan sebagai riwayat.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setConfirmModal({ isOpen: false, resultId: null })}
                                        className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={confirmRemedialAction}
                                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                                    >
                                        Ya, Izinkan
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


        </div>
    );

    return (
        <>
            {selectedStudent ? (
                <StudentDetailView student={selectedStudent} onClose={() => setSelectedStudentId(null)} />
            ) : (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4 justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/teacher/exams')}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <ArrowLeft className="h-6 w-6 text-slate-500" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Hasil Ujian: {exam?.title}</h1>
                                <p className="text-slate-500 text-sm">
                                    {exam?.questions?.length || 0} Soal • {exam?.duration} Menit • {students.length} Siswa
                                </p>
                            </div>
                        </div>

                        {/* Reset All Button */}
                        {students.some(s => s.attempts && s.attempts.length > 0) && (
                            <button
                                onClick={handleResetAll}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                            >
                                <Trash2 className="h-4 w-4" />
                                Reset Semua Kelas
                            </button>
                        )}
                    </div>

                    {/* Toolbar */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari siswa..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 focus:bg-white transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3 w-full md:w-auto">
                            {/* Class Filter Dropdown */}
                            <select
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-all font-medium text-slate-700"
                            >
                                <option value="all">Semua Kelas</option>
                                {uniqueClasses.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>

                            {/* Reset Per Class Button - Only show when a class is selected */}
                            {selectedClassId !== 'all' && filteredStudents.some(s => s.attempts && s.attempts.length > 0) && (
                                <button
                                    onClick={() => {
                                        const selectedClass = uniqueClasses.find(c => c.id === selectedClassId);
                                        handleResetClass(
                                            selectedClassId,
                                            selectedClass?.name || selectedClassId,
                                            filteredStudents
                                        );
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 font-bold rounded-xl hover:bg-orange-100 transition-colors border border-orange-200 whitespace-nowrap"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Reset Kelas Ini
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Active Exams Monitor - Only show for published exams */}
                    {exam?.status === 'published' && (
                        <ActiveExamsMonitor examId={examId} />
                    )}

                    {/* Students List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        {filteredStudents.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="h-8 w-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700">Tidak ada siswa ditemukan</h3>
                            </div>
                        ) : (
                            <div className="cursor-default">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Siswa</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Attempt</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status Terakhir</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Nilai Terbaik</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredStudents.map((student) => (
                                            <tr
                                                key={student.id}
                                                onClick={() => setSelectedStudentId(student.id)}
                                                className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm uppercase">
                                                            {student.name[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{student.name}</p>
                                                            <p className="text-xs text-slate-500">{student.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold">
                                                        {student.attempts.length}x
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {student.status === 'completed' && (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                                            <CheckCircle className="h-3 w-3" /> Selesai
                                                        </span>
                                                    )}
                                                    {student.status === 'remedial' && (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full border border-orange-100">
                                                            <RefreshCw className="h-3 w-3" /> Remedial
                                                        </span>
                                                    )}
                                                    {student.status === 'pending' && (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">
                                                            Belum Mengerjakan
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {student.bestScore !== undefined && student.attempts.length > 0 ? (
                                                        <span className={`font-bold ${student.bestScore >= 70 ? 'text-green-600' : 'text-slate-600'}`}>
                                                            {Math.round(student.bestScore)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button className="p-2 bg-white rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm group-hover:border-blue-300">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Reset Confirmation Modal */}
            <AnimatePresence>
                {resetModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trash2 className="h-8 w-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">
                                    Reset Ujian?
                                </h3>
                                <p className="text-slate-600 mb-2">
                                    Anda akan menghapus data ujian untuk:
                                </p>
                                <p className="text-lg font-bold text-red-600 mb-4">
                                    {resetModal.targetName}
                                </p>
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-red-700 font-medium">
                                        ⚠️ Peringatan: Semua hasil ujian dan session akan dihapus permanen.
                                        Siswa dapat mengulang ujian dari awal. Tindakan ini tidak dapat dibatalkan.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setResetModal({ isOpen: false, type: null, targetId: null, targetName: null, studentIds: null })}
                                        className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={confirmReset}
                                        className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                                    >
                                        Ya, Reset
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
