// Script to fix student classId
// Run this with: node fix_student_classid.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDXEto4ZOJdslxLQcRDwmLLzJxWLKfXqKI",
    authDomain: "kirimtugas-app.firebaseapp.com",
    projectId: "kirimtugas-app",
    storageBucket: "kirimtugas-app.firebasestorage.app",
    messagingSenderId: "1039692863114",
    appId: "1:1039692863114:web:a6f3f0a7e8e2c5e8e8e8e8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixStudentClassIds() {
    try {
        const classId = 'CJhf3ILNO2wjU5egonUY'; // Religion - Kelas 6

        // Student emails from the class
        const studentEmails = [
            'faeyza@student.smpplus.sch.id',
            'jirau@student.smpplus.sch.id',
            'keiko@student.smpplus.sch.id',
            'kimiya@student.smpplus.sch.id',
            'andra@student.smpplus.sch.id'
        ];

        console.log('🔧 Fixing student classIds...');

        for (const email of studentEmails) {
            // Find student by email
            const q = query(
                collection(db, 'users'),
                where('email', '==', email)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                console.log(`⚠️  Student not found: ${email}`);
                continue;
            }

            const studentDoc = snapshot.docs[0];
            const studentData = studentDoc.data();

            console.log(`👤 Found: ${studentData.name} | Current classId: ${studentData.classId || 'NOT SET'}`);

            // Update classId if not set or different
            if (studentData.classId !== classId) {
                await updateDoc(doc(db, 'users', studentDoc.id), {
                    classId: classId
                });
                console.log(`   ✅ Updated classId to: ${classId}`);
            } else {
                console.log(`   ✓ Already correct`);
            }
        }

        console.log('\n✅ Done! All students should now have correct classId.');
        console.log('Refresh the ExamResults page to see all 5 students.');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixStudentClassIds();
