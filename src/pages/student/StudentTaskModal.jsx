import { motion, AnimatePresence } from 'framer-motion';
import {
    X, FileText, Download, ExternalLink, Link2,
    Image as ImageIcon, Video, Pencil, Save, Send,
    AlertCircle, CheckCircle, Clock, Upload, Calendar,
    ChevronDown, Trash2, Maximize2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import RichTextEditor from '../../components/RichTextEditor';
import DOMPurify from 'dompurify';

// Custom Toolbar Configuration
const modules = {
    toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'blockquote', 'code-block'],
        [{ 'color': [] }, { 'background': [] }],
        ['clean']
    ],
};

const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link', 'blockquote', 'code-block',
    'color', 'background'
];

export default function StudentTaskModal({
    task,
    onClose,
    submission,
    onSubmit,
    onUpdate,
    isSubmitting,
    submissionText,
    setSubmissionText,
    file,
    setFile,
    editingTask,
    startEditing,
    cancelEditing
}) {
    // Preview state for selected file
    const [previewUrl, setPreviewUrl] = useState(null);
    // Lightbox state
    const [lightboxImage, setLightboxImage] = useState(null);

    useEffect(() => {
        if (file && file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewUrl(null);
        }
    }, [file]);

    if (!task) return null;

    const isGraded = submission && submission.grade !== null && submission.grade !== undefined;

    // Helper to safely render HTML
    const SafeHTML = ({ content, className = '' }) => {
        const sanitizedContent = DOMPurify.sanitize(content);
        return (
            <div
                className={`prose prose-sm max-w-none text-slate-700 leading-relaxed ql-editor px-0 [&_ol]:!list-decimal [&_ul]:!list-disc [&_ol]:!pl-5 [&_ul]:!pl-5 [&_li]:!pl-1 ${className}`}
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />
        );
    };


    // Function to force download
    const handleDownload = async (e, url, filename) => {
        e.preventDefault();
        e.stopPropagation();

        // Special handling for blob URLs (local previews)
        // We cannot 'fetch' a blob URL in some environments, but we can download it directly if it's valid.
        // Special handling for blob URLs (local) and data URLs (Base64)
        if (url.startsWith('blob:') || url.startsWith('data:')) {
            try {
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (err) {
                console.error("Download failed:", err);
                // Fallback: just open in new tab
                window.open(url, '_blank');
            }
            return;
        }

        // For remote URLs (Firebase Storage), fetch as blob to force download
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            // Fallback: just open in new tab
            window.open(url, '_blank');
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex flex-col bg-white">
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="flex-1 flex flex-col w-full h-full bg-slate-50 overflow-hidden"
                >
                    {/* Header - Sticky Full Width */}
                    <div className="bg-white border-b border-slate-200 shadow-sm flex-none z-20 sticky top-0">
                        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
                            <div className="flex-1 min-w-0 pr-4">
                                <h2 className="text-xl md:text-2xl font-bold text-slate-900 line-clamp-1">{task.title}</h2>
                                <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                    <span className="flex items-center gap-1.5 font-medium">
                                        <Clock className="h-4 w-4 text-slate-400" />
                                        {task.deadline ? (
                                            <>Due: {new Date(task.deadline).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</>
                                        ) : 'No Deadline'}
                                    </span>
                                    {submission && (
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ring-inset ${isGraded ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                                            }`}>
                                            {isGraded ? 'Graded' : 'Submitted'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors border border-slate-200"
                                title="Close (Esc)"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Main Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">

                            {/* SECTION 1: TASK DETAILS */}
                            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
                                {/* Description */}
                                <div className="mb-8">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        task instructions
                                        <span className="h-px w-full bg-slate-100 flex-1"></span>
                                    </h3>
                                    {/* Task description usually comes from teacher, assuming it's safe or plain text. If teacher uses rich text, we should use SafeHTML too, but keeping consistent for now. */}
                                    <div className="prose prose-slate prose-lg max-w-none text-slate-700 leading-relaxed">
                                        {/* Assuming task.description is plain text/linkified for now unless teacher also got rich text */}
                                        {/* If teacher description is rich text, use: <SafeHTML content={task.description} /> */}
                                        {/* For now keeping LinkifiedText as per previous code, unless requested to change */}
                                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(task.description.replace(/\n/g, '<br />')) }} />
                                    </div>
                                </div>

                                {/* Resources Grid */}
                                {task.resources && task.resources.length > 0 && (
                                    <div className="mb-8">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Resources</h3>
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {task.resources.map((resource, idx) => (
                                                <a
                                                    key={idx}
                                                    href={resource.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-300 rounded-xl transition-all group"
                                                >
                                                    <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm group-hover:scale-105 transition-transform">
                                                        <Link2 className="h-4 w-4 text-blue-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-700 truncate group-hover:text-blue-700 transition-colors">{resource.title || 'Link'}</p>
                                                        <p className="text-xs text-slate-500 truncate">{resource.url}</p>
                                                    </div>
                                                    <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Attachments Grid */}
                                {task.attachments && task.attachments.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Attachments & Files</h3>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            {task.attachments.map((att, idx) => (
                                                <div key={idx} className="group">
                                                    {att.type === 'image' || att.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                        <div
                                                            className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer relative"
                                                            onClick={() => setLightboxImage(att.url)}
                                                        >
                                                            <div className="aspect-video bg-slate-100/50 flex justify-center items-center relative overflow-hidden group-hover:bg-slate-100 transition-colors">
                                                                <img
                                                                    src={att.url}
                                                                    alt={att.name}
                                                                    className="w-full h-full object-contain"
                                                                />
                                                                {/* Hover Overlay */}
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-md border border-white/30 transform scale-90 group-hover:scale-100 transition-transform duration-200">
                                                                        <Maximize2 className="h-6 w-6 text-white drop-shadow-md" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="px-3 py-2.5 bg-white border-t border-slate-100 flex justify-between items-center relative z-10">
                                                                <span className="text-xs font-bold text-slate-600 truncate max-w-[70%]">{att.name}</span>
                                                                {/* Use handleDownload for images too */}
                                                                <button
                                                                    onClick={(e) => handleDownload(e, att.url, att.name)}
                                                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                                                                    title="Download"
                                                                >
                                                                    <Download className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <a
                                                            href={att.url}
                                                            onClick={(e) => handleDownload(e, att.url, att.name)}
                                                            className="flex items-center gap-4 p-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-all shadow-sm hover:shadow-md group h-full cursor-pointer"
                                                        >
                                                            <div className={`p-3 rounded-lg ${att.type === 'video' ? 'bg-pink-100 text-pink-600' :
                                                                'bg-amber-100 text-amber-600'
                                                                }`}>
                                                                {att.type === 'video' ? <Video className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-bold text-slate-700 mb-1 line-clamp-2">{att.name}</p>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded-full">{att.type || 'FILE'}</span>
                                                            </div>
                                                            <Download className="h-5 w-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 2: SUBMISSION AREA */}
                            <div className="mt-8">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                                    <ChevronDown className="h-4 w-4" />
                                    Your Work
                                </h3>

                                <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-blue-100/50 ring-1 ring-slate-100">
                                    {submission ? (
                                        editingTask === task.id ? (
                                            // EDIT MODE
                                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                                                    <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                                        <Pencil className="h-4 w-4 text-blue-600" />
                                                        Editing Answer
                                                    </h4>
                                                </div>

                                                <div className="rounded-xl overflow-hidden border border-slate-200 focus-within:ring-4 focus-within:ring-blue-100 focus-within:border-blue-500 transition-all bg-white">
                                                    <RichTextEditor
                                                        value={submissionText}
                                                        onChange={setSubmissionText}
                                                        placeholder="Update your answer..."
                                                        height={300}
                                                        disabled={isSubmitting}
                                                    />
                                                </div>

                                                <div className="flex justify-end gap-3 mt-14"> {/* Added mt-14 to clear toolbar/editor space if needed */}
                                                    <button
                                                        onClick={cancelEditing}
                                                        disabled={isSubmitting}
                                                        className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdate(task.id, submission.id)}
                                                        disabled={isSubmitting || !submissionText || submissionText === '<p><br></p>'}
                                                        className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
                                                    >
                                                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            // VIEW MODE
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
                                                    <div className="bg-emerald-100 p-2 rounded-lg">
                                                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-base font-bold text-slate-800">Submitted Answer</h4>
                                                        <p className="text-xs text-slate-400">{submission.submittedAt ? submission.submittedAt.toDate().toLocaleString() : 'Draft'}</p>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                                    <SafeHTML content={submission.content} />
                                                </div>

                                                {submission.attachments && submission.attachments.length > 0 && (
                                                    <div className="mt-6">
                                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Attached Files</h5>
                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            {submission.attachments.map((att, idx) => (
                                                                <div key={idx} className="group">
                                                                    {att.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                                        <div
                                                                            className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer relative"
                                                                            onClick={() => setLightboxImage(att.url)}
                                                                        >
                                                                            <div className="h-40 bg-slate-100/50 flex justify-center items-center overflow-hidden relative group-hover:bg-slate-100 transition-colors">
                                                                                <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                                                    <div className="bg-white/20 p-2 rounded-full backdrop-blur-md border border-white/30 transform scale-90 group-hover:scale-100 transition-transform duration-200">
                                                                                        <Maximize2 className="h-5 w-5 text-white drop-shadow-md" />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="px-3 py-2 bg-white flex justify-between items-center relative z-10">
                                                                                <span className="text-xs font-bold text-slate-600 truncate max-w-[70%]">{att.name}</span>
                                                                                <a
                                                                                    href={att.url}
                                                                                    download
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    <Download className="h-4 w-4 text-slate-300 hover:text-blue-600" />
                                                                                </a>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <a
                                                                            href={att.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all"
                                                                        >
                                                                            <FileText className="h-5 w-5 text-blue-500" />
                                                                            <span className="text-sm font-bold text-slate-700 truncate">{att.name}</span>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Grade Display */}
                                                {submission.grade !== null && submission.grade !== undefined && (
                                                    <div className="mt-8 bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Final Grade</span>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-3xl font-black text-emerald-700">{submission.grade}</span>
                                                                <span className="text-sm text-emerald-500 font-bold">/100</span>
                                                            </div>
                                                        </div>
                                                        {submission.feedback && (
                                                            <p className="text-sm text-emerald-800 italic mt-2">"{submission.feedback}"</p>
                                                        )}
                                                    </div>
                                                )}

                                                {!submission.grade && (
                                                    <div className="mt-6 flex justify-end">
                                                        <button
                                                            onClick={() => startEditing(task, submission)}
                                                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Edit Answer
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    ) : (
                                        // CREATE MODE
                                        <div className="relative">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="bg-blue-100 p-2.5 rounded-xl">
                                                    <Send className="h-6 w-6 text-blue-600" />
                                                </div>
                                                <h4 className="text-lg font-bold text-slate-800">Submit Your Work</h4>
                                            </div>

                                            {/* Open Layout: Editor First */}
                                            <div className="space-y-4">
                                                <div className="rounded-xl overflow-hidden border border-slate-200 focus-within:ring-4 focus-within:ring-blue-100 focus-within:border-blue-500 transition-all bg-white shadow-sm">
                                                    <RichTextEditor
                                                        value={submissionText}
                                                        onChange={setSubmissionText}
                                                        placeholder="Write your answer or specific notes for the teacher here..."
                                                        height={300}
                                                        disabled={isSubmitting}
                                                    />
                                                </div>

                                                {/* Preview Area */}
                                                {file && (
                                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap gap-4 items-center mt-12 sm:mt-12"> {/* Added Top Margin roughly for toolbar */}
                                                        {previewUrl ? (
                                                            <div
                                                                className="relative h-20 w-auto rounded-lg overflow-hidden border border-slate-200 shadow-sm cursor-pointer group"
                                                                onClick={() => setLightboxImage(previewUrl)}
                                                            >
                                                                <img src={previewUrl} alt="Preview" className="h-full w-auto object-contain" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <Maximize2 className="h-4 w-4 text-white" />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                                                <FileText className="h-6 w-6" />
                                                            </div>
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                                                            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                                                        </div>

                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setFile(null);
                                                            }}
                                                            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                                            title="Remove file"
                                                        >
                                                            <X className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Toolbar: Attach & Submit */}
                                                <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 ${!file ? 'mt-12 sm:mt-14' : ''}`}>
                                                    <div>
                                                        <input
                                                            type="file"
                                                            id={`modal-file-upload-${task.id}`}
                                                            className="hidden"
                                                            onChange={(e) => setFile(e.target.files[0])}
                                                        />
                                                        <label
                                                            htmlFor={`modal-file-upload-${task.id}`}
                                                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white hover:border-blue-300 hover:text-blue-600 rounded-xl cursor-pointer transition-all text-sm font-bold shadow-sm"
                                                            title="Attach File"
                                                        >
                                                            <Upload className="h-4 w-4" />
                                                            Attach File
                                                        </label>
                                                    </div>

                                                    <button
                                                        onClick={() => onSubmit(task.id)}
                                                        disabled={isSubmitting || !submissionText || submissionText === '<p><br></p>'}
                                                        className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isSubmitting ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                                Sending...
                                                            </div>
                                                        ) : (
                                                            'Submit'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Spacer */}
                            <div className="h-12"></div>
                        </div>
                    </div>
                </motion.div>

                {/* Lightbox Overlay */}
                <AnimatePresence>
                    {lightboxImage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
                            onClick={() => setLightboxImage(null)}
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => setLightboxImage(null)}
                                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-[160]"
                            >
                                <X className="h-8 w-8" />
                            </button>

                            <motion.img
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                src={lightboxImage}
                                alt="Full Preview"
                                className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl cursor-default"
                                onClick={(e) => e.stopPropagation()} // Click image shouldn't close it
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AnimatePresence>
    );
}
