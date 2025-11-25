import { Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PartyPopper, X, Award, TrendingUp, Target } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import Overview from './Overview';
import Tasks from './Tasks';
import Grades from './Grades';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useAuth } from '../../contexts/AuthContext';
import { useGradeNotifications } from '../../hooks/useGradeNotifications';

export default function StudentDashboard() {
    const { currentUser } = useAuth();
    const { notification, dismissNotification } = useGradeNotifications(currentUser);

    // Color coding based on grade
    const getGradeColor = (grade) => {
        if (grade >= 90) return { from: 'from-emerald-500', to: 'to-green-500', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
        if (grade >= 80) return { from: 'from-teal-500', to: 'to-cyan-500', text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' };
        if (grade >= 70) return { from: 'from-blue-500', to: 'to-indigo-500', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
        if (grade >= 60) return { from: 'from-amber-500', to: 'to-orange-500', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
        return { from: 'from-red-500', to: 'to-rose-500', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
    };

    // Encouragement messages - split into title and subtitle
    const getEncouragementMessage = (grade) => {
        if (grade >= 90) return { title: "Outstanding!", subtitle: "Your hard work paid off!" };
        if (grade >= 80) return { title: "Great Job!", subtitle: "Keep up the good performance!" };
        if (grade >= 70) return { title: "Good Work!", subtitle: "Keep improving!" };
        if (grade >= 60) return { title: "Not Bad!", subtitle: "You can do even better!" };
        return { title: "Don't Give Up!", subtitle: "Keep learning and improving!" };
    };

    const getIcon = (grade) => {
        if (grade >= 90) return PartyPopper;
        if (grade >= 70) return Award;
        return TrendingUp;
    };

    return (
        <DashboardLayout>
            <ErrorBoundary>
                <Routes>
                    <Route index element={<Overview />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="grades" element={<Grades />} />
                </Routes>
            </ErrorBoundary>

            {/* Global Grade Notification Modal */}
            <AnimatePresence>
                {notification && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", duration: 0.5 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            {/* Header with gradient */}
                            <div className={`bg-gradient-to-r ${getGradeColor(notification.grade).from} ${getGradeColor(notification.grade).to} p-6 text-white relative overflow-hidden`}>
                                <div className="absolute top-0 right-0 opacity-10">
                                    {(() => {
                                        const Icon = getIcon(notification.grade);
                                        return <Icon className="h-32 w-32 -mr-8 -mt-8" />;
                                    })()}
                                </div>
                                <div className="relative">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            {(() => {
                                                const Icon = getIcon(notification.grade);
                                                return <Icon className="h-6 w-6" />;
                                            })()}
                                            <h3 className="text-xl font-bold">Task Graded!</h3>
                                        </div>
                                        <button
                                            onClick={dismissNotification}
                                            className="text-white/80 hover:text-white transition-colors"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-white/20">
                                        <p className="text-white/90 text-base font-semibold mb-1">Task:</p>
                                        <p className="text-white text-sm font-normal truncate" title={notification.taskTitle}>
                                            {notification.taskTitle}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-4">
                                {/* Grade Display */}
                                <div className="text-center">
                                    <p className="text-sm text-slate-500 mb-2">Your Grade</p>
                                    <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${getGradeColor(notification.grade).bg} border-4 ${getGradeColor(notification.grade).border}`}>
                                        <span className={`text-4xl font-bold ${getGradeColor(notification.grade).text}`}>
                                            {notification.grade}
                                        </span>
                                    </div>
                                </div>

                                {/* Encouragement - No Background, Two Lines */}
                                <div className="text-center py-2">
                                    <p className={`text-xl font-bold ${getGradeColor(notification.grade).text} mb-1`}>
                                        {getEncouragementMessage(notification.grade).title}
                                    </p>
                                    <p className={`text-base ${getGradeColor(notification.grade).text}`}>
                                        {getEncouragementMessage(notification.grade).subtitle}
                                    </p>
                                </div>

                                {/* Feedback */}
                                {notification.feedback && (
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Target className="h-4 w-4 text-slate-500" />
                                            <p className="text-sm font-bold text-slate-700">Teacher's Feedback</p>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            "{notification.feedback}"
                                        </p>
                                    </div>
                                )}

                                {/* Dismiss Button with spacing */}
                                <div className="flex justify-center mt-10">
                                    <button
                                        onClick={dismissNotification}
                                        className={`px-12 py-3 rounded-xl font-bold text-white bg-gradient-to-r ${getGradeColor(notification.grade).from} ${getGradeColor(notification.grade).to} hover:shadow-lg transition-all`}
                                    >
                                        Got it!
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}


