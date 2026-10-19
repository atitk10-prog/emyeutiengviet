import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { StudentLogin } from './pages/StudentLogin';
import { StudentLibrary } from './pages/StudentLibrary';
import { ReadingMission } from './pages/ReadingMission';
import { MissionCompleted } from './pages/MissionCompleted';
import { StudentReview } from './pages/StudentReview';
import { TeacherLogin } from './pages/TeacherLogin';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';

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
  return <>{children}</>;
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
  return <>{children}</>;
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
  return <>{children}</>;
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
