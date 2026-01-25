import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Plus, Trash2, Edit2, ChevronRight, Search, Filter, BookOpen, Copy, FileSpreadsheet, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { exportCurriculumToExcel } from '../../utils/excelExport';

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

    const handleDuplicateCO = async (e, co) => {
        e.stopPropagation();
        const toastId = toast.loading('Menduplikasi curriculum...');
        try {
            // Get full data first to ensure we have entries
            const coRef = doc(db, 'curriculumOverviews', co.id);
            const coSnap = await getDoc(coRef);

            if (!coSnap.exists()) {
                throw new Error('Data tidak ditemukan');
            }

            const data = coSnap.data();

            const newDoc = {
                ...data,
                className: `${data.className} (Copy)`,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                // Keep entries and configuration
            };

            const docRef = await addDoc(collection(db, 'curriculumOverviews'), newDoc);

            toast.success('Curriculum berhasil diduplikasi!', { id: toastId });
            loadCurriculums(); // Reload list
        } catch (error) {
            console.error('Error duplicating CO:', error);
            toast.error('Gagal menduplikasi curriculum', { id: toastId });
        }
    };

    const handleExportExcel = async (e, co) => {
        e.stopPropagation();
        const toastId = toast.loading('Mengexport ke Excel...');
        try {
            const coRef = doc(db, 'curriculumOverviews', co.id);
            const coSnap = await getDoc(coRef);

            if (!coSnap.exists()) {
                throw new Error('Data tidak ditemukan');
            }

            const fullData = coSnap.data();

            // Use helper to generate full spreadsheet Excel
            await exportCurriculumToExcel(fullData);

            toast.success('Export Excel berhasil!', { id: toastId });
        } catch (error) {
            console.error('Error exporting excel:', error);
            toast.error('Gagal export ke Excel', { id: toastId });
        }
    };

    const [selectedAcademicYear, setSelectedAcademicYear] = useState('All');

    const getAcademicYear = (co) => {
        // If year is already in format like "2024 / 2025", just use it
        if (co.year.toString().includes('/')) return co.year;

        return co.semester === 2
            ? `${parseInt(co.year) - 1} / ${co.year}`
            : `${co.year} / ${parseInt(co.year) + 1}`;
    };

    const uniqueAcademicYears = [...new Set(curriculums.map(getAcademicYear))].sort().reverse();

    const filteredCurriculums = curriculums.filter(c => {
        const matchesSearch = c.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.year.includes(searchQuery);

        const academicYear = getAcademicYear(c);
        const matchesYear = selectedAcademicYear === 'All' || academicYear === selectedAcademicYear;

        return matchesSearch && matchesYear;
    });

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
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all font-semibold"
                >
                    <Plus className="h-5 w-5" />
                    Buat CO Baru
                </motion.button>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari kelas atau tahun..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>

                {/* Academic Year Filter */}
                <div className="relative">
                    <select
                        value={selectedAcademicYear}
                        onChange={(e) => setSelectedAcademicYear(e.target.value)}
                        className="appearance-none pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium text-slate-700 cursor-pointer hover:bg-slate-50 min-w-[160px]"
                    >
                        <option value="All">Semua Tahun</option>
                        {uniqueAcademicYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                </div>
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
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-0 p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <div className="col-span-1 text-center">No</div>
                            <div className="col-span-3">Kelas</div>
                            <div className="col-span-2 text-center">Semester</div>
                            <div className="col-span-1 text-center">Tahun</div>
                            <div className="col-span-2 text-right">Last Update</div>
                            <div className="col-span-3 flex justify-center pl-[82px]">Aksi</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-slate-100">
                            {filteredCurriculums.map((co, index) => (
                                <motion.div
                                    key={co.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => navigate(`/teacher/curriculum/${co.id}`)}
                                    className="grid grid-cols-12 gap-0 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                                >
                                    {/* No */}
                                    <div className="col-span-1 text-center font-medium text-slate-400">
                                        {index + 1}
                                    </div>

                                    {/* Class Name */}
                                    <div className="col-span-3">
                                        <h3 className="text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{co.className}</h3>
                                    </div>

                                    {/* Semester */}
                                    <div className="col-span-2 text-center">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border inline-block ${co.semester === 1
                                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                                            : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                            }`}>
                                            {getSemesterLabel(co.semester)}
                                        </span>
                                    </div>

                                    {/* Year */}
                                    <div className="col-span-1 text-center">
                                        <span className="text-xs font-bold text-slate-600">
                                            {getAcademicYear(co)}
                                        </span>
                                    </div>





                                    {/* Last Update */}
                                    <div className="col-span-2 text-right">
                                        <span className="text-xs font-semibold text-slate-600">
                                            {co.updatedAt?.seconds
                                                ? new Date(co.updatedAt.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                                : '-'}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-3 flex items-center justify-end gap-2">
                                        <button
                                            onClick={(e) => handleDuplicateCO(e, co)}
                                            className="p-2.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all hover:scale-110"
                                            title="Duplikat"
                                        >
                                            <Copy className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={(e) => handleExportExcel(e, co)}
                                            className="p-2.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-xl transition-all hover:scale-110"
                                            title="Export Excel"
                                        >
                                            <FileSpreadsheet className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); navigate(`/teacher/curriculum/${co.id}/print`); }}
                                            className="p-2.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-xl transition-all hover:scale-110"
                                            title="Cetak PDF"
                                        >
                                            <Printer className="h-5 w-5" />
                                        </button>
                                        <div className="w-px h-6 bg-slate-200 mx-2"></div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); navigate(`/teacher/curriculum/${co.id}`); }}
                                            className="p-2.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all hover:scale-110"
                                            title="Edit"
                                        >
                                            <Edit2 className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(co.id); }}
                                            className="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all hover:scale-110"
                                            title="Hapus"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
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
