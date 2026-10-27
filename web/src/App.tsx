import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { StudentLogin } from './pages/StudentLogin';
import { TeacherLogin } from './pages/TeacherLogin';
import { AdminLogin } from './pages/AdminLogin';

// Lazy load large role dashboards and interactive mission pages
const TeacherDashboard = lazy(() =>
  import('./pages/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard }))
);
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const StudentLibrary = lazy(() =>
  import('./pages/StudentLibrary').then((m) => ({ default: m.StudentLibrary }))
);
const ReadingMission = lazy(() =>
  import('./pages/ReadingMission').then((m) => ({ default: m.ReadingMission }))
);
const MissionCompleted = lazy(() =>
  import('./pages/MissionCompleted').then((m) => ({ default: m.MissionCompleted }))
);
const StudentReview = lazy(() =>
  import('./pages/StudentReview').then((m) => ({ default: m.StudentReview }))
);

const PageFallback: React.FC<{ text?: string }> = ({ text = 'Đang tải giao diện...' }) => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-slate-500">
    <div className="w-9 h-9 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-3" />
    <span className="text-xs font-bold text-slate-600 tracking-wide">{text}</span>
  </div>
);

// Guard for admin routes
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">
        Đang xác thực quyền Quản trị viên...
      </div>
    );
  }
  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  return <Suspense fallback={<PageFallback text="Đang mở Bảng Quản trị..." />}>{children}</Suspense>;
};

// Guard for teacher routes
const TeacherRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isTeacher, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">
        Đang xác thực quyền giáo viên...
      </div>
    );
  }
  if (!user || !isTeacher) {
    return <Navigate to="/teacher/login" replace />;
  }
  return <Suspense fallback={<PageFallback text="Đang mở Bảng Giáo viên..." />}>{children}</Suspense>;
};

// Guard for student routes
const StudentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { studentSession, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">
        Đang mở góc học tập...
      </div>
    );
  }
  if (!studentSession) {
    return <Navigate to="/student/join" replace />;
  }
  return <Suspense fallback={<PageFallback text="Đang mở phòng học..." />}>{children}</Suspense>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50/50">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/student/join" element={<StudentLogin />} />
              <Route path="/teacher/login" element={<TeacherLogin />} />

              {/* Protected Student Routes */}
              <Route
                path="/student/library"
                element={
                  <StudentRoute>
                    <StudentLibrary />
                  </StudentRoute>
                }
              />
              <Route
                path="/student/mission/:assignmentId"
                element={
                  <StudentRoute>
                    <ReadingMission />
                  </StudentRoute>
                }
              />
              <Route
                path="/student/completed/:attemptId"
                element={
                  <StudentRoute>
                    <MissionCompleted />
                  </StudentRoute>
                }
              />
              <Route
                path="/student/review/:attemptId"
                element={
                  <StudentRoute>
                    <StudentReview />
                  </StudentRoute>
                }
              />

              {/* Protected Teacher Routes */}
              <Route
                path="/teacher/dashboard"
                element={
                  <TeacherRoute>
                    <TeacherDashboard />
                  </TeacherRoute>
                }
              />

              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin/dashboard"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
