import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { SplashScreen } from '@capacitor/splash-screen';
import { AnimatePresence } from 'framer-motion';
import AnimatedSplash from './components/AnimatedSplash';

// Lazy load page components for code splitting
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const TeacherDashboard = lazy(() => import('./pages/teacher/Dashboard'));
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const ExamReview = lazy(() => import('./pages/student/ExamReview'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));

// Loading component for lazy loaded routes
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
      <p className="text-slate-600 font-medium">Loading...</p>
    </div>
  </div>
);


// Protected Route Component
const ProtectedRoute = ({ children, role }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  if (!currentUser) return <Navigate to="/login" />;

  if (role && userRole !== role) {
    if (userRole === 'admin') return <Navigate to="/admin" />;
    return <Navigate to={userRole === 'teacher' ? '/teacher' : '/student'} />;
  }

  return children;
};

// Root Redirect Component
const RootRedirect = () => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  if (!currentUser) return <Navigate to="/login" />;

  if (userRole === 'admin') return <Navigate to="/admin" />;
  return <Navigate to={userRole === 'teacher' ? '/teacher' : '/student'} />;
};

import { SplashScreen } from '@capacitor/splash-screen';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    console.log('🚀 STMS Version 1.2 Loaded');
    // Hide NATIVE splash immediately. Our Web Splash (AnimatedSplash) is already rendered layer above.
    // This creates the seamless transition.
    const hideNativeSplash = async () => {
      await SplashScreen.hide();
    };
    hideNativeSplash();
  }, []);

  return (
    <AuthProvider>
      <Toaster position="top-right" reverseOrder={false} />

      <AnimatePresence>
        {showSplash && <AnimatedSplash onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>

      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Teacher Routes */}
            <Route path="/teacher/*" element={
              <ProtectedRoute role="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            } />

            {/* Student Routes */}
            <Route path="/student/*" element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/student/exams/:id/review" element={
              <ProtectedRoute role="student">
                <ExamReview />
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute role="admin">
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<UserManagement />} />
            </Route>

            {/* Default Redirect */}
            <Route path="/" element={<RootRedirect />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;

