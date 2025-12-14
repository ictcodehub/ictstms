import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Dedicated offline indicator for exam page
 * Shows status badge next to timer for better visibility during exams
 */
export default function ExamOfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={isOnline ? 'online' : 'offline'}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm ${isOnline
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
            >
                {isOnline ? (
                    <>
                        <Wifi className="h-4 w-4" />
                        <span className="hidden sm:inline">Online</span>
                    </>
                ) : (
                    <>
                        <WifiOff className="h-4 w-4 animate-pulse" />
                        <span className="hidden sm:inline">Offline</span>
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
