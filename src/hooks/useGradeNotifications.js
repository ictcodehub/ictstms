import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';

export function useGradeNotifications(currentUser) {
    const [notification, setNotification] = useState(null);
    const [notificationQueue, setNotificationQueue] = useState([]);
    // Track when this session started to ignore old notifications
    const [sessionStart] = useState(Date.now());

    useEffect(() => {
        if (!currentUser) return;

        let unsubscribe = null;

        const setupListener = async () => {
            try {
                // Get tasks map for task titles
                const tasksSnap = await getDocs(collection(db, 'tasks'));
                const tasksMap = {};
                tasksSnap.forEach(doc => {
                    tasksMap[doc.id] = doc.data();
                });

                // Setup real-time listener for submissions
                const submissionsQuery = query(
                    collection(db, 'submissions'),
                    where('studentId', '==', currentUser.uid)
                );

                unsubscribe = onSnapshot(submissionsQuery, async (snapshot) => {
                    const newNotifications = [];

                    // Use map to handle async operations properly
                    const processingPromises = snapshot.docChanges().map(async (change) => {
                        if (change.type === 'added' || change.type === 'modified') {
                            const submission = change.doc.data();
                            const taskId = submission.taskId;

                            // Fix: Only show notification if the grade was given AFTER the user logged in (Real-time only)
                            // This prevents "Catch-up" notifications on login for old grades
                            const gradeTime = submission.gradedAt?.toMillis ? submission.gradedAt.toMillis() :
                                (submission.gradedAt?.seconds ? submission.gradedAt.seconds * 1000 : 0);

                            // Check if grade is actually new (received after this session started)
                            // We use a small buffer (5 seconds) to avoid race conditions on page load
                            const isNewGrade = gradeTime > (sessionStart - 5000);

                            if (submission.grade !== null && submission.grade !== undefined && isNewGrade) {
                                let taskTitle = tasksMap[taskId]?.title;

                                // If task title not found in initial map (new task), fetch it
                                if (!taskTitle) {
                                    try {
                                        const taskQuery = query(collection(db, 'tasks'), where('__name__', '==', taskId));
                                        const taskDoc = await getDocs(taskQuery);
                                        if (!taskDoc.empty) {
                                            const taskData = taskDoc.docs[0].data();
                                            taskTitle = taskData.title;
                                            tasksMap[taskId] = taskData;
                                        }
                                    } catch (err) {
                                        console.error('Error fetching task details:', err);
                                    }
                                }



                                if (taskTitle) {
                                    newNotifications.push({
                                        taskId,
                                        taskTitle: taskTitle,
                                        grade: submission.grade,
                                        feedback: submission.feedback || submission.teacherComment || '',
                                        gradedAt: submission.gradedAt,
                                        gradedAtMillis: gradeTime
                                    });
                                }
                            }
                        }
                    });

                    await Promise.all(processingPromises);

                    // Add new notifications to queue
                    if (newNotifications.length > 0) {
                        setNotificationQueue(prev => {
                            // Filter out duplicates that might already be in queue
                            const existingTaskIds = new Set(prev.map(n => n.taskId));
                            const uniqueNew = newNotifications.filter(n => !existingTaskIds.has(n.taskId));
                            return [...prev, ...uniqueNew].slice(0, 5);
                        });
                    }
                });

            } catch (error) {
                console.error('Error setting up grade notifications:', error);
            }
        };

        setupListener();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [currentUser]);

    // Show next notification from queue
    useEffect(() => {
        if (!notification && notificationQueue.length > 0) {
            setNotification(notificationQueue[0]);
        }
    }, [notification, notificationQueue]);

    const dismissNotification = () => {
        if (notification) {
            // Remove from queue and clear current
            setNotificationQueue(prev => prev.slice(1));
            setNotification(null);
        }
    };

    return {
        notification,
        dismissNotification
    };
}
