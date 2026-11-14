/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Subjects } from './pages/Subjects';
import { Questions } from './pages/Questions';
import { Exams } from './pages/Exams';
import { NewExam } from './pages/NewExam';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Carregando...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/exams" replace />} />
        <Route path="subjects" element={<Subjects />} />
        <Route path="questions" element={<Questions />} />
        <Route path="exams" element={<Exams />} />
        <Route path="exams/new" element={<NewExam />} />
        <Route path="exams/edit/:id" element={<NewExam />} />
        <Route 
          path="users" 
          element={
            <ProtectedRoute allowedRoles={['coordinator']}>
              <Users />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="settings" 
          element={
            <ProtectedRoute allowedRoles={['coordinator']}>
              <Settings />
            </ProtectedRoute>
          } 
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
