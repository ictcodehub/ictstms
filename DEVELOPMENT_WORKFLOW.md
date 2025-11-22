# Development Workflow

## Branch Strategy

Kami menggunakan **Git Flow** sederhana dengan 2 branch utama:

### **Branches:**

1. **`main`** - Production branch
   - Selalu stable dan siap production
   - Auto-deploy ke Firebase Hosting
   - Hanya menerima merge dari `dev` setelah testing

2. **`dev`** - Development branch
   - Branch untuk development dan testing
   - Semua perubahan baru dibuat di sini
   - Testing dilakukan di local sebelum merge ke `main`

---

## Workflow untuk Development

### **1. Membuat Perubahan Baru**

Pastikan berada di branch `dev`:
```bash
git checkout dev
git pull origin dev
```

### **2. Edit Code**

Buat perubahan yang diperlukan di code.

### **3. Test Local**

Jalankan development server:
```bash
npm run dev
```

Buka browser: `http://localhost:5173`

**Cek:**
- ✅ Fitur berfungsi dengan baik
- ✅ Tidak ada error di console
- ✅ UI terlihat bagus
- ✅ Responsive di berbagai ukuran layar

### **4. Commit ke Dev Branch**

```bash
git add .
git commit -m "Deskripsi perubahan"
git push origin dev
```

### **5. Minta Review & Approval**

- Screenshot atau demo fitur baru
- Tunggu approval dari user
- Jika ada revisi, ulangi dari step 2

### **6. Merge ke Main (Setelah Approved)**

```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```

Setelah push ke `main`, GitHub Actions akan otomatis deploy ke Firebase.

---

## Workflow untuk Hotfix (Urgent)

Jika ada bug urgent di production:

```bash
git checkout main
git pull origin main
# Fix bug
git add .
git commit -m "Hotfix: deskripsi bug"
git push origin main
# Sync back to dev
git checkout dev
git merge main
git push origin dev
```

---

## Current Status

- ✅ Branch `dev` sudah dibuat
- ✅ Branch `main` adalah production
- ✅ Auto-deploy aktif untuk branch `main`

---

## Commands Cheat Sheet

```bash
# Switch to dev
git checkout dev

# Switch to main
git checkout main

# Check current branch
git branch

# Pull latest changes
git pull origin dev

# Push changes
git push origin dev

# Merge dev to main
git checkout main
git merge dev
git push origin main
```

---

## Notes

- **JANGAN** push langsung ke `main` kecuali hotfix urgent
- **SELALU** test di local sebelum merge ke `main`
- **SELALU** minta approval sebelum merge ke `main`
- Commit messages harus descriptive
