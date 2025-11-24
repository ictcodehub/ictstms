# 📚 STMS - Student Task Management System

> Developed by **Ajit Prasetiyo**

Sistem Manajemen Tugas Siswa berbasis web yang modern dan intuitif, dirancang untuk memudahkan guru dan siswa dalam mengelola tugas, pengumpulan, dan penilaian secara digital.

## 🌟 Fitur Utama

### 👨‍🏫 Untuk Guru
- **Manajemen Kelas** - Buat dan kelola kelas dengan mudah
- **Manajemen Tugas** - Buat tugas dengan deadline, prioritas, dan deskripsi lengkap
- **Penilaian Otomatis** - Sistem grading yang efisien dengan feedback
- **Gradebook** - Lihat nilai semua siswa dalam satu tampilan
- **Task Detail Modal** - Lihat detail tugas lengkap dengan format yang rapi
- **Sortable Tables** - Urutkan data siswa berdasarkan nama, tugas, atau nilai
- **Status Tracking** - Monitor status pengumpulan tugas real-time
- **Auto Link Detection** - URL dalam submission otomatis menjadi clickable links

### 👨‍🎓 Untuk Siswa
- **Dashboard Overview** - Lihat semua tugas dan deadline dalam satu halaman
- **Task Submission** - Submit tugas dengan mudah
- **Grade Tracking** - Monitor nilai dan feedback dari guru
- **Task Filtering** - Filter tugas berdasarkan status (belum submit, sudah dinilai, dll)
- **Priority Badges** - Indikator visual untuk tugas prioritas tinggi

### 🔐 Untuk Admin
- **User Management** - Kelola akun guru dan siswa
- **Role-based Access** - Sistem permission berbasis role (Admin, Guru, Siswa)

## 🛠️ Teknologi yang Digunakan

### Frontend
- **React** - Library UI modern
- **Vite** - Build tool yang cepat
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animasi yang smooth
- **Lucide React** - Icon library yang modern

### Backend & Database
- **Firebase Authentication** - Autentikasi user yang aman
- **Cloud Firestore** - NoSQL database real-time
- **Firebase Hosting** - Deployment yang mudah

### State Management & Utilities
- **React Hot Toast** - Notifikasi yang elegan
- **React Router** - Routing aplikasi

## 📦 Instalasi

### Prerequisites
- Node.js (v16 atau lebih baru)
- npm atau yarn
- Akun Firebase

### Langkah Instalasi

1. **Clone repository**
```bash
git clone https://github.com/kirimtugas/submit.git
cd submit
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup Firebase**
   - Buat project baru di [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication (Email/Password)
   - Enable Cloud Firestore
   - Copy konfigurasi Firebase Anda

4. **Konfigurasi Environment**
   - Buat file `src/lib/firebase.js`
   - Tambahkan konfigurasi Firebase Anda:
```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

5. **Jalankan aplikasi**
```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173`

## 🚀 Deployment

### Build untuk Production
```bash
npm run build
```

### Deploy ke Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 📁 Struktur Project

```
STMS/
├── src/
│   ├── components/        # Reusable components
│   ├── layouts/          # Layout components (DashboardLayout)
│   ├── lib/              # Firebase config & utilities
│   ├── pages/            # Page components
│   │   ├── admin/        # Admin pages
│   │   ├── teacher/      # Teacher pages
│   │   └── student/      # Student pages
│   ├── utils/            # Utility functions (linkify, etc)
│   ├── App.jsx           # Main app component
│   └── main.jsx          # Entry point
├── public/               # Static assets
└── index.html           # HTML template
```

## 🎨 Fitur UI/UX

- **Responsive Design** - Optimal di desktop, tablet, dan mobile
- **Dark Mode Ready** - Siap untuk implementasi dark mode
- **Smooth Animations** - Transisi yang halus dengan Framer Motion
- **Modern Glassmorphism** - Desain modern dengan efek glass
- **Color-coded Status** - Status visual yang jelas dengan warna
- **Interactive Tables** - Sortable dan filterable tables
- **Modal Dialogs** - Konfirmasi aksi penting dengan modal
- **Toast Notifications** - Feedback real-time untuk user actions

## 📊 Database Schema

### Collections

#### `users`
- `uid` - User ID (dari Firebase Auth)
- `email` - Email user
- `name` - Nama lengkap
- `role` - Role (admin/teacher/student)
- `classId` - ID kelas (untuk siswa)

#### `classes`
- `id` - Class ID
- `name` - Nama kelas (e.g., "9A")
- `subject` - Mata pelajaran
- `teacherId` - ID guru pengampu

#### `tasks`
- `id` - Task ID
- `title` - Judul tugas
- `description` - Deskripsi tugas (HTML)
- `deadline` - Deadline pengumpulan
- `priority` - Prioritas (high/medium/low)
- `assignedClasses` - Array ID kelas yang ditugaskan
- `createdBy` - ID guru pembuat

#### `submissions`
- `id` - Submission ID
- `taskId` - ID tugas
- `studentId` - ID siswa
- `content` - Konten jawaban
- `submittedAt` - Waktu submit
- `grade` - Nilai (0-100)
- `feedback` - Feedback dari guru

## 🔒 Security Rules

Aplikasi ini menggunakan Firebase Security Rules untuk melindungi data:
- Admin dapat mengakses semua data
- Guru hanya dapat mengakses data kelas mereka
- Siswa hanya dapat mengakses data mereka sendiri

## 🤝 Contributing

Kontribusi selalu welcome! Silakan:
1. Fork repository ini
2. Buat branch baru (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👤 Developer

**Ajit Prasetiyo**

- GitHub: [@kirimtugas](https://github.com/kirimtugas)
- Repository: [submit](https://github.com/kirimtugas/submit)

## 🙏 Acknowledgments

- React Team untuk library yang luar biasa
- Firebase untuk backend infrastructure
- Tailwind CSS untuk styling framework
- Lucide untuk icon library
- Semua kontributor open source yang membuat project ini possible

---

⭐ Jika project ini membantu Anda, jangan lupa berikan star di GitHub!
