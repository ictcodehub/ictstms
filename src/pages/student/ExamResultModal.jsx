import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const ExamResultModal = ({ showResultModal, setShowResultModal, examResult, navigate }) => {
    if (!showResultModal || !examResult) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-50/50 backdrop-blur-md"
                    onClick={() => setShowResultModal(false)}
                />

                {/* Confetti Particles (Only if passed and complete) */}
                {(examResult.gradingStatus !== 'pending' && examResult.score >= 60) && [...Array(50)].map((_, i) => (
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
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg ${examResult.gradingStatus === 'pending'
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-500' // Pending color
                            : 'bg-gradient-to-br from-blue-500 to-cyan-500' // Normal color
                            }`}
                    >
                        {examResult.gradingStatus === 'pending' ? (
                            <Clock className="h-10 w-10 text-white" />
                        ) : (
                            <CheckCircle2 className="h-10 w-10 text-white" />
                        )}
                    </motion.div>

                    {/* Title */}
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-2xl font-bold text-slate-800 mb-2"
                    >
                        {examResult.gradingStatus === 'pending' ? 'Submission Received' : 'Exam Completed!'}
                    </motion.h2>

                    {/* Status Message for Pending */}
                    {examResult.gradingStatus === 'pending' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6"
                        >
                            <div className="flex items-start gap-3 text-left">
                                <div className="bg-indigo-100 p-2 rounded-lg">
                                    <AlertCircle className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-indigo-900 text-sm mb-1">Menunggu Penilaian</h4>
                                    <p className="text-xs text-indigo-700 leading-relaxed">
                                        Jawaban esai/isian singkat Anda menyusul untuk diperiksa oleh guru. Nilai akhir akan muncul setelah pemeriksaan selesai.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Score Display (Conditional - only show if NOT pending, or show partial/pending score specifically labeled) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4, type: 'spring' }}
                        className="mb-6"
                    >
                        <div className={`text-6xl font-bold bg-clip-text text-transparent mb-2 ${examResult.gradingStatus === 'pending'
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
                            : 'bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600'
                            }`}>
                            {Math.round(examResult.score)}
                        </div>

                        {/* Grade Badge or Pending Label */}
                        {examResult.gradingStatus === 'pending' ? (
                            <div className="inline-block px-4 py-2 rounded-full text-sm font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                ⏳ Nilai Sementara (Otomatis)
                            </div>
                        ) : (
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
                        )}
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
        </AnimatePresence>
    );
};

export default ExamResultModal;
