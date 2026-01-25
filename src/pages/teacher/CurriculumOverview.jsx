import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Plus, Trash2, Edit2, ChevronRight, Search, Filter, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CurriculumOverview() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [curriculums, setCurriculums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Form state for creating new CO
    const [newCO, setNewCO] = useState({
        className: '',
        semester: 1,
        year: new Date().getFullYear().toString()
    });

    useEffect(() => {
        if (currentUser) {
            loadCurriculums();
        }
    }, [currentUser]);

    const loadCurriculums = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'curriculumOverviews'),
                where('teacherId', '==', currentUser.uid)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort by year desc, then semester desc
            data.sort((a, b) => {
                if (a.year !== b.year) return b.year.localeCompare(a.year);
                return b.semester - a.semester;
            });
            setCurriculums(data);
        } catch (error) {
            console.error('Error loading curriculums:', error);
            toast.error('Gagal memuat data curriculum');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCO = async () => {
        if (!newCO.className.trim()) {
            toast.error('Nama kelas harus diisi');
            return;
        }

        try {
            const docRef = await addDoc(collection(db, 'curriculumOverviews'), {
                teacherId: currentUser.uid,
                className: newCO.className.trim(),
                semester: newCO.semester,
                year: newCO.year,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                totalME: 0,
                totalHBE: 0,
                blockedWeeks: [],
                entries: []
            });

            toast.success('Curriculum Overview berhasil dibuat!');
            setShowCreateModal(false);
            setNewCO({ className: '', semester: 1, year: new Date().getFullYear().toString() });

            // Navigate to editor
            navigate(`/teacher/curriculum/${docRef.id}`);
        } catch (error) {
            console.error('Error creating CO:', error);
            toast.error('Gagal membuat Curriculum Overview');
        }
    };

    const handleDeleteCO = async (id) => {
        try {
            await deleteDoc(doc(db, 'curriculumOverviews', id));
            toast.success('Curriculum Overview berhasil dihapus');
            setCurriculums(prev => prev.filter(c => c.id !== id));
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting CO:', error);
            toast.error('Gagal menghapus Curriculum Overview');
        }
    };

    const filteredCurriculums = curriculums.filter(c =>
        c.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.year.includes(searchQuery)
    );

    const getSemesterLabel = (semester) => {
        return semester === 1 ? 'Semester 1 (Ganjil)' : 'Semester 2 (Genap)';
    };

    const getEntriesCount = (co) => {
        return co.entries?.length || 0;
    };

    const getBlockedWeeksCount = (co) => {
        return co.blockedWeeks?.length || 0;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                        <CalendarDays className="h-7 w-7 text-indigo-600" />
                        CO Maker
                    </h1>
                    <p className="text-slate-500 mt-1">Kelola Curriculum Overview per Semester</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-semibold"
                >
                    <Plus className="h-5 w-5" />
                    Buat CO Baru
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Cari kelas atau tahun..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                </div>
            ) : filteredCurriculums.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-12 text-center">
                    <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CalendarDays className="h-10 w-10 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                        {searchQuery ? 'Tidak ada hasil' : 'Belum ada Curriculum Overview'}
                    </h3>
                    <p className="text-slate-500 mb-6">
                        {searchQuery ? 'Coba kata kunci lain' : 'Buat CO pertama Anda untuk mulai merencanakan kurikulum'}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold"
                        >
                            <Plus className="h-5 w-5 inline mr-2" />
                            Buat CO Pertama
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredCurriculums.map((co, index) => (
                        <motion.div
                            key={co.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 hover:shadow-xl transition-all group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                                        <BookOpen className="h-7 w-7 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">{co.className}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                                                {getSemesterLabel(co.semester)}
                                            </span>
                                            <span className="text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                                {co.year}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {/* Stats */}
                                    <div className="hidden md:flex items-center gap-6 text-sm">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-indigo-600">{getEntriesCount(co)}</p>
                                            <p className="text-slate-500">Pertemuan</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-orange-500">{getBlockedWeeksCount(co)}</p>
                                            <p className="text-slate-500">Minggu Blok</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setDeleteConfirm(co.id)}
                                            className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all"
                                            title="Hapus"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={() => navigate(`/teacher/curriculum/${co.id}`)}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all font-medium"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                            Edit
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCreateModal(false)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
                        >
                            <h2 className="text-xl font-bold text-slate-800 mb-4">Buat Curriculum Overview Baru</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Kelas</label>
                                    <input
                                        type="text"
                                        placeholder="Contoh: KELAS 7"
                                        value={newCO.className}
                                        onChange={(e) => setNewCO({ ...newCO, className: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Semester</label>
                                    <select
                                        value={newCO.semester}
                                        onChange={(e) => setNewCO({ ...newCO, semester: parseInt(e.target.value) })}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    >
                                        <option value={1}>Semester 1 (Ganjil)</option>
                                        <option value={2}>Semester 2 (Genap)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tahun</label>
                                    <input
                                        type="text"
                                        placeholder="2025"
                                        value={newCO.year}
                                        onChange={(e) => setNewCO({ ...newCO, year: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleCreateCO}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-medium"
                                >
                                    Buat CO
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDeleteConfirm(null)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center"
                        >
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="h-8 w-8 text-red-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Hapus Curriculum?</h3>
                            <p className="text-slate-500 mb-6">Semua data pertemuan dan jadwal akan ikut terhapus.</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => handleDeleteCO(deleteConfirm)}
                                    className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-medium"
                                >
                                    Hapus
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
