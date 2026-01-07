import { useState, useEffect } from 'react';
import { db, auth, createStudentAccount } from '../../lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc, serverTimestamp, setDoc, arrayUnion } from 'firebase/firestore';

import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, Filter, MoreVertical, Mail, Plus, Edit2, Trash2, X, Save, UserPlus, BookOpen, Award, CheckCircle, Lock, School, Star, TrendingUp, Users, ArrowUpDown, RotateCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { sortClasses } from '../../utils/classSort';

import StudentDetail from './StudentDetail';
import TaskDetail from './TaskDetail';

export default function ClassDetail({ classData, classes, onBack }) {
    const { currentUser } = useAuth();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [modalTab, setModalTab] = useState('new'); // 'new' or 'existing'
    const [currentStudent, setCurrentStudent] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', classId: '', password: '' });
    const [availableStudents, setAvailableStudents] = useState([]);
    const [existingSearchTerm, setExistingSearchTerm] = useState('');
    const [searchingExisting, setSearchingExisting] = useState(false);
    const [saving, setSaving] = useState(false);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);

    // Restore Modal State
    const [restoreModalOpen, setRestoreModalOpen] = useState(false);
    const [pendingRestoreStudent, setPendingRestoreStudent] = useState(null);

    // Enroll Modal State
    const [enrollModalOpen, setEnrollModalOpen] = useState(false);
    const [studentToEnroll, setStudentToEnroll] = useState(null);

    useEffect(() => {
        setSelectedStudent(null); // Reset selected student when class changes
        loadClassData();

        // Listen for Add Student event from Classes page
        const handleOpenAddStudent = () => {
            setFormData({ name: '', email: '', classId: classData.id, password: '' });
            setCurrentStudent(null);
            setModalTab('new');
            setExistingSearchTerm('');
            setAvailableStudents([]);
            setShowModal(true);
        };

        window.addEventListener('openAddStudent', handleOpenAddStudent);

        return () => {
            window.removeEventListener('openAddStudent', handleOpenAddStudent);
        };
    }, [classData.id]);

    const loadClassData = async () => {
        setLoading(true);
        try {
            // Get all students in this class (Legacy check: classId field)
            const legacyQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('classId', '==', classData.id)
            );

            // Get all students in this class (New check: classIds array)
            const newQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('classIds', 'array-contains', classData.id)
            );

            const [legacySnap, newSnap] = await Promise.all([
                getDocs(legacyQuery),
                getDocs(newQuery)
            ]);

            const studentsMap = new Map();

            // Merge results
            [...legacySnap.docs, ...newSnap.docs].forEach(doc => {
                if (!studentsMap.has(doc.id)) {
                    studentsMap.set(doc.id, { id: doc.id, ...doc.data() });
                }
            });

            // Filter out deleted students
            const studentsList = Array.from(studentsMap.values())
                .filter(student => student.status !== 'deleted');

            // Sort students alphabetically by name
            studentsList.sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB, 'id-ID');
            });

            setStudents(studentsList);
        } catch (error) {
            console.error("Error loading class details:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (student) => {
        setFormData({
            name: student.name || '',
            email: student.email || '',
            classId: student.classId || classData.id
        });
        setCurrentStudent(student);
        setShowModal(true);
    };

    const handleDeleteClick = (student) => {
        setStudentToDelete(student);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!studentToDelete) return;

        try {
            // Soft delete: Update status to 'deleted' instead of removing document
            await updateDoc(doc(db, 'users', studentToDelete.id), {
                status: 'deleted',
                deletedAt: serverTimestamp(),
                deletedBy: currentUser.uid
            });

            toast.success('Student deleted successfully');
            setDeleteModalOpen(false);
            setStudentToDelete(null);
            loadClassData(); // Reload data
        } catch (error) {
            console.error("Error deleting student:", error);
            toast.error("Failed to delete student.");
        }
    };

    const handleConfirmRestore = async () => {
        if (!pendingRestoreStudent) return;

        try {
            await updateDoc(doc(db, 'users', pendingRestoreStudent.id), {
                status: 'active',
                classId: classData.id, // Legacy support
                classIds: arrayUnion(classData.id), // Add to this class
                name: formData.name, // Update name if changed
                updatedAt: serverTimestamp(),
                restoredAt: serverTimestamp(),
                restoredBy: currentUser.uid
            });

            toast.success(`Student "${formData.name}" restored successfully!`);
            setRestoreModalOpen(false);
            setPendingRestoreStudent(null);
            setShowModal(false); // Close the add/edit modal too
            loadClassData();
        } catch (error) {
            console.error("Error restoring student:", error);
            toast.error("Failed to restore student.");
        }
    };

    const searchAvailableStudents = async (term) => {
        if (!term || term.length < 2) {
            setAvailableStudents([]);
            return;
        }

        setSearchingExisting(true);
        try {
            // Simplified search: Get all active students and filter client-side 
            // (Firestore text search is limited without third-party like Algolia)
            const q = query(
                collection(db, 'users'),
                where('role', '==', 'student')
            );

            const querySnapshot = await getDocs(q);
            const allStudents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter by name or email, AND exclude students already in this class
            const results = allStudents.filter(student => {
                const matchesTerm = (student.name || '').toLowerCase().includes(term.toLowerCase()) ||
                    (student.email || '').toLowerCase().includes(term.toLowerCase());

                const alreadyInClass = student.classId === classData.id ||
                    (student.classIds && student.classIds.includes(classData.id));

                const isActive = student.status !== 'deleted';

                return matchesTerm && !alreadyInClass && isActive;
            });

            setAvailableStudents(results.slice(0, 10)); // Limit to 10 results
        } catch (error) {
            console.error("Error searching students:", error);
        } finally {
            setSearchingExisting(false);
        }
    };

    // Trigger search when term changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (modalTab === 'existing') {
                searchAvailableStudents(existingSearchTerm);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [existingSearchTerm, modalTab]);

    const handleAssignClick = (student) => {
        setStudentToEnroll(student);
        setEnrollModalOpen(true);
        // We keep the main modal open until confirmed
    };

    const handleConfirmEnroll = async () => {
        if (!studentToEnroll) return;

        try {
            const studentRef = doc(db, 'users', studentToEnroll.id);

            // Prepare classIds: If user has legacy classId, ensure it's in the array
            let currentClassIds = studentToEnroll.classIds || [];
            if (studentToEnroll.classId && !currentClassIds.includes(studentToEnroll.classId)) {
                currentClassIds.push(studentToEnroll.classId);
            }

            // We use arrayUnion to safely add the new class ID
            await updateDoc(studentRef, {
                classIds: arrayUnion(...currentClassIds, classData.id),
                updatedAt: serverTimestamp()
            });

            toast.success(`Student "${studentToEnroll.name}" enrolled in this class!`);
            setEnrollModalOpen(false);
            setStudentToEnroll(null);
            setShowModal(false);
            loadClassData();
        } catch (error) {
            console.error("Error enrolling student:", error);
            toast.error("Failed to enroll student.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (currentStudent) {
                // Update existing student
                await updateDoc(doc(db, 'users', currentStudent.id), {
                    name: formData.name,
                    email: formData.email,
                    classId: formData.classId,
                    updatedAt: serverTimestamp()
                });
                toast.success("Student data updated successfully!");
            } else {
                // Check if email was previously used by ANY student (Active or Deleted)
                const emailCheckQuery = query(
                    collection(db, 'users'),
                    where('email', '==', formData.email)
                );
                const emailCheckSnap = await getDocs(emailCheckQuery);

                if (!emailCheckSnap.empty) {
                    const existingUser = { id: emailCheckSnap.docs[0].id, ...emailCheckSnap.docs[0].data() };

                    if (existingUser.status === 'deleted') {
                        // Restore Flow
                        setPendingRestoreStudent(existingUser);
                        setRestoreModalOpen(true);
                        setSaving(false);
                        return;
                    } else {
                        // Active User Found - Check if already in this class
                        const isAlreadyInClass = (existingUser.classId === classData.id) ||
                            (existingUser.classIds && existingUser.classIds.includes(classData.id));

                        if (isAlreadyInClass) {
                            toast.error("Student is already enrolled in this class.");
                            setSaving(false);
                            return;
                        }

                        // Not in this class yet -> Enrollment Flow
                        setStudentToEnroll(existingUser);
                        setEnrollModalOpen(true);
                        setSaving(false);
                        return;
                    }
                }

                // Create new student with Firebase Auth (using secondary app to avoid session swap)
                const userCredential = await createStudentAccount(
                    formData.email,
                    formData.password
                );

                // Create Firestore user document using setDoc to match UID
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    name: formData.name,
                    email: formData.email,
                    classId: formData.classId,
                    classIds: [formData.classId], // Initialize array
                    role: 'student',
                    status: 'active',
                    createdAt: serverTimestamp()
                });

                toast.success(`Student "${formData.name}" created successfully!`);
            }
            setShowModal(false);
            loadClassData();
        } catch (error) {
            console.error("Error saving student:", error);
            if (error.code === 'auth/email-already-in-use') {
                toast.error("Email already in use. Please use a different email.");
            } else if (error.code === 'auth/weak-password') {
                toast.error("Password should be at least 6 characters.");
            } else {
                toast.error("Failed to save student data.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredStudents = students.filter(student =>
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
        const aValue = (a.name || '').toLowerCase();
        const bValue = (b.name || '').toLowerCase();

        if (sortConfig.direction === 'asc') {
            return aValue.localeCompare(bValue, 'id-ID');
        }
        return bValue.localeCompare(aValue, 'id-ID');
    });



    if (selectedTask) {
        return (
            <TaskDetail
                task={selectedTask}
                classes={classes}
                onBack={() => setSelectedTask(null)}
            />
        );
    }

    if (selectedStudent) {
        return (
            <StudentDetail
                student={selectedStudent}
                onBack={() => setSelectedStudent(null)}
                onTaskClick={(task) => setSelectedTask(task)}
                hideSubmissionTime={true}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search students..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 focus:bg-white transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-sm text-slate-500 font-medium">
                    Total: <span className="text-slate-800 font-bold">{filteredStudents.length}</span> Student
                </div>
            </div>

            {/* Table View */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">No students</h3>
                        <p className="text-slate-500">No students in this class yet or not found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">No</th>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors group"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            Student
                                            <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100" />
                                        </div>
                                    </th>

                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStudents.map((student, index) => (
                                    <motion.tr
                                        key={student.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.02 }}
                                        onClick={() => setSelectedStudent(student)}
                                        className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {index + 1}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0 shadow-sm">
                                                    {student.name?.[0]?.toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{student.name}</div>
                                                    <div className="text-xs text-slate-500 truncate">{student.email}</div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEditClick(student); }}
                                                    className="text-amber-600 bg-amber-50 hover:bg-amber-100 p-2 rounded-lg transition-all"
                                                    title="Edit student"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(student); }}
                                                    className="text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-all"
                                                    title="Delete student"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div >
                )
                }
            </div >

            {/* Edit Modal */}
            < AnimatePresence >
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white flex justify-between items-center">
                                <h2 className="text-xl font-bold">{currentStudent ? 'Edit Student' : 'Add Student'}</h2>
                                <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {/* Tabs */}
                            {!currentStudent && (
                                <div className="flex border-b border-slate-200">
                                    <button
                                        onClick={() => setModalTab('new')}
                                        className={`flex-1 py-3 text-sm font-bold transition-all ${modalTab === 'new'
                                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        Create New
                                    </button>
                                    <button
                                        onClick={() => setModalTab('existing')}
                                        className={`flex-1 py-3 text-sm font-bold transition-all ${modalTab === 'existing'
                                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        Assign Existing
                                    </button>
                                </div>
                            )}

                            {modalTab === 'new' ? (
                                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Full Name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                                        <input
                                            type="email"
                                            required
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="email@mutiarabangsa.sch.id"
                                            disabled={currentStudent !== null}
                                        />
                                        {currentStudent && (
                                            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                                        )}
                                    </div>
                                    {!currentStudent && (
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                                            <div className="relative">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                                <input
                                                    type="password"
                                                    required
                                                    minLength={6}
                                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                    placeholder="Minimum 6 characters"
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">Student will use this password to login</p>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Class</label>
                                        <div className="relative">
                                            <School className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                            <select
                                                required
                                                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white appearance-none cursor-pointer"
                                                value={formData.classId}
                                                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                            >
                                                {sortClasses(classes || []).map((cls) => (
                                                    <option key={cls.id} value={cls.id}>
                                                        {cls.name}{cls.subject ? ` - ${cls.subject}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {saving ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="h-5 w-5" />
                                                    Save
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                // EXISTING STUDENTS TAB
                                <div className="p-6 h-[500px] flex flex-col">
                                    <div className="relative mb-4">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="Search by name or email..."
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 focus:bg-white transition-all"
                                            value={existingSearchTerm}
                                            onChange={(e) => setExistingSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                        {searchingExisting ? (
                                            <div className="flex justify-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                            </div>
                                        ) : availableStudents.length > 0 ? (
                                            availableStudents.map(student => (
                                                <div key={student.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                                            {student.name?.[0]?.toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-sm">{student.name}</div>
                                                            <div className="text-xs text-slate-500">{student.email}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAssignClick(student)}
                                                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1.5"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                        Add
                                                    </button>
                                                </div>
                                            ))
                                        ) : existingSearchTerm.length > 1 ? (
                                            <div className="text-center py-12 text-slate-500">
                                                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                                <p>No available students found.</p>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 text-slate-400">
                                                <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                                <p>Type to search existing students</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence >

            {/* Delete Confirmation Modal */}
            < AnimatePresence >
                {deleteModalOpen && studentToDelete && (
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
                                    <h3 className="font-bold text-lg">Delete Student?</h3>
                                </div>
                                <button onClick={() => setDeleteModalOpen(false)} className="text-white/70 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-800 text-sm">
                                    <p className="font-bold mb-1">WARNING:</p>
                                    <p>You are about to delete student <strong>"{studentToDelete.name}"</strong> from this class.</p>
                                    <p className="mt-1 opacity-80">All submission data and grades for this student will be permanently deleted.</p>
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
            </AnimatePresence >

            {/* Restore Confirmation Modal */}
            <AnimatePresence>
                {restoreModalOpen && pendingRestoreStudent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="bg-green-600 p-6 text-white flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg">
                                        <RotateCcw className="h-6 w-6 text-white" />
                                    </div>
                                    <h3 className="font-bold text-lg">Restore Student?</h3>
                                </div>
                                <button onClick={() => setRestoreModalOpen(false)} className="text-white/70 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-green-800 text-sm">
                                    <p className="font-bold mb-1">Found deleted account:</p>
                                    <p>The email <strong>{pendingRestoreStudent.email}</strong> belongs to a deleted student: <strong>"{pendingRestoreStudent.name}"</strong>.</p>
                                    <p className="mt-2 text-green-700">Would you like to restore this account instead of creating a new one?</p>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => setRestoreModalOpen(false)}
                                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium text-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmRestore}
                                        className="flex-1 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                        Yes, Restore
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Enroll Confirmation Modal */}
            <AnimatePresence>
                {enrollModalOpen && studentToEnroll && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg">
                                        <UserPlus className="h-6 w-6 text-white" />
                                    </div>
                                    <h3 className="font-bold text-lg">Enroll Existing Student?</h3>
                                </div>
                                <button onClick={() => setEnrollModalOpen(false)} className="text-white/70 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800 text-sm">
                                    <p className="font-bold mb-1">Student Found:</p>
                                    <p>The email <strong>{studentToEnroll.email}</strong> is already registered to <strong>"{studentToEnroll.name}"</strong>.</p>
                                    <p className="mt-2 text-blue-700">Would you like to enroll this student in <strong>{classData.name}</strong> as well?</p>
                                    <p className="mt-1 text-xs text-blue-600/80">They will remain in their other classes.</p>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => setEnrollModalOpen(false)}
                                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium text-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmEnroll}
                                        className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        Yes, Enroll
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
