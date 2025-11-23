import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    BookOpen,
    ClipboardList,
    GraduationCap,
    Menu,
    X,
    Flame
} from 'lucide-react';
import { useState, useEffect } from 'react';
import ProfileDropdown from '../components/ProfileDropdown';

export default function DashboardLayout({ children }) {
    const { currentUser, logout, userRole } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile screen size
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            // Auto-open sidebar on desktop, closed on mobile
            setSidebarOpen(!mobile);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const teacherMenuItems = [
        { path: '/teacher', icon: LayoutDashboard, label: 'Overview' },
        { path: '/teacher/classes', icon: Users, label: 'Classes' },
        { path: '/teacher/students', icon: GraduationCap, label: 'Students' },
        { path: '/teacher/tasks', icon: BookOpen, label: 'Tasks' },
        { path: '/teacher/gradebook', icon: ClipboardList, label: 'Gradebook' },
    ];

    const studentMenuItems = [
        { path: '/student', icon: LayoutDashboard, label: 'Overview' },
        { path: '/student/tasks', icon: BookOpen, label: 'My Tasks' },
        { path: '/student/grades', icon: ClipboardList, label: 'My Grades' },
    ];

    const menuItems = userRole === 'teacher' ? teacherMenuItems : studentMenuItems;

    // Close sidebar on navigation (mobile only)
    const handleNavClick = () => {
        if (isMobile) {
            setSidebarOpen(false);
        }
    };

    return (
        <div className="flex h-screen bg-sky-50 overflow-hidden">
            {/* Overlay for mobile */}
            <AnimatePresence>
                {sidebarOpen && isMobile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    x: sidebarOpen ? 0 : -300
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed left-0 top-0 h-full bg-white border-r border-blue-100 text-slate-600 w-64 shadow-2xl flex flex-col z-50`}
            >
                <div className="p-6 flex-1 overflow-y-auto">
                    {/* App Branding */}
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            {/* Firebase Icon */}
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-lg flex items-center justify-center shadow-md">
                                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3.89 15.672L6.255.461A.542.542 0 017.27.288l2.543 4.771zm16.794 3.692l-2.25-14a.54.54 0 00-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 001.588 0zM14.3 7.147l-1.82-3.482a.542.542 0 00-.96 0L3.53 17.984z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h1 className="text-xl font-bold text-slate-800 leading-tight">
                                    ICT Codehub
                                </h1>
                                <p className="text-xs text-slate-500 font-medium">
                                    Student Task Management
                                </p>
                            </div>
                        </div>
                        {/* Role Badge - More subtle */}
                        <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-200">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="font-light">
                                {userRole === 'teacher' ? 'Teacher Dashboard' : 'Student Dashboard'}
                            </span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-200 mb-6"></div>

                    <nav className="space-y-2">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/teacher' || item.path === '/student'}
                                onClick={handleNavClick}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                        ? 'bg-blue-50 text-blue-600 shadow-sm font-semibold'
                                        : 'text-slate-500 hover:bg-blue-50/50 hover:text-blue-700'
                                    }`
                                }
                            >
                                <item.icon className="h-5 w-5" />
                                <span className="font-medium">{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                {/* Credits Section */}
                <div className="px-3 py-2 border-t border-slate-100">
                    <div className="text-center space-y-0.5">
                        <p className="text-xs text-slate-400 font-light leading-tight flex items-center justify-center gap-1">
                            Made with <Flame className="h-3 w-3 text-orange-500 fill-orange-500 animate-pulse" /> by <span className="font-normal text-slate-500">Mr. Tio</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-light leading-tight">
                            Powered by Google Antigravity & Firebase
                        </p>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <div
                className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen && !isMobile ? 'lg:ml-64' : 'ml-0'
                    }`}
            >
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-slate-600"
                        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                    >
                        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>

                    <ProfileDropdown currentUser={currentUser} logout={logout} />
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {children || <Outlet />}
                </main>
            </div>
        </div>
    );
}
