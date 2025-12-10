import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Calendar, CheckCircle, XCircle, RefreshCw, FileText, Search, ChevronRight, Award } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ExamResults() {
    const { id: examId } = useParams();
    const navigate = useNavigate();

    const [exam, setExam] = useState(null);
    const [students, setStudents] = useState([]); // List of students with their best/latest result attached
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Selection state for Master-Detail view
    const [selectedStudent, setSelectedStudent] = useState(null);

    useEffect(() => {
        loadData();
    }, [examId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Get Exam Details
            const examRef = doc(db, 'exams', examId);
            const examSnap = await getDoc(examRef);

            if (!examSnap.exists()) {
                toast.error("Ujian tidak ditemukan");
                navigate('/teacher/exams');
                return;
            }
            const examData = { id: examSnap.id, ...examSnap.data() };
            setExam(examData);

            // 2. Get Students assigned to this exam
            // Exam has 'assignedClasses' array.
            const assignedClassIds = examData.assignedClasses || [];
            if (assignedClassIds.length === 0) {
                setStudents([]);
                setLoading(false);
                return;
            }

            // Fetch students in these classes
            // Note: If many classes, might need batching. Assuming small scale for now.
            const studentsQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('classId', 'in', assignedClassIds.slice(0, 10)) // Limit to 10 classes for 'in' query safety
            );
            const studentsSnap = await getDocs(studentsQuery);
            const studentMap = {};
            studentsSnap.docs.forEach(doc => {
                studentMap[doc.id] = { id: doc.id, ...doc.data(), attempts: [] };
            });

            // 3. Get All Results for this exam
            const resultsQuery = query(
                collection(db, 'exam_results'),
                where('examId', '==', examId)
            );
            const resultsSnap = await getDocs(resultsQuery);

            // Attach results to students
            resultsSnap.docs.forEach(doc => {
                const res = { id: doc.id, ...doc.data() };
                if (studentMap[res.studentId]) {
                    studentMap[res.studentId].attempts.push(res);
                }
            });

            // Flatten to array and process stats per student
            const studentList = Object.values(studentMap).map(s => {
                // Sort attempts by date descending
                s.attempts.sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));

                // Latest attempt
                const latest = s.attempts[0];
                const bestScore = s.attempts.reduce((max, curr) => Math.max(max, curr.score), 0);

                return {
                    ...s,
                    latestAttempt: latest,
                    bestScore,
                    status: latest ? (latest.allowRetake ? 'remedial' : 'completed') : 'pending' // pending, completed, remedial
                };
            });

            // Sort by Name
            studentList.sort((a, b) => a.name.localeCompare(b.name));
            setStudents(studentList);

        } catch (error) {
            console.error("Error loading info:", error);
            toast.error("Gagal memuat data nilai");
        } finally {
            setLoading(false);
        }
    };

    const handleAllowRetake = async (resultId, studentId) => {
        if (!window.confirm("Izinkan siswa ini mengerjakan ulang ujian? Nilai sebelumnya akan tetap tersimpan.")) return;

        try {
            const resultRef = doc(db, 'exam_results', resultId);
            await updateDoc(resultRef, {
                allowRetake: true
            });

            // Update local state
            setStudents(prev => prev.map(s => {
                if (s.id === studentId) {
                    const newAttempts = s.attempts.map(a =>
                        a.id === resultId ? { ...a, allowRetake: true } : a
                    );
                    return {
                        ...s,
                        attempts: newAttempts,
                        latestAttempt: { ...s.latestAttempt, allowRetake: true },
                        status: 'remedial'
                    };
                }
                return s;
            }));

            // Also update selectedStudent if active
            if (selectedStudent && selectedStudent.id === studentId) {
                setSelectedStudent(prev => ({
                    ...prev,
                    status: 'remedial',
                    attempts: prev.attempts.map(a =>
                        a.id === resultId ? { ...a, allowRetake: true } : a
                    )
                }));
            }

            toast.success("Siswa diizinkan remedial");
        } catch (error) {
            console.error("Error updating result:", error);
            toast.error("Gagal mengupdate status");
        }
    };

    // Filtered list
    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <div className="flex justify-center py-12">Loading...</div>;
    }

    // Detail View Component (Inline for simplicity or split)
    const StudentDetailView = ({ student, onClose }) => (
        <div className="space-y-6">
            <button
                onClick={onClose}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium mb-4"
            >
                <ArrowLeft className="h-5 w-5" />
                Kembali ke Daftar Siswa
            </button>

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
                                {student.attempts.length} Percobaan
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
                                        <span className="font-bold text-slate-700">Percobaan {student.attempts.length - idx}</span>
                                        {attempt.allowRetake && (
                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold border border-orange-200">
                                                Remedial Aktif
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
                                            onClick={() => handleAllowRetake(attempt.id, student.id)}
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
        </div>
    );

    if (selectedStudent) {
        return <StudentDetailView student={selectedStudent} onClose={() => setSelectedStudent(null)} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
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

                {/* Legenda/Filter could go here */}
            </div>

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
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Percobaan</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status Terakhir</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Nilai Terbaik</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStudents.map((student) => (
                                    <tr
                                        key={student.id}
                                        onClick={() => setSelectedStudent(student)}
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
    );
}
