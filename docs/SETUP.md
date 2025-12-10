# Setup Guide

Complete guide to set up and run ICT STMS application locally.

---

## Prerequisites

### Required Software

1. **Node.js** (v16 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **npm** (comes with Node.js)
   - Verify: `npm --version`

3. **Git**
   - Download: https://git-scm.com/
   - Verify: `git --version`

4. **Firebase Account**
   - Create account: https://firebase.google.com/

### Optional Software

- **VS Code** (recommended code editor)
- **Firebase CLI** (for deployment)
  ```bash
  npm install -g firebase-tools
  ```

---

## Step 1: Clone Repository

```bash
git clone https://github.com/kirimtugas/submit.git
cd submit
```

Or if you have SSH set up:

```bash
git clone git@github.com:kirimtugas/submit.git
cd submit
```

---

## Step 2: Install Dependencies

```bash
npm install
```

This will install:
- React and related libraries
- Vite build tool
- Firebase SDK
- Tailwind CSS
- Testing libraries
- All other dependencies

**Expected output:**
```
added 316 packages, and audited 316 packages in 45s
found 0 vulnerabilities
```

---

## Step 3: Firebase Setup

### 3.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name (e.g., "ict-stms-dev")
4. Disable Google Analytics (optional)
5. Click "Create Project"

### 3.2 Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get Started"
3. Enable **Email/Password** provider
4. Click "Save"

### 3.3 Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create Database"
3. Select "Start in **test mode**" (for development)
4. Choose location (closest to your users)
5. Click "Enable"

### 3.4 Enable Hosting

1. In Firebase Console, go to **Hosting**
2. Click "Get Started"
3. Follow the setup wizard

### 3.5 Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click **Web icon** (</>)
4. Register app name (e.g., "STMS Web App")
5. Copy the configuration object:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

---

## Step 4: Configure Firebase in Project

### 4.1 Update Firebase Config

Open `src/lib/firebase.js` and replace with your configuration:

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### 4.2 Update Firebase Project ID

Open `.firebaserc` and update:

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

---

## Step 5: Set Up Firestore Security Rules

In Firebase Console, go to **Firestore Database > Rules** and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
                      (request.auth.uid == userId || getUserRole() == 'admin');
      allow delete: if getUserRole() == 'admin';
    }
    
    match /classes/{classId} {
      allow read: if isAuthenticated();
      allow write: if getUserRole() in ['admin', 'teacher'];
    }
    
    match /tasks/{taskId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if getUserRole() in ['admin', 'teacher'];
    }
    
    match /submissions/{submissionId} {
      allow read: if isAuthenticated();
      allow create: if getUserRole() == 'student';
      allow update: if getUserRole() in ['admin', 'teacher', 'student'];
      allow delete: if getUserRole() in ['admin', 'teacher'];
    }
    
    match /exams/{examId} {
      allow read: if isAuthenticated();
      allow write: if getUserRole() in ['admin', 'teacher'];
    }
    
    match /exam_results/{resultId} {
      allow read: if isAuthenticated();
      allow create: if getUserRole() == 'student';
      allow update: if getUserRole() in ['admin', 'teacher'];
      allow delete: if getUserRole() in ['admin', 'teacher'];
    }
  }
}
```

Click "Publish" to apply the rules.

---

## Step 6: Create Initial Admin User

### 6.1 Register First User

1. Start the dev server: `npm run dev`
2. Open http://localhost:5173
3. Click "Register"
4. Fill in the form with admin credentials
5. Submit registration

### 6.2 Set Admin Role Manually

Since this is the first user, you need to manually set the admin role:

1. Go to Firebase Console > **Firestore Database**
2. Find the `users` collection
3. Find your user document (by email)
4. Edit the document
5. Change `role` field from `student` to `admin`
6. Save

### 6.3 Login as Admin

1. Logout from the app
2. Login with your admin credentials
3. You should now see the Admin Dashboard

---

## Step 7: Run Development Server

```bash
npm run dev
```

The app will start at: **http://localhost:5173**

**You should see:**
```
VITE v7.2.4  ready in 313 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## Step 8: Verify Setup

### Test Checklist

- [ ] Can access http://localhost:5173
- [ ] Can see login page
- [ ] Can register new user
- [ ] Can login successfully
- [ ] Can see dashboard (based on role)
- [ ] No console errors
- [ ] Firebase connection working

### Common Issues

**Issue: "Module not found" errors**
- Solution: Run `npm install` again

**Issue: Firebase connection fails**
- Solution: Check firebase.js configuration
- Verify API key is correct

**Issue: Authentication not working**
- Solution: Verify Email/Password is enabled in Firebase Console

**Issue: Permission denied in Firestore**
- Solution: Check security rules are published
- Verify user role is set correctly

---

## Step 9: Seed Test Data (Optional)

### Create Sample Classes

1. Login as teacher/admin
2. Go to Classes page
3. Create classes: 10A, 10B, 11A, etc.

### Create Sample Students

1. Go to User Management (admin) or Students (teacher)
2. Create sample student accounts
3. Assign to classes

### Create Sample Tasks

1. Go to Tasks page
2. Create several test tasks
3. Assign to classes

---

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

---

## Environment Variables

Currently, the app doesn't use `.env` files. Firebase config is in `src/lib/firebase.js`.

**To use environment variables (optional):**

1. Create `.env` file:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
```

2. Update `firebase.js`:
```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ...
};
```

3. Add `.env` to `.gitignore`

---

## Deployment

### Deploy to Firebase Hosting

```bash
# Login to Firebase
firebase login

# Build production version
npm run build

# Deploy
firebase deploy
```

Your app will be live at: `https://your-project-id.web.app`

### Continuous Deployment

Set up GitHub Actions for auto-deploy on push to `main`:

See `.github/workflows/firebase-hosting-merge.yml`

---

## Troubleshooting

### Build Fails

**Error: "Cannot find module"**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Firebase Errors

**Error: "Permission denied"**
- Check Firestore security rules
- Verify user is authenticated
- Check user role is correct

**Error: "Project not found"**
- Verify `.firebaserc` has correct project ID
- Run `firebase use <project-id>`

### Development Server Issues

**Port 5173 already in use**
```bash
# Kill the process using the port
# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:5173 | xargs kill
```

---

## Getting Help

- **Documentation**: See `/docs` folder
- **Issues**: Create issue on GitHub
- **Email**: contact@example.com

---

## Next Steps

After setup:

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand system design
2. Read [FIREBASE_SCHEMA.md](./FIREBASE_SCHEMA.md) for database structure
3. Read [API.md](./API.md) for function references
4. Read [COMPONENTS.md](./COMPONENTS.md) for component usage
5. Read [TESTING_GUIDE.md](../TESTING_GUIDE.md) for testing info

---

## Additional Resources

- [React Documentation](https://react.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Framer Motion Documentation](https://www.framer.com/motion/)

