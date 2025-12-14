import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Custom hook to track new exams for students
 * Uses localStorage to track last seen timestamp
 */
export const useNewExams = (userRole, classId) => {
    const [newExamsCount, setNewExamsCount] = useState(0);
    const [newExams, setNewExams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userRole !== 'student' || !classId) {
            setLoading(false);
            return;
        }

        // Get last seen timestamp from localStorage
        const lastSeenKey = `exams-last-seen-${classId}`;
        const lastSeen = localStorage.getItem(lastSeenKey);
        const lastSeenDate = lastSeen ? new Date(parseInt(lastSeen)) : new Date(0);

        // Setup real-time listener for published exams
        const examsRef = collection(db, 'exams');
        const q = query(
            examsRef,
            where('assignedClasses', 'array-contains', classId),
            where('status', '==', 'published')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const examsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter exams created after last seen
            const newExamsList = examsData.filter(exam => {
                const createdAt = exam.createdAt?.toDate() || new Date(0);
                return createdAt > lastSeenDate;
            });

            setNewExams(newExamsList);
            setNewExamsCount(newExamsList.length);
            setLoading(false);
        }, (error) => {
            console.error('Error listening to new exams:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userRole, classId]);

    const markAsRead = () => {
        if (classId) {
            const lastSeenKey = `exams-last-seen-${classId}`;
            localStorage.setItem(lastSeenKey, Date.now().toString());
            setNewExamsCount(0);
            setNewExams([]);
        }
    };

    const isNewExam = (examId) => {
        return newExams.some(e => e.id === examId);
    };

    return { newExamsCount, newExams, loading, markAsRead, isNewExam };
};
