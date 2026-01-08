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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [examToDelete, setExamToDelete] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const examsPerPage = 10;

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

    const handleDeleteClick = (exam) => {
        setExamToDelete(exam);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!examToDelete) return;

        try {
            await deleteDoc(doc(db, 'exams', examToDelete.id));
            setExams(prev => prev.filter(e => e.id !== examToDelete.id));
            toast.success("Exam deleted successfully");
            setShowDeleteModal(false);
            setExamToDelete(null);
        } catch (error) {
            console.error("Error deleting exam:", error);
            toast.error("Failed to delete exam");
            setShowDeleteModal(false);
            setExamToDelete(null);
        }
    };

    const filteredExams = exams.filter(exam => {
        const matchesSearch = exam.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'all' || exam.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    // Pagination logic
    const totalPages = Math.ceil(filteredExams.length / examsPerPage);
    const startIndex = (currentPage - 1) * examsPerPage;
    const endIndex = startIndex + examsPerPage;
    const displayExams = filteredExams.slice(startIndex, endIndex);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterStatus]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
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
                        <div className="flex items-center gap-6 flex-1">
                            <span className="w-6 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">No</span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detail Ujian</span>
                        </div>
                        <div className="flex items-center gap-8 pl-4">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[90px] text-center">Durasi</span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Status</span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[80px] text-center">Soal</span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Aksi</span>
                        </div>
                    </div>

                    {/* TABLE BODY */}
                    <div className="divide-y divide-slate-100">
                        {displayExams.map((exam, index) => (
                            <motion.div
                                key={exam.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                onClick={() => navigate(`/teacher/exams/results/${exam.id}`)}
                                className={`group flex items-center justify-between py-4 px-6 transition-colors cursor-pointer ${exam.status === 'published' ? 'bg-emerald-50/30 hover:bg-emerald-50/50' : 'bg-white hover:bg-slate-50'
                                    }`}
                            >
                                {/* Left Section: Number + Details */}
                                <div className="flex items-center gap-6 flex-1">
                                    <span className="w-6 text-center text-sm text-slate-500 font-medium">
                                        {startIndex + index + 1}
                                    </span>
                                    <div className="max-w-md">
                                        <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-1 truncate">
                                            {exam.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 line-clamp-1 mb-2">
                                            {exam.description || 'No description'}
                                        </p>
                                        <p className="text-[10px] text-blue-600 font-medium">
                                            Diberikan: {exam.createdAt
                                                ? new Date(exam.createdAt.toDate()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                                : '-'}
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
                                            className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-all"
                                            title="Edit"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(exam);
                                            }}
                                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all"
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
                </div>
    )
}

{/* Pagination */ }
{
    !loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white rounded-xl border border-slate-200">
            <div className="text-sm text-slate-600">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredExams.length)} of {filteredExams.length} exams
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                    Previous
                </button>
                <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                            pageNum = i + 1;
                        } else if (currentPage <= 3) {
                            pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                        } else {
                            pageNum = currentPage - 2 + i;
                        }

                        return (
                            <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-9 h-9 rounded-lg transition-all font-medium text-sm ${currentPage === pageNum
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                    Next
                </button>
            </div>
        </div>
    )
}

{/* Delete Confirmation Modal */ }
{
    showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <Trash2 className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Delete Exam</h3>
                        <p className="text-sm text-gray-500">This action cannot be undone</p>
                    </div>
                </div>

                <p className="text-gray-700 mb-6">
                    Are you sure you want to delete <span className="font-semibold">"{examToDelete?.title}"</span>?
                    All exam data and student results will be permanently removed.
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setShowDeleteModal(false);
                            setExamToDelete(null);
                        }}
                        className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={confirmDelete}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
        </div >
    );
}
