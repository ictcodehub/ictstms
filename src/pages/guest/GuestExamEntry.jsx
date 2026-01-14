import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { User, School, ArrowRight, AlertCircle, Loader2, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GuestExamEntry() {
    const { examId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [exam, setExam] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        absen: '',
        className: '', // 'Class' is a reserved word
    });
    const [error, setError] = useState(null);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        const checkExam = async () => {
            try {
                if (!examId) return;
                const docRef = doc(db, 'exams', examId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (!data.isGuestAllowed) {
                        setError("This exam does not allow guest access.");
                    } else if (data.status !== 'published') {
                        setError("This exam is not currently active.");
                    } else {
                        setExam({ id: docSnap.id, ...data });
                    }
                } else {
                    setError("Exam not found.");
                }
            } catch (err) {
                console.error("Error loading exam:", err);
                setError("Failed to load exam details.");
            } finally {
                setLoading(false);
            }
        };

        checkExam();
    }, [examId]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) return toast.error("Please enter your name");
        if (!formData.absen) return toast.error("Please select your absen number");
        if (!formData.className.trim()) return toast.error("Please enter your class");

        setChecking(true);
        try {
            // LAYER 1: Browser Lock (LocalStorage)
            if (localStorage.getItem(`guest_completed_${examId}`)) {
                setError("Anda sudah mengerjakan ujian ini (terdeteksi dari perangkat).");
                return;
            }

            const cleanName = formData.name.trim().toLowerCase();
            const cleanClass = formData.className.trim().toLowerCase();
            const absenNum = parseInt(formData.absen);

            // LAYER 2: Name + Class Check
            const nameQuery = query(
                collection(db, 'guest_attempts'),
                where('examId', '==', examId),
                where('name', '==', cleanName),
                where('className', '==', cleanClass),
                limit(1)
            );

            // LAYER 3: Absen + Class Check
            const absenQuery = query(
                collection(db, 'guest_attempts'),
                where('examId', '==', examId),
                where('absen', '==', absenNum),
                where('className', '==', cleanClass),
                limit(1)
            );

            const [nameSnap, absenSnap] = await Promise.all([
                getDocs(nameQuery),
                getDocs(absenQuery)
            ]);

            if (!nameSnap.empty) {
                setError(`Nama "${formData.name}" di kelas "${formData.className}" sudah mengerjakan ujian ini.`);
                return;
            }

            if (!absenSnap.empty) {
                setError(`No. Absen ${formData.absen} di kelas "${formData.className}" sudah digunakan untuk ujian ini.`);
                return;
            }

            // All clear - proceed
            const guestId = `guest_${crypto.randomUUID()}`;
            const guestSession = {
                guestId,
                name: formData.name.trim(),
                absen: absenNum,
                className: formData.className.trim(),
                examId,
                startedAt: new Date().toISOString()
            };

            localStorage.setItem(`guest_session_${examId}`, JSON.stringify(guestSession));

            navigate(`/exam/guest/${examId}/start`, {
                state: { guestUser: guestSession }
            });

        } catch (err) {
            console.error("Error validation guest:", err);
            // Show detailed error for debugging logic
            if (err.message.includes('requires an index') || err.code === 'failed-precondition') {
                toast.error("System Error: Database Index Missing. Please report to admin.");
            } else if (err.message.includes('permission-denied') || err.code === 'permission-denied') {
                toast.error("System Error: Access Denied. Database rules might not be deployed.");
            } else {
                toast.error(`Error: ${err.message}`);
            }
        } finally {
            setChecking(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-xl overflow-hidden max-w-md w-full flex flex-col"
            >
                {/* Header with Exam Info */}
                <div className="bg-blue-600 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                    <div className="relative z-10">
                        <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-medium mb-3 border border-white/20">
                            Guest Exam Access
                        </span>
                        <h1 className="text-2xl font-bold mb-2">{exam?.title}</h1>
                        <p className="text-blue-100 text-sm line-clamp-2">{exam?.description || "Please enter your details to start the exam."}</p>

                        <div className="flex items-center gap-4 mt-4 text-xs font-medium text-blue-100">
                            <span className="flex items-center gap-1 bg-blue-700/50 px-2 py-1 rounded">
                                ⏱️ {exam?.duration} Mins
                            </span>
                            <span className="flex items-center gap-1 bg-blue-700/50 px-2 py-1 rounded">
                                📝 {exam?.questions?.length || 0} Questions
                            </span>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Enter your full name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Attendance Number</label>
                            <div className="relative">
                                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <select
                                    required
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none bg-white cursor-pointer"
                                    value={formData.absen}
                                    onChange={e => setFormData({ ...formData, absen: e.target.value })}
                                >
                                    <option value="" disabled>Select Attendance Number</option>
                                    {Array.from({ length: 50 }, (_, i) => i + 1).map(num => (
                                        <option key={num} value={num}>{num}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Class / Section</label>
                            <div className="relative">
                                <School className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    placeholder="e.g. 7A"
                                    value={formData.className}
                                    onChange={e => setFormData({ ...formData, className: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={checking}
                            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait"
                        >
                            {checking ? 'Checking...' : 'Start Exam'} {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
