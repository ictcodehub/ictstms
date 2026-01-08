import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, AlertCircle, Check, FileText } from 'lucide-react';

const ExamResultModal = ({ showResultModal, setShowResultModal, examResult, navigate }) => {
    if (!showResultModal || !examResult) return null;

    const isPending = examResult.gradingStatus === 'pending';

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-50/90 backdrop-blur-sm"
                    onClick={() => setShowResultModal(false)}
                />

                {/* Confetti Particles (Only if passed and complete) */}
                {(!isPending && examResult.score >= 60) && [...Array(50)].map((_, i) => (
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
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full text-center overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header Banner */}
                    {/* Header Banner */}
                    <div className={`relative h-48 flex flex-col items-center justify-center overflow-hidden ${isPending
                            ? 'bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800'
                            : 'bg-gradient-to-br from-blue-600 via-cyan-600 to-blue-800'
                        }`}>
                        {/* Animated Background Shapes */}
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                rotate: [0, 90, 0],
                                opacity: [0.3, 0.5, 0.3]
                            }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                            className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"
                        />
                        <motion.div
                            animate={{
                                scale: [1, 1.5, 1],
                                x: [0, -20, 0],
                                opacity: [0.2, 0.4, 0.2]
                            }}
                            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"
                        />

                        <div className="relative z-10 text-white flex flex-col items-center pt-2">
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-4 shadow-lg ring-4 ring-white/10"
                            >
                                <motion.div
                                    animate={isPending ? {
                                        rotate: [0, 360],
                                        scale: [1, 1.1, 1]
                                    } : {
                                        scale: [1, 1.2, 1]
                                    }}
                                    transition={isPending ? {
                                        rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                                        scale: { duration: 2, repeat: Infinity }
                                    } : {
                                        duration: 0.5, delay: 0.5
                                    }}
                                >
                                    {isPending ? (
                                        <Clock className="h-8 w-8 text-white drop-shadow-md" />
                                    ) : (
                                        <CheckCircle2 className="h-8 w-8 text-white drop-shadow-md" />
                                    )}
                                </motion.div>
                            </motion.div>

                            <motion.h2
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-3xl font-bold tracking-tight mb-2 drop-shadow-sm text-center px-4"
                            >
                                {isPending ? 'Submission Received' : 'Exam Completed!'}
                            </motion.h2>

                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-white/90 text-sm font-medium px-6 text-center leading-relaxed max-w-md"
                            >
                                {isPending ? 'Your answers have been saved securely.' : 'Congratulations on finishing the exam.'}
                            </motion.p>
                        </div>
                    </div>

                    <div className="p-8">
                        {/* Split View Content */}
                        {isPending ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {/* Objective Score Card */}
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="bg-green-50 border border-green-100 rounded-xl p-5 text-left relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-3 opacity-10">
                                        <CheckCircle2 className="w-24 h-24 text-green-600 -mr-6 -mt-6" />
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-green-100 p-1.5 rounded-lg">
                                            <Check className="w-4 h-4 text-green-700" />
                                        </div>
                                        <span className="font-bold text-green-800 text-sm">Objective Score</span>
                                    </div>
                                    <div className="text-3xl font-bold text-green-700 mb-1">
                                        {Math.round(examResult.autoPoints)} <span className="text-base font-normal text-green-600">/ {examResult.maxAutoPoints}</span>
                                    </div>
                                    <div className="text-xs text-green-600">
                                        Multiple Choice & Matching
                                    </div>
                                </motion.div>

                                {/* Essay Status Card */}
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="bg-amber-50 border border-amber-100 rounded-xl p-5 text-left relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-3 opacity-10">
                                        <FileText className="w-24 h-24 text-amber-600 -mr-6 -mt-6" />
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-amber-100 p-1.5 rounded-lg">
                                            <Clock className="w-4 h-4 text-amber-700" />
                                        </div>
                                        <span className="font-bold text-amber-800 text-sm">Essay & Short Answer</span>
                                    </div>
                                    <div className="text-xl font-bold text-amber-700 mb-1 mt-1">
                                        Pending Review
                                    </div>
                                    <div className="text-xs text-amber-600">
                                        Worth up to <span className="font-bold">{examResult.manualPoints} points</span>
                                    </div>
                                </motion.div>
                            </div>
                        ) : (
                            /* Standard Single Score View */
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4, type: 'spring' }}
                                className="mb-8"
                            >
                                <div className={`text-6xl font-black bg-clip-text text-transparent mb-2 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600`}>
                                    {Math.round(examResult.score)}
                                </div>
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
                        )}

                        {/* Statistics Grid */}
                        <div className="grid grid-cols-3 gap-3 mb-8">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Time</div>
                                <div className="font-bold text-slate-800">{examResult.timeTaken || '-'}</div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Answered</div>
                                <div className="font-bold text-slate-800">{examResult.answeredQuestions} / {examResult.totalQuestions}</div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Total Score</div>
                                <div className="font-bold text-slate-800">
                                    {isPending ? (
                                        <span className="text-indigo-600 text-sm">Wait for Grade</span>
                                    ) : (
                                        <span>{Math.round(examResult.score)} / 100</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            {isPending && (
                                <p className="text-xs text-slate-500 mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                    Your final grade will be calculated once your teacher reviews your essay answers. You will see the update in your exam history.
                                </p>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    setShowResultModal(false);
                                    navigate('/student/exams');
                                }}
                                className="w-full px-6 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg"
                            >
                                Back to Exams
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ExamResultModal;
