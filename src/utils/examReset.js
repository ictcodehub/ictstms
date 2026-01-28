import { db } from '../lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

/**
 * Helper to remove guest attempts and release the lock
 */
const removeGuestAttempts = async (examId, resultData) => {
    if (!resultData.guestName) return;

    try {
        const constraints = [
            where('examId', '==', examId),
            where('name', '==', resultData.guestName.toLowerCase()),
            where('className', '==', (resultData.guestClass || '').toLowerCase())
        ];

        if (resultData.guestAbsen) {
            constraints.push(where('absen', '==', parseInt(resultData.guestAbsen)));
        }

        const q = query(collection(db, 'guest_attempts'), ...constraints);
        const snapshot = await getDocs(q);

        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        if (snapshot.size > 0) {

        }
    } catch (err) {
        console.error("Error removing guest attempts:", err);
    }
};

/**
 * Reset exam for all assigned classes
 * Deletes all exam_results and exam_sessions for the exam
 */
export const resetExamForAllClasses = async (examId) => {
    const deletedCount = { results: 0, sessions: 0 };

    try {
        // Delete all exam_results
        const resultsQuery = query(
            collection(db, 'exam_results'),
            where('examId', '==', examId)
        );
        const resultsSnapshot = await getDocs(resultsQuery);

        for (const docSnap of resultsSnapshot.docs) {
            await removeGuestAttempts(examId, docSnap.data()); // Release lock
            await deleteDoc(doc(db, 'exam_results', docSnap.id));
            deletedCount.results++;
        }

        // Delete all exam_sessions
        const sessionsQuery = query(
            collection(db, 'exam_sessions'),
            where('examId', '==', examId)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);

        for (const docSnap of sessionsSnapshot.docs) {
            await deleteDoc(doc(db, 'exam_sessions', docSnap.id));
            deletedCount.sessions++;
        }

        return deletedCount;
    } catch (error) {
        console.error('Error resetting exam for all classes:', error);
        throw error;
    }
};

/**
 * Reset exam for specific class
 * Deletes exam_results and exam_sessions for students in the class
 */
export const resetExamForClass = async (examId, classId, studentIds) => {
    const deletedCount = { results: 0, sessions: 0 };

    try {
        // Delete exam_results for students in this class
        for (const studentId of studentIds) {
            const resultsQuery = query(
                collection(db, 'exam_results'),
                where('examId', '==', examId),
                where('studentId', '==', studentId)
            );
            const resultsSnapshot = await getDocs(resultsQuery);

            for (const docSnap of resultsSnapshot.docs) {
                await removeGuestAttempts(examId, docSnap.data()); // Release lock
                await deleteDoc(doc(db, 'exam_results', docSnap.id));
                deletedCount.results++;
            }

            // Delete exam_sessions
            const sessionsQuery = query(
                collection(db, 'exam_sessions'),
                where('examId', '==', examId),
                where('studentId', '==', studentId)
            );
            const sessionsSnapshot = await getDocs(sessionsQuery);

            for (const docSnap of sessionsSnapshot.docs) {
                await deleteDoc(doc(db, 'exam_sessions', docSnap.id));
                deletedCount.sessions++;
            }
        }

        return deletedCount;
    } catch (error) {
        console.error('Error resetting exam for class:', error);
        throw error;
    }
};

/**
 * Reset exam for specific student
 * Deletes all exam_results and exam_sessions for the student
 */
export const resetExamForStudent = async (examId, studentId) => {
    const deletedCount = { results: 0, sessions: 0 };

    try {
        // Delete exam_results
        const resultsQuery = query(
            collection(db, 'exam_results'),
            where('examId', '==', examId),
            where('studentId', '==', studentId)
        );
        const resultsSnapshot = await getDocs(resultsQuery);

        for (const docSnap of resultsSnapshot.docs) {
            await removeGuestAttempts(examId, docSnap.data()); // Release lock
            await deleteDoc(doc(db, 'exam_results', docSnap.id));
            deletedCount.results++;
        }

        // Delete exam_sessions
        const sessionsQuery = query(
            collection(db, 'exam_sessions'),
            where('examId', '==', examId),
            where('studentId', '==', studentId)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);

        for (const docSnap of sessionsSnapshot.docs) {
            await deleteDoc(doc(db, 'exam_sessions', docSnap.id));
            deletedCount.sessions++;
        }

        return deletedCount;
    } catch (error) {
        console.error('Error resetting exam for student:', error);
        throw error;
    }
};
