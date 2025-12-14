import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NewExamsBanner({ newExams, onDismiss }) {
    const navigate = useNavigate();

    if (!newExams || newExams.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl p-5 mb-6 relative shadow-lg"
            >
                <button
                    onClick={onDismiss}
                    className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 transition-colors"
                    aria-label="Dismiss notification"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="flex items-start gap-4">
                    <div className="bg-blue-500 p-3 rounded-xl shadow-md">
                        <Bell className="h-6 w-6 text-white animate-pulse" />
                    </div>
                    <div className="flex-1 pr-8">
                        <h3 className="font-bold text-blue-900 text-lg mb-2">
                            🎉 {newExams.length} New Exam{newExams.length > 1 ? 's' : ''} Available!
                        </h3>
                        <div className="space-y-1 mb-4">
                            {newExams.slice(0, 3).map((exam, index) => (
                                <p key={exam.id} className="text-sm text-blue-700 font-medium">
                                    {index + 1}. {exam.title}
                                </p>
                            ))}
                            {newExams.length > 3 && (
                                <p className="text-sm text-blue-600 italic">
                                    +{newExams.length - 3} more exam{newExams.length - 3 > 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                navigate('/student/exams');
                                onDismiss();
                            }}
                            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                        >
                            View All Exams
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
