import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { LoginPage } from './auth/LoginPage';
import { ChatPage } from './chat/ChatPage';
import { LeaveListPage } from './leave/LeaveListPage';
import { UploadPage } from './documents/UploadPage';
import { DashboardPage } from './admin/DashboardPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="h-screen bg-white text-[#101A2E] flex flex-col antialiased overflow-hidden selection:bg-[#F5EDE4] selection:text-[#8C592B]">
          <Navbar />
          <main id="main-content" className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/leaves"
                element={
                  <ProtectedRoute>
                    <LeaveListPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/documents"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UploadPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
