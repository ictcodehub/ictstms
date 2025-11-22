import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Users, BookOpen, GraduationCap, School } from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        teachers: 0,
        students: 0,
        classes: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const classesSnap = await getDocs(collection(db, 'classes'));

            let teachers = 0;
            let students = 0;

            usersSnap.forEach(doc => {
                const role = doc.data().role;
                if (role === 'teacher') teachers++;
                if (role === 'student') students++;
            });

            setStats({
                totalUsers: usersSnap.size,
                teachers,
                students,
                classes: classesSnap.size
            });
        } catch (error) {
            console.error('Error loading admin stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { label: 'Total Pengguna', value: stats.totalUsers, icon: Users, color: 'from-blue-500 to-indigo-500' },
        { label: 'Guru', value: stats.teachers, icon: School, color: 'from-emerald-500 to-teal-500' },
        { label: 'Siswa', value: stats.students, icon: GraduationCap, color: 'from-orange-500 to-amber-500' },
        { label: 'Total Kelas', value: stats.classes, icon: BookOpen, color: 'from-purple-500 to-pink-500' },
    ];

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Dashboard Admin</h1>
                <p className="text-slate-500 mt-1">Ringkasan data sistem STMS</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`bg-gradient-to-br ${stat.color} p-6 rounded-2xl text-white shadow-lg relative overflow-hidden`}
                    >
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                        <div className="relative z-10">
                            <div className="bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 backdrop-blur-sm">
                                <stat.icon className="h-6 w-6 text-white" />
                            </div>
                            <p className="text-white/80 text-sm font-medium">{stat.label}</p>
                            <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
