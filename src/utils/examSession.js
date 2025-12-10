import { db } from '../lib/firebase';
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';

/**
 * Create a new exam session when student starts an exam
 */
export const createExamSession = async (examId, studentId, duration, questionOrder = null, answerOrders = {}) => {
    try {
        const sessionRef = doc(collection(db, 'exam_sessions'));
        const now = new Date();
        const expiresAt = new Date(now.getTime() + duration * 60 * 1000);

        const sessionData = {
            examId,
            studentId,
            startedAt: serverTimestamp(),
            expiresAt: Timestamp.fromDate(expiresAt),
            answers: {},
            questionOrder: questionOrder || null, // Store shuffled question order
            answerOrders: answerOrders || {}, // Store shuffled answer orders per question
            status: 'in_progress',
            submittedAt: null,
            lastActivityAt: serverTimestamp()
        };

        await setDoc(sessionRef, sessionData);
        return sessionRef.id;
    } catch (error) {
        console.error('Error creating exam session:', error);
        throw error;
    }
};

/**
 * Get existing exam session for a student
 */
export const getExamSession = async (examId, studentId) => {
    try {
        const q = query(
            collection(db, 'exam_sessions'),
            where('examId', '==', examId),
            where('studentId', '==', studentId),
            where('status', '==', 'in_progress')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        const sessionDoc = snapshot.docs[0];
        return {
            id: sessionDoc.id,
            ...sessionDoc.data()
        };
    } catch (error) {
        console.error('Error getting exam session:', error);
        throw error;
    }
};

/**
 * Update session answers (auto-save)
 */
export const updateSessionAnswers = async (sessionId, answers) => {
    try {
        const sessionRef = doc(db, 'exam_sessions', sessionId);
        await updateDoc(sessionRef, {
            answers,
            lastActivityAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating session answers:', error);
        throw error;
    }
};

/**
 * Complete exam session and move to results
 */
export const completeExamSession = async (sessionId, finalAnswers, score) => {
    try {
        const sessionRef = doc(db, 'exam_sessions', sessionId);
        await updateDoc(sessionRef, {
            answers: finalAnswers,
            status: 'completed',
            submittedAt: serverTimestamp(),
            finalScore: score
        });
    } catch (error) {
        console.error('Error completing exam session:', error);
        throw error;
    }
};

/**
 * Calculate remaining time in seconds
 */
export const calculateRemainingTime = (expiresAt) => {
    if (!expiresAt) return 0;

    const now = new Date();
    const expiry = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
    const remaining = Math.floor((expiry - now) / 1000);

    return Math.max(0, remaining);
};

/**
 * Check if session has expired
 */
export const isSessionExpired = (expiresAt) => {
    return calculateRemainingTime(expiresAt) === 0;
};
