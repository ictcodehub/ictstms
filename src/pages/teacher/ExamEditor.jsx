import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Save,
    ArrowLeft,
    Plus,
    Trash2,
    CheckCircle2,
    X,
    Copy,
    FileText,
    Image as ImageIcon,
    File,
    Video,
    Link,
    Paperclip,
    FileDown,
    Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function ExamEditor() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const { id } = useParams();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(!!id);
    const [classes, setClasses] = useState([]);

    // Form State
    const [examData, setExamData] = useState({
        title: '',
        description: '',
        duration: 60, // minutes
        assignedClasses: [],
        status: 'draft',
        randomizeQuestions: false,
        randomizeAnswers: false,
        showResultToStudents: false
    });

    const [questions, setQuestions] = useState([]);
    const [activeQuestionId, setActiveQuestionId] = useState(null);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkModalData, setLinkModalData] = useState({ questionId: null, url: '', name: '' });
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showDeleteSingleConfirmation, setShowDeleteSingleConfirmation] = useState(false);
    const [questionToDelete, setQuestionToDelete] = useState(null);
    const [showImportSuccess, setShowImportSuccess] = useState(false);
    const [importSummary, setImportSummary] = useState(0);

    // Load initial data
    useEffect(() => {
        const loadClasses = async () => {
            try {
                const q = query(collection(db, 'classes'), where('createdBy', '==', currentUser.uid));
                const snapshot = await getDocs(q);
                const loadedClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort classes naturally (6A, 6B, 9A, 9B, etc.)
                loadedClasses.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                setClasses(loadedClasses);
            } catch (error) {
                console.error("Error loading classes:", error);
            }
        };

        const loadExam = async () => {
            if (!id) return;
            try {
                const docRef = doc(db, 'exams', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setExamData({
                        title: data.title,
                        description: data.description,
                        duration: data.duration,
                        assignedClasses: data.assignedClasses || [],
                        status: data.status,
                        randomizeQuestions: data.randomizeQuestions || false,
                        randomizeAnswers: data.randomizeAnswers || false,
                        showResultToStudents: data.showResultToStudents || false
                    });
                    setQuestions(data.questions || []);
                    if (data.questions && data.questions.length > 0) {
                        setActiveQuestionId(data.questions[0].id);
                    }
                } else {
                    toast.error("Ujian tidak ditemukan");
                    navigate('/teacher/exams');
                }
            } catch (error) {
                console.error("Error loading exam:", error);
                toast.error("Failed to load exam");
            } finally {
                setInitialLoading(false);
            }
        };

        loadClasses();
        loadExam();
    }, [id, currentUser, navigate]);

    // Questions Management
    const addQuestion = () => {
        // Validation: Cannot add new question if existing ones are incomplete
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];

            // Check text
            if (!q.text.trim()) {
                toast.error(`Pertanyaan nomor ${i + 1} belum diisi`);
                setActiveQuestionId(q.id);
                return;
            }

            // Check options based on type
            if (q.type === 'single_choice' || q.type === 'true_false') {
                if (!q.options.some(o => o.isCorrect)) {
                    toast.error(`Soal nomor ${i + 1} belum ada kunci jawaban`);
                    setActiveQuestionId(q.id);
                    return;
                }
            }
            if (q.type === 'multiple_choice') {
                if (!q.options.some(o => o.isCorrect)) {
                    toast.error(`Soal nomor ${i + 1} (Checkbox) minimal 1 jawaban benar`);
                    setActiveQuestionId(q.id);
                    return;
                }
            }
            if (q.type === 'matching') {
                if (q.options.some(o => !o.left.trim() || !o.right.trim())) {
                    toast.error(`Soal nomor ${i + 1} pasangan tidak lengkap`);
                    setActiveQuestionId(q.id);
                    return;
                }
            }
        }

        const newQuestion = {
            id: crypto.randomUUID(),
            type: 'single_choice', // default
            text: '',
            attachments: [],
            options: [
                { id: 'opt1', text: '', isCorrect: false },
                { id: 'opt2', text: '', isCorrect: false },
                { id: 'opt3', text: '', isCorrect: false },
                { id: 'opt4', text: '', isCorrect: false }
            ],
            points: 10,
            enablePartialScoring: true // Default enabled for suitable types
        };
        setQuestions([...questions, newQuestion]);
        setActiveQuestionId(newQuestion.id);
    };

    const updateQuestion = (qId, updates) => {
        setQuestions(questions.map(q => q.id === qId ? { ...q, ...updates } : q));
    };

    const deleteQuestion = (qId) => {
        setQuestionToDelete(qId);
        setShowDeleteSingleConfirmation(true);
    };

    const confirmDeleteSingle = () => {
        if (!questionToDelete) return;
        setQuestions(questions.filter(q => q.id !== questionToDelete));
        if (activeQuestionId === questionToDelete) setActiveQuestionId(null);
        setShowDeleteSingleConfirmation(false);
        setQuestionToDelete(null);
        toast.success("Soal dihapus");
    };

    const deleteAllQuestions = () => {
        if (questions.length === 0) return;
        setShowDeleteConfirmation(true);
    };

    const confirmDeleteAll = () => {
        setQuestions([]);
        setActiveQuestionId(null);
        setShowDeleteConfirmation(false);
        toast.success("Semua soal dihapus");
    };

    const duplicateQuestion = (question) => {
        const newQuestion = {
            ...question,
            id: crypto.randomUUID(),
            text: question.text + ' (Copy)'
        };
        setQuestions([...questions, newQuestion]);
    };

    // Attachment Handlers
    const handleFileUpload = async (questionId, file) => {
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error("File terlalu besar (Maksimal 10MB)");
            return;
        }

        const toastId = toast.loading("Mengupload file...");
        try {
            const folder = id ? `exams/${id}` : `exams/temp/${Date.now()}`;
            const storageRef = ref(storage, `${folder}/${questionId}/${file.name}`);

            console.log("Starting upload...", file.name);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload is ' + progress + '% done');
                },
                (error) => {
                    console.error("Upload error details:", error);
                    // Trigger fallback immediately on error
                    handleUploadFallback(file, questionId, toastId);
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        console.log('File available at', downloadURL);

                        // ... (ketersediaan URL sukses) ...

                        let type = 'file';
                        if (file.type.startsWith('image/')) type = 'image';
                        if (file.type.startsWith('video/')) type = 'video';

                        const newAttachment = {
                            id: crypto.randomUUID(),
                            type,
                            url: downloadURL,
                            name: file.name
                        };

                        saveAttachment(questionId, newAttachment);
                        toast.success("File berhasil diupload", { id: toastId });
                    } catch (urlError) {
                        console.error("Error getting URL:", urlError);
                        handleUploadFallback(file, questionId, toastId);
                    }
                }
            );
        } catch (error) {
            console.error("Error uploading file:", error);
            handleUploadFallback(file, questionId, toastId);
        }
    };

    // Helper for saving attachment to state
    const saveAttachment = (questionId, newAttachment) => {
        const question = questions.find(q => q.id === questionId);
        const updatedAttachments = [...(question.attachments || []), newAttachment];
        updateQuestion(questionId, { attachments: updatedAttachments });
    };

    // Fallback for when Storage is unavailable (Free Tier/CORS issues)
    const handleUploadFallback = (file, questionId, toastId) => {
        console.log("Attempting fallback upload...");

        // 1. Try Base64 for small images (Persistent)
        if (file.type.startsWith('image/') && file.size < 500 * 1024) { // < 500KB
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                const newAttachment = {
                    id: crypto.randomUUID(),
                    type: 'image',
                    url: base64String, // Save Base64 string directly
                    name: file.name + ' (Local)'
                };
                saveAttachment(questionId, newAttachment);
                toast.success("Disimpan lokal (Base64)", { id: toastId, icon: '⚠️' });
            };
            reader.readAsDataURL(file);
            return;
        }

        // 2. Use Object URL for others (Temporary Preview)
        const objectUrl = URL.createObjectURL(file);
        let type = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        if (file.type.startsWith('video/')) type = 'video';

        const newAttachment = {
            id: crypto.randomUUID(),
            type,
            url: objectUrl,
            name: file.name + ' (Preview Only)'
        };
        saveAttachment(questionId, newAttachment);
        toast.success("Mode Preview (Storage non-aktif)", { id: toastId, icon: '⚠️' });
    };

    const handleAddLink = (questionId, url, label) => {
        if (!url) return;

        const newAttachment = {
            id: crypto.randomUUID(),
            type: 'link',
            url,
            name: label || url
        };

        const question = questions.find(q => q.id === questionId);
        const updatedAttachments = [...(question.attachments || []), newAttachment];
        updateQuestion(questionId, { attachments: updatedAttachments });
        toast.success("Link berhasil ditambahkan");
    };

    const removeAttachment = (questionId, attachmentId) => {
        const question = questions.find(q => q.id === questionId);
        const updatedAttachments = question.attachments.filter(a => a.id !== attachmentId);
        updateQuestion(questionId, { attachments: updatedAttachments });
        toast.success("Lampiran dihapus");
    };

    // Question Type Logic
    const handleTypeChange = (qId, newType) => {
        const currentQ = questions.find(q => q.id === qId);
        let updates = { type: newType };

        // Reset options structure based on new type
        if (newType === 'true_false') {
            updates.options = [
                { id: 'true', text: 'Benar', isCorrect: true },
                { id: 'false', text: 'Salah', isCorrect: false }
            ];
        } else if (newType === 'matching') {
            updates.options = [
                { id: 'p1', left: '', right: '' },
                { id: 'p2', left: '', right: '' },
                { id: 'p3', left: '', right: '' }
            ];
        } else if (currentQ.type === 'matching' || currentQ.type === 'true_false') {
            // Revert to standard options if switching from matching/tf
            updates.options = [
                { id: crypto.randomUUID(), text: '', isCorrect: false },
                { id: crypto.randomUUID(), text: '', isCorrect: false },
                { id: crypto.randomUUID(), text: '', isCorrect: false },
                { id: crypto.randomUUID(), text: '', isCorrect: false }
            ];
        }

        updateQuestion(qId, updates);
    };

    // --- Excel Import/Export Logic ---
    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const headers = ['Pertanyaan', 'Tipe', 'Poin', 'Opsi_A', 'Opsi_B', 'Opsi_C', 'Opsi_D', 'Opsi_E', 'Jawaban_Benar'];
        const exampleData = [
            ['Ibu kota Indonesia adalah...', 'single_choice', 10, 'Jakarta', 'Bandung', 'Surabaya', 'Medan', '', 'A'],
            ['Manakah yang termasuk buah?', 'multiple_choice', 10, 'Apel', 'Kucing', 'Jeruk', 'Batu', '', 'A,C'],
            ['Bumi itu bulat', 'true_false', 10, '', '', '', '', '', 'Benar'],
            ['Jodohkan hewan dan kakinya', 'matching', 10, 'Ayam || 2 Kaki', 'Kucing || 4 Kaki', 'Ular || Tidak punya kaki', '', '', ''],
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);

        // Add comments/help as a second sheet
        const helpHeaders = ['Tipe Soal', 'Kode Tipe', 'Format Opsi', 'Format Jawaban'];
        const helpData = [
            ['Pilihan Ganda', 'single_choice', 'Isi Opsi A-E', 'Huruf opsi benar (misal: A)'],
            ['Pilihan Jamak', 'multiple_choice', 'Isi Opsi A-E', 'Huruf opsi benar dipisah koma (misal: A,C)'],
            ['Benar Salah', 'true_false', 'Kosongkan Opsi', 'Tulis "Benar" atau "Salah"'],
            ['Menjodohkan', 'matching', 'Format: "Kiri || Kanan"', 'Kosongkan Jawaban'],
        ];
        const wsHelp = XLSX.utils.aoa_to_sheet([helpHeaders, ...helpData]);

        XLSX.utils.book_append_sheet(wb, ws, "Template Soal");
        XLSX.utils.book_append_sheet(wb, wsHelp, "Panduan");

        XLSX.writeFile(wb, "Template_Soal_ICT_Codehub.xlsx");
        toast.success("Template berhasil didownload");
    };

    const handleExcelImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsName = wb.SheetNames[0];
                const ws = wb.Sheets[wsName];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    toast.error("File Excel kosong atau format salah");
                    return;
                }

                const newQuestions = [];

                data.forEach((row, idx) => {
                    const qTypeRaw = (row['Tipe'] || 'single_choice').toLowerCase().trim();
                    let qType = 'single_choice';
                    if (qTypeRaw.includes('multiple') || qTypeRaw.includes('jamak')) qType = 'multiple_choice';
                    if (qTypeRaw.includes('true') || qTypeRaw.includes('fals') || qTypeRaw.includes('benar')) qType = 'true_false';
                    if (qTypeRaw.includes('match') || qTypeRaw.includes('jodoh')) qType = 'matching';

                    const points = parseInt(row['Poin']) || 10;
                    const text = row['Pertanyaan'] || `Soal Tanpa Teks #${idx + 1}`;
                    const answerRaw = String(row['Jawaban_Benar'] || '').toUpperCase().trim();

                    const newQ = {
                        id: crypto.randomUUID(),
                        type: qType,
                        text,
                        points,
                        attachments: [],
                        enablePartialScoring: true,
                        options: []
                    };

                    if (qType === 'matching') {
                        // Matching Parser: Split 'A || B'
                        const rawOptions = [row['Opsi_A'], row['Opsi_B'], row['Opsi_C'], row['Opsi_D'], row['Opsi_E']];
                        newQ.options = rawOptions.filter(o => o && String(o).includes('||')).map(o => {
                            const [left, right] = String(o).split('||').map(s => s.trim());
                            return { id: crypto.randomUUID(), left, right };
                        });
                        // Fallback if empty
                        if (newQ.options.length === 0) {
                            newQ.options = [{ id: crypto.randomUUID(), left: '', right: '' }];
                        }
                    } else if (qType === 'true_false') {
                        // TF Parser
                        const isTrue = answerRaw.includes('BENAR') || answerRaw === 'A' || answerRaw === 'TRUE';
                        newQ.options = [
                            { id: 'true', text: 'Benar', isCorrect: isTrue },
                            { id: 'false', text: 'Salah', isCorrect: !isTrue }
                        ];
                    } else {
                        // Single/Multiple Parser
                        const rawOptions = [row['Opsi_A'], row['Opsi_B'], row['Opsi_C'], row['Opsi_D'], row['Opsi_E']];
                        // Map A,B,C,D,E to indices 0,1,2,3,4
                        const correctIndices = [];
                        if (qType === 'multiple_choice') {
                            if (answerRaw.includes('A')) correctIndices.push(0);
                            if (answerRaw.includes('B')) correctIndices.push(1);
                            if (answerRaw.includes('C')) correctIndices.push(2);
                            if (answerRaw.includes('D')) correctIndices.push(3);
                            if (answerRaw.includes('E')) correctIndices.push(4);
                        } else {
                            if (answerRaw === 'A') correctIndices.push(0);
                            if (answerRaw === 'B') correctIndices.push(1);
                            if (answerRaw === 'C') correctIndices.push(2);
                            if (answerRaw === 'D') correctIndices.push(3);
                            if (answerRaw === 'E') correctIndices.push(4);
                        }

                        newQ.options = rawOptions.map((optText, i) => {
                            if (!optText) return null; // Skip empty cols
                            return {
                                id: crypto.randomUUID(),
                                text: String(optText),
                                isCorrect: correctIndices.includes(i)
                            };
                        }).filter(o => o !== null);
                    }

                    newQuestions.push(newQ);
                });

                setQuestions(prev => [...prev, ...newQuestions]);
                setImportSummary(newQuestions.length);
                setShowImportSuccess(true);
                e.target.value = null; // Reset input

            } catch (error) {
                console.error("Excel Parse Error:", error);
                toast.error("Gagal membaca file Excel. Pastikan format sesuai template.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!examData.title) return toast.error("Judul ujian wajib diisi");
        if (questions.length === 0) return toast.error("Minimal harus ada 1 soal");

        // Validate question correctness
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text) return toast.error(`Soal nomor ${i + 1} belum ada pertanyaannya`);

            if (q.type === 'single_choice' || q.type === 'true_false') {
                if (!q.options.some(o => o.isCorrect)) return toast.error(`Soal nomor ${i + 1} belum ada kunci jawaban`);
            }
            if (q.type === 'multiple_choice') {
                if (!q.options.some(o => o.isCorrect)) return toast.error(`Soal nomor ${i + 1} (Checkbox) minimal 1 jawaban benar`);
            }
            if (q.type === 'matching') {
                if (q.options.some(o => !o.left || !o.right)) return toast.error(`Soal nomor ${i + 1} pasangan tidak lengkap`);
            }
        }

        setLoading(true);
        try {
            const payload = {
                ...examData,
                questions,
                updatedAt: serverTimestamp(),
                createdBy: currentUser.uid
            };

            if (id) {
                await updateDoc(doc(db, 'exams', id), payload);
                toast.success("Ujian diperbarui");
            } else {
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, 'exams'), payload);
                toast.success("Ujian dibuat");
            }
            navigate('/teacher/exams');
        } catch (error) {
            console.error("Error saving exam:", error);
            toast.error("Failed to save exam");
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    return (
        <div className="pb-20">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-200 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/teacher/exams')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="h-6 w-6 text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">{id ? 'Edit Ujian' : 'Buat Ujian Baru'}</h1>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${examData.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                            {examData.status === 'published' ? 'Terbit' : 'Draft'}
                        </span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setExamData(prev => ({ ...prev, status: prev.status === 'draft' ? 'published' : 'draft' }))}
                        className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition-all"
                    >
                        {examData.status === 'draft' ? 'Terbitkan' : 'Jadikan Draft'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        Simpan
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-6">
                {/* Left: General Settings */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <h3 className="font-bold text-lg text-slate-800 border-b pb-2">Info Dasar</h3>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Judul Ujian</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={examData.title}
                                onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                                placeholder="Contoh: Modul 1 Matematika"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                            <textarea
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                                value={examData.description}
                                onChange={(e) => setExamData({ ...examData, description: e.target.value })}
                                placeholder="Petunjuk pengerjaan..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Durasi (Menit)</label>
                            <input
                                type="number"
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={examData.duration}
                                onChange={(e) => setExamData({ ...examData, duration: parseInt(e.target.value) || 0 })}
                            />
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-200">
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Randomization Options</h4>

                            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                                <div>
                                    <span className="text-sm font-medium text-slate-700">Randomize Question Order</span>
                                    <p className="text-xs text-slate-500 mt-0.5">Shuffle questions for each student</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={examData.randomizeQuestions}
                                    onChange={(e) => setExamData({ ...examData, randomizeQuestions: e.target.checked })}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                                <div>
                                    <span className="text-sm font-medium text-slate-700">Randomize Answer Options</span>
                                    <p className="text-xs text-slate-500 mt-0.5">Shuffle answer choices within questions</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={examData.randomizeAnswers}
                                    onChange={(e) => setExamData({ ...examData, randomizeAnswers: e.target.checked })}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                            </label>

                            <div className="pt-4 border-t border-slate-200">
                                <h4 className="text-sm font-semibold text-slate-700 mb-2">Review Settings</h4>
                                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                                    <div>
                                        <span className="text-sm font-medium text-slate-700">Show Results to Students</span>
                                        <p className="text-xs text-slate-500 mt-0.5">Allow students to see correct answers after submission</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={examData.showResultToStudents}
                                        onChange={(e) => setExamData({ ...examData, showResultToStudents: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-4">Participant Classes</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {classes.map(cls => (
                                <label key={cls.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={examData.assignedClasses.includes(cls.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setExamData(prev => ({ ...prev, assignedClasses: [...prev.assignedClasses, cls.id] }));
                                            } else {
                                                setExamData(prev => ({ ...prev, assignedClasses: prev.assignedClasses.filter(id => id !== cls.id) }));
                                            }
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    />
                                    <span className="text-slate-700">{cls.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center/Right: Question Editor */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Import/Export Tools */}
                    <div className="flex gap-2">
                        <button
                            onClick={downloadTemplate}
                            className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-bold border border-green-200 transition-colors"
                        >
                            <FileDown className="h-4 w-4" /> Template Excel
                        </button>
                        <label className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-bold border border-blue-200 transition-colors cursor-pointer">
                            <Upload className="h-4 w-4" /> Import Excel
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                onChange={handleExcelImport}
                            />
                        </label>
                        {questions.length > 0 && (
                            <button
                                onClick={deleteAllQuestions}
                                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-bold border border-red-200 transition-colors ml-auto"
                            >
                                <Trash2 className="h-4 w-4" /> Hapus Semua
                            </button>
                        )}
                    </div>

                    {/* Question List Visualizer */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-2">
                        {questions.map((q, idx) => (
                            <button
                                key={q.id}
                                onClick={() => setActiveQuestionId(q.id)}
                                className={`w-10 h-10 rounded-lg font-bold text-sm transition-all border ${activeQuestionId === q.id
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                            >
                                {idx + 1}
                            </button>
                        ))}
                        <button
                            onClick={addQuestion}
                            className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:text-blue-600 hover:border-blue-400 flex items-center justify-center transition-colors"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Active Question Editor */}
                    <AnimatePresence mode="wait">
                        {activeQuestionId && (() => {
                            const question = questions.find(q => q.id === activeQuestionId);
                            if (!question) return null;
                            const qIndex = questions.findIndex(q => q.id === activeQuestionId);

                            return (
                                <motion.div
                                    key={activeQuestionId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                                >
                                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <span className="text-lg font-bold text-slate-400">#{qIndex + 1}</span>
                                            <select
                                                value={question.type}
                                                onChange={(e) => handleTypeChange(question.id, e.target.value)}
                                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="single_choice">Pilihan Ganda (1 Jawaban)</option>
                                                <option value="multiple_choice">Pilihan Jamak (Checkbox)</option>
                                                <option value="true_false">Benar / Salah</option>
                                                <option value="matching">Menjodohkan</option>
                                            </select>
                                            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Poin</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={question.points || 0}
                                                    onChange={(e) => updateQuestion(question.id, { points: parseInt(e.target.value) || 0 })}
                                                    className="w-20 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => duplicateQuestion(question)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Duplikat">
                                                <Copy className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => deleteQuestion(question.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {/* Question Text */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Pertanyaan</label>
                                            <textarea
                                                value={question.text}
                                                onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] text-lg"
                                                placeholder="Tulis pertanyaan di sini..."
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
                                                            {att.type === 'file' && <File className="w-8 h-8 text-orange-500" />}
                                                            {att.type === 'link' && <Link className="w-8 h-8 text-green-500" />}

                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-medium text-slate-700 truncate" title={att.name}>{att.name}</p>
                                                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                                                                    Lihat
                                                                </a>
                                                            </div>

                                                            <button
                                                                onClick={() => removeAttachment(question.id, att.id)}
                                                                className="absolute top-1 right-1 p-1 bg-white rounded-full shadow-sm text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex gap-2">
                                                    <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                                                        <ImageIcon className="h-4 w-4" />
                                                        Gambar
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="image/*"
                                                            onChange={(e) => handleFileUpload(question.id, e.target.files[0])}
                                                        />
                                                    </label>
                                                    <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                                                        <Paperclip className="h-4 w-4" />
                                                        File / Dokumen
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                                            onChange={(e) => handleFileUpload(question.id, e.target.files[0])}
                                                        />
                                                    </label>
                                                    <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                                                        <Video className="h-4 w-4" />
                                                        Video
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="video/*"
                                                            onChange={(e) => handleFileUpload(question.id, e.target.files[0])}
                                                        />
                                                    </label>
                                                    <button
                                                        onClick={() => {
                                                            setLinkModalData({ questionId: question.id, url: '', name: '' });
                                                            setShowLinkModal(true);
                                                        }}
                                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
                                                    >
                                                        <Link className="h-4 w-4" />
                                                        Link
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Options Editor */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-sm font-bold text-slate-700">Opsi Jawaban</label>
                                                {(question.type === 'multiple_choice' || question.type === 'matching') && (
                                                    <div className="flex items-center gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100 transition-colors" title="Jika aktif, siswa mendapat nilai sebagian untuk jawaban yang benar sebagian. Jika mati, jawaban harus benar sempurna.">
                                                            <input
                                                                type="checkbox"
                                                                checked={question.enablePartialScoring !== false}
                                                                onChange={(e) => updateQuestion(question.id, { enablePartialScoring: e.target.checked })}
                                                                className="rounded text-blue-600 focus:ring-blue-500"
                                                            />
                                                            Partial Scoring
                                                        </label>
                                                        {question.type === 'multiple_choice' && (
                                                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                                                Centang semua jawaban benar
                                                            </span>
                                                        )}
                                                        {question.type === 'matching' && (
                                                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                                                Pasangan Kiri - Kanan
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                {question.type === 'matching' ? (
                                                    // Matching Editor
                                                    <>
                                                        {question.options.map((opt, idx) => (
                                                            <div key={opt.id} className="flex gap-4 items-center">
                                                                <div className="bg-slate-100 flex items-center justify-center w-8 h-8 rounded-full font-bold text-slate-500 text-xs">
                                                                    {idx + 1}
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    value={opt.left}
                                                                    onChange={(e) => {
                                                                        const newOpts = [...question.options];
                                                                        newOpts[idx].left = e.target.value;
                                                                        updateQuestion(question.id, { options: newOpts });
                                                                    }}
                                                                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                                                    placeholder="Item Kiri"
                                                                />
                                                                <span className="text-slate-400">↔</span>
                                                                <input
                                                                    type="text"
                                                                    value={opt.right}
                                                                    onChange={(e) => {
                                                                        const newOpts = [...question.options];
                                                                        newOpts[idx].right = e.target.value;
                                                                        updateQuestion(question.id, { options: newOpts });
                                                                    }}
                                                                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                                                    placeholder="Pasangan Kanan"
                                                                />
                                                                <button onClick={() => {
                                                                    const newOpts = question.options.filter((_, i) => i !== idx);
                                                                    updateQuestion(question.id, { options: newOpts });
                                                                }} className="text-slate-400 hover:text-red-500">
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={() => updateQuestion(question.id, { options: [...question.options, { id: crypto.randomUUID(), left: '', right: '' }] })}
                                                            className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1"
                                                        >
                                                            <Plus className="h-3 w-3" /> Tambah Pasangan
                                                        </button>
                                                    </>
                                                ) : (
                                                    // Standard Options (Multiple Choice / Checkbox / TrueFalse)
                                                    <>
                                                        {question.options.map((opt, idx) => (
                                                            <div key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${opt.isCorrect ? 'border-green-200 bg-green-50/50' : 'border-slate-200'}`}>
                                                                <button
                                                                    onClick={() => {
                                                                        const newOpts = [...question.options];
                                                                        if (question.type === 'single_choice' || question.type === 'true_false') {
                                                                            // Clear others
                                                                            newOpts.forEach(o => o.isCorrect = false);
                                                                            newOpts[idx].isCorrect = true;
                                                                        } else {
                                                                            // Toggle
                                                                            newOpts[idx].isCorrect = !newOpts[idx].isCorrect;
                                                                        }
                                                                        updateQuestion(question.id, { options: newOpts });
                                                                    }}
                                                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${opt.isCorrect
                                                                        ? 'border-green-500 bg-green-500 text-white'
                                                                        : 'border-slate-300 hover:border-blue-400'
                                                                        }`}
                                                                >
                                                                    {opt.isCorrect && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                </button>

                                                                <input
                                                                    type="text"
                                                                    value={opt.text}
                                                                    readOnly={question.type === 'true_false'} // TF text is fixed
                                                                    onChange={(e) => {
                                                                        const newOpts = [...question.options];
                                                                        newOpts[idx].text = e.target.value;
                                                                        updateQuestion(question.id, { options: newOpts });
                                                                    }}
                                                                    className={`flex-1 bg-transparent outline-none ${opt.isCorrect ? 'text-green-800 font-medium' : 'text-slate-700'}`}
                                                                    placeholder={`Opsi ${idx + 1}`}
                                                                />

                                                                {question.type !== 'true_false' && (
                                                                    <button onClick={() => {
                                                                        const newOpts = question.options.filter((_, i) => i !== idx);
                                                                        updateQuestion(question.id, { options: newOpts });
                                                                    }} className="text-slate-400 hover:text-red-500 px-2">
                                                                        <X className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {question.type !== 'true_false' && (
                                                            <button
                                                                onClick={() => updateQuestion(question.id, { options: [...question.options, { id: crypto.randomUUID(), text: '', isCorrect: false }] })}
                                                                className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1 mt-2"
                                                            >
                                                                <Plus className="h-3 w-3" /> Tambah Opsi
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })()}
                        {!activeQuestionId && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center min-h-[500px]">
                                <div className="bg-slate-50 p-6 rounded-full mb-6">
                                    <FileText className="h-16 w-16 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Belum ada pertanyaan</h3>
                                <p className="text-slate-500 max-w-sm mb-8">
                                    Mulai buat ujian Anda dengan menambahkan pertanyaan baru.
                                </p>
                                <button
                                    onClick={addQuestion}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 shadow-xl shadow-blue-200 hover:-translate-y-1 transition-all"
                                >
                                    <Plus className="h-6 w-6" />
                                    Buat Pertanyaan Pertama
                                </button>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Custom Link Modal */}
            <AnimatePresence>
                {showLinkModal && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <Link className="h-5 w-5 text-blue-600" />
                                    Tambah Link
                                </h3>
                                <button onClick={() => setShowLinkModal(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Judul Link (Opsional)</label>
                                    <input
                                        type="text"
                                        placeholder="Contoh: Video Referensi"
                                        value={linkModalData.name}
                                        onChange={(e) => setLinkModalData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">URL / Tautan <span className="text-red-500">*</span></label>
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={linkModalData.url}
                                        onChange={(e) => setLinkModalData(prev => ({ ...prev, url: e.target.value }))}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                                <button
                                    onClick={() => setShowLinkModal(false)}
                                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (!linkModalData.url) return toast.error("URL tidak boleh kosong");
                                        handleAddLink(linkModalData.questionId, linkModalData.url, linkModalData.name);
                                        setShowLinkModal(false);
                                    }}
                                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"
                                >
                                    Simpan
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirmation && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-6 text-center space-y-4">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                                    <Trash2 className="h-8 w-8 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Hapus Semua Soal?</h3>
                                    <p className="text-slate-500 mt-2">
                                        Apakah Anda yakin ingin menghapus <b>{questions.length} soal</b>? <br />
                                        Tindakan ini tidak dapat dibatalkan.
                                    </p>
                                </div>
                            </div>
                            <div className="flex border-t border-slate-100 bg-slate-50 p-4 gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirmation(false)}
                                    className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={confirmDeleteAll}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                                >
                                    Ya, Hapus Semua
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Delete Single Question Confirmation Modal */}
            <AnimatePresence>
                {showDeleteSingleConfirmation && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-6 text-center space-y-4">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                                    <Trash2 className="h-8 w-8 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Hapus Soal Ini?</h3>
                                    <p className="text-slate-500 mt-2">
                                        Tindakan ini tidak dapat dibatalkan. Soal akan dihapus dari daftar.
                                    </p>
                                </div>
                            </div>
                            <div className="flex border-t border-slate-100 bg-slate-50 p-4 gap-3">
                                <button
                                    onClick={() => setShowDeleteSingleConfirmation(false)}
                                    className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={confirmDeleteSingle}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                                >
                                    Hapus Soal
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Import Success Modal */}
            <AnimatePresence>
                {showImportSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-6 text-center space-y-4">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Import Berhasil!</h3>
                                    <p className="text-slate-500 mt-2">
                                        Berhasil menambahkan <b className="text-green-600">{importSummary} soal baru</b> ke dalam editor ujian.
                                    </p>
                                </div>
                            </div>
                            <div className="flex border-t border-slate-100 bg-slate-50 p-4">
                                <button
                                    onClick={() => setShowImportSuccess(false)}
                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                                >
                                    Oke, Lanjutkan
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
