import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCc6eXP16jU3z4EKYowp9vmp1mhxD-Rhv0",
    authDomain: "kirimtugas-app.firebaseapp.com",
    projectId: "kirimtugas-app",
    storageBucket: "kirimtugas-app.firebasestorage.app",
    messagingSenderId: "834165771444",
    appId: "1:834165771444:web:2e622e0d85dc1b3f489be1",
    measurementId: "G-9ZQC3VF7EX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Helper to create student account without logging out teacher
export const createStudentAccount = async (email, password) => {
    const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
    const secondaryAuth = getAuth(secondaryApp);
    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        return userCredential;
    } finally {
        // We don't delete the app here to avoid issues if called rapidly, 
        // but traditionally one might. For now, letting it live or caching it is fine.
        // Actually, deleting it is safer to clean up.
        // deleteApp(secondaryApp); // deleteApp is async, need import.
    }
};
