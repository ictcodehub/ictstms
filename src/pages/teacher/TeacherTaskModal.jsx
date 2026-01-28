import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
    X, FileText, Link2, Image as ImageIcon, Video,
    Calendar, Clock, CheckCircle, AlertCircle,
    Save, Paperclip, Trash2, ChevronDown
} from 'lucide-react';
import React from 'react';
import RichTextEditor from '../../components/RichTextEditor';

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
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Task Description
                                            </span>
                                            <div className="flex gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-400/50"></div>
                                                <div className="w-2 h-2 rounded-full bg-amber-400/50"></div>
                                                <div className="w-2 h-2 rounded-full bg-green-400/50"></div>
                                            </div>
                                        </div>
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
                                </div>

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
                                            <div key={`res-${idx}`} className="group flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all min-w-[200px] max-w-sm">
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
                                            <div key={`att-${idx}`} className="group flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all min-w-[200px] max-w-sm">
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

                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
