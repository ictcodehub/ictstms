import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(true);
    const [showOnlineNotif, setShowOnlineNotif] = useState(false);

    useEffect(() => {
        const isMobile = Capacitor.isNativePlatform();

        if (isMobile) {
            // Use Capacitor Network plugin for mobile
            const checkInitialStatus = async () => {
                const status = await Network.getStatus();
                setIsOnline(status.connected);
            };

            checkInitialStatus();

            const networkListener = Network.addListener('networkStatusChange', (status) => {
                const wasOffline = !isOnline;
                setIsOnline(status.connected);

                // Show online notification when coming back online
                if (status.connected && wasOffline) {
                    setShowOnlineNotif(true);
                    setTimeout(() => setShowOnlineNotif(false), 3000);
                } else if (!status.connected) {
                    setShowOnlineNotif(false);
                }
            });

            return () => {
                networkListener.remove();
            };
        } else {
            // Fallback to web API for browser
            setIsOnline(navigator.onLine);

            const handleOnline = () => {
                setIsOnline(true);
                setShowOnlineNotif(true);
                setTimeout(() => setShowOnlineNotif(false), 3000);
            };

            const handleOffline = () => {
                setIsOnline(false);
                setShowOnlineNotif(false);
            };

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        }
    }, [isOnline]);

    return (
        <>
            {/* Offline Banner */}
            <AnimatePresence>
                {!isOnline && (
                    <motion.div
                        initial={{ y: -100 }}
                        animate={{ y: 0 }}
                        exit={{ y: -100 }}
                        className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-lg"
                    >
                        <WifiOff className="h-4 w-4 animate-pulse" />
                        <span>Offline Mode - Your answers are saved locally</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Online Notification (temporary) */}
            <AnimatePresence>
                {showOnlineNotif && (
                    <motion.div
                        initial={{ y: -100 }}
                        animate={{ y: 0 }}
                        exit={{ y: -100 }}
                        className="fixed top-0 left-0 right-0 z-[9999] bg-green-500 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Wifi className="h-4 w-4" />
                        <span>Back Online - Syncing your data...</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
