# Feature Wishlist / Backlog

## 1. Teacher Create/Edit Task Page Redesign
**Priority:** High  
**Status:** ⏳ Pending

**Requirements:**
- Redesign halaman Create/Edit Tasks di Teacher menjadi **full screen** seperti tampilan Task di Student
- Gunakan desain yang sama agar seragam (uniform UI/UX)
- Tambahkan **TinyMCE rich text editor** untuk deskripsi task
- Match styling dengan `StudentTaskModal.jsx`

**Files yang terlibat:**
- `src/pages/teacher/TaskDetail.jsx` (Edit mode)
- `src/pages/teacher/Tasks.jsx` (Create mode)
- `src/components/RichTextEditor.jsx` (reuse)

---

## 2. Rich Text Editor untuk Exam (Jawaban Uraian)
**Priority:** Medium  
**Status:** ⏳ Pending

**Requirements:**
- Integrasikan TinyMCE rich text editor pada fitur Exam
- Khususnya untuk **jawaban uraian panjang** (essay answers)
- Siswa dapat memformat jawaban dengan bold, italic, lists, dll
- Guru dapat melihat jawaban dengan formatting yang benar

**Files yang terlibat:**
- `src/pages/student/Exams.jsx` atau terkait
- `src/pages/teacher/Exams.jsx` atau terkait
- `src/components/RichTextEditor.jsx` (reuse)

---

*Last updated: 2026-01-25*
