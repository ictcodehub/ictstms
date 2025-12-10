import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { ClipboardCheck, Clock, CheckCircle2, AlertCircle, ArrowRight, Search, Filter, ChevronDown, Trophy, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentExams() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [studentClassId, setStudentClassId] = useState(null);
    const [studentClassName, setStudentClassName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        const loadStudentData = async () => {
            if (!currentUser) return;
            try {
                // Get student's class ID
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.classId) {
                        setStudentClassId(userData.classId);

                        // Fetch Class Name
                        const classDoc = await getDoc(doc(db, 'classes', userData.classId));
                        if (classDoc.exists()) {
                            setStudentClassName(classDoc.data().name);
                        } else {
                            setStudentClassName('Unknown Class');
                        }

                        // loadExams(userData.classId); // Removed direct call
                    } else {
                        setLoading(false);
                    }
                }
            } catch (error) {
                console.error("Error loading student data:", error);
                setLoading(false);
            }
        };

        loadStudentData();
    }, [currentUser]);

    useEffect(() => {
        if (!studentClassId || !currentUser) return;

        setLoading(true);
        let localExams = [];
        let localResults = [];

        const qExams = query(
            collection(db, 'exams'),
            where('assignedClasses', 'array-contains', studentClassId),
            where('status', '==', 'published')
        );

        const qResults = query(
            collection(db, 'exam_results'),
            where('studentId', '==', currentUser.uid)
        );

        const mergeAndSet = () => {
            const merged = localExams.map(exam => {
                const attempts = localResults.filter(r => r.examId === exam.id);
                attempts.sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));
                return { ...exam, attempt: attempts[0] || null };
            });

            merged.sort((a, b) => {
                const aActive = !a.attempt || (a.attempt.allowRetake);
                const bActive = !b.attempt || (b.attempt.allowRetake);
                if (aActive && !bActive) return -1;
                if (!aActive && bActive) return 1;
                return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
            });

            setExams(merged);
            setLoading(false);
        };

        const unsubExams = onSnapshot(qExams, snap => {
            localExams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            mergeAndSet();
        });

        const unsubResults = onSnapshot(qResults, snap => {
            localResults = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            mergeAndSet();
        });

        return () => { unsubExams(); unsubResults(); };
    }, [studentClassId, currentUser]);


    const getStatusBadge = (exam) => {
        if (exam.attempt) {
            if (exam.attempt.allowRetake) {
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-full border border-orange-200">
                        <ArrowRight className="h-3 w-3" />
                        Remedial Tersedia
                    </span>
                );
            }
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
                <Clock className="h-3 w-3" />
                Not Started
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!studentClassId) {
        return (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
                <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800">Class Not Assigned</h3>
                <p className="text-slate-500 max-w-md mx-auto mt-2">
                    You are not enrolled in any class yet. Contact your teacher to be added to a class so you can view exams.
                </p>
            </div>
        );
    }

    // Filter exams based on search and status
    const getExamStatus = (exam) => {
        if (exam.attempt) {
            if (exam.attempt.allowRetake) {
                return { type: 'retake', label: 'Retake Available' };
            }
            return { type: 'completed', label: 'Completed' };
        }
        return { type: 'not_started', label: 'Not Started' };
    };

    const filteredExams = exams.filter(exam => {
        const status = getExamStatus(exam);
        const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (exam.description || '').toLowerCase().includes(searchTerm.toLowerCase());

        let matchesFilter = true;
        if (filterStatus === 'not_started') matchesFilter = status.type === 'not_started';
        if (filterStatus === 'completed') matchesFilter = status.type === 'completed';
        if (filterStatus === 'retake') matchesFilter = status.type === 'retake';

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                    Exam List
                </h1>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-slate-500">Complete exams available for your class.</p>
                    {studentClassName && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                            {studentClassName}
                        </span>
                    )}
                </div>
            </div>

            {!loading && !studentClassId && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                    <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                    <div>
                        <h3 className="text-lg font-bold text-amber-800">You are not assigned to any class</h3>
                        <p className="text-amber-700 mt-1">Please contact your teacher to be added to a class so you can see exams.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Search exams..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                </div>
                <div className="relative min-w-[200px]">
                    <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none bg-white"
                    >
                        <option value="all">All Status</option>
                        <option value="not_started">Not Started</option>
                        <option value="completed">Completed</option>
                        <option value="retake">Retake Available</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4 pointer-events-none" />
                </div>
            </div>

            {filteredExams.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ClipboardCheck className="h-10 w-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">No exams found</h3>
                    <p className="text-slate-500 mt-2 max-w-md mx-auto">
                        {searchTerm || filterStatus !== 'all'
                            ? 'Try changing your filter or search keywords.'
                            : `There are currently no exams available for class ${studentClassName}.`
                        }
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                    {/* TABLE HEADER */}
                    <div className="flex items-center justify-between py-4 px-6 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-3 flex-1">
                            <span className="w-6 text-center text-[13px] font-bold text-slate-500 uppercase tracking-wider">No</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Exam Details</span>
                        </div>
                        <div className="flex items-center gap-8 pl-4">
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Duration</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[140px] text-center">Date</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[120px] text-center">Status</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[70px] text-center">Score</span>
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider min-w-[140px] text-center">Action</span>
                        </div>
                    </div>

                    {/* TABLE BODY */}
                    <div className="divide-y divide-slate-100">
                        {filteredExams.map((exam, index) => {
                            const status = getExamStatus(exam);
                            const isCompleted = exam.attempt && !exam.attempt.allowRetake;

                            return (
                                <motion.div
                                    key={exam.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    className={`flex items-center justify-between py-4 px-6 transition-colors ${isCompleted ? 'bg-emerald-50/30 hover:bg-emerald-50/50' :
                                        exam.attempt?.allowRetake ? 'bg-orange-50/30 hover:bg-orange-50/50' :
                                            'bg-white hover:bg-slate-50'
                                        }`}
                                >
                                    {/* Left Section: Number + Details */}
                                    <div className="flex items-center gap-3 flex-1">
                                        <span className="w-6 text-center text-sm font-bold text-slate-400">
                                            {index + 1}
                                        </span>
                                        <div className="flex-1">
                                            <h3 className="text-base font-bold text-slate-800 mb-0.5">
                                                {exam.title}
                                            </h3>
                                            <p className="text-sm text-slate-500 line-clamp-1">
                                                {exam.description || 'No description'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right Section: Info Columns */}
                                    <div className="flex items-center gap-8 pl-4">
                                        {/* Duration */}
                                        <div className="min-w-[100px] text-center">
                                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600">
                                                <Clock className="h-4 w-4" />
                                                {exam.duration} min
                                            </span>
                                        </div>

                                        {/* Date */}
                                        <div className="min-w-[140px] text-center">
                                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600">
                                                <Calendar className="h-4 w-4" />
                                                {exam.attempt?.submittedAt
                                                    ? new Date(exam.attempt.submittedAt.toDate()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                                                    : exam.createdAt
                                                        ? new Date(exam.createdAt.toDate()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                                                        : '-'
                                                }
                                            </span>
                                        </div>

                                        {/* Status */}
                                        <div className="min-w-[120px] flex justify-center">
                                            {getStatusBadge(exam)}
                                        </div>

                                        {/* Score */}
                                        <div className="min-w-[70px] text-center">
                                            {exam.attempt && !exam.attempt.allowRetake ? (
                                                <span className="inline-flex items-center gap-1 text-base font-bold text-emerald-600">
                                                    <Trophy className="h-4 w-4" />
                                                    {Math.round(exam.attempt.score)}
                                                </span>
                                            ) : exam.attempt?.allowRetake ? (
                                                <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-500">
                                                    <Trophy className="h-3.5 w-3.5" />
                                                    {Math.round(exam.attempt.score)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </div>

                                        {/* Action */}
                                        <div className="min-w-[140px] flex justify-center">
                                            {isCompleted ? (
                                                <button
                                                    disabled
                                                    className="px-3 py-1.5 bg-slate-200 text-slate-500 rounded-lg text-xs font-bold cursor-not-allowed"
                                                >
                                                    Completed
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => navigate(`/student/exams/${exam.id}`)}
                                                    className={`px-3 py-1.5 ${exam.attempt?.allowRetake
                                                        ? 'bg-orange-600 hover:bg-orange-700'
                                                        : 'bg-blue-600 hover:bg-blue-700'
                                                        } text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5`}
                                                >
                                                    {exam.attempt?.allowRetake ? 'Retake' : 'Start'}
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
