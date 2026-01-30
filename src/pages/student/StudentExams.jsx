import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { ClipboardCheck, Clock, CheckCircle2, AlertCircle, ArrowRight, Search, Filter, ChevronDown, Trophy, Calendar, ChevronLeft, ChevronRight, ClipboardList, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '../../components/Pagination';
import { getExamSession } from '../../utils/examSession';

export default function StudentExams() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [studentClassId, setStudentClassId] = useState(null);
    const [studentClassName, setStudentClassName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth < 768 ? 5 : 10);
    const [examSessions, setExamSessions] = useState({});
    const [enrolledClassIds, setEnrolledClassIds] = useState([]); // New state

    // Responsive itemsPerPage
    useEffect(() => {
        const handleResize = () => {
            setItemsPerPage(window.innerWidth < 768 ? 5 : 10);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    useEffect(() => {
        const loadStudentData = async () => {
            if (!currentUser) return;
            try {
                // Get student's class ID
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();

                    // Collect all class IDs (legacy + new)
                    const classIds = new Set();
                    if (userData.classId) classIds.add(userData.classId);
                    if (userData.classIds && Array.isArray(userData.classIds)) {
                        userData.classIds.forEach(id => classIds.add(id));
                    }

                    const classIdsArray = Array.from(classIds);
                    setStudentClassId(userData.classId); // Keep for legacy compatibility if needed
                    setEnrolledClassIds(classIdsArray);

                    // Fetch Class Name (Primary)
                    if (userData.classId) {
                        const classDoc = await getDoc(doc(db, 'classes', userData.classId));
                        if (classDoc.exists()) {
                            setStudentClassName(classDoc.data().name);
                        } else {
                            setStudentClassName('Unknown Class');
                        }
                    } else if (classIdsArray.length > 0) {
                        setStudentClassName(`${classIdsArray.length} Classes Enrolled`);
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
        if (enrolledClassIds.length === 0 || !currentUser) {
            if (!loading && enrolledClassIds.length === 0) setLoading(false);
            return;
        }

        setLoading(true);
        let localExams = [];
        let localResults = [];

        // Updated query to check ANY of the enrolled classes
        const qExams = query(
            collection(db, 'exams'),
            where('assignedClasses', 'array-contains-any', enrolledClassIds),
            where('status', '==', 'published')
        );

        const qResults = query(
            collection(db, 'exam_results'),
            where('studentId', '==', currentUser.uid)
        );

        const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });

        const mergeAndSet = () => {
            const merged = localExams.map(exam => {
                const attempts = localResults.filter(r => r.examId === exam.id);
                attempts.sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));
                return { ...exam, attempt: attempts[0] || null };
            });

            merged.sort((a, b) => {
                let valA, valB;

                switch (sortConfig.key) {
                    case 'title':
                        valA = a.title.toLowerCase();
                        valB = b.title.toLowerCase();
                        break;
                    case 'duration':
                        valA = parseInt(a.duration) || 0;
                        valB = parseInt(b.duration) || 0;
                        break;
                    case 'status':
                        const getStatusWeight = (exam) => {
                            if (exam.attempt) return exam.attempt.allowRetake ? 2 : 3; // 2=Retake, 3=Completed
                            if (examSessions[exam.id]) return 1; // In Progress
                            if (isExamExpired(exam)) return 4; // Expired
                            return 0; // Not Started
                        };
                        valA = getStatusWeight(a);
                        valB = getStatusWeight(b);
                        break;
                    case 'score':
                        valA = a.attempt ? (a.attempt.score || 0) : -1;
                        valB = b.attempt ? (b.attempt.score || 0) : -1;
                        break;
                    default:
                        valA = 0;
                        valB = 0;
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
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
    }, [enrolledClassIds, currentUser, sortConfig]);

    // Load exam sessions for all exams with real-time listener
    useEffect(() => {
        if (!currentUser) return;

        // Real-time listener for exam sessions (include paused sessions)
        const sessionsQuery = query(
            collection(db, 'exam_sessions'),
            where('studentId', '==', currentUser.uid),
            where('status', 'in', ['in_progress', 'paused']) // Include paused sessions
        );

        const unsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
            const sessions = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                sessions[data.examId] = { id: doc.id, ...data };
            });
            setExamSessions(sessions);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const isExamExpired = (exam) => {
        if (!exam.deadline) return false;
        const now = new Date();
        const deadline = exam.deadline.toDate ? exam.deadline.toDate() : new Date(exam.deadline);
        return now > deadline;
    };

    const getStatusBadge = (exam) => {
        // Check if expired first
        if (!exam.attempt && isExamExpired(exam)) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-200">
                    <AlertCircle className="h-3 w-3" />
                    Expired
                </span>
            );
        }

        // Check if exam is paused
        if (examSessions[exam.id]?.status === 'paused') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                    <Clock className="h-3 w-3" />
                    Paused
                </span>
            );
        }

        // Check if exam is in progress (has active session)
        if (examSessions[exam.id]) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-50 text-yellow-700 text-xs font-bold rounded-full border border-yellow-200">
                    <Clock className="h-3 w-3 animate-pulse" />
                    In Progress
                </span>
            );
        }

        if (exam.attempt) {
            if (exam.attempt.allowRetake) {
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-full border border-orange-200">
                        <ArrowRight className="h-3 w-3" />
                        Remedial
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
                Available
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

    if (enrolledClassIds.length === 0 && !loading) {
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
                </div>
            </div>

            {!loading && enrolledClassIds.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                    <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
                    <div>
                        <h3 className="text-lg font-bold text-amber-800">You are not assigned to any class</h3>
                        <p className="text-amber-700 mt-1">Please contact your teacher to be added to a class so you can see exams.</p>
                    </div>
                </div>
            )}

            {/* Search and Filter */}
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

                {/* Desktop Filter */}
                <div className="hidden md:block relative min-w-[200px]">
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

                {/* Mobile Filter - Custom Dropdown */}
                <div className="md:hidden relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="w-full pl-9 pr-9 py-3 text-sm rounded-lg border border-slate-200 bg-white font-medium text-left relative"
                    >
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <span className="text-slate-700">
                            {filterStatus === 'all' ? 'All Status' :
                                filterStatus === 'not_started' ? 'Not Started' :
                                    filterStatus === 'completed' ? 'Completed' : 'Retake Available'}
                        </span>
                        <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isFilterOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                            {[
                                { value: 'all', label: 'All Status' },
                                { value: 'not_started', label: 'Not Started' },
                                { value: 'completed', label: 'Completed' },
                                { value: 'retake', label: 'Retake Available' }
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setFilterStatus(option.value);
                                        setIsFilterOpen(false);
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${filterStatus === option.value
                                        ? 'bg-blue-50 text-blue-700 font-semibold'
                                        : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
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
                    {/* TABLE HEADER - Desktop Only */}
                    <div className="hidden md:flex items-center justify-between py-4 px-6 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-3 flex-1">
                            <span className="w-6 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">No</span>
                            <div className="w-10"></div>
                            <div
                                className="flex items-center gap-1 cursor-pointer group"
                                onClick={() => handleSort('title')}
                            >
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Exam Details</span>
                                {sortConfig.key === 'title' ? (
                                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                ) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-blue-400" />}
                            </div>
                        </div>
                        <div className="flex items-center gap-8 pl-4">
                            <div
                                className="flex items-center justify-center gap-1 cursor-pointer group min-w-[100px]"
                                onClick={() => handleSort('duration')}
                            >
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Duration</span>
                                {sortConfig.key === 'duration' ? (
                                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                ) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-blue-400" />}
                            </div>

                            <div
                                className="flex items-center justify-center gap-1 cursor-pointer group min-w-[120px]"
                                onClick={() => handleSort('status')}
                            >
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Status</span>
                                {sortConfig.key === 'status' ? (
                                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                ) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-blue-400" />}
                            </div>

                            <div
                                className="flex items-center justify-center gap-1 cursor-pointer group min-w-[60px]"
                                onClick={() => handleSort('score')}
                            >
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Score</span>
                                {sortConfig.key === 'score' ? (
                                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                                ) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-blue-400" />}
                            </div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px] text-center">Action</span>
                        </div>
                    </div>

                    {/* TABLE BODY - Desktop View */}
                    <div className="hidden md:block divide-y divide-slate-100" style={{ minHeight: '650px' }}>
                        {(() => {
                            const startIndex = (currentPage - 1) * itemsPerPage;
                            const endIndex = startIndex + itemsPerPage;
                            const paginatedExams = filteredExams.slice(startIndex, endIndex);

                            return paginatedExams.map((exam, index) => {
                                const status = getExamStatus(exam);
                                const isCompleted = exam.attempt && !exam.attempt.allowRetake;
                                const isExpired = isExamExpired(exam);

                                return (
                                    <motion.div
                                        key={exam.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className={`flex flex-col md:flex-row md:items-center md:justify-between py-4 px-4 md:px-6 transition-colors gap-3 md:gap-0 rounded-xl mb-4 md:rounded-none md:mb-0 ${isCompleted ? 'bg-emerald-50/70 md:bg-white md:hover:bg-slate-50' :
                                            examSessions[exam.id] ? 'bg-yellow-50/70 hover:bg-yellow-50' :
                                                exam.attempt?.allowRetake ? 'bg-orange-50/70 hover:bg-orange-50' :
                                                    'bg-purple-50/70 hover:bg-purple-50'
                                            }`}
                                    >
                                        {/* Left Section: Number + Icon + Details */}
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {/* Number */}
                                            <span className="w-6 text-center text-xs font-bold text-slate-400">
                                                {startIndex + index + 1}
                                            </span>

                                            {/* Icon */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-colors border-2 ${isCompleted ? 'bg-white border-emerald-100 text-emerald-600' :
                                                examSessions[exam.id] ? 'bg-white border-yellow-100 text-yellow-600' :
                                                    exam.attempt?.allowRetake ? 'bg-white border-orange-100 text-orange-600' :
                                                        'bg-white border-purple-100 text-purple-600'
                                                }`}>
                                                <ClipboardCheck className="h-5 w-5" />
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-bold text-slate-800 mb-1 line-clamp-1">
                                                    {exam.title}
                                                </h3>
                                                <p className="text-xs text-slate-500 line-clamp-1">
                                                    {exam.description || `${exam.questions?.length || 0} Questions`}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Section: Table Columns */}
                                        <div className="flex items-center gap-8 pl-4">
                                            {/* Duration */}
                                            <div className="min-w-[100px] flex justify-center">
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                                    <Clock className="h-4 w-4" />
                                                    {exam.duration} min
                                                </span>
                                            </div>

                                            {/* Status Badge */}
                                            <div className="min-w-[120px] flex justify-center">
                                                {getStatusBadge(exam)}
                                            </div>

                                            {/* Score */}
                                            <div className="min-w-[60px] flex justify-center">
                                                {exam.attempt && !exam.attempt.allowRetake ? (
                                                    exam.attempt.gradingStatus === 'pending' ? (
                                                        <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                            <Clock className="h-3 w-3 mr-1" /> Pending
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-bold border ${Math.round(exam.attempt.score) >= 90 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                            Math.round(exam.attempt.score) >= 80 ? 'bg-teal-50 text-teal-600 border-teal-100' :
                                                                Math.round(exam.attempt.score) >= 70 ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                    Math.round(exam.attempt.score) >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                        'bg-red-50 text-red-600 border-red-100'
                                                            }`}>
                                                            {Math.round(exam.attempt.score)}
                                                        </span>
                                                    )
                                                ) : exam.attempt?.allowRetake ? (
                                                    <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-bold border ${Math.round(exam.attempt.score) >= 90 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        Math.round(exam.attempt.score) >= 80 ? 'bg-teal-50 text-teal-600 border-teal-100' :
                                                            Math.round(exam.attempt.score) >= 70 ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                Math.round(exam.attempt.score) >= 60 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                    'bg-red-50 text-red-600 border-red-100'
                                                        }`}>
                                                        {Math.round(exam.attempt.score)}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-sm font-bold text-slate-400">–</span>
                                                )}
                                            </div>

                                            {/* Action Button */}
                                            <div className="min-w-[100px] flex justify-center">
                                                {isCompleted ? (
                                                    <button
                                                        onClick={() => {
                                                            if (exam.showResultToStudents) {
                                                                navigate(`/student/exams/${exam.id}/review`);
                                                            }
                                                        }}
                                                        disabled={!exam.showResultToStudents}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${exam.showResultToStudents
                                                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                                                            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        {exam.showResultToStudents ? 'Review' : 'Completed'}
                                                        {exam.showResultToStudents && <ExternalLink className="h-3 w-3" />}
                                                    </button>
                                                ) : isExpired && !exam.attempt ? (
                                                    <button
                                                        disabled
                                                        className="px-3 py-1.5 bg-red-200 text-red-600 rounded-lg text-xs font-bold cursor-not-allowed"
                                                    >
                                                        Expired
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => navigate(`/student/exams/${exam.id}`)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${exam.attempt?.allowRetake
                                                            ? 'bg-orange-600 hover:bg-orange-700 text-white'
                                                            : examSessions[exam.id]
                                                                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                                                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                            }`}
                                                    >
                                                        {exam.attempt?.allowRetake ? 'Retake' : examSessions[exam.id] ? 'Resume' : 'Start'}
                                                        <ArrowRight className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            });
                        })()}
                    </div>

                    {/* MOBILE CARDS - Mobile Only */}
                    <div className="md:hidden p-6 space-y-0" style={{ minHeight: '650px' }}>
                        {(() => {
                            const startIndex = (currentPage - 1) * itemsPerPage;
                            const endIndex = startIndex + itemsPerPage;
                            const paginatedExams = filteredExams.slice(startIndex, endIndex);

                            return paginatedExams.map((exam, index) => {
                                const status = getExamStatus(exam);
                                const isCompleted = exam.attempt && !exam.attempt.allowRetake;
                                const isExpired = isExamExpired(exam);

                                return (
                                    <motion.div
                                        key={`mobile-${exam.id}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className={`flex flex-col p-4 transition-all rounded-2xl mb-4 border-2 ${isCompleted ? 'bg-emerald-50/50 border-emerald-200' :
                                            exam.attempt?.allowRetake ? 'bg-orange-50/50 border-orange-200' :
                                                'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                                            }`}
                                    >
                                        {/* Header: Icon + Title + Status */}
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${isCompleted ? 'bg-emerald-100 text-emerald-600' :
                                                exam.attempt?.allowRetake ? 'bg-orange-100 text-orange-600' :
                                                    'bg-purple-100 text-purple-600'
                                                }`}>
                                                <ClipboardCheck className="h-6 w-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <h3 className="text-sm font-bold text-slate-800 line-clamp-1 flex-1">
                                                        {exam.title}
                                                    </h3>
                                                    {/* Status Badge */}
                                                    <div className="flex-shrink-0">
                                                        {getStatusBadge(exam)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" /> {exam.duration} min
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <ClipboardList className="h-3.5 w-3.5" /> {exam.questions?.length || 0} Questions
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Divider */}
                                        <div className="border-t border-slate-200 my-3"></div>

                                        {/* Score - Full Width (Only if has score) */}
                                        {exam.attempt && (
                                            <div className="mb-3">
                                                {exam.attempt && !exam.attempt.allowRetake ? (
                                                    exam.attempt.gradingStatus === 'pending' ? (
                                                        <div className="w-full py-3 px-4 border-2 border-indigo-100 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center gap-2">
                                                            <Clock className="h-4 w-4" />
                                                            <span className="text-sm font-bold">Grading in Progress</span>
                                                        </div>
                                                    ) : (
                                                        <div className={`w-full py-3 px-4 border-2 rounded-xl flex items-center justify-center gap-2 ${Math.round(exam.attempt.score) >= 90 ? 'bg-emerald-100 border-emerald-200 text-emerald-700' :
                                                            Math.round(exam.attempt.score) >= 80 ? 'bg-teal-100 border-teal-200 text-teal-700' :
                                                                Math.round(exam.attempt.score) >= 70 ? 'bg-blue-100 border-blue-200 text-blue-700' :
                                                                    Math.round(exam.attempt.score) >= 60 ? 'bg-amber-100 border-amber-200 text-amber-700' :
                                                                        'bg-red-100 border-red-200 text-red-700'
                                                            }`}>
                                                            <span className="text-sm font-bold">Score: {Math.round(exam.attempt.score)}</span>
                                                        </div>
                                                    )
                                                ) : exam.attempt?.allowRetake && (
                                                    <div className={`w-full py-3 px-4 border-2 rounded-xl flex items-center justify-center gap-2 ${Math.round(exam.attempt.score) >= 90 ? 'bg-emerald-100 border-emerald-200 text-emerald-700' :
                                                        Math.round(exam.attempt.score) >= 80 ? 'bg-teal-100 border-teal-200 text-teal-700' :
                                                            Math.round(exam.attempt.score) >= 70 ? 'bg-blue-100 border-blue-200 text-blue-700' :
                                                                Math.round(exam.attempt.score) >= 60 ? 'bg-amber-100 border-amber-200 text-amber-700' :
                                                                    'bg-red-100 border-red-200 text-red-700'
                                                        }`}>
                                                        <span className="text-sm font-bold">Previous Score: {Math.round(exam.attempt.score)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Action Button - Full Width & Prominent */}
                                        {isCompleted ? (
                                            <button
                                                onClick={() => {
                                                    if (exam.showResultToStudents) {
                                                        navigate(`/student/exams/${exam.id}/review`);
                                                    }
                                                }}
                                                disabled={!exam.showResultToStudents}
                                                className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mt-3 ${exam.showResultToStudents
                                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer border border-blue-200'
                                                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                                    }`}
                                            >
                                                {exam.showResultToStudents ? (
                                                    <>
                                                        <ExternalLink className="h-5 w-5" />
                                                        View Review
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="h-5 w-5" />
                                                        Completed
                                                    </>
                                                )}
                                            </button>
                                        ) : isExpired && !exam.attempt ? (
                                            <button
                                                disabled
                                                className="w-full py-3 px-4 bg-red-100 text-red-600 rounded-xl text-xs font-bold cursor-not-allowed flex items-center justify-center gap-2 mt-3 border-2 border-red-200"
                                            >
                                                <AlertCircle className="h-5 w-5" />
                                                Exam Expired
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => navigate(`/student/exams/${exam.id}`)}
                                                className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg mt-3 ${exam.attempt?.allowRetake
                                                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-orange-200'
                                                    : examSessions[exam.id]
                                                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-teal-200'
                                                        : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-200'
                                                    }`}
                                            >
                                                {exam.attempt?.allowRetake ? (
                                                    <>
                                                        <ArrowRight className="h-5 w-5" />
                                                        Retake Exam
                                                    </>
                                                ) : examSessions[exam.id] ? (
                                                    <>
                                                        <ArrowRight className="h-5 w-5" />
                                                        Resume Exam
                                                    </>
                                                ) : (
                                                    <>
                                                        <ArrowRight className="h-5 w-5" />
                                                        Start Exam
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </motion.div>
                                );
                            });
                        })()}
                    </div>

                    {/* Pagination Footer */}
                    {(() => {
                        const totalItems = filteredExams.length;
                        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
                        const startIndex = (currentPage - 1) * itemsPerPage;
                        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

                        return (
                            <div className="bg-white px-6 py-4 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                                <p className="text-sm text-slate-500">
                                    Showing <span className="font-medium">{totalItems === 0 ? 0 : startIndex + 1}</span> - <span className="font-medium">{endIndex}</span> of <span className="font-medium">{totalItems}</span> exams
                                </p>
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        );
                    })()}
                </div>
            )}


        </div>
    );
}
