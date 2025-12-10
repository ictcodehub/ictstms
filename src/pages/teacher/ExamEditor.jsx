import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Save,
    ArrowLeft,
    Plus,
    Trash2,
    CheckCircle2,
    X,
    Copy
} from 'lucide-react';
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
        randomizeAnswers: false
    });

    const [questions, setQuestions] = useState([]);
    const [activeQuestionId, setActiveQuestionId] = useState(null);

    // Load initial data
    useEffect(() => {
        const loadClasses = async () => {
            try {
                const q = query(collection(db, 'classes'), where('createdBy', '==', currentUser.uid));
                const snapshot = await getDocs(q);
                setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
                        randomizeAnswers: data.randomizeAnswers || false
                    });
                    setQuestions(data.questions || []);
                } else {
                    toast.error("Ujian tidak ditemukan");
                    navigate('/teacher/exams');
                }
            } catch (error) {
                console.error("Error loading exam:", error);
                toast.error("Gagal memuat ujian");
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
        if (window.confirm("Hapus soal ini?")) {
            setQuestions(questions.filter(q => q.id !== qId));
            if (activeQuestionId === qId) setActiveQuestionId(null);
        }
    };

    const duplicateQuestion = (question) => {
        const newQuestion = {
            ...question,
            id: crypto.randomUUID(),
            text: question.text + ' (Copy)'
        };
        setQuestions([...questions, newQuestion]);
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
            toast.error("Gagal menyimpan ujian");
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    return (
        <div className="pb-20 max-w-7xl mx-auto">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
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
                <div className="flex gap-2">
                    <button
                        onClick={() => setExamData(prev => ({ ...prev, status: prev.status === 'draft' ? 'published' : 'draft' }))}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${examData.status === 'draft' ? 'border-green-600 text-green-600 hover:bg-green-50' : 'border-slate-300 text-slate-500 hover:bg-slate-50'}`}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
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
                            <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
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
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-4">Kelas Peserta</h3>
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
                                            <button onClick={() => deleteQuestion(question.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Hapus">
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
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
