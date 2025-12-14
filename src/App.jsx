import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { SplashScreen } from '@capacitor/splash-screen';
import { AnimatePresence, motion } from 'framer-motion';
import AnimatedSplash from './components/AnimatedSplash';
import OfflineIndicator from './components/OfflineIndicator';

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

// Loading component for lazy loaded routes - matches auth loading screen
const LoadingFallback = () => (
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
    <div className="mb-6 relative">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-blue-400/30 blur-2xl rounded-full scale-150 animate-pulse"></div>
      <img src="/favicon.png" alt="ICT Codehub" className="w-28 h-28 rounded-2xl shadow-2xl relative z-10" />
    </div>
    <div className="text-center relative z-10">
      <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-1">ICT Codehub</h1>
      <p className="text-sm text-slate-500 font-medium">Loading...</p>
    </div>
    {/* Loading Indicator */}
    <div className="mt-8">
      <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  </div>
);


// Protected Route Component
const ProtectedRoute = ({ children, role }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return <LoadingFallback />;

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

  if (loading) return <LoadingFallback />;

  if (!currentUser) return <Navigate to="/login" />;

  if (userRole === 'admin') return <Navigate to="/admin" />;
  return <Navigate to={userRole === 'teacher' ? '/teacher' : '/student'} />;
};

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashMinTimeComplete, setSplashMinTimeComplete] = useState(false);

  useEffect(() => {
    console.log('🚀 STMS Version 1.2 Loaded');
    // Hide NATIVE splash immediately. Our Web Splash (AnimatedSplash) is already rendered layer above.
    // This creates the seamless transition.
    const hideNativeSplash = async () => {
      await SplashScreen.hide();
    };
    hideNativeSplash();

    // Set minimum splash time (1.5s for animation)
    const timer = setTimeout(() => {
      setSplashMinTimeComplete(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AuthProvider>
      <AppContent
        splashMinTimeComplete={splashMinTimeComplete}
        showSplash={showSplash}
        setShowSplash={setShowSplash}
      />
    </AuthProvider>
  );
}

// AppContent has access to AuthContext
function AppContent({ splashMinTimeComplete, showSplash, setShowSplash }) {
  const { loading: authLoading } = useAuth();

  // Hide splash only when BOTH conditions are met:
  // 1. Minimum animation time complete (1.5s)
  // 2. Auth check complete
  useEffect(() => {
    if (splashMinTimeComplete && !authLoading && showSplash) {
      setShowSplash(false);
    }
  }, [splashMinTimeComplete, authLoading, showSplash, setShowSplash]);

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <OfflineIndicator />

      <AnimatePresence mode="wait">
        {showSplash ? (
          <AnimatedSplash key="splash" />
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="h-screen w-screen"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;

