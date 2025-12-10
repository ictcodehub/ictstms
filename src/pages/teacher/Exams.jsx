import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, deleteDoc, doc, query, where, onSnapshot } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
    Plus,
    Search,
    Filter,
    ClipboardCheck,
    Clock,
    Edit2,
    Trash2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Exams() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        const q = query(
            collection(db, 'exams'),
            where('createdBy', '==', currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedExams = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort manually
            loadedExams.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

            setExams(loadedExams);
            setLoading(false);
        }, (error) => {
            console.error("Error loading exams:", error);
            toast.error("Failed to load exam list");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleDelete = async (examId) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus ujian ini? Data yang sudah dihapus tidak dapat dikembalikan.")) return;

        try {
            await deleteDoc(doc(db, 'exams', examId));
            setExams(prev => prev.filter(e => e.id !== examId));
            toast.success("Exam deleted successfully");
        } catch (error) {
            console.error("Error deleting exam:", error);
            toast.error("Failed to delete exam");
        }
    };

    const filteredExams = exams.filter(exam => {
        const matchesSearch = exam.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'all' || exam.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                        Exam Management
                    </h1>
                    <p className="text-slate-500 mt-1">Create and manage CBT exams for students</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/teacher/exams/create')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all"
                >
                    <Plus className="h-5 w-5" />
                    Buat Ujian Baru
                </motion.button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari judul ujian..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>
                <div className="relative w-full md:w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer bg-white"
                    >
                        <option value="all">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                    </select>
                </div>
            </div>

            {/* Content using Grid */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : filteredExams.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ClipboardCheck className="h-10 w-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Belum ada ujian</h3>
                    <p className="text-slate-500 mb-6">Mulai buat ujian pertama Anda sekarang.</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                    {/* TABLE HEADER */}
                    <div className="flex items-center justify-between py-4 px-6 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-3 flex-1">
                            <span className="w-6 text-center text-[13px] font-bold text-slate-500 uppercase tracking-wider">No</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Detail Ujian</span>
                        </div>
                        <div className="flex items-center gap-8 pl-4">
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[90px] text-center">Durasi</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[130px] text-center">Tanggal</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Status</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[80px] text-center">Soal</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Aksi</span>
                        </div>
                    </div>

                    {/* TABLE BODY */}
                    <div className="divide-y divide-slate-100">
                        {filteredExams.map((exam, index) => (
                            <motion.div
                                key={exam.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                onClick={() => navigate(`/teacher/exams/results/${exam.id}`)}
                                className={`flex items-center justify-between py-4 px-6 transition-colors cursor-pointer ${exam.status === 'published' ? 'bg-emerald-50/30 hover:bg-emerald-50/50' : 'bg-white hover:bg-slate-50'
                                    }`}
                            >
                                {/* Left Section: Number + Details */}
                                <div className="flex items-center gap-3 flex-1">
                                    <span className="w-6 text-center text-sm font-bold text-slate-400">
                                        {index + 1}
                                    </span>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-slate-800 mb-0.5">
                                            {exam.title}
                                        </h3>
                                        <p className="text-sm text-slate-500 line-clamp-1">
                                            {exam.description || 'No description'}
                                        </p>
                                    </div>
                                </div>

                                {/* Right Section: Info Columns */}
                                <div className="flex items-center gap-8 pl-4">
                                    {/* Duration */}
                                    <div className="min-w-[90px] text-center">
                                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600">
                                            <Clock className="h-4 w-4" />
                                            {exam.duration} m
                                        </span>
                                    </div>

                                    {/* Date */}
                                    <div className="min-w-[130px] text-center">
                                        <span className="text-sm font-medium text-slate-600">
                                            {exam.createdAt
                                                ? new Date(exam.createdAt.toDate()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : '-'
                                            }
                                        </span>
                                    </div>

                                    {/* Status */}
                                    <div className="min-w-[100px] flex justify-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${exam.status === 'published'
                                            ? 'bg-green-50 text-green-600 border-green-200'
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                            {exam.status === 'published' ? 'Published' : 'Draft'}
                                        </span>
                                    </div>

                                    {/* Questions Count */}
                                    <div className="min-w-[80px] text-center">
                                        <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-600">
                                            <ClipboardCheck className="h-4 w-4" />
                                            {exam.questions?.length || 0}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="min-w-[100px] flex justify-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/teacher/exams/edit/${exam.id}`);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                            title="Edit"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(exam.id);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
