import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, Send, FileText, ChevronDown, ChevronUp, Upload, Download } from 'lucide-react';

export default function TasksMobile({
    tasks,
    submissions,
    currentPage,
    itemsPerPage,
    expandedTask,
    submitting,
    comment,
    file,
    fileInputRef,
    setComment,
    setFile,
    toggleExpand,
    handleSubmit,
    setCurrentPage
}) {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedTasks = tasks.slice(startIndex, endIndex);

    return (
        <div className="space-y-3 p-4" style={{ minHeight: '650px' }}>
            {paginatedTasks.map((task, index) => {
                const submission = submissions[task.id];
                const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;
                const isExpanded = expandedTask === task.id;
                const isSubmitting = submitting === task.id;
                const isGraded = submission && submission.grade !== null && submission.grade !== undefined;
                const deadlineDate = task.deadline ? new Date(task.deadline) : null;

                // Determine status badge
                let statusBadge = null;
                if (isGraded) {
                    statusBadge = (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Graded</span>
                        </div>
                    );
                } else if (submission) {
                    statusBadge = (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Pending Review</span>
                        </div>
                    );
                } else if (isOverdue) {
                    statusBadge = (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Overdue</span>
                        </div>
                    );
                } else {
                    statusBadge = (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Pending</span>
                        </div>
                    );
                }

                // Background color based on status
                let cardBgColor = "bg-white";
                if (isGraded) {
                    cardBgColor = "bg-white";
                } else if (submission) {
                    cardBgColor = "bg-amber-50/30";
                } else {
                    cardBgColor = isOverdue ? "bg-red-50" : "bg-red-50/40";
                }

                return (
                    <div key={task.id} className="space-y-4">
                        {/* Card Header */}
                        <div className={`${cardBgColor} rounded-2xl border border-slate-200 shadow-sm`}>
                            <div
                                onClick={() => toggleExpand(task.id)}
                                className="p-4 cursor-pointer active:bg-slate-50/50 transition-colors"
                            >
                                {/* Title & Status */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <h3 className="text-sm font-bold text-slate-800 flex-1 leading-snug">
                                        {task.title}
                                    </h3>
                                    {statusBadge}
                                </div>

                                {/* Description - Clamped preview */}
                                {task.description && (
                                    <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                                        {task.description}
                                    </p>
                                )}

                                {/* Info Row */}
                                <div className="flex items-center flex-wrap gap-3 text-xs text-slate-600 mb-3">
                                    {/* Deadline */}
                                    {deadlineDate && (
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 text-blue-600" />
                                            <span className="font-medium">
                                                Due: {deadlineDate.toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })} at {deadlineDate.toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    )}

                                    {/* Attachments count */}
                                    {task.attachments && task.attachments.length > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="h-3.5 w-3.5" />
                                            <span>{task.attachments.length}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Expand Toggle */}
                                <button className="flex items-center gap-2 text-sm font-medium text-blue-600 w-full justify-center py-2 border-t border-slate-100 -mb-4 -mx-4 px-4 mt-2">
                                    {isExpanded ? (
                                        <>
                                            <ChevronUp className="h-4 w-4" />
                                            <span>Hide Details</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="h-4 w-4" />
                                            <span>View Details</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Expanded Details - Separate Container */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                                        {/* Full Description */}
                                        {task.description && (
                                            <div className="px-4 py-4 border-b border-slate-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                    <span className="text-sm font-bold text-slate-800">Task Description</span>
                                                </div>
                                                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto scrollbar-hide">
                                                    {task.description}
                                                </div>
                                            </div>
                                        )}

                                        {/* Attachments */}
                                        {task.attachments && task.attachments.length > 0 && (
                                            <div className="px-4 py-4 border-b border-slate-200">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                    <span className="text-sm font-bold text-slate-800">
                                                        Attachments ({task.attachments.length})
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {task.attachments.map((att, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={att.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium bg-white px-3 py-2 rounded-lg"
                                                        >
                                                            <Download className="h-4 w-4 flex-shrink-0" />
                                                            <span className="truncate">{att.name}</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Submission Status */}
                                        {submission ? (
                                            <div className="px-4 py-4 bg-emerald-50/30">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                                                    <span className="text-sm font-bold text-emerald-800">
                                                        Your Submission
                                                    </span>
                                                </div>

                                                {submission.submittedAt && (
                                                    <p className="text-xs text-slate-600 mb-3">
                                                        <span className="font-medium">Submitted:</span> {new Date(submission.submittedAt.toDate()).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                )}

                                                {submission.comment && (
                                                    <div className="mb-3">
                                                        <p className="text-xs font-semibold text-slate-700 mb-1">Comment:</p>
                                                        <p className="text-xs text-slate-700 bg-white rounded-lg p-3 leading-relaxed">
                                                            {submission.comment}
                                                        </p>
                                                    </div>
                                                )}

                                                {submission.fileUrl && (
                                                    <a
                                                        href={submission.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium bg-white px-3 py-2 rounded-lg mb-3"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                        <span>Download Submission</span>
                                                    </a>
                                                )}

                                                {/* Grade Display */}
                                                {isGraded && (
                                                    <div className="mt-3 pt-3 border-t border-emerald-200">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-slate-700">Grade:</span>
                                                            <span className={`text-base font-bold ${submission.grade >= 90 ? 'text-emerald-600' :
                                                                    submission.grade >= 80 ? 'text-teal-600' :
                                                                        submission.grade >= 70 ? 'text-blue-600' :
                                                                            submission.grade >= 60 ? 'text-amber-600' :
                                                                                'text-red-600'
                                                                }`}>
                                                                {submission.grade}
                                                            </span>
                                                        </div>
                                                        {submission.feedback && (
                                                            <div className="mt-2">
                                                                <p className="text-xs font-semibold text-slate-700 mb-1">Teacher Feedback:</p>
                                                                <p className="text-xs text-slate-700 bg-white rounded-lg p-3 leading-relaxed">
                                                                    {submission.feedback}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* Submit Form */
                                            <div className="px-4 py-4 bg-blue-50/20">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Send className="h-4 w-4 text-blue-600" />
                                                    <span className="text-sm font-bold text-blue-800">Submit Your Work</span>
                                                </div>

                                                <div className="space-y-3">
                                                    <textarea
                                                        placeholder="Add a comment (optional)"
                                                        value={comment}
                                                        onChange={(e) => setComment(e.target.value)}
                                                        className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white resize-none"
                                                        rows="3"
                                                        disabled={isSubmitting}
                                                    />

                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        onChange={(e) => setFile(e.target.files[0])}
                                                        className="hidden"
                                                        disabled={isSubmitting}
                                                    />

                                                    <button
                                                        onClick={() => handleSubmit(task.id)}
                                                        disabled={isSubmitting}
                                                        className="w-full px-4 py-3 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-sm"
                                                    >
                                                        {isSubmitting ? (
                                                            <>
                                                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                                <span>Submitting...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Send className="h-4 w-4" />
                                                                <span>Submit Task</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}
