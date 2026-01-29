import { useState } from 'react';
import FileUpload from '../../components/FileUpload';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, Send, FileText, ChevronDown, ChevronUp, Download, Edit, X, Save, Link2, ExternalLink, Upload, Video } from 'lucide-react';
// import { LinkifiedText } from '../../utils/linkify'; // No longer needed for HTML content
import RichTextEditor from '../../components/RichTextEditor';
import DOMPurify from 'dompurify';

// Simplified Toolbar for Mobile
const mobileModules = {
    toolbar: [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['clean']
    ],
};

const mobileFormats = [
    'bold', 'italic', 'underline',
    'list', 'bullet'
];

export default function TasksMobile({
    tasks,
    submissions,
    currentPage,
    itemsPerPage,
    expandedTask,
    submitting,
    comment,
    setComment,

    toggleExpand,
    handleSubmit,
    handleUpdate,
    setCurrentPage,
    file,
    setFile
}) {
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');

    const startEditing = (submission) => {
        setEditingId(submission.id);
        setEditContent(submission.content);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditContent('');
    };

    const onUpdate = async (taskId, submissionId) => {
        await handleUpdate(taskId, submissionId, editContent);
        setEditingId(null);
        setEditContent('');
    };

    // Safe HTML Renderer
    const SafeHTML = ({ content, className = "" }) => {
        const sanitizedContent = DOMPurify.sanitize(content);
        return (
            <div
                className={`prose prose - sm max - w - none text - slate - 700 leading - relaxed ql - editor px - 0[& _ol]: !list - decimal[& _ul]: !list - disc[& _ol]: !pl - 5[& _ul]: !pl - 5[& _li]: !pl - 1 ${className} `}
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />
        );
    };

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
                    if (task.isMaterialOnly) {
                        statusBadge = (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                <CheckCircle className="h-3.5 w-3.5" />
                                <span>Completed</span>
                            </div>
                        );
                    } else {
                        statusBadge = (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Pending Review</span>
                            </div>
                        );
                    }
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
                    cardBgColor = task.isMaterialOnly ? "bg-white border-emerald-100" : "bg-amber-50/30";
                } else {
                    cardBgColor = isOverdue ? "bg-red-50" : "bg-red-50/40";
                }

                return (
                    <div key={task.id} className="space-y-4">
                        {/* Card Header */}
                        <div className={`${cardBgColor} rounded - 2xl border border - slate - 200 shadow - sm`}>
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

                                {/* Description - Clamped preview (Strip HTML for preview) */}
                                {/* Description - Clamped preview (Strip HTML for preview) */}
                                {task.description && (
                                    <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                                        {(() => {
                                            const withSpaces = task.description.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, ' ');
                                            const doc = new DOMParser().parseFromString(withSpaces, 'text/html');
                                            return doc.body.textContent || "";
                                        })()}
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
                                                <div className="text-sm text-slate-700 bg-white p-3 rounded-xl border border-slate-100">
                                                    <SafeHTML content={task.description} />
                                                </div>
                                            </div>
                                        )}

                                        {/* Attachments - Inline Images */}
                                        {task.attachments && task.attachments.length > 0 && (
                                            <div className="px-4 py-4 border-b border-slate-200">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                    <span className="text-sm font-bold text-slate-800">
                                                        Attachments ({task.attachments.length})
                                                    </span>
                                                </div>
                                                <div className="space-y-3">
                                                    {task.attachments.map((att, idx) => (
                                                        <div key={idx}>
                                                            {att.type === 'image' ? (
                                                                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                                    <img
                                                                        src={att.url}
                                                                        alt={att.name}
                                                                        className="w-full h-auto object-contain bg-slate-100" // Full width on mobile is natural
                                                                    />
                                                                    <div className="px-3 py-2 bg-white border-t border-slate-100 flex justify-between items-center">
                                                                        <span className="text-xs font-bold text-slate-500 truncate">{att.name}</span>
                                                                        <a href={att.url} download target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors">
                                                                            <Download className="h-4 w-4" />
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <a
                                                                    href={att.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50"
                                                                >
                                                                    <div className={`p - 2 rounded - lg flex - shrink - 0 ${att.type === 'video' ? 'bg-pink-100 text-pink-600' :
                                                                        'bg-orange-100 text-orange-600'
                                                                        } `}>
                                                                        {att.type === 'video' ? <Video className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-bold text-slate-700 truncate">{att.name}</p>
                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                            {att.size && <span className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(0)} KB</span>}
                                                                        </div>
                                                                    </div>
                                                                    <Download className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Resources/Links */}
                                        {task.resources && task.resources.length > 0 && (
                                            <div className="px-4 py-4 border-b border-slate-200">
                                                <div className="space-y-2">
                                                    {task.resources.map((resource, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={resource.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 p-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all"
                                                        >
                                                            <div className="bg-blue-500 p-1.5 rounded">
                                                                <Link2 className="h-3 w-3 text-white" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-blue-900 truncate">{resource.title || 'Link'}</p>
                                                                <p className="text-[10px] text-blue-600 truncate">{resource.url}</p>
                                                            </div>
                                                            <ExternalLink className="h-3 w-3 text-blue-600 flex-shrink-0" />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Submission Status */}
                                        {submission ? (
                                            <div className="px-4 py-4 bg-emerald-50/30">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                                                        <span className="text-sm font-bold text-emerald-800">
                                                            Your Submission
                                                        </span>
                                                    </div>
                                                    {!isGraded && !editingId && !task.isMaterialOnly && (
                                                        <button
                                                            onClick={() => startEditing(submission)}
                                                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100"
                                                        >
                                                            <Edit className="h-3 w-3" />
                                                            Edit Answer
                                                        </button>
                                                    )}
                                                </div>

                                                {submission.submittedAt && (
                                                    <div className="mb-3 space-y-1">
                                                        <p className="text-xs text-slate-600">
                                                            <span className="font-medium">Submitted:</span> {new Date(submission.submittedAt.toDate()).toLocaleDateString('en-US', {
                                                                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </p>
                                                        {submission.revisedAt && (
                                                            <p className="text-xs text-slate-500 italic flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                Last revised: {submission.revisedAt.toDate().toLocaleDateString('en-US', {
                                                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                                })}
                                                                {submission.revisionCount > 0 && ` • Revised ${submission.revisionCount} time${submission.revisionCount > 1 ? 's' : ''} `}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {editingId === submission.id ? (
                                                    <div className="space-y-3">
                                                        <div className="bg-white rounded-lg overflow-hidden border border-slate-300">
                                                            <RichTextEditor
                                                                value={editContent}
                                                                onChange={setEditContent}
                                                                placeholder="Update answer..."
                                                                height={350}
                                                                isMobile={true}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => onUpdate(task.id, submission.id)}
                                                                disabled={isSubmitting}
                                                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                                                            >
                                                                {isSubmitting ? (
                                                                    <div className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent" />
                                                                ) : (
                                                                    <Save className="h-3.5 w-3.5" />
                                                                )}
                                                                Save Changes
                                                            </button>
                                                            <button
                                                                onClick={cancelEditing}
                                                                disabled={isSubmitting}
                                                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    task.isMaterialOnly ? (
                                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 text-center space-y-3 mb-3">
                                                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                                                                <CheckCircle className="h-6 w-6" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <h4 className="text-sm font-bold text-slate-800">Review Completed</h4>
                                                                <p className="text-xs text-slate-600">You have marked this material as done.</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mb-3">
                                                            {submission.content && (
                                                                <>
                                                                    <p className="text-xs font-semibold text-slate-700 mb-1">Answer:</p>
                                                                    <div className="text-xs text-slate-700 bg-white rounded-lg p-3 leading-relaxed border border-slate-100 shadow-sm">
                                                                        <SafeHTML content={submission.content} />
                                                                    </div>
                                                                </>
                                                            )}

                                                            {/* Submission Attachments */}
                                                            {submission.attachments && submission.attachments.length > 0 && (
                                                                <div className="mt-3">
                                                                    <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                                                                        <FileText className="h-3 w-3" />
                                                                        Attached Files:
                                                                    </p>
                                                                    <div className="grid gap-2">
                                                                        {submission.attachments.map((att, idx) => (
                                                                            <a
                                                                                key={idx}
                                                                                href={att.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                                                            >
                                                                                <Download className="h-3.5 w-3.5 text-blue-500" />
                                                                                <span className="flex-1 text-xs text-slate-700 truncate">{att.name}</span>
                                                                                <span className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(0)}KB</span>
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                )}

                                                {/* Grade Display */}
                                                {isGraded && (
                                                    <div className="mt-3 pt-3 border-t border-emerald-200">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-slate-700">Grade:</span>
                                                            <span className={`text - base font - bold ${submission.grade >= 90 ? 'text-emerald-600' :
                                                                submission.grade >= 80 ? 'text-teal-600' :
                                                                    submission.grade >= 70 ? 'text-blue-600' :
                                                                        submission.grade >= 60 ? 'text-amber-600' :
                                                                            'text-red-600'
                                                                } `}>
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

                                                {task.submissionInstructions && (
                                                    <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                                        <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-[10px] font-bold text-amber-900 mb-0.5">Instructions:</p>
                                                            <p className="text-[10px] text-amber-800 whitespace-pre-wrap leading-relaxed">{task.submissionInstructions}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {task.isMaterialOnly ? (
                                                    <div className="bg-white border border-blue-100 rounded-xl p-6 text-center space-y-4">
                                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
                                                            <FileText className="h-6 w-6" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <h4 className="text-sm font-bold text-slate-800">Learning Material</h4>
                                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                                Please review the material above, then mark it as done.
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleSubmit(task.id)}
                                                            disabled={isSubmitting}
                                                            className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 shadow-sm transition-all flex items-center justify-center gap-2"
                                                        >
                                                            {isSubmitting ? (
                                                                <>
                                                                    <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                                                                    <span>Processing...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="h-4 w-4" />
                                                                    <span>Mark as Done</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <div className="mb-2">
                                                            <input
                                                                type="file"
                                                                id={`mobile - file - upload - ${task.id} `}
                                                                className="hidden"
                                                                onChange={(e) => setFile(e.target.files[0])}
                                                            />

                                                            {!file ? (
                                                                <label
                                                                    htmlFor={`mobile - file - upload - ${task.id} `}
                                                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-600 text-sm font-bold hover:bg-slate-50 cursor-pointer transition-all shadow-sm w-full"
                                                                >
                                                                    <Upload className="h-4 w-4 text-slate-500" />
                                                                    Attach File
                                                                </label>
                                                            ) : (
                                                                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl w-full">
                                                                    <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                                                    <span className="flex-1 text-sm text-blue-800 font-medium truncate">{file.name}</span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            setFile(null);
                                                                        }}
                                                                        className="p-1 hover:bg-blue-100 rounded-full text-blue-400 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="bg-white rounded-lg overflow-hidden border border-slate-300">
                                                            <RichTextEditor
                                                                value={comment}
                                                                onChange={setComment}
                                                                placeholder="Add a comment or answer..."
                                                                height={350}
                                                                disabled={isSubmitting}
                                                                isMobile={true}
                                                            />
                                                        </div>

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
                                                )}
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
