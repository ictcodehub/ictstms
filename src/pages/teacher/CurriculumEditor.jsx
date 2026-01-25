import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CalendarDays, ArrowLeft, Save, Plus, Trash2, X,
    Calendar, BookOpen, Eye, Lock, AlertCircle, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

// Month names for semester 1 (Jul-Dec) and semester 2 (Jan-Jun)
const SEMESTER_1_MONTHS = ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const SEMESTER_2_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];

// Block types with colors
const BLOCK_TYPES = [
    { id: 'holiday', label: 'Libur Nasional', color: '#FFA500', bgClass: 'bg-orange-500' },
    { id: 'religious', label: 'Hari Raya', color: '#FFD700', bgClass: 'bg-yellow-500' },
    { id: 'exam', label: 'Ujian/Test', color: '#22C55E', bgClass: 'bg-green-500' },
    { id: 'activity', label: 'Kegiatan Sekolah', color: '#3B82F6', bgClass: 'bg-blue-500' },
    { id: 'preparation', label: 'Persiapan/Review', color: '#8B5CF6', bgClass: 'bg-purple-500' },
];

export default function CurriculumEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('block'); // 'block', 'entries', 'calendar'
    const [curriculum, setCurriculum] = useState(null);

    // Block weeks form
    const [blockForm, setBlockForm] = useState({
        month: 1,
        week: 1,
        type: 'holiday',
        label: ''
    });

    // Entry form
    const [entryForm, setEntryForm] = useState({
        meetingNo: '',
        chapter: '',
        dateStart: '',
        dateEnd: '',
        topic: '',
        duration: 2,
        plotWeeks: []
    });
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [editingEntryId, setEditingEntryId] = useState(null);

    // Get months based on semester
    const months = useMemo(() => {
        if (!curriculum) return SEMESTER_2_MONTHS;
        return curriculum.semester === 1 ? SEMESTER_1_MONTHS : SEMESTER_2_MONTHS;
    }, [curriculum]);

    const [showChapterSuggestions, setShowChapterSuggestions] = useState(false);

    // Sort entries by Meeting No (P1, P2, P10, etc.)
    const sortedEntries = useMemo(() => {
        if (!curriculum?.entries) return [];
        return [...curriculum.entries].sort((a, b) => {
            return (a.meetingNo || '').localeCompare(b.meetingNo || '', undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [curriculum?.entries]);

    useEffect(() => {
        if (id && currentUser) {
            loadCurriculum();
        }
    }, [id, currentUser]);

    const loadCurriculum = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, 'curriculumOverviews', id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() };
                if (data.teacherId !== currentUser.uid) {
                    toast.error('Akses ditolak');
                    navigate('/teacher/curriculum');
                    return;
                }
                setCurriculum(data);
            } else {
                toast.error('Curriculum tidak ditemukan');
                navigate('/teacher/curriculum');
            }
        } catch (error) {
            console.error('Error loading curriculum:', error);
            toast.error('Gagal memuat curriculum');
        } finally {
            setLoading(false);
        }
    };

    const saveCurriculum = async (updatedData) => {
        setSaving(true);
        try {
            const docRef = doc(db, 'curriculumOverviews', id);
            await updateDoc(docRef, {
                ...updatedData,
                updatedAt: serverTimestamp()
            });
            setCurriculum(prev => ({ ...prev, ...updatedData }));
            toast.success('Perubahan tersimpan');
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    };

    // Block weeks functions
    const handleAddBlockedWeek = () => {
        if (!blockForm.label.trim()) {
            toast.error('Label harus diisi');
            return;
        }

        const newBlock = {
            id: Date.now().toString(),
            month: blockForm.month,
            week: blockForm.week,
            type: blockForm.type,
            label: blockForm.label.trim(),
            color: BLOCK_TYPES.find(t => t.id === blockForm.type)?.color || '#888'
        };

        // Check if already blocked
        const exists = curriculum.blockedWeeks?.some(
            b => b.month === newBlock.month && b.week === newBlock.week
        );
        if (exists) {
            toast.error('Minggu ini sudah di-block');
            return;
        }

        const updatedBlocks = [...(curriculum.blockedWeeks || []), newBlock];
        saveCurriculum({ blockedWeeks: updatedBlocks });
        setBlockForm({ ...blockForm, label: '' });
    };

    const handleRemoveBlockedWeek = (blockId) => {
        const updatedBlocks = curriculum.blockedWeeks.filter(b => b.id !== blockId);
        saveCurriculum({ blockedWeeks: updatedBlocks });
    };

    // Entry functions
    const openAddEntryModal = () => {
        const nextMeetingNo = `P${(curriculum.entries?.length || 0) + 1}`;

        // Smart date calculation
        let nextDateStart = '';
        let nextDateEnd = '';

        if (sortedEntries.length > 0) {
            const lastEntry = sortedEntries[sortedEntries.length - 1];
            if (lastEntry.dateRange) {
                const parts = lastEntry.dateRange.split(lastEntry.dateRange.includes(' - ') ? ' - ' : '~');
                if (parts.length >= 1) {
                    try {
                        // Parse last start date
                        const lastStart = new Date(parts[0]);

                        if (!isNaN(lastStart.getTime())) {
                            // Add 7 days for next week
                            const nextStart = new Date(lastStart);
                            nextStart.setDate(nextStart.getDate() + 7);

                            // Format YYYY-MM-DD
                            nextDateStart = nextStart.toISOString().split('T')[0];

                            // Calculate end date (assuming 5 days work week: Mon-Fri) or spread derived from last entry
                            if (parts.length > 1) {
                                const lastEnd = new Date(parts[1]);
                                if (!isNaN(lastEnd.getTime())) {
                                    const diffTime = Math.abs(lastEnd - lastStart);
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                    const nextEnd = new Date(nextStart);
                                    nextEnd.setDate(nextEnd.getDate() + diffDays);
                                    nextDateEnd = nextEnd.toISOString().split('T')[0];
                                }
                            } else {
                                // Default to +4 days (Mon -> Fri) if no end date previously
                                const nextEnd = new Date(nextStart);
                                nextEnd.setDate(nextEnd.getDate() + 4);
                                nextDateEnd = nextEnd.toISOString().split('T')[0];
                            }
                        }
                    } catch (e) {
                        console.error("Error calculating next date", e);
                    }
                }
            }
        }

        setEntryForm({
            meetingNo: nextMeetingNo,
            chapter: '',
            dateStart: nextDateStart,
            dateEnd: nextDateEnd,
            topic: '',
            duration: 2,
            plotWeeks: []
        });
        setEditingEntryId(null);
        setShowEntryModal(true);
    };

    const openEditEntryModal = (entry) => {
        setEntryForm({
            meetingNo: entry.meetingNo,
            chapter: entry.chapter,
            dateStart: entry.dateRange?.split('~')[0] || '',
            dateEnd: entry.dateRange?.split('~')[1] || '',
            topic: entry.topic,
            duration: entry.duration,
            plotWeeks: entry.plotWeeks || []
        });
        setEditingEntryId(entry.id);
        setShowEntryModal(true);
    };

    const handleSaveEntry = () => {
        if (!entryForm.meetingNo.trim() || !entryForm.chapter.trim()) {
            toast.error('Meeting No dan Chapter harus diisi');
            return;
        }

        const entryData = {
            id: editingEntryId || Date.now().toString(),
            meetingNo: entryForm.meetingNo.trim(),
            chapter: entryForm.chapter.trim(),
            dateRange: entryForm.dateStart && entryForm.dateEnd
                ? `${entryForm.dateStart}~${entryForm.dateEnd}`
                : '',
            topic: entryForm.topic.trim(),
            duration: entryForm.duration,
            plotWeeks: entryForm.plotWeeks
        };

        let updatedEntries;
        if (editingEntryId) {
            updatedEntries = curriculum.entries.map(e =>
                e.id === editingEntryId ? entryData : e
            );
        } else {
            updatedEntries = [...(curriculum.entries || []), entryData];
        }

        saveCurriculum({ entries: updatedEntries });
        setShowEntryModal(false);
    };

    const handleDeleteEntry = (entryId) => {
        const updatedEntries = curriculum.entries.filter(e => e.id !== entryId);
        saveCurriculum({ entries: updatedEntries });
    };

    const togglePlotWeek = (monthIndex, week) => {
        const key = `${monthIndex}-${week}`;
        const isBlocked = curriculum.blockedWeeks?.some(
            b => b.month === monthIndex + 1 && b.week === week
        );
        if (isBlocked) return;

        setEntryForm(prev => {
            const exists = prev.plotWeeks.some(p => p.month === monthIndex + 1 && p.week === week);
            if (exists) {
                return {
                    ...prev,
                    plotWeeks: prev.plotWeeks.filter(p => !(p.month === monthIndex + 1 && p.week === week))
                };
            } else {
                return {
                    ...prev,
                    plotWeeks: [...prev.plotWeeks, { month: monthIndex + 1, week, jp: prev.duration }]
                };
            }
        });
    };

    // Check if a week is blocked
    const isWeekBlocked = (monthIndex, week) => {
        return curriculum?.blockedWeeks?.some(
            b => b.month === monthIndex + 1 && b.week === week
        );
    };

    // Get block info for a week
    const getBlockInfo = (monthIndex, week) => {
        return curriculum?.blockedWeeks?.find(
            b => b.month === monthIndex + 1 && b.week === week
        );
    };

    // Get entries plotted for a week
    const getEntriesForWeek = (monthIndex, week) => {
        return sortedEntries?.filter(e =>
            e.plotWeeks?.some(p => p.month === monthIndex + 1 && p.week === week)
        ) || [];
    };

    // Calculate stats
    const totalME = useMemo(() => {
        if (!curriculum) return 0;
        const totalWeeks = months.length * 5;
        const blockedCount = curriculum.blockedWeeks?.length || 0;
        return totalWeeks - blockedCount;
    }, [curriculum, months]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!curriculum) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/teacher/curriculum')}
                        className="p-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                        <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{curriculum.className}</h1>
                        <p className="text-slate-500">
                            {curriculum.semester === 1 ? 'Semester 1 (Ganjil)' : 'Semester 2 (Genap)'} - {curriculum.year}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200">
                        <div className="text-center">
                            <p className="text-lg font-bold text-indigo-600">{totalME}</p>
                            <p className="text-xs text-slate-500">ME</p>
                        </div>
                        <div className="w-px h-8 bg-slate-200"></div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-emerald-600">{curriculum.entries?.length || 0}</p>
                            <p className="text-xs text-slate-500">Pertemuan</p>
                        </div>
                    </div>
                    {saving && (
                        <div className="flex items-center gap-2 text-indigo-600">
                            <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                            <span className="text-sm">Menyimpan...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-200">
                <button
                    onClick={() => setActiveTab('block')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'block'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    <Lock className="h-4 w-4" />
                    <span>Blok Minggu</span>
                </button>
                <button
                    onClick={() => setActiveTab('entries')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'entries'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    <BookOpen className="h-4 w-4" />
                    <span>Pertemuan</span>
                </button>
                <button
                    onClick={() => setActiveTab('calendar')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'calendar'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    <Eye className="h-4 w-4" />
                    <span>Kalender</span>
                </button>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                {/* Block Weeks Tab */}
                {activeTab === 'block' && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-amber-800 text-sm">
                                <strong>Step 1:</strong> Tandai minggu-minggu yang tidak tersedia untuk pembelajaran (libur, ujian, kegiatan sekolah).
                                Minggu yang di-block tidak bisa diisi materi.
                            </p>
                        </div>

                        {/* Add Block Form */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-slate-50 rounded-xl">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Bulan</label>
                                <select
                                    value={blockForm.month}
                                    onChange={(e) => setBlockForm({ ...blockForm, month: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    {months.map((m, i) => (
                                        <option key={i} value={i + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Minggu</label>
                                <select
                                    value={blockForm.week}
                                    onChange={(e) => setBlockForm({ ...blockForm, week: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    {[1, 2, 3, 4, 5].map(w => (
                                        <option key={w} value={w}>Minggu {w}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipe</label>
                                <select
                                    value={blockForm.type}
                                    onChange={(e) => setBlockForm({ ...blockForm, type: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    {BLOCK_TYPES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Idul Fitri 1446 H"
                                    value={blockForm.label}
                                    onChange={(e) => setBlockForm({ ...blockForm, label: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleAddBlockedWeek}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium"
                                >
                                    <Plus className="h-4 w-4" />
                                    Block
                                </button>
                            </div>
                        </div>

                        {/* Blocked Weeks List */}
                        <div className="space-y-2">
                            <h3 className="font-semibold text-slate-800">Minggu yang Di-block ({curriculum.blockedWeeks?.length || 0})</h3>
                            {!curriculum.blockedWeeks?.length ? (
                                <p className="text-slate-500 text-sm py-4 text-center">Belum ada minggu yang di-block</p>
                            ) : (
                                <div className="grid gap-2">
                                    {curriculum.blockedWeeks.map(block => {
                                        const typeInfo = BLOCK_TYPES.find(t => t.id === block.type);
                                        return (
                                            <div
                                                key={block.id}
                                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`w-3 h-3 rounded-full ${typeInfo?.bgClass || 'bg-gray-500'}`}
                                                    ></div>
                                                    <span className="font-medium text-slate-800">
                                                        {months[block.month - 1]} - Minggu {block.week}
                                                    </span>
                                                    <span className="text-sm text-slate-500">({block.label})</span>
                                                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                                        {typeInfo?.label}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveBlockedWeek(block.id)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Entries Tab */}
                {activeTab === 'entries' && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl flex-1 mr-4">
                                <BookOpen className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <p className="text-blue-800 text-sm">
                                    <strong>Step 2:</strong> Tambahkan pertemuan pembelajaran. Setiap pertemuan bisa di-plot ke satu atau lebih minggu.
                                </p>
                            </div>
                            <button
                                onClick={openAddEntryModal}
                                className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium flex-shrink-0"
                            >
                                <Plus className="h-5 w-5" />
                                Tambah Pertemuan
                            </button>
                        </div>

                        {/* Entries Spreadsheet Table */}
                        {!curriculum.entries?.length ? (
                            <div className="text-center py-12">
                                <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500">Belum ada pertemuan. Klik tombol "Tambah Pertemuan" untuk mulai.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="w-full border-collapse min-w-[1200px]">
                                    <thead>
                                        {/* Month Headers Row */}
                                        <tr className="bg-slate-100">
                                            <th colSpan="5" className="border-b border-r border-slate-200"></th>
                                            {months.map((month, idx) => (
                                                <th
                                                    key={idx}
                                                    colSpan={month === 'April' || month === 'Oktober' || month === 'Juli' ? 5 : 4}
                                                    className="px-1 py-2 text-xs font-bold text-slate-700 border-b border-r border-slate-200 text-center bg-slate-50"
                                                >
                                                    {month}
                                                </th>
                                            ))}
                                            <th className="border-b border-slate-200"></th>
                                        </tr>
                                        {/* Week Headers Row */}
                                        <tr className="bg-slate-50">
                                            <th className="w-10 px-2 py-2 text-xs font-bold text-slate-600 border-b border-r border-slate-200 text-center sticky left-0 bg-slate-50 z-10">No</th>
                                            <th className="w-32 px-2 py-2 text-xs font-bold text-slate-600 border-b border-r border-slate-200 text-left">Chapter/Bab</th>
                                            <th className="w-28 px-2 py-2 text-xs font-bold text-slate-600 border-b border-r border-slate-200 text-center">Date</th>
                                            <th className="min-w-[200px] max-w-[300px] px-2 py-2 text-xs font-bold text-slate-600 border-b border-r border-slate-200 text-left">TOPIC</th>
                                            <th className="w-14 px-2 py-2 text-xs font-bold text-slate-600 border-b border-r border-slate-200 text-center">TIME</th>
                                            {months.map((month, monthIdx) => {
                                                const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
                                                return Array.from({ length: weekCount }, (_, weekIdx) => (
                                                    <th
                                                        key={`${monthIdx}-${weekIdx}`}
                                                        className="w-8 px-1 py-2 text-[10px] font-semibold text-slate-500 border-b border-r border-slate-200 text-center"
                                                    >
                                                        {weekIdx + 1}
                                                    </th>
                                                ));
                                            })}

                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedEntries.map((entry, index) => (
                                            <tr
                                                key={entry.id}
                                                onClick={() => openEditEntryModal(entry)}
                                                className="cursor-pointer hover:bg-indigo-50/50 transition-colors group"
                                            >
                                                {/* No */}
                                                <td className="px-1 py-2 text-center border-b border-r border-slate-200 sticky left-0 bg-white z-10 transition-colors group-hover:bg-indigo-50/50">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded">
                                                        {entry.meetingNo}
                                                    </span>
                                                </td>
                                                {/* Chapter/Bab */}
                                                <td className="px-2 py-2 border-b border-r border-slate-200 max-w-[130px]">
                                                    <div className="text-xs font-medium text-slate-800 truncate" title={entry.chapter}>
                                                        {entry.chapter}
                                                    </div>
                                                </td>
                                                {/* Date */}
                                                <td className="px-1 py-2 text-center border-b border-r border-slate-200 whitespace-nowrap">
                                                    <span className="text-[10px] text-slate-600 block leading-tight font-medium">
                                                        {entry.dateRange ? (
                                                            (() => {
                                                                // Handle potential separators: ' - ' or '~'
                                                                const sep = entry.dateRange.includes(' - ') ? ' - ' : '~';
                                                                const parts = entry.dateRange.split(sep);

                                                                const formatDate = (dateStr) => {
                                                                    if (!dateStr || dateStr.length < 10) return '-';
                                                                    // dateStr is typically YYYY-MM-DD
                                                                    const yy = dateStr.slice(2, 4);
                                                                    const mm = dateStr.slice(5, 7);
                                                                    const dd = dateStr.slice(8, 10);
                                                                    return `${yy}.${mm}.${dd}`;
                                                                };

                                                                const start = formatDate(parts[0]);
                                                                const end = parts.length > 1 ? formatDate(parts[1]) : '';

                                                                return end ? `${start} - ${end}` : start;
                                                            })()
                                                        ) : '-'}
                                                    </span>
                                                </td>
                                                {/* Topic */}
                                                <td className="px-2 py-2 border-b border-r border-slate-200 max-w-[300px]">
                                                    <div className="text-[10px] text-slate-600 truncate" title={entry.topic}>
                                                        {entry.topic || '-'}
                                                    </div>
                                                </td>
                                                {/* Time (JP) */}
                                                <td className="px-1 py-2 text-center border-b border-r border-slate-200">
                                                    <span className="text-xs font-bold text-indigo-700">
                                                        {entry.duration}JP
                                                    </span>
                                                </td>
                                                {/* Weekly Cells */}
                                                {months.map((month, monthIdx) => {
                                                    const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
                                                    return Array.from({ length: weekCount }, (_, weekIdx) => {
                                                        const week = weekIdx + 1;
                                                        const monthNum = monthIdx + 1;

                                                        // Check if this week is blocked
                                                        const blockInfo = curriculum.blockedWeeks?.find(
                                                            b => b.month === monthNum && b.week === week
                                                        );

                                                        // Check previous week to see if we should skip rendering this cell (merged horizontally)
                                                        let isMergedWithPrev = false;
                                                        if (weekIdx > 0) {
                                                            const prevBlock = curriculum.blockedWeeks?.find(
                                                                b => b.month === monthNum && b.week === week - 1
                                                            );
                                                            if (blockInfo && prevBlock && blockInfo.label === prevBlock.label && blockInfo.type === prevBlock.type) {
                                                                isMergedWithPrev = true;
                                                            }
                                                        }

                                                        if (isMergedWithPrev) return null;

                                                        // Check how many future weeks can be merged
                                                        let colSpan = 1;
                                                        if (blockInfo) {
                                                            for (let i = weekIdx + 1; i < weekCount; i++) {
                                                                const nextWeek = i + 1;
                                                                const nextBlock = curriculum.blockedWeeks?.find(
                                                                    b => b.month === monthNum && b.week === nextWeek
                                                                );
                                                                if (nextBlock && nextBlock.label === blockInfo.label && nextBlock.type === blockInfo.type) {
                                                                    colSpan++;
                                                                } else {
                                                                    break;
                                                                }
                                                            }
                                                        }

                                                        // If blocked, render merged cell on first row, nothing on others
                                                        // ALSO handle colSpan for consecutive blocks in same month
                                                        if (blockInfo) {
                                                            if (index === 0) {
                                                                const bgClass = BLOCK_TYPES.find(t => t.id === blockInfo.type)?.bgClass || 'bg-gray-300';
                                                                return (
                                                                    <td
                                                                        key={`${monthIdx}-${weekIdx}`}
                                                                        rowSpan={sortedEntries.length}
                                                                        colSpan={colSpan}
                                                                        className={`px-1 py-1 text-center border-b border-r border-slate-200 align-middle ${bgClass}`}
                                                                        title={blockInfo.label}
                                                                    >
                                                                        <div className="flex items-center justify-center h-full w-full max-h-[500px] overflow-hidden">
                                                                            <span className="text-xs font-bold text-white/90 [writing-mode:vertical-lr] rotate-180 tracking-wider whitespace-nowrap py-4">
                                                                                {blockInfo.label}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            } else {
                                                                return null;
                                                            }
                                                        }

                                                        // Check if entry is plotted for this week
                                                        const plotted = entry.plotWeeks?.find(
                                                            p => p.month === monthNum && p.week === week
                                                        );

                                                        return (
                                                            <td
                                                                key={`${monthIdx}-${weekIdx}`}
                                                                className="px-1 py-1 text-center border-b border-r border-slate-200 align-middle"
                                                            >
                                                                {plotted && (
                                                                    <span className="inline-flex items-center justify-center w-6 h-6 bg-indigo-600 text-white font-bold text-[10px] rounded shadow-sm">
                                                                        {plotted.jp || entry.duration}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        );
                                                    });
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Calendar Tab */}
                {activeTab === 'calendar' && (
                    <div className="p-6">
                        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
                            <Eye className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <p className="text-emerald-800 text-sm">
                                <strong>Kalender Visual:</strong> Lihat overview seluruh semester. Warna menunjukkan tipe minggu yang di-block.
                            </p>
                        </div>

                        {/* Calendar Grid */}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse min-w-[800px]">
                                <thead>
                                    <tr>
                                        <th className="p-2 text-left text-sm font-semibold text-slate-600 border-b border-slate-200">Bulan</th>
                                        {[1, 2, 3, 4, 5].map(week => (
                                            <th key={week} className="p-2 text-center text-sm font-semibold text-slate-600 border-b border-slate-200">
                                                M{week}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {months.map((month, monthIndex) => (
                                        <tr key={monthIndex}>
                                            <td className="p-2 font-medium text-slate-800 border-b border-slate-100">
                                                {month}
                                            </td>
                                            {[1, 2, 3, 4, 5].map(week => {
                                                const blockInfo = getBlockInfo(monthIndex, week);
                                                const entries = getEntriesForWeek(monthIndex, week);
                                                const totalJP = entries.reduce((sum, e) => sum + (e.duration || 0), 0);

                                                return (
                                                    <td key={week} className="p-1 border-b border-slate-100">
                                                        <div
                                                            className={`relative h-16 rounded-lg flex flex-col items-center justify-center text-xs transition-all ${blockInfo
                                                                ? `${BLOCK_TYPES.find(t => t.id === blockInfo.type)?.bgClass || 'bg-gray-400'} text-white`
                                                                : entries.length > 0
                                                                    ? 'bg-indigo-100 border-2 border-indigo-300'
                                                                    : 'bg-slate-50 border border-slate-200'
                                                                }`}
                                                            title={blockInfo?.label || entries.map(e => e.meetingNo).join(', ')}
                                                        >
                                                            {blockInfo ? (
                                                                <>
                                                                    <Lock className="h-4 w-4 mb-1" />
                                                                    <span className="text-[10px] text-center px-1 leading-tight">
                                                                        {blockInfo.label.length > 12
                                                                            ? blockInfo.label.slice(0, 12) + '...'
                                                                            : blockInfo.label}
                                                                    </span>
                                                                </>
                                                            ) : entries.length > 0 ? (
                                                                <>
                                                                    <span className="font-bold text-indigo-700 text-lg">{totalJP}</span>
                                                                    <span className="text-indigo-600">JP</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-slate-300">-</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Legend */}
                        <div className="mt-6 flex flex-wrap gap-4">
                            {BLOCK_TYPES.map(type => (
                                <div key={type.id} className="flex items-center gap-2 text-sm">
                                    <div className={`w-4 h-4 rounded ${type.bgClass}`}></div>
                                    <span className="text-slate-600">{type.label}</span>
                                </div>
                            ))}
                            <div className="flex items-center gap-2 text-sm">
                                <div className="w-4 h-4 rounded bg-indigo-100 border-2 border-indigo-300"></div>
                                <span className="text-slate-600">Ada Materi</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Entry Modal */}
            <AnimatePresence>
                {showEntryModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowEntryModal(false)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-slate-800">
                                    {editingEntryId ? 'Edit Pertemuan' : 'Tambah Pertemuan'}
                                </h2>
                                <button
                                    onClick={() => setShowEntryModal(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-all"
                                >
                                    <X className="h-5 w-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Meeting No</label>
                                        <select
                                            value={entryForm.meetingNo}
                                            onChange={(e) => setEntryForm({ ...entryForm, meetingNo: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {Array.from({ length: 25 }, (_, i) => i + 1).map(num => (
                                                <option key={num} value={`P${num}`}>P{num}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Durasi (JP)</label>
                                        <select
                                            value={entryForm.duration}
                                            onChange={(e) => setEntryForm({ ...entryForm, duration: parseInt(e.target.value) })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                                                <option key={num} value={num}>{num} JP</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="relative">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Chapter/Bab</label>
                                    <input
                                        type="text"
                                        placeholder="Mastery in Tables"
                                        value={entryForm.chapter}
                                        onChange={(e) => {
                                            setEntryForm({ ...entryForm, chapter: e.target.value });
                                            setShowChapterSuggestions(true);
                                        }}
                                        onFocus={() => setShowChapterSuggestions(true)}
                                        onClick={() => setShowChapterSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowChapterSuggestions(false), 200)} // Delayed close to allow click
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        autoComplete="off"
                                    />
                                    {showChapterSuggestions && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                            {(() => {
                                                const uniqueChapters = Array.from(new Set(curriculum.entries?.map(e => e.chapter) || [])).sort();

                                                // Filter logic:
                                                // 1. If input matches an option exactly, show ALL options (assume user might want to switch)
                                                // 2. Otherwise filter by search text
                                                let filtered = uniqueChapters.filter(c =>
                                                    c.toLowerCase().includes(entryForm.chapter.toLowerCase())
                                                );

                                                // If we have exactly one match and it's the current value, 
                                                // or if the input strictly matches one of the options, 
                                                // show all options to allow switching.
                                                const exactMatch = uniqueChapters.find(c => c === entryForm.chapter);
                                                if (exactMatch) {
                                                    filtered = uniqueChapters;
                                                }

                                                if (filtered.length === 0) return null;

                                                return filtered.map((chapter, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        className="w-full text-left px-4 py-2 text-base text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer transition-colors"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault(); // Prevent input blur
                                                        }}
                                                        onClick={() => {
                                                            setEntryForm({ ...entryForm, chapter });
                                                            setShowChapterSuggestions(false);
                                                        }}
                                                    >
                                                        {chapter}
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                                        <input
                                            type="date"
                                            value={entryForm.dateStart}
                                            onChange={(e) => setEntryForm({ ...entryForm, dateStart: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
                                        <input
                                            type="date"
                                            value={entryForm.dateEnd}
                                            onChange={(e) => setEntryForm({ ...entryForm, dateEnd: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Topic/Materi</label>
                                    <textarea
                                        placeholder="Deskripsi materi yang akan dipelajari..."
                                        value={entryForm.topic}
                                        onChange={(e) => setEntryForm({ ...entryForm, topic: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Week Plotter */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Plot ke Minggu</label>
                                    <div className="grid grid-cols-6 gap-2 p-4 bg-slate-50 rounded-xl">
                                        <div></div>
                                        {[1, 2, 3, 4, 5].map(week => (
                                            <div key={week} className="text-center text-xs font-medium text-slate-500">M{week}</div>
                                        ))}
                                        {months.map((month, monthIndex) => (
                                            <>
                                                <div key={`month-${monthIndex}`} className="text-xs font-medium text-slate-700 flex items-center">
                                                    {month.slice(0, 3)}
                                                </div>
                                                {[1, 2, 3, 4, 5].map(week => {
                                                    // Determine block count for this month
                                                    const currentMonthName = months[monthIndex];
                                                    const weekCount = (currentMonthName === 'April' || currentMonthName === 'Oktober' || currentMonthName === 'Juli') ? 5 : 4;

                                                    if (week > weekCount) {
                                                        return <div key={`${monthIndex}-${week}`} className="h-8"></div>;
                                                    }

                                                    const blocked = isWeekBlocked(monthIndex, week);

                                                    // Check if this week is occupied by ANOTHER entry
                                                    const isOccupied = curriculum.entries.some(e =>
                                                        e.id !== editingEntryId && // Ignore current entry being edited
                                                        e.plotWeeks?.some(p => p.month === monthIndex + 1 && p.week === week)
                                                    );

                                                    const selected = entryForm.plotWeeks.some(
                                                        p => p.month === monthIndex + 1 && p.week === week
                                                    );

                                                    const isDisabled = blocked || isOccupied;

                                                    return (
                                                        <button
                                                            key={`${monthIndex}-${week}`}
                                                            onClick={() => !isDisabled && togglePlotWeek(monthIndex, week)}
                                                            disabled={isDisabled}
                                                            title={isOccupied ? 'Sudah diisi pertemuan lain' : blocked ? 'Minggu Libur/Exam' : ''}
                                                            className={`h-8 rounded transition-all ${blocked
                                                                ? 'bg-slate-200 cursor-not-allowed'
                                                                : isOccupied
                                                                    ? 'bg-red-50 border border-red-100 cursor-not-allowed opacity-60'
                                                                    : selected
                                                                        ? 'bg-indigo-600 text-white'
                                                                        : 'bg-white border border-slate-200 hover:border-indigo-300'
                                                                }`}
                                                        >
                                                            {selected && <Check className="h-4 w-4 mx-auto" />}
                                                            {blocked && <Lock className="h-3 w-3 mx-auto text-slate-400" />}
                                                            {isOccupied && !blocked && !selected && <span className="text-[10px] text-red-300 block text-center">x</span>}
                                                        </button>
                                                    );
                                                })}
                                            </>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                                <div>
                                    {editingEntryId && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Yakin ingin menghapus pertemuan ini?')) {
                                                    handleDeleteEntry(editingEntryId);
                                                    setShowEntryModal(false);
                                                }
                                            }}
                                            className="px-4 py-2.5 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-xl transition-all font-bold flex items-center gap-2 text-sm"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Hapus
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowEntryModal(false)}
                                        className="px-5 py-2.5 bg-white border-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-bold"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={handleSaveEntry}
                                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                                    >
                                        <Save className="h-4 w-4" />
                                        Simpan
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
