import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
    X, FileText, Link as LinkIcon, Image as ImageIcon, Video,
    Calendar, Clock, CheckCircle, CheckCircle2, AlertCircle,
    Save, Paperclip, Trash2, ChevronDown, ExternalLink,
    Plus, Copy, HelpCircle, GripVertical, Download, Upload, Link2
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import toast from 'react-hot-toast';
import RichTextEditor from '../../components/RichTextEditor';

// Helper to extract URLs from HTML content
const extractUrls = (html) => {
    if (!html) return [];
    // Parse HTML to get text content first
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = doc.body.textContent || "";

    // Regex to find URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);

    if (!matches) return [];

    // Clean up trailing punctuation and return unique URLs
    const cleanedUrls = matches.map(url => {
        return url.replace(/[.,:;)]+$/, '');
    });

    return [...new Set(cleanedUrls)];
};

export default function TeacherTaskModal({
    isOpen,
    onClose,
    isEditing,
    formData,
    setFormData,
    loading,
    classes,
    onSubmit,
    handleFileUpload,
    removeAttachment,
    openLinkModal
}) {
    const [activeQuestionId, setActiveQuestionId] = useState(null);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkModalData, setLinkModalData] = useState({ questionId: null, url: '', name: '' });
    // Collapsible Quiz Section Toggle
    const [showQuizSection, setShowQuizSection] = useState(false);



    // Ensure activeQuestionId is set if questions exist
    useEffect(() => {
        if (formData.questions && formData.questions.length > 0 && !activeQuestionId) {
            setActiveQuestionId(formData.questions[0].id);
        }
    }, [formData.questions]);

    const toggleClassSelection = (classId) => {
        const isSelected = formData.assignedClasses.includes(classId);
        if (isSelected) {
            setFormData({
                ...formData,
                assignedClasses: formData.assignedClasses.filter(id => id !== classId)
            });
        } else {
            setFormData({
                ...formData,
                assignedClasses: [...formData.assignedClasses, classId]
            });
        }
    };

    // --- Question Management Logic ---
    const addQuestion = () => {
        const newQuestion = {
            id: crypto.randomUUID(),
            type: 'single_choice',
            text: '',
            attachments: [],
            options: [
                { id: 'opt1', text: '', isCorrect: false },
                { id: 'opt2', text: '', isCorrect: false },
                { id: 'opt3', text: '', isCorrect: false },
                { id: 'opt4', text: '', isCorrect: false }
            ],
            points: 10
        };
        const currentQuestions = formData.questions || [];
        setFormData({ ...formData, questions: [...currentQuestions, newQuestion] });
        setActiveQuestionId(newQuestion.id);
    };

    const updateQuestion = (qId, updates) => {
        const currentQuestions = formData.questions || [];
        const updatedQuestions = currentQuestions.map(q => q.id === qId ? { ...q, ...updates } : q);
        setFormData({ ...formData, questions: updatedQuestions });
    };

    const deleteQuestion = (qId) => {
        const currentQuestions = formData.questions || [];
        const updatedQuestions = currentQuestions.filter(q => q.id !== qId);
        setFormData({ ...formData, questions: updatedQuestions });
        if (activeQuestionId === qId) {
            setActiveQuestionId(null);
        }
    };

    const duplicateQuestion = (question) => {
        const newQuestion = {
            ...question,
            id: crypto.randomUUID(),
            text: question.text + ' (Copy)',
            attachments: question.attachments ? [...question.attachments] : []
        };
        const currentQuestions = formData.questions || [];
        setFormData({ ...formData, questions: [...currentQuestions, newQuestion] });
        setActiveQuestionId(newQuestion.id);
    };

    // --- Attachment Handlers for Questions ---
    const handleQuestionFileUpload = async (questionId, file) => {
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error("File terlalu besar (Maksimal 10MB)");
            return;
        }

        const toastId = toast.loading("Mengupload file...");
        try {
            // Use a specific folder for task question attachments
            // If we don't have a task ID yet (new task), we use a temp folder or just a timestamp?
            // Better to use a 'tasks/temp' or similar if no ID. But typically we might not have ID.
            // Let's use 'tasks/questions/${Date.now()}' for now.
            const folder = isEditing && formData.id ? `tasks/${formData.id}/questions` : `tasks/temp/${Date.now()}`;
            const storageRef = ref(storage, `${folder}/${questionId}/${file.name}`);

            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => { },
                (error) => {
                    console.error("Upload error:", error);
                    toast.error(`Upload gagal: ${error.message}`, { id: toastId });
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        let type = 'file';
                        if (file.type.startsWith('image/')) type = 'image';
                        if (file.type.startsWith('video/')) type = 'video';

                        const newAttachment = {
                            id: crypto.randomUUID(),
                            type,
                            url: downloadURL,
                            name: file.name
                        };

                        const currentQuestions = formData.questions || [];
                        const question = currentQuestions.find(q => q.id === questionId);
                        const updatedAttachments = [...(question.attachments || []), newAttachment];
                        updateQuestion(questionId, { attachments: updatedAttachments });
                        toast.success("File berhasil diupload", { id: toastId });
                    } catch (urlError) {
                        toast.error(`Gagal mendapatkan URL`, { id: toastId });
                    }
                }
            );
        } catch (error) {
            toast.error(`Error upload: ${error.message}`, { id: toastId });
        }
    };

    const handleAddQuestionLink = (questionId, url, label) => {
        if (!url) return;
        const newAttachment = {
            id: crypto.randomUUID(),
            type: 'link',
            url,
            name: label || url
        };
        const currentQuestions = formData.questions || [];
        const question = currentQuestions.find(q => q.id === questionId);
        const updatedAttachments = [...(question.attachments || []), newAttachment];
        updateQuestion(questionId, { attachments: updatedAttachments });
    };

    const removeQuestionAttachment = (questionId, attachmentId) => {
        const currentQuestions = formData.questions || [];
        const question = currentQuestions.find(q => q.id === questionId);
        const updatedAttachments = (question.attachments || []).filter(a => a.id !== attachmentId);
        updateQuestion(questionId, { attachments: updatedAttachments });
    };

    const handleOptionChange = (qId, optId, newText) => {
        const currentQuestions = formData.questions || [];
        const question = currentQuestions.find(q => q.id === qId);
        const updatedOptions = question.options.map(opt => opt.id === optId ? { ...opt, text: newText } : opt);
        updateQuestion(qId, { options: updatedOptions });
    };

    const toggleCorrectOption = (qId, optId, type) => {
        const currentQuestions = formData.questions || [];
        const question = currentQuestions.find(q => q.id === qId);
        let updatedOptions;

        if (type === 'single_choice' || type === 'true_false') {
            updatedOptions = question.options.map(opt => ({ ...opt, isCorrect: opt.id === optId }));
        } else { // multiple_choice
            updatedOptions = question.options.map(opt => opt.id === optId ? { ...opt, isCorrect: !opt.isCorrect } : opt);
        }
        updateQuestion(qId, { options: updatedOptions });
    };

    const handleTypeChange = (qId, newType) => {
        const currentQuestions = formData.questions || [];
        const currentQ = currentQuestions.find(q => q.id === qId);
        let updates = { type: newType };

        if (newType === 'true_false') {
            updates.options = [
                { id: 'true', text: 'Benar', isCorrect: true },
                { id: 'false', text: 'Salah', isCorrect: false }
            ];
        } else if (newType === 'essay' || newType === 'short_answer') {
            updates.options = [];
        } else if (newType === 'matching') {
            updates.options = [
                { id: crypto.randomUUID(), left: '', right: '' },
                { id: crypto.randomUUID(), left: '', right: '' },
                { id: crypto.randomUUID(), left: '', right: '' }
            ];
        } else if (['single_choice', 'multiple_choice'].includes(newType) && !['single_choice', 'multiple_choice'].includes(currentQ.type)) {
            updates.options = [
                { id: crypto.randomUUID(), text: '', isCorrect: false },
                { id: crypto.randomUUID(), text: '', isCorrect: false },
                { id: crypto.randomUUID(), text: '', isCorrect: false },
                { id: crypto.randomUUID(), text: '', isCorrect: false }
            ];
        }
        updateQuestion(qId, updates);
    };

    return createPortal(
        <AnimatePresence mode="wait">
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex flex-col bg-white">
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="flex-1 flex flex-col w-full h-full bg-slate-50 overflow-hidden"
                    >
                        {/* Header - Sticky Top */}
                        <div className="bg-white border-b border-slate-200 shadow-sm flex-none z-20 sticky top-0">
                            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-medium text-slate-900">
                                        {isEditing ? 'Desain Materi / Tugas' : 'Buat Materi Baru'}
                                    </h2>
                                    <p className="text-sm text-slate-500 hidden md:block">
                                        {isEditing ? 'Perbarui detail tugas dan lampiran' : 'Isi detail tugas untuk siswa Anda'}
                                    </p>
                                </div>

                                <button
                                    onClick={onClose}
                                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors border border-slate-200"
                                    title="Close (Esc)"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Main Scrollable Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
                            <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8 pb-32">

                                {/* 1. MAIN CONTENT (Title & Description) */}
                                <div className="space-y-6">
                                    {/* Title Input - Clean & Minimalist */}
                                    <div className="group">
                                        <label className="sr-only">Task Title</label>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            placeholder="Judul Tugas (Contoh: Latihan Soal Aljabar)"
                                            className="w-full text-3xl md:text-4xl font-semibold text-slate-800 placeholder:text-slate-300 border-none outline-none focus:ring-0 bg-transparent px-0 py-2 transition-all"
                                            autoFocus
                                        />
                                        {/* Subtle animated underline */}
                                        <div className="h-0.5 w-24 group-focus-within:w-full bg-slate-200 group-focus-within:bg-blue-500 rounded-full transition-all duration-500 ease-out" />
                                    </div>

                                    {/* Material Only Toggle */}
                                    <div className="flex items-center gap-2">
                                        <label className="relative inline-flex items-center cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={formData.isMaterialOnly || false}
                                                onChange={(e) => setFormData({ ...formData, isMaterialOnly: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            <span className="ms-3 text-sm font-bold text-slate-600 group-hover:text-blue-600 transition-colors">
                                                Material Only (No Submission)
                                            </span>
                                        </label>
                                        <div className="group relative">
                                            <AlertCircle className="h-4 w-4 text-slate-400 cursor-help" />
                                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 bg-slate-800 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                                Students only need to click "Mark as Done" without uploading files or writing answers.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rich Description - Unified Card */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden focus-within:ring-4 focus-within:ring-blue-100 focus-within:border-blue-500 transition-all">
                                        <div className="p-0">
                                            <RichTextEditor
                                                value={formData.description}
                                                onChange={(val) => setFormData({ ...formData, description: val })}
                                                placeholder="Write your task description here..."
                                                height={300}
                                                className="border-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Detected Links Preview (Smart Link Detection) */}
                                    {formData.description && extractUrls(formData.description).length > 0 && (
                                        <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <Link2 className="h-4 w-4 text-blue-500" />
                                                Detected Links in Description
                                            </h4>
                                            <div className="grid grid-cols-1 gap-2">
                                                {extractUrls(formData.description).map((url, idx) => {
                                                    // Check if this URL is already in resources
                                                    const isAdded = formData.resources?.some(r => r.url === url);

                                                    return (
                                                        <div key={idx} className="flex items-center gap-3 p-3 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-xl transition-all group">
                                                            <div className="bg-white p-2 rounded-lg border border-blue-100 shadow-sm text-blue-600">
                                                                <ExternalLink className="h-4 w-4" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold text-blue-700 truncate">{url}</p>
                                                                <p className="text-xs text-blue-500">{isAdded ? 'Added to resources' : 'Found in text'}</p>
                                                            </div>
                                                            {!isAdded && (
                                                                <button
                                                                    onClick={() => {
                                                                        const newResource = {
                                                                            id: crypto.randomUUID(),
                                                                            title: 'Link from Description',
                                                                            url: url,
                                                                            type: 'link'
                                                                        };
                                                                        setFormData({
                                                                            ...formData,
                                                                            resources: [...formData.resources, newResource]
                                                                        });
                                                                    }}
                                                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                                                >
                                                                    Add as Resource
                                                                </button>
                                                            )}
                                                            {isAdded && (
                                                                <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-emerald-50 rounded-lg">
                                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                                    Added
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 1.5. QUIZ QUESTIONS (Exam-like Editor) */}
                                {!formData.isMaterialOnly && (
                                    <div className="space-y-6">
                                        {/* Header / Toggle */}
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                                                    <HelpCircle className="h-5 w-5" />
                                                </div>
                                                Quiz & Pertanyaan
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    const newState = !showQuizSection;
                                                    setShowQuizSection(newState);
                                                    if (newState && (!formData.questions || formData.questions.length === 0)) {
                                                        addQuestion();
                                                    }
                                                }}
                                                className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${showQuizSection
                                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200 hover:-translate-y-0.5'
                                                    }`}
                                            >
                                                {showQuizSection ? (
                                                    <>Sembunyikan Quiz <ChevronDown className="h-4 w-4 rotate-180" /></>
                                                ) : (
                                                    <>Enable Quiz / Add Questions <Plus className="h-4 w-4" /></>
                                                )}
                                            </button>
                                        </div>

                                        {/* Collapsible Content */}
                                        <AnimatePresence>
                                            {showQuizSection && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="space-y-6 pt-2">
                                                        {/* ROW 1: Settings & Navigation (Side by Side) */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            {/* COL 1: Settings */}
                                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                                                <h3 className="font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
                                                                    <div className="p-1 bg-slate-100 rounded">
                                                                        <GripVertical className="h-4 w-4 text-slate-500" />
                                                                    </div>
                                                                    Pengaturan Kuis
                                                                </h3>
                                                                <div className="space-y-2">
                                                                    {/* Randomize Questions */}
                                                                    <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer group">
                                                                        <div className="flex-1 pr-4">
                                                                            <span className="block text-sm font-bold text-slate-700 group-hover:text-purple-700 transition-colors">Acak Urutan Soal</span>
                                                                            <span className="block text-xs text-slate-500 mt-0.5">Siswa mendapat urutan soal berbeda</span>
                                                                        </div>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={formData.randomizeQuestions || false}
                                                                            onChange={(e) => setFormData({ ...formData, randomizeQuestions: e.target.checked })}
                                                                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                                                                        />
                                                                    </label>

                                                                    {/* Randomize Options */}
                                                                    <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer group">
                                                                        <div className="flex-1 pr-4">
                                                                            <span className="block text-sm font-bold text-slate-700 group-hover:text-purple-700 transition-colors">Acak Opsi Jawaban</span>
                                                                            <span className="block text-xs text-slate-500 mt-0.5">Pilihan ganda akan diacak</span>
                                                                        </div>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={formData.randomizeAnswers || false}
                                                                            onChange={(e) => setFormData({ ...formData, randomizeAnswers: e.target.checked })}
                                                                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                                                                        />
                                                                    </label>

                                                                    {/* Guest Access */}
                                                                    <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer group">
                                                                        <div className="flex-1 pr-4">
                                                                            <span className="block text-sm font-bold text-slate-700 group-hover:text-purple-700 transition-colors">Guest Access</span>
                                                                            <span className="block text-xs text-slate-500 mt-0.5">Izinkan akses tanpa login</span>
                                                                        </div>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={formData.isGuestAllowed || false}
                                                                            onChange={(e) => setFormData({ ...formData, isGuestAllowed: e.target.checked })}
                                                                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                                                                        />
                                                                    </label>
                                                                </div>
                                                            </div>

                                                            {/* COL 2: Navigation Grid */}
                                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <h3 className="font-bold text-slate-800">Daftar Soal</h3>
                                                                    <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded-full text-slate-600">
                                                                        {formData.questions?.length || 0} Soal
                                                                    </span>
                                                                </div>

                                                                <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                                                                    {formData.questions?.map((q, idx) => (
                                                                        <button
                                                                            key={q.id}
                                                                            onClick={() => setActiveQuestionId(q.id)}
                                                                            className={`w-10 h-10 rounded-lg font-bold text-sm transition-all border ${activeQuestionId === q.id
                                                                                ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200'
                                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'}`}
                                                                        >
                                                                            {idx + 1}
                                                                        </button>
                                                                    ))}
                                                                    <button
                                                                        onClick={addQuestion}
                                                                        className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:text-purple-600 hover:border-purple-400 flex items-center justify-center transition-colors"
                                                                        title="Tambah Soal Baru"
                                                                    >
                                                                        <Plus className="h-5 w-5" />
                                                                    </button>
                                                                </div>

                                                                {/* Delete All Button condition */}
                                                                {formData.questions?.length > 0 && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (window.confirm("Hapus semua soal?")) {
                                                                                setFormData({ ...formData, questions: [] });
                                                                                setActiveQuestionId(null);
                                                                            }
                                                                        }}
                                                                        className="w-full mt-6 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" /> Hapus Semua Soal
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>


                                                        {/* ROW 2: Active Question Editor (Full Width) */}
                                                        <div>
                                                            <AnimatePresence mode="wait">
                                                                {activeQuestionId ? (() => {
                                                                    const question = formData.questions?.find(q => q.id === activeQuestionId);
                                                                    if (!question) return null;
                                                                    const qIndex = formData.questions?.findIndex(q => q.id === activeQuestionId);

                                                                    return (
                                                                        <motion.div
                                                                            key={activeQuestionId}
                                                                            initial={{ opacity: 0, y: 10 }}
                                                                            animate={{ opacity: 1, y: 0 }}
                                                                            exit={{ opacity: 0, y: -10 }}
                                                                            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                                                                        >
                                                                            {/* Editor Header */}
                                                                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 justify-between items-center">
                                                                                <div className="flex items-center gap-4">
                                                                                    <span className="text-lg font-bold text-slate-400">#{qIndex + 1}</span>
                                                                                    <select
                                                                                        value={question.type}
                                                                                        onChange={(e) => handleTypeChange(question.id, e.target.value)}
                                                                                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                                                                                    >
                                                                                        <option value="single_choice">Pilihan Ganda (1 Jawaban)</option>
                                                                                        <option value="multiple_choice">Pilihan Jamak (Checkbox)</option>
                                                                                        <option value="matching">Menjodohkan (Matching)</option>
                                                                                        <option value="true_false">Benar / Salah</option>
                                                                                        <option value="short_answer">Jawaban Singkat</option>
                                                                                        <option value="essay">Essay</option>
                                                                                    </select>
                                                                                    <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                                                                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Poin</label>
                                                                                        <input
                                                                                            type="number"
                                                                                            min="0"
                                                                                            value={question.points || 0}
                                                                                            onChange={(e) => updateQuestion(question.id, { points: parseInt(e.target.value) || 0 })}
                                                                                            className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none"
                                                                                        />
                                                                                    </div>


                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <button onClick={() => duplicateQuestion(question)} className="p-2 text-slate-400 hover:text-purple-600 transition-colors" title="Duplikat">
                                                                                        <Copy className="h-4 w-4" />
                                                                                    </button>
                                                                                    <button onClick={() => deleteQuestion(question.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Hapus">
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>

                                                                            <div className="p-6 space-y-6">
                                                                                {/* Question Text */}
                                                                                <div>
                                                                                    <label className="block text-sm font-bold text-slate-700 mb-2">Pertanyaan / Instruksi</label>
                                                                                    <textarea
                                                                                        value={question.text}
                                                                                        onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                                                                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none min-h-[100px] text-base"
                                                                                        placeholder={question.type === 'matching' ? "Instruksi: Pasangkan item berikut..." : "Tulis pertanyaan di sini..."}
                                                                                    />

                                                                                    {/* Attachment UI */}
                                                                                    <div className="mt-4">
                                                                                        <div className="flex flex-wrap gap-2 mb-3">
                                                                                            {question.attachments && question.attachments.map(att => (
                                                                                                <div key={att.id} className="relative group bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center gap-3 pr-8 min-w-[150px]">
                                                                                                    {att.type === 'image' && (
                                                                                                        <div className="w-10 h-10 rounded bg-slate-200 overflow-hidden flex-shrink-0">
                                                                                                            <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {att.type === 'video' && <Video className="w-8 h-8 text-blue-500" />}
                                                                                                    {att.type === 'link' && <LinkIcon className="w-8 h-8 text-green-500" />}
                                                                                                    {att.type === 'file' && <FileText className="w-8 h-8 text-orange-500" />}

                                                                                                    <div className="flex-1 min-w-0">
                                                                                                        <p className="text-xs font-medium text-slate-700 truncate" title={att.name}>{att.name}</p>
                                                                                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">Lihat</a>
                                                                                                    </div>
                                                                                                    <button
                                                                                                        onClick={() => removeQuestionAttachment(question.id, att.id)}
                                                                                                        className="absolute top-1 right-1 p-1 bg-white rounded-full shadow-sm text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                                                                    >
                                                                                                        <X className="h-3 w-3" />
                                                                                                    </button>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>

                                                                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                                                                            <div className="flex gap-2 flex-wrap">
                                                                                                <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                                                                                                    <ImageIcon className="h-4 w-4" /> Gambar
                                                                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleQuestionFileUpload(question.id, e.target.files[0])} />
                                                                                                </label>
                                                                                                <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                                                                                                    <Paperclip className="h-4 w-4" /> File
                                                                                                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => handleQuestionFileUpload(question.id, e.target.files[0])} />
                                                                                                </label>
                                                                                                <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                                                                                                    <Video className="h-4 w-4" /> Video
                                                                                                    <input type="file" className="hidden" accept="video/*" onChange={(e) => handleQuestionFileUpload(question.id, e.target.files[0])} />
                                                                                                </label>
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setLinkModalData({ questionId: question.id, url: '', name: '' });
                                                                                                        setShowLinkModal(true);
                                                                                                    }}
                                                                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
                                                                                                >
                                                                                                    <LinkIcon className="h-4 w-4" /> Link
                                                                                                </button>
                                                                                            </div>

                                                                                            {/* Partial Scoring Toggle (Moved Here) */}
                                                                                            {(question.type === 'multiple_choice' || question.type === 'matching') && (
                                                                                                <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors" title="Jika aktif, siswa dapat poin sebagian jika jawaban tidak lengkap tapi benar">
                                                                                                    <input
                                                                                                        type="checkbox"
                                                                                                        checked={question.allowPartial || false}
                                                                                                        onChange={(e) => updateQuestion(question.id, { allowPartial: e.target.checked })}
                                                                                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                                                                                    />
                                                                                                    <span className="text-xs font-bold text-blue-700">Partial Scoring</span>
                                                                                                </label>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Options Logic */}
                                                                                {(question.type === 'essay' || question.type === 'short_answer') ? (
                                                                                    <div className="space-y-4">
                                                                                        <div>
                                                                                            <label className="block text-sm font-bold text-slate-700 mb-2">Expected Answer (Referensi Grading)</label>
                                                                                            <textarea
                                                                                                value={question.expectedAnswer || ''}
                                                                                                onChange={(e) => updateQuestion(question.id, { expectedAnswer: e.target.value })}
                                                                                                placeholder="Contoh jawaban yang diharapkan..."
                                                                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none min-h-[100px] text-sm bg-amber-50/30"
                                                                                            />
                                                                                            <p className="text-xs text-slate-500 mt-1">Hanya untuk referensi guru, tidak dilihat siswa.</p>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : question.type === 'matching' ? (
                                                                                    <div>
                                                                                        <label className="block text-sm font-bold text-slate-700 mb-3">Pasangan Jawaban (Matching Pairs)</label>
                                                                                        <div className="grid grid-cols-[1fr,auto,1fr,auto] gap-2 mb-2 px-2">
                                                                                            <span className="text-xs font-bold text-slate-500 uppercase">Sisi Kiri (Pertanyaan)</span>
                                                                                            <span></span>
                                                                                            <span className="text-xs font-bold text-slate-500 uppercase">Sisi Kanan (Pasangan)</span>
                                                                                        </div>
                                                                                        <div className="space-y-3">
                                                                                            {(question.options || []).map((pair, idx) => (
                                                                                                <div key={pair.id} className="flex items-center gap-2">
                                                                                                    <input
                                                                                                        type="text"
                                                                                                        value={pair.left || ''}
                                                                                                        onChange={(e) => {
                                                                                                            const newOpts = question.options.map(p => p.id === pair.id ? { ...p, left: e.target.value } : p);
                                                                                                            updateQuestion(question.id, { options: newOpts });
                                                                                                        }}
                                                                                                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                                                                                        placeholder="Item Kiri"
                                                                                                    />
                                                                                                    <span className="text-slate-400">➜</span>
                                                                                                    <input
                                                                                                        type="text"
                                                                                                        value={pair.right || ''}
                                                                                                        onChange={(e) => {
                                                                                                            const newOpts = question.options.map(p => p.id === pair.id ? { ...p, right: e.target.value } : p);
                                                                                                            updateQuestion(question.id, { options: newOpts });
                                                                                                        }}
                                                                                                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                                                                                        placeholder="Pasangan Kanan"
                                                                                                    />
                                                                                                    <button
                                                                                                        onClick={() => {
                                                                                                            const newOpts = question.options.filter(p => p.id !== pair.id);
                                                                                                            updateQuestion(question.id, { options: newOpts });
                                                                                                        }}
                                                                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                                                                    >
                                                                                                        <X className="h-4 w-4" />
                                                                                                    </button>
                                                                                                </div>
                                                                                            ))}
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const newPair = { id: crypto.randomUUID(), left: '', right: '' };
                                                                                                    updateQuestion(question.id, { options: [...(question.options || []), newPair] });
                                                                                                }}
                                                                                                className="text-sm text-purple-600 font-bold hover:underline flex items-center gap-1 mt-2"
                                                                                            >
                                                                                                <Plus className="h-4 w-4" /> Tambah Pasangan
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div>
                                                                                        <label className="block text-sm font-bold text-slate-700 mb-3">Opsi Jawaban</label>
                                                                                        <div className="space-y-3">
                                                                                            {question.options.map((opt, idx) => (
                                                                                                <div key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${opt.isCorrect ? 'border-green-200 bg-green-50/50' : 'border-slate-200'}`}>
                                                                                                    <button
                                                                                                        onClick={() => toggleCorrectOption(question.id, opt.id, question.type)}
                                                                                                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${opt.isCorrect
                                                                                                            ? 'border-green-500 bg-green-500 text-white'
                                                                                                            : 'border-slate-300 hover:border-blue-400'}`}
                                                                                                    >
                                                                                                        {opt.isCorrect && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                                                    </button>
                                                                                                    <input
                                                                                                        type="text"
                                                                                                        value={opt.text}
                                                                                                        readOnly={question.type === 'true_false'}
                                                                                                        onChange={(e) => handleOptionChange(question.id, opt.id, e.target.value)}
                                                                                                        className={`flex-1 bg-transparent outline-none ${opt.isCorrect ? 'text-green-800 font-medium' : 'text-slate-700'}`}
                                                                                                        placeholder={`Opsi ${idx + 1}`}
                                                                                                    />
                                                                                                    {question.type !== 'true_false' && (
                                                                                                        <button
                                                                                                            onClick={() => {
                                                                                                                const updatedOptions = question.options.filter(o => o.id !== opt.id);
                                                                                                                updateQuestion(question.id, { options: updatedOptions });
                                                                                                            }}
                                                                                                            className="text-slate-400 hover:text-red-500 px-2"
                                                                                                        >
                                                                                                            <X className="h-4 w-4" />
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            ))}
                                                                                            {question.type !== 'true_false' && (
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        const newOpt = { id: crypto.randomUUID(), text: '', isCorrect: false };
                                                                                                        updateQuestion(question.id, { options: [...question.options, newOpt] });
                                                                                                    }}
                                                                                                    className="text-sm text-purple-600 font-medium hover:underline flex items-center gap-1 mt-2"
                                                                                                >
                                                                                                    <Plus className="h-3 w-3" /> Tambah Opsi
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </motion.div>
                                                                    );
                                                                })() : (
                                                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                                                                        <div className="bg-slate-50 p-6 rounded-full mb-6">
                                                                            <HelpCircle className="h-16 w-16 text-slate-300" />
                                                                        </div>
                                                                        <h3 className="text-xl font-bold text-slate-800 mb-2">Belum ada pertanyaan dipilih</h3>
                                                                        <p className="text-slate-500 max-w-sm mb-8">
                                                                            Pilih soal dari grid di sebelah kiri atau buat soal baru.
                                                                        </p>
                                                                        <button
                                                                            onClick={addQuestion}
                                                                            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-3 shadow-xl shadow-purple-200 hover:-translate-y-1 transition-all"
                                                                        >
                                                                            <Plus className="h-5 w-5" />
                                                                            Buat Pertanyaan Baru
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )
                                }

                                {/* 2. Resources & Attachments Section */}
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                                <Paperclip className="h-4 w-4" />
                                            </div>
                                            Materi & Lampiran
                                        </h3>
                                        <span className="text-[10px] font-medium px-2 py-1 bg-slate-100 text-slate-500 rounded-full">
                                            {formData.resources.length + formData.attachments.length} Items
                                        </span>
                                    </div>

                                    {/* List of Attachments */}
                                    <div className="flex flex-wrap gap-3 mb-6">
                                        {/* Links */}
                                        {formData.resources.map((res, idx) => (
                                            <div key={`res-${idx}`} className="group flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all min-w-[200px] max-w-sm border-l-4 border-l-emerald-500">
                                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                                    <Link2 className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-700 truncate">{res.title || 'Link'}</p>
                                                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate block">
                                                        {res.url}
                                                    </a>
                                                </div>
                                                <button onClick={() => removeAttachment(idx, true)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}

                                        {/* Files */}
                                        {formData.attachments.map((att, idx) => (
                                            <div key={`att-${idx}`} className="group flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all min-w-[200px] max-w-sm border-l-4 border-l-blue-500">
                                                <div className={`p-2 rounded-lg ${att.type === 'image' ? 'bg-purple-50 text-purple-600' :
                                                    att.type === 'video' ? 'bg-pink-50 text-pink-600' :
                                                        'bg-indigo-50 text-indigo-600'
                                                    }`}>
                                                    {att.type === 'image' ? <ImageIcon className="h-4 w-4" /> :
                                                        att.type === 'video' ? <Video className="h-4 w-4" /> :
                                                            <FileText className="h-4 w-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-700 truncate">{att.name}</p>
                                                    <p className="text-[9px] font-medium text-slate-400 uppercase">
                                                        {att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(1)} KB` : `${(att.size / (1024 * 1024)).toFixed(1)} MB`}
                                                    </p>
                                                </div>
                                                <button onClick={() => removeAttachment(idx, false)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}

                                        {formData.resources.length === 0 && formData.attachments.length === 0 && (
                                            <div className="w-full text-center py-8 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                                <p className="text-sm text-slate-500">Belum ada lampiran materi.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons - Horizontal Row */}
                                    <div className="flex flex-wrap gap-3">
                                        <label className="cursor-pointer px-4 py-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95">
                                            <ImageIcon className="h-4 w-4 text-blue-500" />
                                            Upload Image
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e.target.files[0], 'image')} />
                                        </label>

                                        <label className="cursor-pointer px-4 py-2.5 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95">
                                            <FileText className="h-4 w-4 text-indigo-500" />
                                            Upload File
                                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e.target.files[0], 'file')} />
                                        </label>

                                        <label className="cursor-pointer px-4 py-2.5 bg-white border border-slate-200 hover:border-pink-400 hover:bg-pink-50 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95">
                                            <Video className="h-4 w-4 text-pink-500" />
                                            Upload Video
                                            <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e.target.files[0], 'video')} />
                                        </label>

                                        <button
                                            onClick={openLinkModal}
                                            className="px-4 py-2.5 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95"
                                        >
                                            <Link2 className="h-4 w-4 text-emerald-500" />
                                            Add Link
                                        </button>
                                    </div>
                                </div>

                                {/* 3. Deadline Section (Full Width) */}
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-slate-400" />
                                        Tenggat Waktu
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.deadline}
                                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                        className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                                        required
                                    />
                                </div>

                                {/* 4. Split Layout: Instructions & Classes */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                                    {/* Left: Instructions */}
                                    <div className="bg-amber-50 rounded-2xl p-6 shadow-sm border border-amber-100/50 flex flex-col h-full">
                                        <label className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4" /> Instruksi Pengerjaan
                                        </label>
                                        <textarea
                                            value={formData.submissionInstructions}
                                            onChange={(e) => setFormData({ ...formData, submissionInstructions: e.target.value })}
                                            placeholder="Contoh: Format file PDF, maksimal 2 halaman..."
                                            className="flex-1 w-full p-3 bg-white/80 border border-amber-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 min-h-[150px] resize-none transition-all"
                                        />
                                    </div>

                                    {/* Right: Class Assignment */}
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col h-full">
                                        <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center justify-between">
                                            <span>Assign ke Kelas</span>
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                                {formData.assignedClasses.length} Dipilih
                                            </span>
                                        </label>
                                        <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 flex-1 max-h-[250px]">
                                            {classes.map(cls => (
                                                <label
                                                    key={cls.id}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${formData.assignedClasses.includes(cls.id)
                                                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                                                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${formData.assignedClasses.includes(cls.id)
                                                        ? 'bg-blue-500 border-blue-500 scale-100'
                                                        : 'bg-white border-slate-300 scale-90 group-hover:scale-100'
                                                        }`}>
                                                        {formData.assignedClasses.includes(cls.id) && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={formData.assignedClasses.includes(cls.id)}
                                                        onChange={() => toggleClassSelection(cls.id)}
                                                    />
                                                    <span className={`text-sm font-bold ${formData.assignedClasses.includes(cls.id) ? 'text-blue-700' : 'text-slate-600'
                                                        }`}>
                                                        {cls.name}
                                                    </span>
                                                </label>
                                            ))}
                                            {classes.length === 0 && (
                                                <div className="text-center py-8">
                                                    <p className="text-sm text-slate-400">Belum ada kelas.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons - Inline (No Footer) */}
                                <div className="flex items-center justify-end gap-3 pt-8 mt-4 border-t border-slate-200/60">
                                    <button
                                        onClick={onClose}
                                        disabled={loading}
                                        className="px-8 py-4 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-all text-base"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={onSubmit}
                                        disabled={loading}
                                        className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all flex items-center gap-2 text-base"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-5 w-5" />
                                                {isEditing ? 'Simpan Perubahan' : 'Terbitkan Tugas'}
                                            </>
                                        )}
                                    </button>
                                </div>

                            </div >
                        </div >
                    </motion.div >
                </div >
            )
            }
            {
                showLinkModal && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-800">Tambah Link</h3>
                                <button onClick={() => setShowLinkModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X className="h-5 w-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">URL / Link Address</label>
                                    <input
                                        type="url"
                                        value={linkModalData.url}
                                        onChange={(e) => setLinkModalData({ ...linkModalData, url: e.target.value })}
                                        placeholder="https://example.com"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Link Title (Optional)</label>
                                    <input
                                        type="text"
                                        value={linkModalData.name}
                                        onChange={(e) => setLinkModalData({ ...linkModalData, name: e.target.value })}
                                        placeholder="Contoh: Video Referensi"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        onClick={() => setShowLinkModal(false)}
                                        className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleAddQuestionLink(linkModalData.questionId, linkModalData.url, linkModalData.name);
                                            setShowLinkModal(false);
                                        }}
                                        disabled={!linkModalData.url}
                                        className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Tambah Link
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )
            }
        </AnimatePresence >,
        document.body
    );
}
