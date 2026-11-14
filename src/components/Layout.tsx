import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen,
  FileText,
  Settings,
  LogOut,
  GraduationCap,
  Bookmark,
  Menu,
  ChevronLeft,
  Users,
} from 'lucide-react';

export function Layout() {
  const { profile, logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    { path: '/subjects', icon: Bookmark, label: 'Disciplinas' },
    { path: '/questions', icon: BookOpen, label: 'Banco de Questões' },
    { path: '/exams', icon: FileText, label: 'Provas' },
  ];

  if (profile?.role === 'coordinator') {
    menuItems.push({ path: '/users', icon: Users, label: 'Usuários' });
    menuItems.push({ path: '/settings', icon: Settings, label: 'Configurações' });
  }

  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`p-4 flex items-center h-20 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'hidden' : 'flex'}`}>
            <div className="bg-[#f68a39] p-2 rounded-lg text-white shrink-0">
              <GraduationCap size={24} />
            </div>
            <span className="text-xl font-bold text-slate-800 whitespace-nowrap">SisProvaEPM</span>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0 transition-colors"
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center px-3 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                } ${isCollapsed ? 'justify-center' : 'gap-3'}`}
              >
                <item.icon size={20} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          {!isCollapsed && (
            <div className="px-3 py-2 mb-2 overflow-hidden">
              <p className="text-sm font-medium text-slate-800 truncate">{profile?.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {profile?.role === 'coordinator' ? 'Coordenador' : 'Professor'}
              </p>
            </div>
          )}
          <button
            onClick={logout}
            title={isCollapsed ? 'Sair' : undefined}
            className={`flex items-center px-3 py-3 w-full text-slate-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'gap-3 text-left'}`}
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
