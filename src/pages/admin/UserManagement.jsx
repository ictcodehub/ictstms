import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, MoreVertical, Edit2, Trash2, Shield, Ban, CheckCircle, X } from 'lucide-react';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [editingUser, setEditingUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const usersList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersList);
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!editingUser) return;

        try {
            await updateDoc(doc(db, 'users', editingUser.id), {
                name: editingUser.name,
                role: editingUser.role,
                status: editingUser.status || 'active'
            });
            setShowModal(false);
            setEditingUser(null);
            loadUsers();
            alert('User updated successfully');
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Failed to update user');
        }
    };

    const handleBanUser = async (user) => {
        const isBanned = user.status === 'banned';
        const action = isBanned ? 'activate' : 'ban';
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            await updateDoc(doc(db, 'users', user.id), {
                status: isBanned ? 'active' : 'banned'
            });
            loadUsers();
        } finally {
            setLoading(false);
        }
    };

    const confirmDeleteUser = (user) => {
        if (user.role === 'admin') {
            alert('Admin users cannot be deleted.');
            return;
        }
        setUserToDelete(user);
        setDeleteModalOpen(true);
    };

    const executeDeleteUser = async () => {
        if (!userToDelete) return;
        const user = userToDelete;

        console.log('Starting delete process via Modal...');
        setLoading(true);
        try {
            console.log('Initializing batch...');
            const batch = writeBatch(db);

            // Helper to delete query results in batch
            const deleteQueryBatch = async (q, desc) => {
                console.log(`Querying for ${desc}...`);
                const snapshot = await getDocs(q);
                console.log(`Found ${snapshot.size} documents for ${desc}`);
                snapshot.forEach((doc) => {
                    console.log(`Deleting ${desc} doc: ${doc.id}`);
                    batch.delete(doc.ref);
                });
                return snapshot.size;
            };

            console.log(`Processing role: ${user.role}`);

            if (user.role === 'student') {
                // 1. Delete Submissions
                const submissionsQ = query(collection(db, 'submissions'), where('studentId', '==', user.id));
                await deleteQueryBatch(submissionsQ, 'submissions');

                // 2. Delete Class Memberships
                const membersQ = query(collection(db, 'class_members'), where('studentId', '==', user.id));
                await deleteQueryBatch(membersQ, 'class_members');

            } else if (user.role === 'teacher') {
                // 1. Delete Classes and their Members
                console.log('Finding teacher classes...');
                const classesQ = query(collection(db, 'classes'), where('createdBy', '==', user.id));
                const classesSnap = await getDocs(classesQ);
                console.log(`Found ${classesSnap.size} classes`);

                for (const classDoc of classesSnap.docs) {
                    console.log(`Processing class: ${classDoc.id}`);
                    // Delete members of this class
                    const classMembersQ = query(collection(db, 'class_members'), where('classId', '==', classDoc.id));
                    await deleteQueryBatch(classMembersQ, `members of class ${classDoc.id}`);
                    // Delete the class itself
                    console.log(`Deleting class doc: ${classDoc.id}`);
                    batch.delete(classDoc.ref);
                }

                // 2. Delete Tasks and their Submissions
                console.log('Finding teacher tasks...');
                const tasksQ = query(collection(db, 'tasks'), where('createdBy', '==', user.id));
                const tasksSnap = await getDocs(tasksQ);
                console.log(`Found ${tasksSnap.size} tasks`);

                for (const taskDoc of tasksSnap.docs) {
                    console.log(`Processing task: ${taskDoc.id}`);
                    // Delete submissions for this task
                    const taskSubmissionsQ = query(collection(db, 'submissions'), where('taskId', '==', taskDoc.id));
                    await deleteQueryBatch(taskSubmissionsQ, `submissions for task ${taskDoc.id}`);
                    // Delete the task itself
                    console.log(`Deleting task doc: ${taskDoc.id}`);
                    batch.delete(taskDoc.ref);
                }
            }

            // 3. Delete User Profile
            console.log('Deleting user profile doc:', user.id);
            batch.delete(doc(db, 'users', user.id));

            // Commit the batch
            console.log('Committing batch...');
            await batch.commit();
            console.log('Batch commit successful.');

            alert(`User ${user.name} dan semua datanya berhasil dihapus.`);
            setDeleteModalOpen(false);
            setUserToDelete(null);
            loadUsers();

        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Gagal menghapus user: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = filterRole === 'all' || user.role === filterRole;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manajemen User</h1>
                    <p className="text-slate-500">Kelola akun guru dan siswa</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari nama atau email..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                >
                    <option value="all">Semua Role</option>
                    <option value="teacher">Guru</option>
                    <option value="student">Siswa</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-700">User</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Role</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Loading...</td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Tidak ada user ditemukan</td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-bold text-slate-800">{user.name || 'No Name'}</div>
                                                <div className="text-sm text-slate-500">{user.email}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                user.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {user.role?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.status === 'banned' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {user.status === 'banned' ? 'BANNED' : 'ACTIVE'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingUser(user);
                                                        setShowModal(true);
                                                    }}
                                                    className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                                    title="Edit User"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                {user.role !== 'admin' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleBanUser(user)}
                                                            className={`p-2 rounded-lg transition-colors ${user.status === 'banned'
                                                                ? 'hover:bg-green-50 text-green-600'
                                                                : 'hover:bg-orange-50 text-orange-600'
                                                                }`}
                                                            title={user.status === 'banned' ? 'Activate User' : 'Ban User'}
                                                        >
                                                            {user.status === 'banned' ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                                        </button>
                                                        <button
                                                            onClick={() => confirmDeleteUser(user)}
                                                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                                            title="Delete Permanently"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {showModal && editingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                                <h3 className="font-bold text-lg">Edit User</h3>
                                <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editingUser.name || ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                    <select
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        value={editingUser.role}
                                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                                    >
                                        <option value="student">Student</option>
                                        <option value="teacher">Teacher</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium text-slate-700"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-200"
                                    >
                                        Simpan
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalOpen && userToDelete && (
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
                                    <h3 className="font-bold text-lg">Hapus Permanen?</h3>
                                </div>
                                <button onClick={() => setDeleteModalOpen(false)} className="text-white/70 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-800 text-sm">
                                    <p className="font-bold mb-1">PERINGATAN KERAS:</p>
                                    <p>Anda akan menghapus user <strong>{userToDelete.name}</strong> ({userToDelete.role}).</p>
                                    <ul className="list-disc list-inside mt-2 space-y-1 opacity-80">
                                        <li>Semua data kelas & tugas akan hilang.</li>
                                        <li>Data nilai & pengumpulan akan hilang.</li>
                                        <li>Tindakan ini <strong>TIDAK BISA DIBATALKAN</strong>.</li>
                                    </ul>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => setDeleteModalOpen(false)}
                                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium text-slate-700"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={executeDeleteUser}
                                        className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Ya, Hapus Permanen
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
