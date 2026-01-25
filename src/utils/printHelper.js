// Print Helper - Generate full spreadsheet HTML for printing
export const generateCurriculumPrintHTML = (fullData) => {
    // Determine months based on semester
    const SEMESTER_1_MONTHS = ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const SEMESTER_2_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];
    const months = fullData.semester === 1 ? SEMESTER_1_MONTHS : SEMESTER_2_MONTHS;

    // Block types with colors
    const BLOCK_TYPES = {
        'holiday': { color: '#FFA500', label: 'Libur Nasional' },
        'religious': { color: '#FFD700', label: 'Hari Raya' },
        'exam': { color: '#22C55E', label: 'Ujian/Test' },
        'activity': { color: '#3B82F6', label: 'Kegiatan Sekolah' },
        'preparation': { color: '#8B5CF6', label: 'Persiapan/Review' }
    };

    // Sort entries
    const sortedEntries = (fullData.entries || []).sort((a, b) => {
        return (a.meetingNo || '').localeCompare(b.meetingNo || '', undefined, { numeric: true, sensitivity: 'base' });
    });

    // Format date range
    const formatDateRange = (dateRange) => {
        if (!dateRange) return '-';
        const parts = dateRange.split('~');
        if (parts.length >= 2) {
            const formatDate = (dateStr) => {
                if (!dateStr || dateStr.length < 10) return '';
                const [y, m, d] = dateStr.split('-');
                return `${d}.${m}.${y.slice(2)}`;
            };
            return `${formatDate(parts[0])} - ${formatDate(parts[1])}`;
        }
        return '-';
    };

    return {
        months,
        sortedEntries,
        formatDateRange,
        BLOCK_TYPES,
        getSemesterLabel: (semester) => semester === 1 ? 'Semester 1 (Ganjil)' : 'Semester 2 (Genap)'
    };
};
