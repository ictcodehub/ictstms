import { db } from '../lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

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
