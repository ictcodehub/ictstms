import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ArrowRight, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NewExamsBanner({ newExams, onDismiss }) {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);

    // Auto-rotate slides
    useEffect(() => {
        if (!newExams || newExams.length === 0) return;

        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % (newExams.length + 1));
        }, 3000); // Change every 3 seconds

        return () => clearInterval(interval);
    }, [newExams]);

    if (!newExams || newExams.length === 0) return null;

    // Prepare slides: first slide is summary, rest are individual exams
    const slides = [
        { type: 'summary', text: `${newExams.length} New Exam${newExams.length > 1 ? 's' : ''} Available!` },
        ...newExams.map((exam) => ({ type: 'exam', text: exam.title }))
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="bg-gradient-to-r from-blue-50 via-cyan-50 to-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-6 relative shadow-lg hover:shadow-xl transition-shadow"
            >
                <button
                    onClick={onDismiss}
                    className="absolute top-4 right-4 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg p-1 transition-all"
                    aria-label="Dismiss notification"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-6 pr-12">
                    {/* Icon */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl shadow-lg shrink-0">
                        <Bell className="h-7 w-7 text-white animate-pulse" />
                    </div>

                    {/* Animated Content */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentSlide}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.5 }}
                                className="flex items-center gap-3"
                            >
                                {slides[currentSlide].type === 'summary' ? (
                                    <span className="text-2xl">🎉</span>
                                ) : (
                                    <ClipboardList className="h-6 w-6 text-blue-600 shrink-0" />
                                )}
                                <h3 className="font-bold text-blue-900 text-xl truncate">
                                    {slides[currentSlide].text}
                                </h3>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Button */}
                    <button
                        onClick={() => {
                            navigate('/student/exams');
                            onDismiss();
                        }}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3.5 rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 shrink-0 group"
                    >
                        <span>View Exams</span>
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
