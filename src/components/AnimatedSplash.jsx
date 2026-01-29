import { motion } from 'framer-motion';
import { useEffect } from 'react';

export default function AnimatedSplash({ onComplete = () => { } }) {
    useEffect(() => {
        // Signal completion after total animation time (reduced to 1.5s for faster startup)
        const completeTimer = setTimeout(() => {
            onComplete();
        }, 1500);

        return () => {
            clearTimeout(completeTimer);
        };
    }, [onComplete]);

    return (
        <motion.div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
        >
            {/* Logo - animates in first */}
            <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                    duration: 0.5,
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                }}
                className="mb-6 relative"
            >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-blue-400/30 blur-2xl rounded-full scale-150 animate-pulse"></div>
                <img src="/favicon.png" alt="ICT Codehub" className="w-28 h-28 rounded-2xl shadow-2xl relative z-10" />
            </motion.div>

            {/* Text - always rendered, animates in after logo */}
            <div className="text-center relative z-10">
                <motion.h1
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                    className="text-3xl font-bold text-slate-800 tracking-tight"
                >
                    ICT Codehub
                </motion.h1>
                <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
                    className="text-sm text-slate-500 font-medium mt-1"
                >
                    Learning Management System
                </motion.p>
            </div>

            {/* Loading Indicator at bottom */}
            <motion.div
                className="absolute bottom-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
            >
                <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            </motion.div>
        </motion.div>
    );
}
