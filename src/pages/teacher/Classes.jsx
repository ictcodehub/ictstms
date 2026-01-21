import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, Users as UsersIcon, Edit2, BookOpen, TrendingUp, Award, GraduationCap, BarChart3, Calendar, MapPin, Star, Users, Search, ArrowUpDown, UserPlus } from 'lucide-react';
import ClassDetail from './ClassDetail';
import { useAuth } from '../../contexts/AuthContext';
import { sortClasses } from '../../utils/classSort';
import toast from 'react-hot-toast';

export default function Classes() {
    const { currentUser } = useAuth();
    const location = useLocation();
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [formData, setFormData] = useState({ name: '', subject: '' });
    const [classStats, setClassStats] = useState({});
    const [hoveredCard, setHoveredCard] = useState(null);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [classToDelete, setClassToDelete] = useState(null);

    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('a-z'); // newest, oldest, a-z, z-a

    useEffect(() => {
        if (currentUser) {
            loadClasses();
        }
    }, [currentUser]);

    const loadClasses = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'classes'),
                where('createdBy', '==', currentUser.uid)
            );
            const snapshot = await getDocs(q);
            const classesList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setClasses(classesList);

            // Load stats for each class
            const stats = {};
            for (const cls of classesList) {
                // Count students
                // Count students (Support both legacy classId and new classIds)
                const studentsLegacyQuery = query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', cls.id));
                const studentsModernQuery = query(collection(db, 'users'), where('role', '==', 'student'), where('classIds', 'array-contains', cls.id));

                const [studentsLegacySnap, studentsModernSnap] = await Promise.all([
                    getDocs(studentsLegacyQuery),
                    getDocs(studentsModernQuery)
                ]);

                // Merge unique students
                const uniqueStudentIds = new Set();
                const studentsDocs = [];

                [...studentsLegacySnap.docs, ...studentsModernSnap.docs].forEach(doc => {
                    if (!uniqueStudentIds.has(doc.id)) {
                        uniqueStudentIds.add(doc.id);
                        studentsDocs.push(doc);
                    }
                });

                // Count tasks - only tasks created by current teacher
                const tasksSnap = await getDocs(
                    query(
                        collection(db, 'tasks'),
                        where('assignedClasses', 'array-contains', cls.id),
                        where('createdBy', '==', currentUser.uid)
                    )
                );

                // Calculate average grade for this class
                const submissions = await getDocs(
                    query(collection(db, 'submissions'))
                );

                let totalGrade = 0;
                let gradedCount = 0;

                submissions.forEach(subDoc => {
                    const sub = subDoc.data();
                    if (sub.grade !== null && sub.grade !== undefined) {
                        // Check if student is in this class
                        studentsDocs.forEach(studentDoc => {
                            if (studentDoc.data().uid === sub.studentId) {
                                totalGrade += sub.grade;
                                gradedCount++;
                            }
                        });
                    }
                });

                stats[cls.id] = {
                    studentCount: uniqueStudentIds.size,
                    taskCount: tasksSnap.size,
                    avgGrade: gradedCount > 0 ? (totalGrade / gradedCount).toFixed(1) : 0
                };
            }
            setClassStats(stats);
        } catch (error) {
            console.error('Error loading classes:', error);
        } finally {
            setLoading(false);
        }
    };

    // Auto-select first class from sorted list
    useEffect(() => {
        if (classes.length > 0 && !selectedClass) {
            // Apply default sorting to get the first class
            const sorted = sortClasses(classes);
            setSelectedClass(sorted[0]);
        }
    }, [classes]);

    // Auto-select class from navigation state (from new student activity)
    useEffect(() => {
        if (location.state?.selectedClassId && classes.length > 0) {
            const cls = classes.find(c => c.id === location.state.selectedClassId);
            if (cls) {
                setSelectedClass(cls);
                // Clear the state to prevent re-selecting on subsequent renders
                window.history.replaceState({}, document.title);
            }
        }
    }, [location.state, classes]);

    // Reset view when clicking "Classes" in sidebar
    useEffect(() => {
        if (!location.state?.selectedClassId) {
            setSelectedClass(null);
        }
    }, [location]);

    const handleOpenModal = (cls = null) => {
        if (cls) {
            setEditingClass(cls);
            setFormData({ name: cls.name, subject: cls.subject || '' });
        } else {
            setEditingClass(null);
            setFormData({ name: '', subject: '' });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.subject.trim()) return;

        setLoading(true);
        try {
            if (editingClass) {
                await updateDoc(doc(db, 'classes', editingClass.id), {
                    name: formData.name,
                    subject: formData.subject,
                    updatedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'classes'), {
                    name: formData.name,
                    subject: formData.subject,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp()
                });
            }
            setFormData({ name: '', subject: '' });
            setShowModal(false);
            setEditingClass(null);
            loadClasses();
        } catch (error) {
            console.error('Error saving class:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDeleteModal = (cls) => {
        setClassToDelete(cls);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!classToDelete) return;

        setLoading(true);
        try {
            await deleteDoc(doc(db, 'classes', classToDelete.id));
            toast.success('Class deleted successfully');

            // If deleted class was selected, deselect it
            if (selectedClass?.id === classToDelete.id) {
                setSelectedClass(null);
            }

            setDeleteModalOpen(false);
            setClassToDelete(null);
            loadClasses();
        } catch (error) {
            console.error('Error deleting class:', error);
            toast.error('Failed to delete class');
        } finally {
            setLoading(false);
        }
    };

    const filteredClasses = classes.filter(cls =>
        cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.subject?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply sorting
    let sortedClasses = [...filteredClasses];
    switch (sortBy) {
        case 'newest':
            sortedClasses.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            break;
        case 'oldest':
            sortedClasses.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
            break;
        case 'a-z':
            sortedClasses = sortClasses(filteredClasses);
            break;
        case 'z-a':
            sortedClasses = sortClasses(filteredClasses).reverse();
            break;
        default:
            break;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                        Class Management
                    </h1>
                    <p className="text-slate-500 mt-1">Kelola kelas, siswa, dan aktivitas pembelajaran</p>
                </div>
                <div className="flex items-center gap-3">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all"
                    >
                        <Plus className="h-5 w-5" />
                        Add Class
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            if (selectedClass) {
                                // Open Add Student modal in ClassDetail
                                // This will be handled by passing a prop
                                window.dispatchEvent(new CustomEvent('openAddStudent'));
                            } else {
                                toast.error('Please select a class first');
                            }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-green-200 flex items-center gap-2 transition-all"
                    >
                        <UserPlus className="h-5 w-5" />
                        Add Student
                    </motion.button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar - Class List */}
                <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col max-h-[500px] lg:h-[calc(100vh-12rem)] lg:sticky lg:top-6">
                    <div className="p-4 border-b border-slate-100 space-y-3 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800">Class List</h3>
                            <div className="relative group">
                                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <ArrowUpDown className="h-4 w-4" />
                                </button>
                                <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden hidden group-hover:block z-10">
                                    <button onClick={() => setSortBy('newest')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortBy === 'newest' ? 'text-blue-600 font-medium' : 'text-slate-600'}`}>Terbaru</button>
                                    <button onClick={() => setSortBy('oldest')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortBy === 'oldest' ? 'text-blue-600 font-medium' : 'text-slate-600'}`}>Terlama</button>
                                    <button onClick={() => setSortBy('a-z')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortBy === 'a-z' ? 'text-blue-600 font-medium' : 'text-slate-600'}`}>Nama (A-Z)</button>
                                    <button onClick={() => setSortBy('z-a')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${sortBy === 'z-a' ? 'text-blue-600 font-medium' : 'text-slate-600'}`}>Nama (Z-A)</button>
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search Class..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-slate-50 focus:bg-white transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : sortedClasses.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-sm">
                                {searchTerm ? 'Class not found' : 'No classes yet'}
                            </div>
                        ) : (
                            sortedClasses.map((cls) => {
                                const isSelected = selectedClass?.id === cls.id;
                                const stats = classStats[cls.id] || { studentCount: 0 };

                                return (
                                    <div
                                        key={cls.id}
                                        onClick={() => setSelectedClass(cls)}
                                        className={`p-3 rounded-xl cursor-pointer transition-all border ${isSelected
                                            ? 'bg-blue-50 border-blue-200 shadow-sm'
                                            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                <UsersIcon className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`font-bold text-sm truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                                                    {cls.name}
                                                </h4>
                                                <p className="text-xs text-slate-500 truncate mb-1.5">
                                                    {cls.subject}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {stats.studentCount} Siswa
                                                    </span>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="flex flex-col gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenModal(cls);
                                                        }}
                                                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-all"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenDeleteModal(cls);
                                                        }}
                                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Main Content - Class Detail */}
                <div className="lg:col-span-3">
                    {selectedClass ? (
                        <ClassDetail
                            classData={selectedClass}
                            classes={classes}
                            onBack={() => setSelectedClass(null)}
                        />
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[400px] lg:h-[calc(100vh-12rem)] flex flex-col items-center justify-center text-center p-8">
                            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                                <GraduationCap className="h-10 w-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Select a Class</h3>
                            <p className="text-slate-500 max-w-md">
                                Pilih salah satu kelas dari daftar di samping untuk melihat detail, mengelola siswa, dan memantau aktivitas.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold">
                                        {editingClass ? 'Edit Class' : 'Create New Class'}
                                    </h2>
                                    <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                <p className="text-blue-100 mt-1">Fill in class details below</p>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Class Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Contoh: X IPA 1"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Mata Pelajaran</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Contoh: Matematika Wajib"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-400 bg-white text-slate-800 font-bold hover:bg-slate-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-xl hover:bg-blue-700 active:bg-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{ backgroundColor: loading ? undefined : '#2563eb' }}
                                    >
                                        {loading ? 'Saving...' : (editingClass ? 'Save Changes' : 'Create Class')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence >

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalOpen && classToDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="bg-red-600 p-6 text-white flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg">
                                        <Trash2 className="h-6 w-6 text-white" />
                                    </div>
                                    <h3 className="font-bold text-lg">Delete Class?</h3>
                                </div>
                                <button onClick={() => setDeleteModalOpen(false)} className="text-white/70 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-800 text-sm">
                                    <p className="font-bold mb-1">PERINGATAN:</p>
                                    <p>Anda akan menghapus kelas <strong>"{classToDelete.name}"</strong>.</p>
                                    <p className="mt-1 opacity-80">Semua data siswa, tugas, dan nilai dalam kelas ini akan dihapus permanen.</p>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => setDeleteModalOpen(false)}
                                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium text-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Yes, Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
