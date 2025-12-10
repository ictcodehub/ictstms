import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Common
      common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        create: 'Create',
        submit: 'Submit',
        loading: 'Loading...',
        search: 'Search',
        filter: 'Filter',
        sort: 'Sort',
        yes: 'Yes',
        no: 'No',
      },
      // Navigation
      nav: {
        overview: 'Overview',
        tasks: 'Tasks',
        classes: 'Classes',
        students: 'Students',
        exams: 'Exams',
        gradebook: 'Gradebook',
        calendar: 'Calendar',
        analytics: 'Analytics',
        myTasks: 'My Tasks',
        myGrades: 'My Grades',
      },
      // Tasks
      tasks: {
        title: 'Tasks',
        createTask: 'Create Task',
        editTask: 'Edit Task',
        deleteTask: 'Delete Task',
        taskTitle: 'Task Title',
        description: 'Description',
        deadline: 'Deadline',
        priority: 'Priority',
        assignedClasses: 'Assigned Classes',
        submissions: 'Submissions',
        noTasks: 'No tasks found',
      },
      // Grades
      grades: {
        title: 'Grades',
        grade: 'Grade',
        feedback: 'Feedback',
        averageGrade: 'Average Grade',
        noGrades: 'No grades yet',
      },
      // Auth
      auth: {
        login: 'Login',
        logout: 'Logout',
        register: 'Register',
        email: 'Email',
        password: 'Password',
        forgotPassword: 'Forgot Password?',
      },
    },
  },
  id: {
    translation: {
      // Common
      common: {
        save: 'Simpan',
        cancel: 'Batal',
        delete: 'Hapus',
        edit: 'Edit',
        create: 'Buat',
        submit: 'Kirim',
        loading: 'Memuat...',
        search: 'Cari',
        filter: 'Filter',
        sort: 'Urutkan',
        yes: 'Ya',
        no: 'Tidak',
      },
      // Navigation
      nav: {
        overview: 'Ringkasan',
        tasks: 'Tugas',
        classes: 'Kelas',
        students: 'Siswa',
        exams: 'Ujian',
        gradebook: 'Buku Nilai',
        calendar: 'Kalender',
        analytics: 'Analitik',
        myTasks: 'Tugas Saya',
        myGrades: 'Nilai Saya',
      },
      // Tasks
      tasks: {
        title: 'Tugas',
        createTask: 'Buat Tugas',
        editTask: 'Edit Tugas',
        deleteTask: 'Hapus Tugas',
        taskTitle: 'Judul Tugas',
        description: 'Deskripsi',
        deadline: 'Tenggat Waktu',
        priority: 'Prioritas',
        assignedClasses: 'Kelas yang Ditugaskan',
        submissions: 'Pengumpulan',
        noTasks: 'Tidak ada tugas',
      },
      // Grades
      grades: {
        title: 'Nilai',
        grade: 'Nilai',
        feedback: 'Umpan Balik',
        averageGrade: 'Rata-rata Nilai',
        noGrades: 'Belum ada nilai',
      },
      // Auth
      auth: {
        login: 'Masuk',
        logout: 'Keluar',
        register: 'Daftar',
        email: 'Email',
        password: 'Kata Sandi',
        forgotPassword: 'Lupa Kata Sandi?',
      },
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'en', // Default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
