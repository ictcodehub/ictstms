// IndexedDB utility for offline exam answer storage

const DB_NAME = 'ictstms-offline';
const STORE_NAME = 'exam-answers';
const DB_VERSION = 1;

/**
 * Initialize IndexedDB
 */
export const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
};

/**
 * Save exam answers offline
 */
export const saveAnswersOffline = async (sessionId, answers) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await store.put({
            sessionId,
            answers,
            timestamp: Date.now(),
            synced: false
        });

        return true;
    } catch (error) {
        console.error('Error saving answers offline:', error);
        return false;
    }
};

/**
 * Get offline answers for a session
 */
export const getOfflineAnswers = async (sessionId) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        return await store.get(sessionId);
    } catch (error) {
        console.error('Error getting offline answers:', error);
        return null;
    }
};

/**
 * Get all unsynced answers
 */
export const getUnsyncedAnswers = async () => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        const allRecords = await store.getAll();
        return allRecords.filter(record => !record.synced);
    } catch (error) {
        console.error('Error getting unsynced answers:', error);
        return [];
    }
};

/**
 * Mark answers as synced
 */
export const markAsSynced = async (sessionId) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const record = await store.get(sessionId);
        if (record) {
            record.synced = true;
            record.syncedAt = Date.now();
            await store.put(record);
        }

        return true;
    } catch (error) {
        console.error('Error marking as synced:', error);
        return false;
    }
};

/**
 * Clear offline answers for a session
 */
export const clearOfflineAnswers = async (sessionId) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await store.delete(sessionId);
        return true;
    } catch (error) {
        console.error('Error clearing offline answers:', error);
        return false;
    }
};

/**
 * Clear all offline data (for cleanup)
 */
export const clearAllOfflineData = async () => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await store.clear();
        return true;
    } catch (error) {
        console.error('Error clearing all offline data:', error);
        return false;
    }
};
