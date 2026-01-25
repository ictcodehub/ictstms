import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Printer } from 'lucide-react';
import { generateCurriculumPrintHTML } from '../../utils/printHelper';

export default function CurriculumPrint() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [curriculum, setCurriculum] = useState(null);
    const [loading, setLoading] = useState(true);
    const [printData, setPrintData] = useState(null);

    useEffect(() => {
        loadCurriculum();
    }, [id]);

    const loadCurriculum = async () => {
        try {
            const docRef = doc(db, 'curriculumOverviews', id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() };
                setCurriculum(data);
                setPrintData(generateCurriculumPrintHTML(data));
            } else {
                console.error('Curriculum not found');
            }
        } catch (error) {
            console.error('Error loading curriculum:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!curriculum || !printData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-slate-600">Curriculum tidak ditemukan</p>
                <button
                    onClick={() => navigate('/teacher/curriculum')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    Kembali
                </button>
            </div>
        );
    }

    const { months, sortedEntries, formatDateRange, getSemesterLabel } = printData;

    return (
        <>
            {/* Print Button - Hidden when printing */}
            <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
                <button
                    onClick={() => navigate('/teacher/curriculum')}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali
                </button>
                <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                    <Printer className="h-4 w-4" />
                    Print PDF
                </button>
            </div>

            {/* Print Content */}
            <div id="print-content" className="max-w-full mx-auto p-8 bg-white overflow-x-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 mb-3 text-center">CURRICULUM OVERVIEW</h1>
                    <div className="flex justify-between items-center text-xs">
                        <div className="text-slate-700">
                            <span><strong>Kelas:</strong> {curriculum.className} | <strong>Semester:</strong> {getSemesterLabel(curriculum.semester)} | <strong>Tahun:</strong> {curriculum.year}</span>
                        </div>
                        <div className="text-slate-500">
                            <span>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                    </div>
                </div>

                {/* Spreadsheet Table */}
                <table className="w-full border-collapse border-2 border-slate-900 text-xs">
                    <thead>
                        {/* Month Headers Row */}
                        <tr className="bg-slate-100">
                            <th rowSpan={2} className="border-2 border-slate-900 px-2 py-2 font-bold text-xs">No</th>
                            <th rowSpan={2} className="border-2 border-slate-900 px-2 py-2 font-bold text-xs">TOPIC</th>
                            <th rowSpan={2} className="border-2 border-slate-900 px-1 py-1 font-bold text-center text-xs" style={{ width: '40px' }}>TIME</th>
                            {months.map((month, idx) => {
                                const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
                                return (
                                    <th
                                        key={idx}
                                        colSpan={weekCount}
                                        className="border-2 border-slate-900 px-1 py-2 font-bold text-center bg-slate-50 text-xs"
                                    >
                                        {month}
                                    </th>
                                );
                            })}
                        </tr>
                        {/* Week Numbers Row */}
                        <tr className="bg-slate-50">
                            {months.map((month, monthIdx) => {
                                const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
                                return Array.from({ length: weekCount }, (_, weekIdx) => (
                                    <th
                                        key={`${monthIdx}-${weekIdx}`}
                                        className="border-2 border-slate-900 px-1 py-1 text-[9px] font-semibold text-center"
                                        style={{ width: '25px', maxWidth: '25px' }}
                                    >
                                        {weekIdx + 1}
                                    </th>
                                ));
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEntries.map((entry, index) => (
                            <tr key={index}>
                                <td className="border-2 border-slate-900 px-2 py-2 text-center font-semibold text-xs">{entry.meetingNo || '-'}</td>
                                <td className="border-2 border-slate-900 px-2 py-2 text-xs leading-tight">
                                    <div className="line-clamp-2">{entry.topic || '-'}</div>
                                </td>
                                <td className="border-2 border-slate-900 px-1 py-2 text-center font-semibold text-indigo-700 text-[10px]">{entry.duration ? `${entry.duration}JP` : '-'}</td>
                                {months.map((month, monthIdx) => {
                                    const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
                                    return Array.from({ length: weekCount }, (_, weekIdx) => {
                                        const week = weekIdx + 1;
                                        const monthNum = monthIdx + 1;

                                        // Check if this week is blocked
                                        const blockInfo = curriculum.blockedWeeks?.find(
                                            b => b.month === monthNum && b.week === week
                                        );

                                        // Check if previous week in same month has same block (for merging)
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

                                        // Calculate rowSpan for merged blocks
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

                                        // Render blocked cell on first row only
                                        if (blockInfo) {
                                            if (index === 0) {
                                                const bgColor = printData.BLOCK_TYPES[blockInfo.type]?.color || '#888';
                                                const cellWidth = colSpan * 25; // 25px per week
                                                return (
                                                    <td
                                                        key={`${monthIdx}-${weekIdx}`}
                                                        rowSpan={sortedEntries.length}
                                                        colSpan={colSpan}
                                                        className="border-2 border-slate-900 px-1 py-1 text-center align-middle"
                                                        style={{ backgroundColor: bgColor, width: `${cellWidth}px`, maxWidth: `${cellWidth}px` }}
                                                    >
                                                        <div className="flex items-center justify-center h-full">
                                                            <span className="text-[10px] font-bold text-white transform -rotate-90 whitespace-nowrap tracking-wide">
                                                                {blockInfo.label}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            } else {
                                                return null;
                                            }
                                        }

                                        // Check if this entry is plotted for this week
                                        const plotted = entry.plotWeeks?.find(p => p.month === monthNum && p.week === week);

                                        return (
                                            <td
                                                key={`${monthIdx}-${weekIdx}`}
                                                className="border-2 border-slate-900 p-0 text-center align-middle"
                                                style={{ width: '25px', maxWidth: '25px', height: '100%' }}
                                            >
                                                {plotted && (
                                                    <div className="flex items-center justify-center w-full h-full">
                                                        <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-100 text-indigo-700 text-[9px] rounded-sm">
                                                            {plotted.jp || entry.duration}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    });
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer with Signature Area */}
                <div className="mt-4">
                    <div className="flex justify-between items-start">
                        {/* Left: Total Pertemuan */}
                        <div className="text-xs text-slate-600">
                            <p>Total Pertemuan: <strong>{curriculum.entries?.length || 0}</strong></p>
                        </div>

                        {/* Right: Signature Area */}
                        <div className="text-center text-xs">
                            <p className="mb-6">Tangerang, {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
                            <p className="font-semibold">Subject Teacher,</p>
                            <div className="mt-10 border-t border-slate-400 pt-1" style={{ width: '200px' }}>
                                <p className="text-slate-600">Nama & Tanda Tangan</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    /* Hide everything by default */
                    body * {
                        visibility: hidden;
                    }
                    
                    /* Show only print content */
                    #print-content, #print-content * {
                        visibility: visible;
                    }
                    
                    /* Position print content at top left */
                    @page {
                        size: landscape;
                        margin: 5mm; 
                    }
                    
                    /* Reset container styles for print */
                    #print-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        max-width: none !important;
                        min-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        background: white;
                    }

                    /* Ensure background colors print */
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    
                    /* Ensure table fills width */
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 12px; /* Slightly larger base font */
                        background: white;
                    }
                    
                    th, td {
                        border: 1px solid #000 !important;
                    }

                    /* Adjust header text size for print */
                    h1 {
                        font-size: 18pt !important;
                        margin-bottom: 10px !important;
                    }

                    .text-xs {
                        font-size: 10px !important; /* Keep utility classes consistent */
                    }
                    
                    .text-[10px] {
                        font-size: 9px !important;
                    }
                    
                    .text-[9px] {
                        font-size: 8px !important;
                    }

                    .no-print {
                        display: none !important;
                    }
                    
                    thead {
                        display: table-header-group;
                    }
                    
                    tr {
                        break-inside: avoid;
                    }
                }
            `}</style>
        </>
    );
}
