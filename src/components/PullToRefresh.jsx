import { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { Loader2, ArrowDown } from 'lucide-react';

export default function PullToRefresh({ children, onRefresh }) {
    const containerRef = useRef(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const y = useMotionValue(0);
    const controls = useAnimation();

    // Transform for icon
    const rotate = useTransform(y, [0, 80], [0, 180]);
    const opacity = useTransform(y, [0, 40], [0, 1]);

    // Touch state
    const startY = useRef(0);
    const isDragging = useRef(false);

    const handleTouchStart = (e) => {
        // Only trigger if we are at the very top
        if (containerRef.current.scrollTop <= 0) {
            startY.current = e.touches[0].clientY;
            // Don't set dragging locally yet, wait for move to confirm direction
        }
    };

    const handleTouchMove = (e) => {
        // If refreshing, don't interfere
        if (isRefreshing) return;

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        // We only care if:
        // 1. We started at top (checked in start)
        // 2. We are pulling DOWN (diff > 0)
        // 3. We are currently at top (scrollTop === 0)

        if (diff > 0 && containerRef.current.scrollTop <= 0) {
            // If we weren't already dragging, establish it now
            isDragging.current = true;

            // Resistance logic (logarithmic or damped)
            // y = x^0.8 for smooth resistance
            const resistance = Math.pow(diff, 0.85); // slightly less than linear

            // Cap the drag
            const cappedResistance = Math.min(resistance, 150);

            y.set(cappedResistance);

            // Prevent native scroll/refresh
            if (e.cancelable) e.preventDefault();
        } else {
            // Revert if scrolling back up or not at top
            isDragging.current = false;
            y.set(0);
        }
    };

    const handleTouchEnd = async () => {
        if (!isDragging.current) {
            y.set(0);
            return;
        }

        isDragging.current = false;
        const currentY = y.get();
        const THRESHOLD = 80;

        if (currentY > THRESHOLD && !isRefreshing) {
            setIsRefreshing(true);
            controls.start({ y: THRESHOLD }); // Snap to loading position

            try {
                if (onRefresh) await onRefresh();
            } finally {
                // Determine wait based on quick refresh or long
                setTimeout(() => {
                    setIsRefreshing(false);
                    controls.start({ y: 0 });
                    y.set(0);
                }, 500);
            }
        } else {
            // Snap back
            controls.start({ y: 0 });
            y.set(0);
        }
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Passive: false is CRITICAL to allow e.preventDefault()
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isRefreshing]);

    return (
        <div className="relative h-full flex flex-col overflow-hidden">
            {/* Indicator */}
            <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pointer-events-none pt-4">
                {/* Indicator Container */}
                <motion.div
                    className="relative flex items-center justify-center p-2"
                    initial={{ opacity: 0, y: -60, scale: 0.5 }} // Force initial state
                    style={{
                        y: useTransform(y, (val) => val - 60),
                        opacity: useTransform(y, [0, 20], [0, 1], { clamp: true }), // Faster fade in, clamped
                        scale: useTransform(y, [0, 80], [0.5, 1]),
                    }}
                >
                    <div className="bg-white/90 backdrop-blur-md rounded-full p-3 shadow-lg border border-blue-100/50 ring-4 ring-blue-50/50">
                        {isRefreshing ? (
                            <div className="relative h-6 w-6">
                                <motion.span
                                    className="absolute inset-0 border-2 border-blue-200 rounded-full"
                                />
                                <motion.span
                                    className="absolute inset-0 border-2 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                                />
                                <motion.div
                                    className="absolute inset-1 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-full"
                                    animate={{ scale: [0.8, 1, 0.8] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                            </div>
                        ) : (
                            <motion.div style={{ rotate }} className="relative">
                                {/* Decor rings */}
                                <div className="absolute -inset-1 border border-blue-100 rounded-full scale-125 opacity-50" />
                                <ArrowDown className="h-6 w-6 text-blue-600" strokeWidth={2.5} />
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Content Scroller */}
            <motion.div
                ref={containerRef}
                style={{ y }}
                animate={controls}
                className="flex-1 overflow-y-auto overscroll-none" // overscroll-none helps prevent browser intervention
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
                {children}
            </motion.div>
        </div>
    );
}
