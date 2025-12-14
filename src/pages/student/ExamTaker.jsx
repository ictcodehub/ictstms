import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, CheckCircle2, ChevronRight, ChevronLeft, Save, LayoutGrid, FileText, Link as LinkIcon, ExternalLink, AlertCircle, AlertTriangle, Send, LogOut, XCircle, ClipboardCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { createExamSession, getExamSession, updateSessionAnswers, completeExamSession, calculateRemainingTime, isSessionExpired, generatePauseCode } from '../../utils/examSession';
import { saveAnswersOffline, getOfflineAnswers, markAsSynced } from '../../utils/offlineStorage';
import ExamOfflineIndicator from '../../components/ExamOfflineIndicator';

// Debounce hook for optimized auto-save
const useDebounce = (callback, delay) => {
    const timeoutRef = useRef(null);

    return useCallback((...args) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    }, [callback, delay]);
};

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
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [remainingQuestionsCount, setRemainingQuestionsCount] = useState(0);
    const [showResultModal, setShowResultModal] = useState(false);
    const [examResult, setExamResult] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [existingSession, setExistingSession] = useState(null);
    const [expiresAt, setExpiresAt] = useState(null); // Store expiration timestamp for timer
    const autoSaveIntervalRef = useRef(null);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [showQuestionNav, setShowQuestionNav] = useState(false);
    const [showAutoSubmitNotif, setShowAutoSubmitNotif] = useState(false);

    // Pause code system
    const [showPauseCodeModal, setShowPauseCodeModal] = useState(false);
    const [pauseCode, setPauseCode] = useState('');
    const [pauseCodeError, setPauseCodeError] = useState('');
    const [isPausing, setIsPausing] = useState(false); // Flag to prevent auto-submit during legal pause

    // Auto-submit modal
    const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);
    const [autoSubmitInfo, setAutoSubmitInfo] = useState({ reason: '', score: 0, answeredCount: 0 });



    // Helper function to exit fullscreen
    const exitFullscreen = () => {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    };

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
                            setExpiresAt(session.expiresAt); // Set expiration for timer
                            setShowResumeModal(true); // Show resume modal instead of auto-starting
                        } else {
                            // Session expired - load answers first, then auto submit
                            setExistingSession(session);
                            setSessionId(session.id);
                            setAnswers(session.answers || {}); // CRITICAL: Load saved answers before auto-submit
                            setExpiresAt(session.expiresAt); // Set expiration for timer
                            setTimeUp(true); // This will trigger auto-submit with loaded answers
                        }
                    } else {
                        // No existing session - check if exam was already auto-submitted
                        const resultsQuery = query(
                            collection(db, 'exam_results'),
                            where('examId', '==', examId),
                            where('studentId', '==', currentUser.uid)
                        );
                        const resultsSnap = await getDocs(resultsQuery);

                        if (!resultsSnap.empty) {
                            // Sort results by submittedAt descending to get the latest
                            const sortedResults = resultsSnap.docs
                                .map(d => ({ id: d.id, ...d.data() }))
                                .sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));

                            const latestResult = sortedResults[0];

                            // If retake is allowed, allow starting new exam
                            if (latestResult.allowRetake) {
                                setTimeLeft(data.duration * 60);
                                return;
                            }

                            // Exam already submitted and NO retake allowed
                            if (latestResult.autoSubmitted && !latestResult.autoSubmitNotified) {
                                // Show notification modal
                                setShowAutoSubmitNotif(true);

                                // Update flag to prevent showing again
                                await updateDoc(doc(db, 'exam_results', latestResult.id), {
                                    autoSubmitNotified: true
                                });
                            }

                            // Redirect to exams list after a short delay
                            setTimeout(() => {
                                navigate('/student/exams');
                            }, showAutoSubmitNotif ? 3000 : 1000);
                        } else {
                            // No existing session and no results - fresh start
                            setTimeLeft(data.duration * 60); // Convert mins to seconds
                        }
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

    // Detect illegal exit (tab switch, fullscreen exit, browser close)
    useEffect(() => {
        if (!hasStarted || timeUp || isSubmitting || isPausing) return;

        // Detect tab switch (visibility change)
        const handleVisibilityChange = () => {
            if (document.hidden && !isPausing) {
                console.log('Tab switch detected - auto-submitting');
                handleIllegalExit();
            }
        };

        // Detect fullscreen exit (ESC key)
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && hasStarted && !timeUp && !isSubmitting && !isPausing) {
                console.log('Fullscreen exit detected - auto-submitting');
                handleIllegalExit();
            }
        };

        // Detect window blur (Win key, Alt+Tab, clicking outside browser)
        const handleWindowBlur = () => {
            if (!isPausing && hasStarted && !timeUp && !isSubmitting) {
                console.log('Window blur detected (Win key / Alt+Tab) - auto-submitting');
                handleIllegalExit();
            }
        };

        // Detect browser close / navigate away
        const handleBeforeUnload = (e) => {
            if (isPausing) return; // Don't trigger if pausing legally

            e.preventDefault();
            e.returnValue = '⚠️ Your exam progress will be lost if you leave!';
            return e.returnValue;
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [hasStarted, timeUp, isSubmitting, isPausing, showPauseCodeModal, answers, sessionId]);

    // Update timer in Resume Modal (real-time)
    useEffect(() => {
        if (showResumeModal && expiresAt) {
            const updateTimer = () => {
                const remaining = calculateRemainingTime(expiresAt);
                setTimeLeft(remaining);
            };

            // Update immediately
            updateTimer();

            // Then update every second
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }
    }, [showResumeModal, expiresAt]);

    // Timer Logic - Real-time calculation from server timestamp
    useEffect(() => {
        if (!hasStarted) return;
        if (!expiresAt) return;

        // Calculate initial time
        const remaining = calculateRemainingTime(expiresAt);
        setTimeLeft(remaining);

        if (remaining <= 0) {
            if (!timeUp) {
                // Load saved answers before auto-submit
                const loadAndSubmit = async () => {
                    if (sessionId) {
                        const sessionDoc = await getDoc(doc(db, 'exam_sessions', sessionId));
                        if (sessionDoc.exists()) {
                            const sessionData = sessionDoc.data();
                            const loadedAnswers = sessionData.answers || {};
                            // Pass answers directly to confirmSubmit
                            setTimeUp(true);
                            confirmSubmit(true, loadedAnswers);
                        } else {
                            setTimeUp(true);
                            confirmSubmit(true);
                        }
                    } else {
                        setTimeUp(true);
                        confirmSubmit(true);
                    }
                };
                loadAndSubmit();
            }
            return;
        }

        // Update timer every second based on server time
        const timer = setInterval(() => {
            const newRemaining = calculateRemainingTime(expiresAt);
            setTimeLeft(newRemaining);

            if (newRemaining <= 0 && !timeUp) {
                // Load saved answers before auto-submit
                const loadAndSubmit = async () => {
                    if (sessionId) {
                        const sessionDoc = await getDoc(doc(db, 'exam_sessions', sessionId));
                        if (sessionDoc.exists()) {
                            const sessionData = sessionDoc.data();
                            const loadedAnswers = sessionData.answers || {};
                            // Pass answers directly to confirmSubmit
                            setTimeUp(true);
                            confirmSubmit(true, loadedAnswers);
                            clearInterval(timer);
                        } else {
                            setTimeUp(true);
                            confirmSubmit(true);
                            clearInterval(timer);
                        }
                    } else {
                        setTimeUp(true);
                        confirmSubmit(true);
                        clearInterval(timer);
                    }
                };
                loadAndSubmit();
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [hasStarted, expiresAt, timeUp, sessionId]);

    // Auto-submit if session expired on load
    useEffect(() => {
        if (timeUp && !hasStarted && sessionId) {
            const autoSubmit = async () => {
                toast.error('Session expired! Auto-submitting your exam...');
                await confirmSubmit(true); // Auto-submit when session expired
            };
            // Small delay to ensure state is settled and toast is visible
            const timer = setTimeout(autoSubmit, 1000);
            return () => clearTimeout(timer);
        }
    }, [timeUp, hasStarted, sessionId]);

    // Cleanup: Exit fullscreen when component unmounts
    useEffect(() => {
        return () => {
            exitFullscreen();
        };
    }, []);

    // Save function with offline support
    const saveAnswers = useCallback(async () => {
        if (!sessionId) return;
        try {
            // Try online save first
            await updateSessionAnswers(sessionId, answers);
            console.log('✅ Answers saved online (writes optimized)');

            // Also save offline as backup
            await saveAnswersOffline(sessionId, answers);

            // Mark as synced if we successfully saved online
            await markAsSynced(sessionId);
        } catch (error) {
            // If offline or error, save locally
            if (!navigator.onLine) {
                await saveAnswersOffline(sessionId, answers);
                console.log('💾 Answers saved offline - will sync when online');
            } else {
                console.error('❌ Auto-save failed:', error);
                // Still try to save offline as backup
                await saveAnswersOffline(sessionId, answers);
            }
        }
    }, [sessionId, answers]);

    // Debounced version (saves 3s after last change)
    const debouncedSave = useDebounce(saveAnswers, 3000);

    // Hybrid Auto-save: Debounce + Periodic Backup (OPTIMIZED)
    useEffect(() => {
        if (!hasStarted || !sessionId) return;

        // 1. Trigger debounced save on answer changes
        debouncedSave();

        // 2. Periodic backup every 30 seconds (reduced from 10s)
        const backupInterval = setInterval(saveAnswers, 30000);
        autoSaveIntervalRef.current = backupInterval;

        // 3. Save on unmount (page leave)
        return () => {
            clearInterval(backupInterval);
            saveAnswers(); // Final save before unmount
        };
    }, [hasStarted, sessionId, answers, debouncedSave, saveAnswers]);

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
                    currentUser.displayName || currentUser.email, // Student name for teacher monitoring
                    exam.duration,
                    questionOrder,
                    answerOrders
                );
                setSessionId(newSessionId);

                // Calculate and set expiresAt for timer
                const now = new Date();
                const expirationTime = new Date(now.getTime() + exam.duration * 60 * 1000);
                setExpiresAt({ toDate: () => expirationTime }); // Match Firestore Timestamp format

                toast.success('Exam session started!');
            } else {
                // Resuming existing session - reset pause code used flag if session was paused
                const sessionDoc = await getDoc(doc(db, 'exam_sessions', sessionId));
                if (sessionDoc.exists() && sessionDoc.data().status === 'paused') {
                    await updateDoc(doc(db, 'exam_sessions', sessionId), {
                        pauseCodeUsed: false, // Reset used flag (code already generated on pause)
                        status: 'in_progress' // Change status back to in_progress
                    });
                    console.log('Exam resumed. Pause code ready for next pause.');
                    toast.success('Exam resumed!');
                }
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
    // Calculation Logic (PARTIAL SCORING)
    const calculateScore = (answersToUse = null) => {
        const finalAnswers = answersToUse || answers;
        let totalScore = 0;
        const maxScore = exam.questions.reduce((acc, q) => acc + (q.points || 10), 0);

        if (maxScore === 0) return 0; // Prevent division by zero

        exam.questions.forEach(q => {
            const studentAnswer = finalAnswers[q.id];
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
    };

    // Handle pause with teacher code
    const handlePauseWithCode = async () => {
        try {
            console.log('Pause attempt - sessionId:', sessionId);
            console.log('Pause attempt - code entered:', pauseCode);

            // Validate sessionId exists
            if (!sessionId) {
                setPauseCodeError('Session not found. Please refresh and try again.');
                return;
            }

            // Get current session to verify pause code
            const sessionDoc = await getDoc(doc(db, 'exam_sessions', sessionId));
            if (!sessionDoc.exists()) {
                console.error('Session document not found');
                setPauseCodeError('Session not found');
                return;
            }

            const sessionData = sessionDoc.data();
            console.log('Session data:', sessionData);
            console.log('Session pauseCode:', sessionData.pauseCode);

            // Verify pause code
            if (pauseCode.toUpperCase() !== sessionData.pauseCode) {
                console.log('Code mismatch:', pauseCode.toUpperCase(), '!==', sessionData.pauseCode);
                setPauseCodeError('Incorrect pause code. Please ask your teacher.');
                return;
            }

            console.log('Code verified, pausing exam...');

            // Set pausing flag to prevent auto-submit
            setIsPausing(true);

            // Save current answers using updateSessionAnswers
            if (Object.keys(answers).length > 0) {
                await updateSessionAnswers(sessionId, answers);
            }

            // Update session to paused
            const newPauseCode = generatePauseCode(); // Generate new code immediately

            await updateDoc(doc(db, 'exam_sessions', sessionId), {
                status: 'paused',
                pauseCode: newPauseCode, // Set new code for next pause (not used yet, so don't mark as used)
                pauseCount: (sessionData.pauseCount || 0) + 1,
                pauseHistory: [
                    ...(sessionData.pauseHistory || []),
                    {
                        pausedAt: new Date().toISOString(), // Use ISO string instead of serverTimestamp
                        resumedAt: null,
                        duration: null
                    }
                ],
                timeRemaining: timeLeft,
                lastActivityAt: serverTimestamp()
            });

            console.log('Exam paused successfully. New code generated:', newPauseCode);
            toast.success('Exam paused successfully!');
            exitFullscreen();
            navigate('/student/exams');
        } catch (error) {
            console.error('Error pausing exam:', error);
            setPauseCodeError('Failed to pause exam. Please try again.');
        }
    };

    // Handle illegal exit (auto-submit)
    const handleIllegalExit = async () => {
        console.log('⚠️ Illegal exit detected - Auto-submitting exam');

        try {
            // Calculate score with current answers
            const finalScore = calculateScore(answers);

            // Complete session
            if (sessionId) {
                await completeExamSession(sessionId, answers, finalScore);
            }

            // Save result with violation flag
            await addDoc(collection(db, 'exam_results'), {
                examId: exam.id,
                studentId: currentUser.uid,
                answers: answers,
                score: finalScore,
                submittedAt: serverTimestamp(),
                autoSubmitted: true,
                autoSubmitReason: 'illegal_exit',
                flaggedForReview: true
            });

            // Exit fullscreen
            exitFullscreen();

            // Count answered questions
            const answeredCount = Object.keys(answers).length;

            // Set modal info and show modal
            setAutoSubmitInfo({
                reason: 'Illegal Exit Detected',
                score: Math.round(finalScore),
                answeredCount: answeredCount,
                totalQuestions: exam.questions.length
            });
            setShowAutoSubmitModal(true);
            setShowPauseCodeModal(false); // Force close pause modal if open

            // Don't navigate immediately - let user see modal and click button
        } catch (error) {
            console.error('Error auto-submitting:', error);
        }
    };

    const handleRequestSubmit = () => {
        // Check if all questions are answered
        const answeredCount = Object.keys(answers).length;
        const totalQuestions = randomizedQuestions.length;

        if (answeredCount < totalQuestions) {
            const remaining = totalQuestions - answeredCount;
            setRemainingQuestionsCount(remaining);
            setShowWarningModal(true);
            return;
        }

        setShowSubmitModal(true);
    };

    const confirmSubmit = async (isAutoSubmit = false, answersToSubmit = null) => {
        console.log('confirmSubmit called', { isAutoSubmit, isSubmitting, answersCount: Object.keys(answers).length });

        if (isSubmitting) {
            console.log('Already submitting, returning');
            return;
        }

        setIsSubmitting(true);
        setShowSubmitModal(false);

        // OPTIMIZED: Save answers one final time before submitting
        await saveAnswers();

        // Use provided answers or current state
        const finalAnswers = answersToSubmit || answers;
        console.log('Final answers:', finalAnswers);

        try {
            const finalScore = calculateScore(finalAnswers);
            console.log('Calculated score:', finalScore);

            // Complete exam session
            if (sessionId) {
                console.log('Completing exam session:', sessionId);
                await completeExamSession(sessionId, finalAnswers, finalScore);
            }

            console.log('Adding exam result to database');
            await addDoc(collection(db, 'exam_results'), {
                examId: exam.id,
                studentId: currentUser.uid,
                answers: finalAnswers,
                score: finalScore,
                submittedAt: serverTimestamp(),
                autoSubmitted: isAutoSubmit,
                autoSubmitNotified: false
            });

            // Exit fullscreen if active
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.log(err));
            }

            // Show result modal instead of immediate navigation (unless auto-submitted)
            if (!isAutoSubmit) {
                console.log('Showing result modal');

                // Calculate detailed stats
                const timeTakenSeconds = (exam.duration * 60) - timeLeft;
                const formattedTime = `${Math.floor(timeTakenSeconds / 60)}m ${timeTakenSeconds % 60}s`;

                // Calculate correct/incorrect counts (Estimate based on partial scoring)
                let correctCount = 0;
                let incorrectCount = 0;

                exam.questions.forEach(q => {
                    // Simplified check: if student got ANY points, consider correct/partial. 
                    // Ideally check against full points, but for now this is informative.
                    // Actually, let's calculate per question score to be accurate
                    // Re-using calculateScore logic partially or just trusting global score?
                    // Let's do a simple exact match check for display purposes:
                    const answer = finalAnswers[q.id];
                    if (answer) correctCount++; // Treating answered as potentially correct for now? No, that's wrong.
                });

                // Better approach: Since we have finalScore (0-100), we can't easily reverse check correctness without re-running logic.
                // Let's just pass timeTaken for now, and maybe answered count.
                // Time Taken is the new info requested.

                setExamResult({
                    score: finalScore,
                    totalQuestions: randomizedQuestions.length,
                    answeredQuestions: Object.keys(finalAnswers).length,
                    examTitle: exam.title,
                    timeTaken: formattedTime
                });
                setShowResultModal(true);
            } else {
                // Auto-submit: Show notification modal instead of immediate navigation
                console.log('Auto-submit successful, showing notification');
                setShowAutoSubmitNotif(true);
            }
        } catch (error) {
            console.error("Error submitting exam:", error);
            console.error("Error details:", error.message, error.stack);
            toast.error(`Failed to submit exam: ${error.message}`);
            setIsSubmitting(false);
        }
    };

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
                            onClick={() => {
                                exitFullscreen();
                                navigate('/student/exams');
                            }}
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
                        onClick={() => navigate('/student/exams')}
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
                {/* Left: Timer */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white">
                    <Clock className="h-5 w-5" />
                    <span className="text-sm font-normal">Time Left: <span className="font-bold tabular-nums">{formatTime(timeLeft)}</span></span>
                </div>


                {/* Right: Exit */}
                <div className="flex items-center gap-3">
                    <ExamOfflineIndicator />
                    <button
                        onClick={() => setShowQuestionNav(true)}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                        aria-label="Question Navigator"
                    >
                        <LayoutGrid className="h-6 w-6 text-slate-700" />
                    </button>
                    <button
                        onClick={() => setShowPauseCodeModal(true)}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                        aria-label="Pause Exam"
                    >
                        <LogOut className="h-6 w-6 text-amber-600" />
                    </button>
                </div>
            </div>

            {/* Main Layout Container */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Main Content Area - Fixed Height */}
                <div className="flex-1 flex flex-col p-3 md:p-6 bg-slate-100/50 overflow-hidden">
                    <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col overflow-hidden">
                        {/* Exam Title */}
                        <div className="mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 shadow-lg relative overflow-hidden">
                            {/* Decorative Elements */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>

                            {/* Content */}
                            <div className="relative flex items-center justify-between">
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-sm font-medium text-white/80 mb-1">Current Exam</p>
                                    <h1 className="text-xl md:text-2xl font-bold text-white truncate">{exam.title}</h1>
                                </div>
                                <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                                    <ClipboardCheck className="h-7 w-7 text-white" />
                                </div>
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentQ.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-5 md:p-8 flex-1 flex flex-col overflow-hidden mb-4"
                            >
                                {/* Top Question Info (All Devices) */}
                                <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        {currentQ.type === 'single_choice' ? 'Single Choice' :
                                            currentQ.type === 'multiple_choice' ? 'Multiple Choice' :
                                                currentQ.type === 'matching' ? 'Matching' :
                                                    currentQ.type === 'true_false' ? 'True/False' : 'Question'}
                                    </span>
                                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                                        Question {currentQuestionIndex + 1}/{randomizedQuestions.length}
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    <h2 className="text-base font-normal text-slate-800 mb-6 leading-relaxed">
                                        <span className="font-bold">{currentQuestionIndex + 1}).</span> {currentQ.text}
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

                        {/* Navigation Buttons - Floating */}
                        <div className="px-4 py-4 pb-safe">
                            <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                                <button
                                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentQuestionIndex === 0}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </button>



                                {isLastInfo ? (
                                    <button
                                        onClick={handleRequestSubmit}
                                        disabled={isSubmitting}
                                        className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-70 shadow-sm"
                                    >
                                        {isSubmitting ? 'Submitting...' : 'Submit'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setCurrentQuestionIndex(prev => Math.min(randomizedQuestions.length - 1, prev + 1))}
                                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-sm"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div >


            </div >

            {/* Custom Modal for Submission */}
            {
                showSubmitModal && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-md" />

                        <div className="relative bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl p-8 max-w-md w-full animate-in fade-in zoom-in duration-200">
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
                                            onClick={() => confirmSubmit()}
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

            {/* Question Navigator Sidebar */}
            <AnimatePresence>
                {showQuestionNav && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowQuestionNav(false)}
                            className="fixed inset-0 bg-black/30 z-40"
                        />

                        {/* Sidebar */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-5 border-b border-slate-200">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-xl font-bold text-slate-800">Question Navigator</h3>
                                    <button
                                        onClick={() => setShowQuestionNav(false)}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <XCircle className="h-5 w-5 text-slate-500" />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400 mb-3 italic">
                                    Click a number to jump to a specific question
                                </p>
                                <p className="text-sm text-slate-500">
                                    {Object.keys(answers).length} of {randomizedQuestions.length} answered
                                </p>
                            </div>

                            {/* Question Grid */}
                            <div className="flex-1 overflow-y-auto p-5">
                                <div className="grid grid-cols-5 gap-x-2 gap-y-4">
                                    {randomizedQuestions.map((q, idx) => {
                                        const isAnswered = !!answers[q.id];
                                        const isCurrent = idx === currentQuestionIndex;

                                        return (
                                            <button
                                                key={q.id}
                                                onClick={() => {
                                                    setCurrentQuestionIndex(idx);
                                                }}
                                                className={`
                                                    w-10 h-10 rounded-lg font-semibold text-sm transition-all
                                                    ${isCurrent
                                                        ? 'bg-blue-600 text-white shadow-md scale-105'
                                                        : isAnswered
                                                            ? 'bg-green-500 text-white hover:bg-green-600'
                                                            : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                                                    }
                                                `}
                                            >
                                                {idx + 1}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Legend - Bottom Fixed */}
                            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 pb-safe">
                                <div className="flex items-center justify-between text-xs pr-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                        <span className="text-slate-600">Unanswered</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                                        <span className="text-slate-600">Current</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <span className="text-slate-600">Answered</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Warning Modal - Unanswered Questions */}
            <AnimatePresence>
                {showWarningModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-50/50 backdrop-blur-md"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 50 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 50 }}
                            transition={{ type: "spring", duration: 0.5 }}
                            className="relative bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl p-8 max-w-md w-full"
                        >
                            <div className="text-center">
                                {/* Warning Icon */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                    className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6"
                                >
                                    <AlertCircle className="h-10 w-10 text-amber-600" />
                                </motion.div>

                                {/* Title */}
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-2xl font-bold text-slate-800 mb-3"
                                >
                                    Warning!
                                </motion.h2>

                                {/* Message */}
                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-slate-600 mb-6 leading-relaxed"
                                >
                                    You still have <span className="font-bold text-amber-600">{remainingQuestionsCount} unanswered question{remainingQuestionsCount > 1 ? 's' : ''}</span>!
                                    <br />
                                    Please complete all questions before submitting.
                                </motion.p>

                                {/* Button */}
                                <motion.button
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowWarningModal(false)}
                                    className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors shadow-lg"
                                >
                                    OK, I Understand
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Auto-Submit Notification Modal */}
            <AnimatePresence>
                {showAutoSubmitNotif && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-md" />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 50 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 50 }}
                            transition={{ type: "spring", duration: 0.5 }}
                            className="relative bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl p-10 max-w-lg w-full"
                        >
                            <div className="text-center">
                                {/* Animated Icon */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                    className="relative mx-auto mb-6"
                                >
                                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                        <Clock className="h-12 w-12 text-white" />
                                    </div>
                                    {/* Pulse effect */}
                                    <div className="absolute inset-0 w-24 h-24 bg-blue-400 rounded-full animate-ping opacity-20 mx-auto"></div>
                                </motion.div>

                                {/* Title */}
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-4"
                                >
                                    Exam Auto-Submitted
                                </motion.h2>

                                {/* Message */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="mb-8"
                                >
                                    <p className="text-slate-600 text-lg leading-relaxed">
                                        Your time has expired. The system has automatically submitted your answers.
                                    </p>
                                    <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                                        <p className="text-blue-700 font-semibold flex items-center justify-center gap-2">
                                            <CheckCircle2 className="h-5 w-5" />
                                            All answers have been saved
                                        </p>
                                    </div>
                                </motion.div>

                                {/* Button */}
                                <motion.button
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                        setShowAutoSubmitNotif(false);
                                        navigate('/student/exams');
                                    }}
                                    className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-lg font-bold rounded-2xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl"
                                >
                                    Back to Exams
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Exam Result Modal with Confetti */}
            <AnimatePresence>
                {showResultModal && examResult && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-50/50 backdrop-blur-md"
                        />

                        {/* Confetti Particles */}
                        {[...Array(50)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{
                                    x: '50vw',
                                    y: '50vh',
                                    opacity: 1,
                                    scale: 0
                                }}
                                animate={{
                                    x: `${Math.random() * 100}vw`,
                                    y: `${Math.random() * 100}vh`,
                                    opacity: 0,
                                    scale: Math.random() * 1.5 + 0.5,
                                    rotate: Math.random() * 360
                                }}
                                transition={{
                                    duration: Math.random() * 2 + 1,
                                    ease: 'easeOut',
                                    delay: Math.random() * 0.3
                                }}
                                className="absolute w-3 h-3 rounded-full"
                                style={{
                                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)]
                                }}
                            />
                        ))}

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 50 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 50 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            className="relative bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center"
                        >
                            {/* Icon */}
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-lg"
                            >
                                <CheckCircle2 className="h-10 w-10 text-white" />
                            </motion.div>

                            {/* Title */}
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-2xl font-bold text-slate-800 mb-2"
                            >
                                Exam Completed!
                            </motion.h2>

                            {/* Score Display */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4, type: 'spring' }}
                                className="mb-6"
                            >
                                <div className="text-6xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent mb-2">
                                    {Math.round(examResult.score)}
                                </div>

                                {/* Grade Badge */}
                                <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${examResult.score >= 90 ? 'bg-green-100 text-green-700' :
                                    examResult.score >= 75 ? 'bg-blue-100 text-blue-700' :
                                        examResult.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                    }`}>
                                    {examResult.score >= 90 ? '🎉 Excellent!' :
                                        examResult.score >= 75 ? '👍 Good Job!' :
                                            examResult.score >= 60 ? '💪 Keep Trying!' :
                                                '📚 Need Improvement'}
                                </div>
                            </motion.div>

                            {/* Statistics */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="grid grid-cols-2 gap-4 mb-8"
                            >
                                <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-sm text-slate-500 mb-1">Time Taken</div>
                                    <div className="font-bold text-slate-800 text-lg">{examResult.timeTaken || '-'}</div>
                                </div>
                                <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-sm text-slate-500 mb-1">Accuracy</div>
                                    <div className="font-bold text-slate-800 text-lg">
                                        {Math.round((examResult.score / 100) * examResult.totalQuestions)} / {examResult.totalQuestions}
                                    </div>
                                </div>
                                <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-sm text-slate-500 mb-1">Answered</div>
                                    <div className="font-bold text-slate-800 text-lg">{examResult.answeredQuestions}</div>
                                </div>
                                <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="text-sm text-slate-500 mb-1">Score</div>
                                    <div className="font-bold text-blue-600 text-lg">{Math.round(examResult.score)}</div>
                                </div>
                            </motion.div>

                            {/* Button */}
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    setShowResultModal(false);
                                    navigate('/student/exams');
                                }}
                                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl"
                            >
                                Back to Exams
                            </motion.button>
                        </motion.div>
                    </div>
                )
                }
            </AnimatePresence >

            {/* Pause Code Modal */}
            {showPauseCodeModal && (
                <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-2xl p-6 max-w-md w-full"
                    >
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                                <span className="text-2xl">🔒</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">
                                Request Pause
                            </h3>
                            <p className="text-slate-500 text-sm mt-1 px-4">
                                Ask your teacher for the secure pause code.
                            </p>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 flex flex-col items-center text-center shadow-sm">
                            <div className="bg-amber-100 p-3 rounded-full mb-3 ring-4 ring-amber-50/50">
                                <AlertTriangle className="h-6 w-6 text-amber-600" />
                            </div>
                            <h4 className="font-bold text-amber-800 text-sm mb-1">Action Required</h4>
                            <p className="text-sm text-amber-700 leading-relaxed px-4">
                                Exiting full-screen or switching tabs without entering the correct code will <strong>automatically submit</strong> your exam.
                            </p>
                        </div>

                        <input
                            type="text"
                            value={pauseCode}
                            onChange={(e) => {
                                setPauseCode(e.target.value.toUpperCase());
                                setPauseCodeError('');
                            }}
                            placeholder="Enter pause code"
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg mb-2 text-center text-2xl font-bold tracking-widest uppercase font-mono"
                            maxLength={6}
                            autoFocus
                        />

                        {pauseCodeError && (
                            <p className="text-sm text-red-600 mb-4">❌ {pauseCodeError}</p>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <button
                                onClick={() => {
                                    setShowPauseCodeModal(false);
                                    setPauseCode('');
                                    setPauseCodeError('');

                                    // Re-enter fullscreen if not already in fullscreen
                                    if (!document.fullscreenElement) {
                                        const elem = document.documentElement;
                                        if (elem.requestFullscreen) {
                                            elem.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
                                        } else if (elem.webkitRequestFullscreen) {
                                            elem.webkitRequestFullscreen();
                                        } else if (elem.msRequestFullscreen) {
                                            elem.msRequestFullscreen();
                                        }
                                    }
                                }}
                                className="px-6 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePauseWithCode}
                                disabled={pauseCode.length !== 6}
                                className={`px-6 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]
                                    ${pauseCode.length === 6
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200'
                                        : 'bg-slate-300 cursor-not-allowed'
                                    }`}
                            >
                                Pause Exam
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Auto-Submit Modal */}
            <AnimatePresence>
                {showAutoSubmitModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <div className="text-center">
                                {/* Icon */}
                                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <XCircle className="h-12 w-12 text-red-600" />
                                </div>

                                {/* Title */}
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                                    Exam Auto-Submitted
                                </h3>

                                {/* Reason */}
                                <p className="text-red-600 font-bold mb-6">
                                    {autoSubmitInfo.reason}
                                </p>

                                {/* Score Info */}
                                <div className="bg-slate-50 rounded-xl p-6 mb-6 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Your Score:</span>
                                        <span className="text-3xl font-bold text-blue-600">
                                            {autoSubmitInfo.score}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Questions Answered:</span>
                                        <span className="text-lg font-bold text-slate-800">
                                            {autoSubmitInfo.answeredCount} / {autoSubmitInfo.totalQuestions}
                                        </span>
                                    </div>
                                </div>

                                {/* Warning */}
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                                    <p className="text-sm text-amber-800">
                                        <strong>⚠️ Note:</strong> This submission has been flagged for teacher review due to illegal exit.
                                    </p>
                                </div>

                                {/* Button */}
                                <button
                                    onClick={() => {
                                        setShowAutoSubmitModal(false);
                                        navigate('/student/exams');
                                    }}
                                    className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg"
                                >
                                    Back to Exams
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
