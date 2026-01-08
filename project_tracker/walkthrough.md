# Panduan: Dukungan Soal Esai & Jawaban Singkat + Sistem Penilaian Manual

Panduan ini mendemonstrasikan kemampuan baru untuk menangani soal **Esai** dan **Jawaban Singkat**, mencakup alur kerja ujung-ke-ujung mulai dari pembuatan ujian hingga penilaian manual dan tinjauan siswa.

## 1. Gambaran Fitur
Kami telah menambahkan dukungan untuk soal subjektif yang memerlukan penilaian manual oleh guru.
- **Tipe Soal Baru**: Esai (Teks Panjang) dan Jawaban Singkat (Satu/Dua baris).
- **Antarmuka Penilaian Manual**: UI khusus bagi guru untuk meninjau jawaban, memberikan nilai, dan memberikan umpan balik (feedback).
- **Penilaian Hibrida**: Ujian sekarang dapat memiliki campuran soal yang dinilai otomatis (Pilihan Ganda) dan soal yang dinilai manual.
- **Pelacakan Status**: Melacak status penilaian "Pending" (Menunggu), "Partial" (Sebagian), dan "Complete" (Selesai).

## 2. Alur Penggunaan

### Langkah 1: Buat Ujian dengan Soal Esai (Guru)
1. Buka menu **Ujian** -> **Buat Ujian Baru**.
2. Tambahkan soal dan pilih **Tipe**: `Essay` (Esai) atau `Short Answer` (Jawaban Singkat).
3. Isi **Teks Soal**.
4. (Opsional) Berikan **Kunci Jawaban/Referensi** (hanya terlihat oleh Anda saat menilai).
5. Tentukan **Poin Maksimum** untuk soal tersebut.
6. Terbitkan (Publish) ujian.

### Langkah 2: Siswa Mengerjakan Ujian (Siswa)
1. Siswa memulai ujian.
2. Untuk soal Esai, disediakan area teks yang besar.
3. Untuk Jawaban Singkat, disediakan input satu baris dengan penghitung karakter.
4. Saat dikirim (submit), sistem menghitung nilai untuk soal *otomatis* secara langsung.
5. Soal khusus yang butuh penilaian manual akan ditandai sebagai **Pending**.

### Langkah 3: Penilaian Manual (Guru)
1. Buka **Hasil Ujian** untuk ujian terkait.
2. Di daftar siswa, Anda akan melihat lencana **"Butuh Penilaian"** untuk siswa yang telah mengirim jawaban esai.
3. Klik tombol **Edit/Nilai** (Ikon Pensil) pada percobaan siswa tersebut.
4. **Antarmuka Penilaian** akan terbuka menutupi layar.
   - Gulir ke soal Esai/Jawaban Singkat.
   - Tinjau jawaban siswa vs Kunci Jawaban Anda.
   - Masukkan **Nilai** (0 - Poin Maks).
   - (Opsional) Masukkan **Feedback** (umpan balik) tertulis.
5. **Total Nilai** di pojok kanan atas akan diperbarui secara real-time saat Anda memasukkan angka.
6. Klik **Simpan Nilai**.
   - Status diperbarui menjadi "Selesai" (Complete).
   - Nilai akhir siswa tersimpan.

### Langkah 4: Tinjau Nilai (Siswa)
1. Siswa membuka **Riwayat Ujian**.
2. Jika penilaian selesai, mereka melihat Nilai Akhir.
3. Jika penilaian belum selesai, mereka melihat status "Pending Review" (Menunggu Tinjauan).
4. Membuka halaman **Review** (Tinjauan) akan menampilkan:
   - Jawaban mereka.
   - Nilai yang diberikan oleh guru.
   - Feedback guru (jika ada).

## 3. Perubahan Teknis
### File yang Dimodifikasi
- [`src/pages/teacher/ExamResults.jsx`](file:///c:/STMS/src/pages/teacher/ExamResults.jsx): Menambahkan komponen `GradingInterface`, logika `handleSaveGrading`, dan indikator status.
- [`src/pages/student/ExamReview.jsx`](file:///c:/STMS/src/pages/student/ExamReview.jsx): Diperbarui untuk menampilkan nilai manual, feedback, dan spanduk pending.
- [`src/pages/student/ExamTaker.jsx`](file:///c:/STMS/src/pages/student/ExamTaker.jsx): (Sebelumnya) Memperbarui logika pengiriman untuk menangani `textAnswer` dan status penilaian awal.
- [`src/pages/student/ExamResultModal.jsx`](file:///c:/STMS/src/pages/student/ExamResultModal.jsx): (Baru) Komponen modal hasil ujian yang dipisahkan dari `ExamTaker.jsx` untuk menangani tampilan hasil klasik dan logika pending.

### Pembaruan Model Data
- **Koleksi `exam_results`**:
  - `manualGradedScore`: Angka (Jumlah nilai manual).
  - `autoGradedScore`: Angka (Jumlah nilai otomatis).
  - `gradingStatus`: String ('pending' | 'complete').
  - `manualScores`: Map { questionId: number }.
  - `feedbacks`: Map { questionId: string }.

### Perbaikan Bug & UI Update
- **Revisi Modal Hasil Ujian**: Modal hasil di `ExamTaker.jsx` dikembalikan ke desain "Klasik" yang lebih sederhana namun tetap informatif, dengan tambahan logika khusus untuk menampilkan status "Menunggu Penilaian" jika ujian mengandung soal esai.
- **Perbaikan Auto-Scroll Grading**: Memisahkan komponen `GradingInterface` dari `ExamResults.jsx` untuk memperbaiki masalah fokus input dan scrolling otomatis saat mengetik nilai.

## 4. Daftar Periksa Verifikasi (Checklist)
- [x] Buat ujian dengan 1 soal Esai dan 1 soal Pilihan Ganda.
- [x] Kerjakan sebagai siswa (jawab keduanya).
- [x] Pastikan hasil Siswa menunjukkan status "Pending" atau modal "Submission Received" dengan jelas.
- [x] Pastikan Guru melihat status "Butuh Penilaian".
- [x] Nilai esai sebagai Guru (beri poin parsial dan feedback).
- [x] Pastikan status berubah menjadi "Selesai" di tampilan standar.
- [x] Pastikan Siswa melihat nilai dan feedback yang diperbarui di halaman Review.
