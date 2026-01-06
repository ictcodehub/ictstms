import { useState, useEffect } from 'react';
import { db, auth, createStudentAccount } from '../../lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, Filter, MoreVertical, Mail, Plus, Edit2, Trash2, X, Save, UserPlus, BookOpen, Award, CheckCircle, Lock, School, Star, TrendingUp, Users, ArrowUpDown } from 'lucide-react';
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
    const [currentStudent, setCurrentStudent] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', classId: '', password: '' });
    const [saving, setSaving] = useState(false);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);

    useEffect(() => {
        setSelectedStudent(null); // Reset selected student when class changes
        loadClassData();

        // Listen for Add Student event from Classes page
        const handleOpenAddStudent = () => {
            setFormData({ name: '', email: '', classId: classData.id, password: '' });
            setCurrentStudent(null);
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
            // Get all students in this class
            const studentsQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('classId', '==', classData.id)
            );
            const studentsSnap = await getDocs(studentsQuery);

            // Filter out deleted students in JavaScript (since not all students have status field)
            const studentsList = studentsSnap.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(student => student.status !== 'deleted'); // Filter deleted students

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
                // Check if email was previously used by a deleted student
                const emailCheckQuery = query(
                    collection(db, 'users'),
                    where('email', '==', formData.email),
                    where('status', '==', 'deleted')
                );
                const emailCheckSnap = await getDocs(emailCheckQuery);

                if (!emailCheckSnap.empty) {
                    toast.error("This email was previously used by a deleted student. Please use a different email.");
                    setSaving(false);
                    return;
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
        </div >
    );
}
