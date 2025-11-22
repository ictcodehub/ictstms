/**
 * Sort classes by grade level (number) then by section (letter)
 * Example: 6A, 7A, 7B, 7C, 9A, 9B, 10A, 10B, 10C, 10D, 10E, 11A, 11B, 12A, 12B, 12C, 12D, 12E, 12F
 */
export function sortClasses(classes) {
    return [...classes].sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';

        // Extract grade number and section letter
        const matchA = nameA.match(/^(\d+)([A-Z]*)$/i);
        const matchB = nameB.match(/^(\d+)([A-Z]*)$/i);

        // If pattern doesn't match, fallback to string comparison
        if (!matchA || !matchB) {
            return nameA.localeCompare(nameB);
        }

        const gradeA = parseInt(matchA[1]);
        const gradeB = parseInt(matchB[1]);
        const sectionA = matchA[2] || '';
        const sectionB = matchB[2] || '';

        // First compare by grade number
        if (gradeA !== gradeB) {
            return gradeA - gradeB;
        }

        // Then compare by section letter
        return sectionA.localeCompare(sectionB);
    });
}
