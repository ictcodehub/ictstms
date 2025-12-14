import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
        const checkNewExams = async () => {
            if (userRole !== 'student' || !classId) {
                setLoading(false);
                return;
            }

            try {
                // Get last seen timestamp from localStorage
                const lastSeenKey = `exams-last-seen-${classId}`;
                const lastSeen = localStorage.getItem(lastSeenKey);
                const lastSeenDate = lastSeen ? new Date(parseInt(lastSeen)) : new Date(0);

                // Query published exams for this class
                const examsRef = collection(db, 'exams');
                const q = query(
                    examsRef,
                    where('assignedClasses', 'array-contains', classId),
                    where('status', '==', 'published')
                );

                const snapshot = await getDocs(q);
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
            } catch (error) {
                console.error('Error checking new exams:', error);
            } finally {
                setLoading(false);
            }
        };

        checkNewExams();
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
