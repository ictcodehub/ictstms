import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
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

    // Auto-trigger print when data is ready
    useEffect(() => {
        if (!loading && curriculum && printData) {
            document.title = `Curriculum_${curriculum.className}_S${curriculum.semester}_${curriculum.year}`;

            const handleAfterPrint = () => {
                // Automatically go back after print dialog closes (Cancel or Print)
                navigate('/teacher/curriculum');
            };

            window.addEventListener('afterprint', handleAfterPrint);

            // Short delay to ensure rendering is complete (including styles/fonts)
            const timer = setTimeout(() => {
                window.print();
            }, 800);

            return () => {
                clearTimeout(timer);
                window.removeEventListener('afterprint', handleAfterPrint);
            };
        }
    }, [loading, curriculum, printData]);

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

    const { months, sortedEntries, getSemesterLabel } = printData;

    return (
        <div id="print-wrapper" className="fixed inset-0 z-[100] bg-white overflow-auto block">
            {/* Dynamic style for print */}
            <style>{`
                @page {
                    size: landscape;
                    margin: 0;
                }
                @media print {
                    #print-wrapper {
                        position: static !important;
                        overflow: visible !important;
                        height: auto !important;
                        background-color: white !important;
                        display: block !important;
                    }
                    body {
                        visibility: hidden;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    /* Hide everything by default */
                    body * {
                        visibility: hidden;
                    }
                    /* Show only the print content */
                    #print-content, #print-content * {
                        visibility: visible;
                    }
                    
                    #print-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 10px 10px !important;
                        box-sizing: border-box !important;
                        box-shadow: none !important;
                        border: none !important;
                        background-color: white !important;
                        /* Scale down slightly to ensure it fits Letter/A4 margins */
                        transform: scale(0.99);
                        transform-origin: top center;
                    }
                    
                    .no-print {
                        display: none !important;
                    }

                    /* Table Styling for Print */
                    table {
                        width: 100%;
                        border-collapse: collapse !important;
                        font-size: 9px;
                    }
                    th, td {
                        border: 1px solid #1e293b !important; /* slate-900 */
                    }
                    
                    /* Force Headers to repeat on new page */
                    thead {
                        display: table-header-group;
                    }
                    tr {
                        page-break-inside: avoid;
                    }
                    
                    /* Hide scrollbars */
                    ::-webkit-scrollbar {
                        display: none;
                    }
                }
            `}</style>

            {/* Loading Overlay - Visible on Screen, Hidden on Print */}
            <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center no-print">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                <h2 className="text-xl font-semibold text-slate-800">Menyiapkan Dokumen...</h2>
                <p className="text-slate-500 mt-2">Dialog print akan muncul otomatis.</p>
                <div className="text-xs text-slate-400 mt-8">
                    Menunggu dialog print...
                </div>
            </div>

            {/* Hidden Visual Preview (Only for Print Rendering) */}
            {/* We position it absolutely behind the white overlay */}
            <div className="absolute top-0 left-0 w-full p-8 z-0">
                <div
                    className="bg-white shadow-none mx-auto relative"
                    style={{
                        width: '100%',
                        minHeight: '100vh',
                        padding: '15mm',
                        // Note: padding here affects screen preview only (which is hidden). 
                        // Print padding is controlled by CSS above.
                        boxSizing: 'border-box'
                    }}
                >
                    {/* We render the content here for PREVIEW. */}
                    <div id="print-content" className="w-full h-full">
                        {/* Header */}
                        <div className="mb-2">
                            <h1 className="text-xl font-bold text-slate-900 mb-1 text-left uppercase tracking-wide">Curriculum Overview</h1>
                            <div className="flex justify-between items-center text-[9px] text-slate-600 pb-2 mb-2">
                                <div>
                                    <span className="mr-4"><strong>Kelas:</strong> {curriculum.className}</span>
                                    <span className="mr-4"><strong>Semester:</strong> {getSemesterLabel(curriculum.semester)}</span>
                                    <span><strong>Tahun:</strong> {curriculum.year}</span>
                                </div>
                                <div>
                                    <span>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Content Table */}
                        <table className="w-full border-collapse border border-slate-900 text-[10px]" style={{ lineHeight: '1.2' }}>
                            <thead>
                                <tr className="bg-slate-100">
                                    <th rowSpan={2} className="border border-slate-900 px-1 py-1 font-bold w-8 text-center bg-slate-200">No</th>
                                    <th rowSpan={2} className="border border-slate-900 px-2 py-1 font-bold text-left bg-slate-200 uppercase">TOPIC</th>
                                    <th rowSpan={2} className="border border-slate-900 px-1 py-1 font-bold w-8 text-center bg-slate-200">JP</th>
                                    {months.map((month, idx) => (
                                        <th
                                            key={idx}
                                            colSpan={month === 'April' || month === 'Oktober' || month === 'Juli' ? 5 : 4}
                                            className="border border-slate-900 px-1 py-1 font-bold text-center bg-slate-100 uppercase"
                                        >
                                            {month}
                                        </th>
                                    ))}
                                </tr>
                                <tr className="bg-slate-50">
                                    {months.map((month, monthIdx) => {
                                        const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
                                        return Array.from({ length: weekCount }, (_, weekIdx) => (
                                            <th
                                                key={`${monthIdx}-${weekIdx}`}
                                                className="border border-slate-900 px-1 py-1 text-[9px] font-semibold text-center w-6"
                                            >
                                                {weekIdx + 1}
                                            </th>
                                        ));
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedEntries.map((entry, index) => (
                                    <tr key={entry.id}>
                                        <td className="border border-slate-900 px-1 py-1 text-center">
                                            <div className="inline-block bg-indigo-100 text-indigo-800 px-1 rounded text-[9px] font-bold min-w-[20px]">
                                                {entry.meetingNo || '-'}
                                            </div>
                                        </td>
                                        <td className="border border-slate-900 px-2 py-2 align-middle">
                                            <div className="text-[10px]">{entry.topic || '-'}</div>
                                        </td>
                                        <td className="border border-slate-900 text-center font-semibold text-indigo-700">{entry.duration ? entry.duration : '-'}</td>

                                        {months.map((month, monthIdx) => {
                                            const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
                                            return Array.from({ length: weekCount }, (_, weekIdx) => {
                                                const week = weekIdx + 1;
                                                const monthNum = monthIdx + 1;

                                                // Check Blocked
                                                const blockInfo = curriculum.blockedWeeks?.find(b => b.month === monthNum && b.week === week);

                                                // Merging logic (Horizontal)
                                                let isMergedWithPrev = false;
                                                if (weekIdx > 0) {
                                                    const prevBlock = curriculum.blockedWeeks?.find(b => b.month === monthNum && b.week === week - 1);
                                                    if (blockInfo && prevBlock && blockInfo.label === prevBlock.label && blockInfo.type === prevBlock.type) {
                                                        isMergedWithPrev = true;
                                                    }
                                                }

                                                if (isMergedWithPrev) return null;

                                                let colSpan = 1;
                                                if (blockInfo) {
                                                    for (let i = weekIdx + 1; i < weekCount; i++) {
                                                        const nextBlock = curriculum.blockedWeeks?.find(b => b.month === monthNum && b.week === i + 1);
                                                        if (nextBlock && nextBlock.label === blockInfo.label && nextBlock.type === blockInfo.type) {
                                                            colSpan++;
                                                        } else {
                                                            break;
                                                        }
                                                    }
                                                }

                                                if (blockInfo) {
                                                    if (index === 0) {
                                                        const bgColor = printData.BLOCK_TYPES[blockInfo.type]?.color || '#888';
                                                        return (
                                                            <td
                                                                key={`${monthIdx}-${weekIdx}`}
                                                                rowSpan={sortedEntries.length}
                                                                colSpan={colSpan}
                                                                className="border border-slate-900 text-center p-0 align-middle relative overflow-hidden group"
                                                                style={{ backgroundColor: bgColor }}
                                                            >
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <span className="text-[10px] font-bold text-white transform -rotate-90 whitespace-nowrap drop-shadow-md tracking-wider">
                                                                        {blockInfo.label}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    } else {
                                                        return null;
                                                    }
                                                }

                                                const plotted = entry.plotWeeks?.find(p => p.month === monthNum && p.week === week);
                                                const bgColor = plotted ? '#e0e7ff' : 'transparent';
                                                const textColor = plotted ? '#4338ca' : 'inherit';

                                                return (
                                                    <td
                                                        key={`${monthIdx}-${weekIdx}`}
                                                        className="border border-slate-900 text-center p-0"
                                                        style={{ backgroundColor: bgColor, color: textColor }}
                                                    >
                                                        {plotted && <span className="font-bold text-[9px]">{plotted.jp || entry.duration}</span>}
                                                    </td>
                                                );
                                            });
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div
                            className="mt-8 flex justify-end"
                            style={{
                                pageBreakInside: 'avoid',
                                breakInside: 'avoid' // ensure signature doesn't split
                            }}
                        >
                            <div className="text-center">
                                <p className="text-[10px] mb-12">Tangerang, {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
                                <p className="text-[10px] font-bold border-t border-slate-400 px-4 pt-1 inline-block mt-4">Subject Teacher</p>
                                <p className="text-[9px] text-slate-500">( Nama & Tanda Tangan )</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
