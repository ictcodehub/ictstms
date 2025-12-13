import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch role
                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        if (userData.status === 'banned') {
                            await signOut(auth);
                            setCurrentUser(null);
                            setUserRole(null);
                            alert("Akun Anda telah dinonaktifkan. Hubungi admin.");
                        } else {
                            setCurrentUser(user);
                            setUserRole(userData.role);
                        }
                    } else {
                        // Profile doesn't exist? Maybe deleted.
                        // For now, allow login but role is null, or force logout?
                        // Let's allow login but role is null, ProtectedRoute will handle it.
                        setCurrentUser(user);
                        setUserRole(null);
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                }
            } else {
                setCurrentUser(null);
                setUserRole(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const logout = () => {
        localStorage.removeItem('lastActivity');
        return signOut(auth);
    };

    // Session Timeout Logic (15 Minutes)
    useEffect(() => {
        if (!currentUser) return;

        const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

        const checkSession = () => {
            const lastActivity = localStorage.getItem('lastActivity');
            if (lastActivity) {
                const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
                if (timeSinceLastActivity > SESSION_TIMEOUT) {
                    logout();
                    // Optional: alert or toast here, but logout usually redirects immediately
                }
            } else {
                localStorage.setItem('lastActivity', Date.now().toString());
            }
        };

        // Initial check and Interval check
        checkSession();
        const intervalId = setInterval(checkSession, 60 * 1000); // Check every minute

        // Activity Listener
        const handleActivity = () => {
            const now = Date.now();
            const lastSaved = parseInt(localStorage.getItem('lastActivity') || '0');

            // Only update storage if more than 1 minute has passed to avoid performance hit
            if (now - lastSaved > 60 * 1000) {
                localStorage.setItem('lastActivity', now.toString());
            }
        };

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);
        window.addEventListener('scroll', handleActivity);
        window.addEventListener('touchstart', handleActivity);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('scroll', handleActivity);
            window.removeEventListener('touchstart', handleActivity);
        };
    }, [currentUser]);

    const login = async (email, password, rememberMe = false) => {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        return signInWithEmailAndPassword(auth, email, password);
    };

    const register = (email, password) => {
        return createUserWithEmailAndPassword(auth, email, password);
    };

    const signup = async (email, password, name, role, classId = null) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Save user data to Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email,
            name,
            role,
            classId: role === 'student' ? classId : null,
            createdAt: serverTimestamp()
        });

        return userCredential;
    };

    const resetPassword = (email) => {
        return sendPasswordResetEmail(auth, email);
    };

    const value = {
        currentUser,
        userRole,
        loading,
        logout,
        login,
        register,
        signup,
        resetPassword
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
