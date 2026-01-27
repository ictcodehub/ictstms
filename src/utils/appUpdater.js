/**
 * Forces an app update by unregistering service workers and clearing the cache storage.
 * This resolves issues where users are stuck on an old version due to aggressive PWA caching.
 */
import toast from 'react-hot-toast';

export const forceAppUpdate = async () => {
    const toastId = toast.loading('Memproses update aplikasi...');

    try {
        console.log('[AppUpdater] Starting force update...');

        // 1. Unregister all Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('[AppUpdater] Service Worker unregistered:', registration);
            }
        }

        // 2. Clear all Cache Storage (PWA Caches)
        if ('caches' in window) {
            const keys = await caches.keys();
            for (const key of keys) {
                await caches.delete(key);
                console.log('[AppUpdater] Cache deleted:', key);
            }
        }

        // 3. Optional: Clear session storage but keep local storage (auth)
        // We do NOT clear localStorage to keep the user logged in.
        sessionStorage.clear();

        toast.success('Aplikasi berhasil di-update! Reloading...', { id: toastId });

        // 4. Force Reload
        // Give UI a moment to show success
        setTimeout(() => {
            window.location.reload(true);
        }, 1000);

    } catch (error) {
        console.error('[AppUpdater] Failed to update:', error);
        toast.error('Gagal melakukan update otomatis. Silakan refresh manual.', { id: toastId });

        // Fallback reload anyway
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
};
