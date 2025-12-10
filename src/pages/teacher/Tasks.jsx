import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, GraduationCap, Calendar, Clock, FileText, AlertCircle, CheckCircle2, Eye, Users, Search, Filter, ArrowUpDown } from 'lucide-react';
import TaskDetail from './TaskDetail';

import { useAuth } from '../../contexts/AuthContext';
import { sortClasses } from '../../utils/classSort';

export default function Tasks() {
    const { currentUser } = useAuth();
    const location = useLocation();
    const [tasks, setTasks] = useState([]);
    const [classes, setClasses] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [showClassModal, setShowClassModal] = useState(false);
    const [selectedTaskClasses, setSelectedTaskClasses] = useState([]);
    const [classStats, setClassStats] = useState({});
    // Filter and sort states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const tasksPerPage = 10;
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        deadline: '',
        assignedClasses: []
    });

    useEffect(() => {
        if (currentUser) {
            loadData();
        }
    }, [currentUser]);

    // Auto-select task from navigation state (from activity feed)
    useEffect(() => {
        if (location.state?.selectedTaskId && tasks.length > 0) {
            const task = tasks.find(t => t.id === location.state.selectedTaskId);
            if (task) {
                setSelectedTask(task);
                // Clear the state to prevent re-selecting on subsequent renders
                window.history.replaceState({}, document.title);
            }
        }
    }, [location.state, tasks]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load classes created by this teacher
            const classesQuery = query(
                collection(db, 'classes'),
                where('createdBy', '==', currentUser.uid)
            );
            const classesSnap = await getDocs(classesQuery);
            const classList = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(sortClasses(classList));

            // Load tasks created by this teacher
            const q = query(
                collection(db, 'tasks'),
                where('createdBy', '==', currentUser.uid)
            );
            const tasksSnap = await getDocs(q);
            setTasks(tasksSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
            );
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadClassStats = async (classList) => {
        try {
            const stats = {};
            for (const cls of classList) {
                // Count students in this class
                const studentsSnap = await getDocs(
                    query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', cls.id))
                );
                stats[cls.id] = {
                    studentCount: studentsSnap.size
                };
            }
            setClassStats(stats);
        } catch (error) {
            console.error('Error loading class stats:', error);
        }
    };

    const handleOpenModal = (task = null) => {
        if (task) {
            setEditingTask(task);
            setFormData({
                title: task.title,
                description: task.description,
                deadline: task.deadline,
                assignedClasses: task.assignedClasses || []
            });
        } else {
            setEditingTask(null);
            setFormData({ title: '', description: '', deadline: '', assignedClasses: [] });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.deadline || formData.assignedClasses.length === 0) {
            toast.error('Please complete all task data');
            return;
        }

        setLoading(true);
        try {
            if (editingTask) {
                await updateDoc(doc(db, 'tasks', editingTask.id), {
                    ...formData,
                    updatedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'tasks'), {
                    ...formData,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp()
                });
            }
            setShowModal(false);
            loadData();
            toast.success('Task saved successfully!');
        } catch (error) {
            console.error('Error saving task:', error);
            toast.error('Failed to save task');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (task) => {
        setTaskToDelete(task);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!taskToDelete) return;

        try {
            await deleteDoc(doc(db, 'tasks', taskToDelete.id));
            setTasks(tasks.filter(t => t.id !== taskToDelete.id));
            toast.success('Task deleted successfully!');
            setDeleteModalOpen(false);
            setTaskToDelete(null);
        } catch (error) {
            console.error('Error deleting task:', error);
            toast.error('Failed to delete task');
        }
    };

    const toggleClassSelection = (classId) => {
        setFormData(prev => ({
            ...prev,
            assignedClasses: prev.assignedClasses.includes(classId)
                ? prev.assignedClasses.filter(id => id !== classId)
                : [...prev.assignedClasses, classId]
        }));
    };

    const isOverdue = (deadline) => {
        return new Date(deadline) < new Date();
    };

    const formatDeadline = (deadline) => {
        const date = new Date(deadline);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const getDeadlineColor = (deadline) => {
        const date = new Date(deadline);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return 'bg-red-50 text-red-600 border-red-200'; // Overdue
        } else if (diffDays <= 3) {
            return 'bg-amber-50 text-amber-600 border-amber-200'; // Soon
        } else {
            return 'bg-emerald-50 text-emerald-600 border-emerald-200'; // Safe
        }
    };

    // Filter and sort logic
    const getFilteredAndSortedTasks = () => {
        let filtered = tasks;

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(t =>
                t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.description?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Status filter
        if (filterStatus === 'active') {
            filtered = filtered.filter(t => !isOverdue(t.deadline));
        } else if (filterStatus === 'overdue') {
            filtered = filtered.filter(t => isOverdue(t.deadline));
        }

        // Class filter
        if (filterClass !== 'all') {
            filtered = filtered.filter(t => t.assignedClasses?.includes(filterClass));
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'oldest':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'deadline-soon':
                    return new Date(a.deadline) - new Date(b.deadline);
                case 'deadline-late':
                    return new Date(b.deadline) - new Date(a.deadline);
                case 'title':
                    return a.title.localeCompare(b.title);
                default: // newest
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

        return sorted;
    };

    const allFilteredTasks = getFilteredAndSortedTasks();

    // Pagination logic
    const totalPages = Math.ceil(allFilteredTasks.length / tasksPerPage);
    const startIndex = (currentPage - 1) * tasksPerPage;
    const endIndex = startIndex + tasksPerPage;
    const displayTasks = allFilteredTasks.slice(startIndex, endIndex);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterStatus, filterClass, sortBy]);

    // Show TaskDetail if a task is selected
    if (selectedTask) {
        return <TaskDetail task={selectedTask} classes={classes} onBack={() => setSelectedTask(null)} />;
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                        Task Management
                    </h1>
                    <p className="text-slate-500 mt-1">Create and manage tasks for your students</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all"
                >
                    <Plus className="h-5 w-5" />
                    Create Task
                </motion.button>
            </div>

            {/* Filter and Sort Controls */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm appearance-none bg-white cursor-pointer"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="overdue">Overdue</option>
                        </select>
                    </div>

                    {/* Class Filter */}
                    <div className="relative">
                        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm appearance-none bg-white cursor-pointer"
                        >
                            <option value="all">All Classes</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Sort */}
                    <div className="relative">
                        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm appearance-none bg-white cursor-pointer"
                        >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="deadline-soon">Closest Deadline</option>
                            <option value="deadline-late">Farthest Deadline</option>
                            <option value="title">Title A-Z</option>
                        </select>
                    </div>
                </div>

                {/* Active Filters Display */}
                {(searchQuery || filterStatus !== 'all' || filterClass !== 'all' || sortBy !== 'newest') && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <span className="text-xs text-slate-500">Active filters:</span>
                        {searchQuery && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-lg">
                                "{searchQuery}"
                            </span>
                        )}
                        {filterStatus !== 'all' && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-lg">
                                {filterStatus === 'active' ? 'Active' : 'Overdue'}
                            </span>
                        )}
                        {filterClass !== 'all' && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-lg">
                                {classes.find(c => c.id === filterClass)?.name}
                            </span>
                        )}
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setFilterStatus('all');
                                setFilterClass('all');
                                setSortBy('newest');
                            }}
                            className="ml-auto text-xs text-slate-500 hover:text-red-600 transition-colors"
                        >
                            Reset Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Tasks List */}
            <div className="space-y-4">
                {loading && tasks.length === 0 ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : displayTasks.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileText className="h-10 w-10 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">No tasks found</h3>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto">
                            {searchQuery || filterStatus !== 'all' || filterClass !== 'all'
                                ? 'Try changing your filter or search keywords.'
                                : 'Start by creating a new task for your classes.'}
                        </p>
                        {!searchQuery && filterStatus === 'all' && filterClass === 'all' && (
                            <button
                                onClick={() => handleOpenModal()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                            >
                                Create First Task
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50/50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">No</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Task Details</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Class</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Deadline</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {displayTasks.map((task, index) => (
                                        <motion.tr
                                            key={task.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.03 }}
                                            onClick={() => setSelectedTask(task)}
                                            className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                                {startIndex + index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="max-w-md">
                                                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-1">
                                                        {task.title}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 line-clamp-1">
                                                        {task.description || 'No description'}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {task.assignedClasses?.map(classId => {
                                                        const cls = classes.find(c => c.id === classId);
                                                        return cls ? (
                                                            <span key={classId} className="text-xs text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200 font-medium">
                                                                {cls.name}
                                                            </span>
                                                        ) : null;
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getDeadlineColor(task.deadline)}`}>
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDeadline(task.deadline)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isOverdue(task.deadline)
                                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                                    : 'bg-green-50 text-green-600 border-green-200'
                                                    }`}>
                                                    {isOverdue(task.deadline) ? (
                                                        <>
                                                            <Clock className="h-3 w-3" />
                                                            Berakhir
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Active
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}
                                                        className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-all"
                                                        title="View details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(task); }}
                                                        className="text-amber-600 bg-amber-50 hover:bg-amber-100 p-2 rounded-lg transition-all"
                                                        title="Edit task"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(task); }}
                                                        className="text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-all"
                                                        title="Delete task"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white rounded-xl border border-slate-200">
                        <div className="text-sm text-slate-600">
                            Menampilkan {startIndex + 1}-{Math.min(endIndex, allFilteredTasks.length)} dari {allFilteredTasks.length} tugas
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
                                Berikutnya
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Task Create/Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white shrink-0">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold">
                                        {editingTask ? 'Edit Task' : 'Create New Task'}
                                    </h2>
                                    <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                <p className="text-blue-100 mt-1">Fill in task details for your students</p>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Task Title <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                            placeholder="Contoh: Latihan Soal Aljabar"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Description
                                        </label>
                                        <textarea
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white min-h-[120px]"
                                            placeholder="Jelaskan detail tugas..."
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Deadline <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="datetime-local"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                            value={formData.deadline}
                                            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Assign to Classes <span className="text-red-500">*</span>
                                        </label>
                                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-xl border border-slate-200">
                                            {classes.map(cls => (
                                                <label
                                                    key={cls.id}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData.assignedClasses.includes(cls.id)
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-transparent bg-white hover:border-slate-300'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                        checked={formData.assignedClasses.includes(cls.id)}
                                                        onChange={() => toggleClassSelection(cls.id)}
                                                    />
                                                    <span className={`font-medium ${formData.assignedClasses.includes(cls.id) ? 'text-blue-700' : 'text-slate-700'
                                                        }`}>
                                                        {cls.name}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        {classes.length === 0 && (
                                            <div className="text-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 mt-2">
                                                <p className="text-sm text-slate-500">No classes yet. Create a class first in the Classes menu.</p>
                                            </div>
                                        )}
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
                                            {loading ? 'Saving...' : (editingTask ? 'Save Changes' : 'Create Task')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Class Info Modal */}
            <AnimatePresence>
                {showClassModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white shrink-0">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold">Assigned Classes</h2>
                                    <button onClick={() => setShowClassModal(false)} className="text-white/80 hover:text-white transition-colors">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                <p className="text-blue-100 mt-1">List of classes assigned to this task</p>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                {selectedTaskClasses.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <GraduationCap className="h-8 w-8 text-slate-400" />
                                        </div>
                                        <p className="text-slate-500">No classes assigned</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedTaskClasses.map((cls, index) => (
                                            <motion.div
                                                key={cls.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 hover:shadow-md transition-all"
                                            >
                                                <div className="bg-blue-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg">
                                                    {cls.name.charAt(0)}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-slate-800">{cls.name}</h3>
                                                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                                        <Users className="h-4 w-4" />
                                                        <span>{classStats[cls.id]?.studentCount || 0} Students</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalOpen && taskToDelete && (
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
                                    <h3 className="font-bold text-lg">Delete Task?</h3>
                                </div>
                                <button onClick={() => setDeleteModalOpen(false)} className="text-white/70 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-800 text-sm">
                                    <p className="font-bold mb-1">WARNING:</p>
                                    <p>You are about to delete task <strong>"{taskToDelete.title}"</strong>.</p>
                                    <p className="mt-1 opacity-80">All student submissions for this task will also be permanently deleted.</p>
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
        </div>
    );
}
