import { db } from '../lib/firebase';
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';

/**
 * Generate unique 6-character pause code
 */
export const generatePauseCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0,O,1,I)
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

/**
 * Create a new exam session when student starts an exam
 */
export const createExamSession = async (examId, studentId, studentName, duration, questionOrder = null, answerOrders = {}) => {
    try {
        const sessionRef = doc(collection(db, 'exam_sessions'));
        const now = new Date();
        const expiresAt = new Date(now.getTime() + duration * 60 * 1000);

        const sessionData = {
            examId,
            studentId,
            studentName, // NEW: For teacher monitoring
            startedAt: serverTimestamp(),
            expiresAt: Timestamp.fromDate(expiresAt),
            answers: {},
            questionOrder: questionOrder || null, // Store shuffled question order
            answerOrders: answerOrders || {}, // Store shuffled answer orders per question
            status: 'in_progress', // 'in_progress' | 'paused' | 'completed'
            submittedAt: null,
            lastActivityAt: serverTimestamp(),
            // NEW: Pause code system
            pauseCode: generatePauseCode(),
            pauseCodeUsed: false,
            pauseCount: 0,
            pauseHistory: [],
            timeRemaining: duration * 60 // Store in seconds
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
            where('status', 'in', ['in_progress', 'paused']) // Include paused sessions
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
        // NEW: Delete the session instead of keeping it 'completed'. 
        // Logic: Results are already saved in 'exam_results'. Keeping 'exam_sessions' is redundant and causes "Running" ghosts.
        const sessionRef = doc(db, 'exam_sessions', sessionId);
        await deleteDoc(sessionRef); // CLEANUP

        // await updateDoc(sessionRef, {
        //     answers: finalAnswers,
        //     status: 'completed',
        //     submittedAt: serverTimestamp(),
        //     finalScore: score
        // });
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
