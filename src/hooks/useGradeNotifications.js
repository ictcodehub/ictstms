import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';

export function useGradeNotifications(currentUser) {
    const [notification, setNotification] = useState(null);
    const [notificationQueue, setNotificationQueue] = useState([]);

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

                            // Check if this grade is new or updated
                            const notificationKey = `grade_notif_${currentUser.uid}_${taskId}`;
                            const lastSeenGradedAt = localStorage.getItem(notificationKey);

                            // Get current gradedAt timestamp safely
                            // Get current gradedAt timestamp safely - use 0 as fallback to prevent infinite loop
                            const currentGradedAt = submission.gradedAt?.toMillis ? submission.gradedAt.toMillis() :
                                (submission.gradedAt?.seconds ? submission.gradedAt.seconds * 1000 : 0);

                            // Only show if grade exists AND (never shown OR gradedAt is newer than last seen)
                            if (submission.grade !== null && submission.grade !== undefined) {
                                if (!lastSeenGradedAt || parseInt(lastSeenGradedAt) < currentGradedAt) {
                                    let taskTitle = tasksMap[taskId]?.title;

                                    // If task title not found in initial map (new task), fetch it
                                    if (!taskTitle) {
                                        try {
                                            const taskQuery = query(collection(db, 'tasks'), where('__name__', '==', taskId));
                                            const taskDoc = await getDocs(taskQuery);
                                            if (!taskDoc.empty) {
                                                const taskData = taskDoc.docs[0].data();
                                                taskTitle = taskData.title;
                                                // Update map for future use
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
                                            gradedAtMillis: currentGradedAt
                                        });
                                    }
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
            // Mark as shown in localStorage with timestamp
            const notificationKey = `grade_notif_${currentUser.uid}_${notification.taskId}`;
            localStorage.setItem(notificationKey, notification.gradedAtMillis.toString());

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
