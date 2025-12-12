import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, CheckCircle2, ChevronRight, ChevronLeft, Save, XCircle, LayoutGrid, FileText, Link as LinkIcon, ExternalLink, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createExamSession, getExamSession, updateSessionAnswers, completeExamSession, calculateRemainingTime, isSessionExpired } from '../../utils/examSession';

export default function ExamTaker() {
    const { currentUser } = useAuth();
    const { examId } = useParams();
    const navigate = useNavigate();

    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({}); // { qId: { ...answerData } }
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeUp, setTimeUp] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [existingSession, setExistingSession] = useState(null);
    const autoSaveIntervalRef = useRef(null);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [showQuestionNav, setShowQuestionNav] = useState(false);

    // Fisher-Yates shuffle utility
    const shuffleArray = useCallback((array) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }, []);

    // Randomize questions if enabled - use session order if exists
    const randomizedQuestions = useMemo(() => {
        if (!exam || !exam.questions) return [];

        // If resuming with existing session, use saved order
        if (existingSession?.questionOrder) {
            return existingSession.questionOrder.map(id =>
                exam.questions.find(q => q.id === id)
            ).filter(Boolean);
        }

        // Otherwise shuffle if enabled
        if (exam.randomizeQuestions) {
            return shuffleArray(exam.questions);
        }
        return exam.questions;
    }, [exam, existingSession, shuffleArray]);

    // Randomize answer options for current question if enabled
    const currentQuestionWithShuffledOptions = useMemo(() => {
        if (!exam || !randomizedQuestions[currentQuestionIndex]) return null;
        const question = randomizedQuestions[currentQuestionIndex];

        // Shuffle options for single_choice, true_false, and multiple_choice
        if (exam.randomizeAnswers &&
            (question.type === 'single_choice' ||
                question.type === 'true_false' ||
                question.type === 'multiple_choice')) {

            // If resuming with existing session, use saved answer order
            if (existingSession?.answerOrders?.[question.id]) {
                const savedOrder = existingSession.answerOrders[question.id];
                return {
                    ...question,
                    options: savedOrder.map(id =>
                        question.options.find(opt => opt.id === id)
                    ).filter(Boolean)
                };
            }

            // Otherwise shuffle
            return {
                ...question,
                options: shuffleArray(question.options)
            };
        }

        return question;
    }, [exam, randomizedQuestions, currentQuestionIndex, existingSession, shuffleArray]);

    // Calculate unanswered count
    const unansweredCount = useMemo(() => {
        if (!randomizedQuestions || randomizedQuestions.length === 0) return 0;
        return randomizedQuestions.filter(q => !answers[q.id]).length;
    }, [randomizedQuestions, answers]);

    // Shuffle right options for matching questions
    const shuffledRightOptions = useMemo(() => {
        const current = currentQuestionWithShuffledOptions;
        if (!current || current.type !== 'matching') return [];

        // Return only the text values, keeping them stable
        return [...current.options].map(o => o.right).sort(() => Math.random() - 0.5);
    }, [currentQuestionWithShuffledOptions]);

    useEffect(() => {
        const loadExam = async () => {
            try {
                const docRef = doc(db, 'exams', examId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setExam({ id: docSnap.id, ...data });

                    // Check for existing session
                    const session = await getExamSession(examId, currentUser.uid);

                    if (session) {
                        // Session exists - check if expired
                        const remaining = calculateRemainingTime(session.expiresAt);

                        if (remaining > 0) {
                            // Resume session - show confirmation modal
                            setExistingSession(session);
                            setSessionId(session.id);
                            setAnswers(session.answers || {});
                            setTimeLeft(remaining);
                            setShowResumeModal(true); // Show resume modal instead of auto-starting
                        } else {
                            // Session expired - auto submit immediately
                            toast.error('Time is up! Submitting your exam...');

                            // Auto submit immediately with exam data
                            setTimeout(async () => {
                                try {
                                    // Calculate score using exam data
                                    let totalScore = 0;
                                    const maxScore = data.questions.reduce((acc, q) => acc + (q.points || 10), 0);

                                    if (maxScore > 0) {
                                        data.questions.forEach(q => {
                                            const studentAnswer = (session.answers || {})[q.id];
                                            const qPoints = q.points || 10;

                                            if (!studentAnswer) return;

                                            if (q.type === 'single_choice' || q.type === 'true_false') {
                                                const correctOpt = q.options.find(o => o.isCorrect);
                                                if (correctOpt && correctOpt.id === studentAnswer) {
                                                    totalScore += qPoints;
                                                }
                                            }
                                            // Add other question types if needed
                                        });
                                    }

                                    const finalScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

                                    await completeExamSession(session.id, session.answers || {}, finalScore);

                                    await addDoc(collection(db, 'exam_results'), {
                                        examId: data.id,
                                        studentId: currentUser.uid,
                                        answers: session.answers || {},
                                        score: finalScore,
                                        submittedAt: serverTimestamp()
                                    });

                                    toast.success("Exam submitted successfully!");
                                    navigate('/student/exams');
                                } catch (error) {
                                    console.error("Error auto-submitting expired exam:", error);
                                    toast.error("Failed to submit exam");
                                }
                            }, 1000);
                            return; // Don't set exam state, just submit and redirect
                        }
                    } else {
                        // No existing session
                        setTimeLeft(data.duration * 60); // Convert mins to seconds
                    }
                } else {
                    toast.error("Exam not found");
                    navigate('/student/exams');
                }
            } catch (error) {
                console.error("Error loading exam:", error);
                toast.error("Failed to load exam");
            } finally {
                setLoading(false);
            }
        };

        loadExam();
    }, [examId, navigate, currentUser]);

    // Auto-enter fullscreen when page loads
    useEffect(() => {
        const enterFullscreenOnLoad = () => {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        };

        // Enter fullscreen after a short delay to ensure page is loaded
        const timer = setTimeout(enterFullscreenOnLoad, 500);

        return () => clearTimeout(timer);
    }, []);

    // Timer Logic - Only run if started
    useEffect(() => {
        if (!hasStarted) return;
        if (!timeLeft || timeLeft <= 0) {
            if (timeLeft === 0 && !timeUp) {
                setTimeUp(true);
                confirmSubmit();
            }
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, timeUp, hasStarted]);

    // Auto-save answers every 10 seconds
    useEffect(() => {
        if (!hasStarted || !sessionId) return;

        const autoSave = async () => {
            try {
                await updateSessionAnswers(sessionId, answers);
                console.log('Answers auto-saved');
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        };

        // Save immediately on first start
        autoSave();

        // Then save every 10 seconds
        const interval = setInterval(autoSave, 10000);
        autoSaveIntervalRef.current = interval;

        return () => {
            if (autoSaveIntervalRef.current) {
                clearInterval(autoSaveIntervalRef.current);
            }
        };
    }, [hasStarted, sessionId, answers]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const enterFullscreen = async () => {
        try {
            // Create exam session if not resuming
            if (!sessionId) {
                // Prepare shuffle orders if randomization is enabled
                let questionOrder = null;
                let answerOrders = {};

                if (exam.randomizeQuestions) {
                    questionOrder = randomizedQuestions.map(q => q.id);
                }

                if (exam.randomizeAnswers) {
                    // Save answer order for each question
                    randomizedQuestions.forEach((question, index) => {
                        // Shuffle for single_choice, true_false, multiple_choice, and matching
                        if (question.type === 'single_choice' ||
                            question.type === 'true_false' ||
                            question.type === 'multiple_choice' ||
                            question.type === 'matching') {

                            // Get the shuffled options for this question
                            const tempQuestion = { ...question };
                            if (exam.randomizeAnswers) {
                                tempQuestion.options = shuffleArray(question.options);
                            }
                            answerOrders[question.id] = tempQuestion.options.map(opt => opt.id);
                        }
                    });
                }

                const newSessionId = await createExamSession(
                    examId,
                    currentUser.uid,
                    exam.duration,
                    questionOrder,
                    answerOrders
                );
                setSessionId(newSessionId);
                toast.success('Exam session started!');
            }

            // Enter fullscreen
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(err => console.log(err));
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }

            setHasStarted(true);
        } catch (error) {
            console.error('Error starting exam:', error);
            toast.error('Failed to start exam');
        }
    };

    // Answer Handlers
    const handleSingleChoice = (qId, optionId) => {
        setAnswers(prev => ({ ...prev, [qId]: optionId }));
    };

    const handleMultiChoice = (qId, optionId) => {
        setAnswers(prev => {
            const current = prev[qId] || []; // Array of optionIds
            if (current.includes(optionId)) {
                return { ...prev, [qId]: current.filter(id => id !== optionId) };
            } else {
                return { ...prev, [qId]: [...current, optionId] };
            }
        });
    };

    const handleMatching = (qId, pairIndex, rightValue) => {
        // answer structure: { 0: "rightVal1", 1: "rightVal2" ... } mapping pairIndex to right string
        setAnswers(prev => {
            const current = prev[qId] || {};
            // If selecting empty value (reset), delete the key
            if (!rightValue) {
                const newCurrent = { ...current };
                delete newCurrent[pairIndex];
                return { ...prev, [qId]: newCurrent };
            }
            return { ...prev, [qId]: { ...current, [pairIndex]: rightValue } };
        });
    };

    // Calculation Logic (PARTIAL SCORING)
    function calculateScore() {
        let totalScore = 0;
        const maxScore = exam.questions.reduce((acc, q) => acc + (q.points || 10), 0);

        if (maxScore === 0) return 0; // Prevent division by zero

        exam.questions.forEach(q => {
            const studentAnswer = answers[q.id];
            const qPoints = q.points || 10; // Default 10 if not set
            const partialEnabled = q.enablePartialScoring !== false; // Default true

            if (!studentAnswer) return; // No points if unanswered

            if (q.type === 'single_choice' || q.type === 'true_false') {
                // Exact Match
                const correctOpt = q.options.find(o => o.isCorrect);
                if (correctOpt && correctOpt.id === studentAnswer) {
                    totalScore += qPoints;
                }
            }
            else if (q.type === 'multiple_choice') {
                const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.id);

                if (!partialEnabled) {
                    // Strict Mode: All correct options must be selected, and NO wrong options
                    // Compare arrays (sort for safety)
                    const studentSelection = Array.isArray(studentAnswer) ? studentAnswer : [];
                    const isExactMatch =
                        studentSelection.length === correctOptions.length &&
                        studentSelection.every(id => correctOptions.includes(id));

                    if (isExactMatch) totalScore += qPoints;
                } else {
                    // Partial Scoring
                    const weightPerOption = qPoints / q.options.length;
                    let questionScore = 0;

                    q.options.forEach(opt => {
                        const isChecked = studentAnswer.includes(opt.id);
                        if (opt.isCorrect === isChecked) {
                            questionScore += weightPerOption;
                        }
                    });
                    totalScore += questionScore;
                }
            }
            else if (q.type === 'matching') {
                if (!partialEnabled) {
                    // Strict Mode: All pairs must be correct
                    const allCorrect = q.options.every((pair, idx) => {
                        const studentRightVal = studentAnswer[idx];
                        return studentRightVal && studentRightVal.trim().toLowerCase() === pair.right.trim().toLowerCase();
                    });
                    if (allCorrect) totalScore += qPoints;
                } else {
                    // Partial Scoring
                    const weightPerPair = qPoints / q.options.length;
                    let questionScore = 0;

                    q.options.forEach((pair, idx) => {
                        const studentRightVal = studentAnswer[idx];
                        if (studentRightVal && studentRightVal.trim().toLowerCase() === pair.right.trim().toLowerCase()) {
                            questionScore += weightPerPair;
                        }
                    });
                    totalScore += questionScore;
                }
            }
        });

        // Return Score (0-100)
        return (totalScore / maxScore) * 100;
    }

    const handleRequestSubmit = () => {
        setShowSubmitModal(true);
    };

    async function confirmSubmit() {
        if (isSubmitting) return;

        setIsSubmitting(true);
        setShowSubmitModal(false);

        try {
            const finalScore = calculateScore();

            // Complete exam session
            if (sessionId) {
                await completeExamSession(sessionId, answers, finalScore);
            }

            await addDoc(collection(db, 'exam_results'), {
                examId: exam.id,
                studentId: currentUser.uid,
                answers,
                score: finalScore,
                submittedAt: serverTimestamp()
            });

            // Exit fullscreen if active
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.log(err));
            }

            toast.success("Exam submitted successfully!");
            navigate('/student/exams');
        } catch (error) {
            console.error("Error submitting exam:", error);
            toast.error("Failed to submit exam");
            setIsSubmitting(false);
        }
    }

    // Get current question from randomized list
    const currentQ = currentQuestionWithShuffledOptions;

    if (loading || !exam || !currentQ) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    // Resume Confirmation Modal
    if (showResumeModal && existingSession) {
        const answeredCount = Object.keys(answers).length;
        const totalQuestions = exam.questions.length;
        const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white max-w-2xl w-full rounded-3xl shadow-xl p-8 space-y-6">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Clock className="h-10 w-10 text-amber-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">Resume Your Exam</h1>
                        <p className="text-slate-500">You have an exam in progress. Here's your current status:</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 space-y-4">
                        <h2 className="font-bold text-lg text-slate-800">{exam.title}</h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-xl p-4 text-center">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Progress</p>
                                <p className="text-3xl font-bold text-blue-600">{progressPercent}%</p>
                                <p className="text-xs text-slate-500 mt-1">{answeredCount} of {totalQuestions} answered</p>
                            </div>

                            <div className="bg-white rounded-xl p-4 text-center">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Time Remaining</p>
                                <p className="text-3xl font-bold text-amber-600">{formatTime(timeLeft)}</p>
                                <p className="text-xs text-slate-500 mt-1">Keep going!</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-700">Completion</span>
                                <span className="text-sm font-bold text-blue-600">{answeredCount}/{totalQuestions}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-sm text-amber-800">
                            <strong>Note:</strong> Your answers have been automatically saved. Click continue to resume where you left off.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setShowResumeModal(false);
                                setHasStarted(true);

                                // Enter fullscreen
                                const elem = document.documentElement;
                                if (elem.requestFullscreen) {
                                    elem.requestFullscreen().catch(err => console.log(err));
                                } else if (elem.webkitRequestFullscreen) {
                                    elem.webkitRequestFullscreen();
                                } else if (elem.msRequestFullscreen) {
                                    elem.msRequestFullscreen();
                                }

                                toast.success('Resuming your exam...');
                            }}
                            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all text-lg"
                        >
                            Continue Exam
                        </button>
                        <button
                            onClick={() => navigate('/student/exams')}
                            className="px-6 py-4 border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                        >
                            Exit
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Check if exam is expired
    const isExamExpired = () => {
        if (!exam || !exam.deadline) return false;
        const now = new Date();
        const deadline = exam.deadline.toDate ? exam.deadline.toDate() : new Date(exam.deadline);
        return now > deadline;
    };

    // Start Screen (First Time)
    if (!hasStarted) {
        // Show expired message if exam is past deadline and no existing session
        if (isExamExpired() && !existingSession) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl p-8 text-center space-y-6">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                            <AlertCircle className="h-10 w-10 text-red-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-red-800 mb-2">Exam Time Has Expired</h1>
                            <p className="text-slate-600">The deadline for this exam has passed. You can no longer start this exam.</p>
                        </div>

                        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                            <p className="text-sm text-red-700">
                                <b>Note:</b> Contact your teacher if you need a remedial opportunity.
                            </p>
                        </div>

                        <button
                            onClick={() => navigate('/student/exams')}
                            className="w-full py-4 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-bold shadow-lg transition-all text-lg"
                        >
                            Back to Exams
                        </button>
                    </div>
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="h-10 w-10 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">{exam.title}</h1>
                        <p className="text-slate-500">{exam.description || 'No description provided'}</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 flex justify-center gap-8">
                        <div className="text-center">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Duration</p>
                            <p className="text-xl font-bold text-slate-700">{exam.duration} Minutes</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Questions</p>
                            <p className="text-xl font-bold text-slate-700">{randomizedQuestions.length}</p>
                        </div>
                    </div>

                    <div className="bg-amber-50 text-amber-800 text-sm p-4 rounded-xl text-left border border-amber-100">
                        <p className="font-bold mb-1 flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Rules:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>The timer starts immediately after you click Start.</li>
                            <li>The exam will enter <b>Full Screen</b> mode.</li>
                            <li>Do not exit Full Screen or switch tabs, or you may be disqualified.</li>
                        </ul>
                    </div>

                    <button
                        onClick={enterFullscreen}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all text-lg"
                    >
                        {existingSession ? 'Resume Exam' : 'Start Exam Now'}
                    </button>

                    <button
                        onClick={() => {
                            // Exit fullscreen if active
                            if (document.fullscreenElement) {
                                document.exitFullscreen().catch(err => console.log(err));
                            }
                            navigate('/student/exams');
                        }}
                        className="text-slate-400 font-medium hover:text-slate-600"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    const isLastInfo = currentQuestionIndex === randomizedQuestions.length - 1;

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-50 flex flex-col overflow-auto focus:outline-none select-none">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
                <button
                    onClick={() => {
                        // Exit fullscreen if active
                        if (document.fullscreenElement) {
                            document.exitFullscreen().catch(err => console.log(err));
                        }
                        navigate('/student/exams');
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ChevronLeft className="h-6 w-6 text-slate-700" />
                </button>

                <h1 className="font-bold text-slate-800 text-base">{exam.title}</h1>

                <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-full bg-blue-600 text-white font-bold text-sm">
                        {formatTime(timeLeft)}
                    </div>
                    <button
                        onClick={() => setShowQuestionNav(true)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <LayoutGrid className="h-5 w-5 text-slate-700" />
                    </button>
                </div>
            </div>

            {/* Main Layout Container */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Main Content Area - Fixed Height */}
                <div className="flex-1 flex flex-col p-3 md:p-6 bg-slate-100/50 overflow-hidden">
                    <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col overflow-hidden">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentQ.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-5 md:p-8 flex-1 flex flex-col overflow-hidden"
                            >
                                <div className="flex-1 overflow-y-auto">
                                    <h2 className="text-base font-normal text-slate-800 mb-6 leading-relaxed">
                                        <span className="font-bold">{currentQuestionIndex + 1})</span>
                                        {currentQ.text}
                                    </h2>

                                    {/* Attachments Section */}
                                    {currentQ.attachments && currentQ.attachments.length > 0 && (
                                        <div className="mb-8 grid grid-cols-1 gap-4">
                                            {currentQ.attachments.map((att) => (
                                                <div key={att.id} className="overflow-hidden bg-slate-50 border border-slate-200 rounded-xl">
                                                    {att.type === 'image' && (
                                                        <div className="relative group">
                                                            <img
                                                                src={att.url}
                                                                alt={att.name}
                                                                className="w-full max-h-[400px] object-contain bg-slate-900/5"
                                                            />
                                                        </div>
                                                    )}

                                                    {att.type === 'video' && (
                                                        <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                                            <video controls className="w-full h-full">
                                                                <source src={att.url} type="video/mp4" />
                                                                Your browser does not support the video tag.
                                                            </video>
                                                        </div>
                                                    )}

                                                    {att.type === 'file' && (
                                                        <a
                                                            href={att.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-3 p-4 hover:bg-slate-100 transition-colors group"
                                                        >
                                                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                                                <FileText className="h-5 w-5" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="font-medium text-slate-700 group-hover:text-blue-600 transition-colors">{att.name}</p>
                                                                <p className="text-xs text-slate-500">Click to view document</p>
                                                            </div>
                                                            <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-500" />
                                                        </a>
                                                    )}

                                                    {att.type === 'link' && (
                                                        <a
                                                            href={att.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-3 p-4 hover:bg-slate-100 transition-colors group"
                                                        >
                                                            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                                                <LinkIcon className="h-5 w-5" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">{att.name || att.url}</p>
                                                                <p className="text-xs text-slate-500">{att.url}</p>
                                                            </div>
                                                            <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-indigo-500" />
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex-1 space-y-3">
                                        {/* Render Options based on Type */}
                                        {currentQ.type === 'single_choice' || currentQ.type === 'true_false' ? (
                                            currentQ.options.map((opt, idx) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => handleSingleChoice(currentQ.id, opt.id)}
                                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${answers[currentQ.id] === opt.id
                                                        ? 'border-green-500 bg-green-50'
                                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                                        }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${answers[currentQ.id] === opt.id
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {String.fromCharCode(65 + idx)}
                                                    </div>
                                                    <span className="font-medium text-slate-800">{opt.text}</span>
                                                </button>
                                            ))
                                        ) : currentQ.type === 'multiple_choice' ? (
                                            currentQ.options.map((opt, idx) => {
                                                const isSelected = (answers[currentQ.id] || []).includes(opt.id);
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => handleMultiChoice(currentQ.id, opt.id)}
                                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${isSelected
                                                            ? 'border-green-500 bg-green-50'
                                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                                            }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${isSelected
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {String.fromCharCode(65 + idx)}
                                                        </div>
                                                        <span className="font-medium text-slate-800">{opt.text}</span>
                                                    </button>
                                                );
                                            })
                                        ) : currentQ.type === 'matching' ? (
                                            <div className="space-y-4">
                                                {currentQ.options.map((pair, idx) => {
                                                    // Get all currently selected values for this question
                                                    const currentAnswers = answers[currentQ.id] || {};
                                                    const selectedValues = Object.values(currentAnswers);
                                                    const myValue = currentAnswers[idx] || "";

                                                    return (
                                                        <div key={pair.id} className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                                                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-medium text-slate-700">
                                                                {pair.left}
                                                            </div>
                                                            <div className="text-slate-400">⟶</div>
                                                            <select
                                                                value={myValue}
                                                                onChange={(e) => handleMatching(currentQ.id, idx, e.target.value)}
                                                                className="p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none w-full bg-white transition-colors"
                                                            >
                                                                <option value="">Select Match...</option>
                                                                {shuffledRightOptions.map((optValue, i) => {
                                                                    // Disable if already selected AND NOT by me
                                                                    const isTaken = selectedValues.includes(optValue) && optValue !== myValue;
                                                                    return (
                                                                        <option key={i} value={optValue} disabled={isTaken} className={isTaken ? 'text-slate-300' : 'text-slate-900'}>
                                                                            {optValue}
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                        </div>
                                                    )
                                                })}
                                                <p className="text-xs text-slate-500 italic mt-2">* Select matching pair from dropdown. Used options cannot be selected again.</p>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        {/* Navigation Bar - 3 Buttons */}
                        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-10" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                            <div className="max-w-4xl mx-auto flex items-center gap-3">
                                <button
                                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentQuestionIndex === 0}
                                    className="flex-1 px-4 py-3 rounded-lg bg-slate-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-all"
                                >
                                    Previous
                                </button>

                                <button
                                    onClick={() => setCurrentQuestionIndex(prev => Math.min(randomizedQuestions.length - 1, prev + 1))}
                                    disabled={isLastInfo}
                                    className="flex-1 px-4 py-3 rounded-lg bg-white text-slate-700 font-bold border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                                >
                                    Skip
                                </button>

                                {isLastInfo ? (
                                    <button
                                        onClick={handleRequestSubmit}
                                        disabled={isSubmitting}
                                        className="flex-1 px-4 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-all"
                                    >
                                        {isSubmitting ? 'Submitting...' : 'Submit'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setCurrentQuestionIndex(prev => Math.min(randomizedQuestions.length - 1, prev + 1))}
                                        className="flex-1 px-4 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition-all"
                                    >
                                        Next
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>


                {/* Question Navigator - Desktop: Sidebar, Mobile: Bottom Sheet */}

                {/* Desktop Sidebar (hidden on mobile) */}
                <div className="hidden md:block fixed z-[90] top-0 bottom-0 right-0 w-[280px] translate-x-[280px] hover:translate-x-0 transition-transform duration-300 ease-out shadow-2xl group/sidebar">
                    {/* Handle (Vertical Tab) */}
                    <div className="absolute top-1/2 -translate-y-1/2 -left-10 w-10 h-auto py-4 bg-slate-900 rounded-l-xl shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors border-y border-l border-slate-800 gap-2">
                        <span className="writing-vertical-lr text-sm text-white rotate-180 whitespace-nowrap py-2 antialiased tracking-wide" style={{ writingMode: 'vertical-rl' }}>
                            Question Navigator
                        </span>
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-lg shadow-blue-500/50"></span>
                    </div>

                    {/* Main Content Panel */}
                    <div className="h-full bg-white flex flex-col border-l border-slate-200">
                        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shrink-0">
                                    <LayoutGrid className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-slate-800 font-bold text-lg tracking-tight">
                                        Question Navigator
                                    </h3>
                                    <p className="text-slate-500 text-xs mt-1">Click number to jump to question</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 content-start">
                            <div className="grid grid-cols-5 gap-2">
                                {randomizedQuestions.map((q, idx) => {
                                    const isAnswered = !!answers[q.id];
                                    const isActive = currentQuestionIndex === idx;
                                    return (
                                        <button
                                            key={q.id}
                                            onClick={() => setCurrentQuestionIndex(idx)}
                                            className={`w-10 h-10 rounded-md font-semibold text-sm transition-all flex items-center justify-center ${isActive
                                                ? 'bg-blue-500 text-white shadow-md scale-105'
                                                : isAnswered
                                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                    : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400 hover:text-blue-600'
                                                }`}
                                        >
                                            {idx + 1}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Question Navigator Button */}
                <button
                    onClick={() => setShowQuestionNav(true)}
                    className="md:hidden fixed top-20 right-4 z-[100] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-500/50 flex items-center gap-2 transition-all active:scale-95 text-sm font-bold"
                    aria-label="Open Question Navigator"
                >
                    <LayoutGrid className="w-4 h-4" />
                    Questions
                </button>

                {/* Mobile Bottom Sheet */}
                <AnimatePresence>
                    {showQuestionNav && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowQuestionNav(false)}
                                className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]"
                            />

                            {/* Bottom Sheet */}
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                                className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[201] max-h-[80vh] flex flex-col"
                            >
                                {/* Handle */}
                                <div className="pt-3 pb-2 flex justify-center">
                                    <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
                                </div>

                                {/* Header */}
                                <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
                                                <LayoutGrid className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-slate-800 font-bold text-lg">Questions</h3>
                                                <p className="text-slate-500 text-xs">Tap to jump</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowQuestionNav(false)}
                                            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                                        >
                                            <XCircle className="w-5 h-5 text-slate-600" />
                                        </button>
                                    </div>
                                </div>

                                {/* Question Grid */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="grid grid-cols-5 gap-3">
                                        {randomizedQuestions.map((q, idx) => {
                                            const isAnswered = !!answers[q.id];
                                            const isActive = currentQuestionIndex === idx;
                                            return (
                                                <button
                                                    key={q.id}
                                                    onClick={() => {
                                                        setCurrentQuestionIndex(idx);
                                                        setShowQuestionNav(false);
                                                    }}
                                                    className={`aspect-square rounded-xl font-bold text-base transition-all flex items-center justify-center active:scale-95 ${isActive
                                                        ? 'bg-blue-500 text-white shadow-md'
                                                        : isAnswered
                                                            ? 'bg-emerald-500 text-white'
                                                            : 'bg-slate-100 text-slate-700 border-2 border-slate-200'
                                                        }`}
                                                >
                                                    {idx + 1}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>


            </div>

            {/* Custom Modal for Submission */}
            {
                showSubmitModal && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Save className="h-8 w-8" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">
                                    {unansweredCount > 0 ? 'Cannot Submit Exam' : 'Submit Exam?'}
                                </h3>

                                {unansweredCount > 0 ? (
                                    <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm">
                                        <p className="font-bold flex items-center justify-center gap-2 text-lg mb-2">
                                            <XCircle className="h-6 w-6" />
                                            Incomplete Answers
                                        </p>
                                        <p className="mt-1 text-slate-600">
                                            You still have <span className="font-bold text-red-600 text-lg mx-1">{unansweredCount}</span> unanswered questions.
                                        </p>
                                        <p className="mt-2 font-medium">
                                            Please complete all answers before submitting.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-slate-500 mb-6">
                                        Are you sure you want to finish this exam? Answers cannot be changed after submission.
                                    </p>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowSubmitModal(false)}
                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                                    >
                                        {unansweredCount > 0 ? 'Go Back' : 'Cancel'}
                                    </button>
                                    {unansweredCount === 0 && (
                                        <button
                                            onClick={confirmSubmit}
                                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-colors"
                                        >
                                            Yes, Submit
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
