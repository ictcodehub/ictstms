import { useState, useRef } from 'react';
import { Upload, X, FileText, Image, File, CheckCircle2, AlertCircle } from 'lucide-react';
import { validateFile, formatFileSize, getFileExtension } from '../utils/fileUtils';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileUpload({ onFileSelect, disabled = false, currentFile = null }) {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState(currentFile);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (disabled) return;

        const files = e.dataTransfer.files;
        if (files && files[0]) {
            handleFileSelection(files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (disabled) return;

        const files = e.target.files;
        if (files && files[0]) {
            handleFileSelection(files[0]);
        }
    };

    const handleFileSelection = (file) => {
        setError(null);

        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
            setError(validation.error);
            setSelectedFile(null);
            if (onFileSelect) onFileSelect(null);
            return;
        }

        // File is valid
        setSelectedFile(file);
        if (onFileSelect) onFileSelect(file);
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (onFileSelect) onFileSelect(null);
    };

    const handleClick = () => {
        if (!disabled) {
            fileInputRef.current?.click();
        }
    };

    const getFileIcon = (file) => {
        if (!file) return File;

        const extension = getFileExtension(file.name);
        if (['jpg', 'jpeg', 'png'].includes(extension)) {
            return Image;
        } else if (['pdf', 'doc', 'docx'].includes(extension)) {
            return FileText;
        }
        return File;
    };

    const FileIcon = selectedFile ? getFileIcon(selectedFile) : Upload;

    return (
        <div className="w-full">
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleChange}
                disabled={disabled}
            />

            {!selectedFile ? (
                <div
                    className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
                        ${dragActive
                            ? 'border-blue-500 bg-blue-50'
                            : error
                                ? 'border-red-300 bg-red-50'
                                : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={handleClick}
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
                            ${dragActive
                                ? 'bg-blue-100'
                                : error
                                    ? 'bg-red-100'
                                    : 'bg-slate-100'
                            }
                        `}>
                            {error ? (
                                <AlertCircle className="h-8 w-8 text-red-500" />
                            ) : (
                                <Upload className={`h-8 w-8 ${dragActive ? 'text-blue-600' : 'text-slate-400'}`} />
                            )}
                        </div>

                        <div>
                            <p className="text-slate-700 font-semibold mb-1">
                                {dragActive ? 'Lepaskan file di sini' : 'Pilih file atau drag & drop'}
                            </p>
                            <p className="text-sm text-slate-500">
                                Semua jenis file (Max 10MB)
                            </p>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-2 px-4 py-2 bg-red-100 border border-red-200 rounded-xl"
                            >
                                <p className="text-sm text-red-600 font-medium">{error}</p>
                            </motion.div>
                        )}
                    </div>
                </div>
            ) : (
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl p-6"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <FileIcon className="h-6 w-6 text-blue-600" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">
                                            {selectedFile.name}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {formatFileSize(selectedFile.size)}
                                        </p>
                                    </div>

                                    {!disabled && (
                                        <button
                                            onClick={handleRemoveFile}
                                            className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all border border-slate-200 hover:border-red-200"
                                            title="Hapus file"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mt-3">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span className="text-xs text-green-600 font-medium">File siap diupload</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    );
}
