// Excel Export Helper with Full Spreadsheet View
import * as XLSX from 'xlsx';

export const exportCurriculumToExcel = async (fullData) => {
    // Determine months based on semester
    const SEMESTER_1_MONTHS = ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const SEMESTER_2_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];
    const months = fullData.semester === 1 ? SEMESTER_1_MONTHS : SEMESTER_2_MONTHS;

    // Sort entries
    const sortedEntries = (fullData.entries || []).sort((a, b) => {
        return (a.meetingNo || '').localeCompare(b.meetingNo || '', undefined, { numeric: true, sensitivity: 'base' });
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Build spreadsheet data array
    const data = [];

    // Row 1: Month headers
    const monthRow = ['No', 'Chapter/Bab', 'Date', 'TOPIC', 'TIME'];
    months.forEach(month => {
        const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
        monthRow.push(month);
        for (let i = 1; i < weekCount; i++) {
            monthRow.push(''); // Will be merged
        }
    });
    data.push(monthRow);

    // Row 2: Week numbers
    const weekRow = ['', '', '', '', ''];
    months.forEach(month => {
        const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
        for (let w = 1; w <= weekCount; w++) {
            weekRow.push(w.toString());
        }
    });
    data.push(weekRow);

    // Data rows - one per entry
    sortedEntries.forEach(entry => {
        const row = [
            entry.meetingNo || '',
            entry.chapter || '',
            '',  // Date will be formatted below
            entry.topic || '',
            entry.duration ? `${entry.duration}JP` : ''
        ];

        // Format date
        if (entry.dateRange) {
            const parts = entry.dateRange.split('~');
            if (parts.length >= 2) {
                const formatDate = (dateStr) => {
                    if (!dateStr || dateStr.length < 10) return '';
                    const [y, m, d] = dateStr.split('-');
                    return `${d}.${m}.${y.slice(2)}`;
                };
                row[2] = `${formatDate(parts[0])} - ${formatDate(parts[1])}`;
            }
        }

        // Add weekly cells
        months.forEach((month, mIdx) => {
            const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
            for (let w = 1; w <= weekCount; w++) {
                // Check if this week is blocked
                const blockInfo = fullData.blockedWeeks?.find(b => b.month === mIdx + 1 && b.week === w);

                if (blockInfo) {
                    // For blocked weeks, use first letter of block type
                    const blockChar = blockInfo.label.substring(0, 3).toUpperCase();
                    row.push(blockChar);
                } else {
                    // For normal weeks, show JP if plotted
                    const plotted = entry.plotWeeks?.find(p => p.month === mIdx + 1 && p.week === w);
                    row.push(plotted ? (plotted.jp || entry.duration).toString() : '');
                }
            }
        });

        data.push(row);
    });

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Calculate column positions and create merges
    let colIdx = 5; // Start after TIME column
    const monthMerges = [];
    months.forEach((month, mIdx) => {
        const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;
        const startCol = colIdx;
        const endCol = colIdx + weekCount - 1;

        // Merge month header
        monthMerges.push({
            s: { r: 0, c: startCol },
            e: { r: 0, c: endCol }
        });

        colIdx += weekCount;
    });

    ws['!merges'] = monthMerges;

    // Apply cell styling for blocked weeks and JP cells
    const BLOCK_COLORS = {
        'holiday': 'FFA500',
        'religious': 'FFD700',
        'exam': '22C55E',
        'activity': '3B82F6',
        'preparation': '8B5CF6'
    };

    // Style cells
    sortedEntries.forEach((entry, rowIdx) => {
        const dataRowIdx = rowIdx + 2; // +2 because of header rows

        let colIdx = 5; // Start after TIME column
        months.forEach((month, mIdx) => {
            const weekCount = (month === 'April' || month === 'Oktober' || month === 'Juli') ? 5 : 4;

            for (let w = 1; w <= weekCount; w++) {
                const cellAddr = XLSX.utils.encode_cell({ r: dataRowIdx, c: colIdx });
                const cell = ws[cellAddr];

                if (cell) {
                    const blockInfo = fullData.blockedWeeks?.find(b => b.month === mIdx + 1 && b.week === w);

                    if (blockInfo) {
                        // Apply block color
                        const bgColor = BLOCK_COLORS[blockInfo.type] || '888888';
                        cell.s = {
                            fill: { fgColor: { rgb: bgColor } },
                            font: { color: { rgb: 'FFFFFF' }, bold: true },
                            alignment: { horizontal: 'center', vertical: 'center' }
                        };
                    } else if (cell.v) {
                        // Style JP cells
                        cell.s = {
                            fill: { fgColor: { rgb: '4F46E5' } }, // indigo-600
                            font: { color: { rgb: 'FFFFFF' }, bold: true },
                            alignment: { horizontal: 'center', vertical: 'center' }
                        };
                    }
                }

                colIdx++;
            }
        });
    });

    // Set column widths
    const cols = [
        { wch: 6 },   // No
        { wch: 20 },  // Chapter
        { wch: 18 },  // Date
        { wch: 50 },  // Topic
        { wch: 8 }    // Time
    ];
    // Add columns for weeks
    const totalWeeks = months.reduce((sum, m) => {
        return sum + ((m === 'April' || m === 'Oktober' || m === 'Juli') ? 5 : 4);
    }, 0);
    for (let i = 0; i < totalWeeks; i++) {
        cols.push({ wch: 5 });
    }
    ws['!cols'] = cols;

    // Add worksheet
    XLSX.utils.book_append_sheet(wb, ws, "CO");

    // Generate filename
    const filename = `CO_${fullData.className.replace(/\s+/g, '_')}_${fullData.semester === 1 ? 'Ganjil' : 'Genap'}_${fullData.year}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);

    return filename;
};
