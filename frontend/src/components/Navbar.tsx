import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  BookOpen,
  MessageSquare,
  CalendarCheck,
  LayoutGrid,
  Users,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const navItemClass = (active: boolean) =>
    `inline-flex items-center gap-2 px-4 xl:px-5 py-2 xl:py-2.5 rounded-xl text-xs sm:text-sm xl:text-[15px] font-semibold transition-all duration-150 ${
      active
        ? 'bg-[#F5EDE4] text-[#8C592B] shadow-2xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-[#FAF8F5]'
    }`;

  const initials = user.full_name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AR';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E7E2DC] bg-white">
      <div className="mx-auto max-w-7xl xl:max-w-[1560px] 2xl:max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex h-16 xl:h-[68px] items-center justify-between gap-4">
          {/* Left: Brand + Navigation Tabs */}
          <div className="flex items-center gap-6 lg:gap-8">
            <Link
              to="/"
              className="flex items-center gap-2.5 xl:gap-3 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] rounded-xl"
              aria-label="SchoolPilot"
            >
              <div className="flex h-9 w-9 xl:h-10 xl:w-10 items-center justify-center rounded-xl bg-[#8C592B] text-white shadow-2xs">
                <BookOpen className="h-5 w-5 xl:h-5.5 xl:w-5.5 stroke-[1.8]" />
              </div>
              <span className="text-lg xl:text-xl font-bold tracking-tight text-[#101A2E]">
                SchoolPilot
              </span>
            </Link>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex md:items-center md:gap-2 xl:gap-2.5" aria-label="Primary navigation">
              <Link to="/" className={navItemClass(isActive('/'))}>
                <MessageSquare className="h-4 w-4 xl:h-4.5 xl:w-4.5" />
                <span>Policy Q&A</span>
              </Link>
              <Link to="/leaves" className={navItemClass(isActive('/leaves'))}>
                <CalendarCheck className="h-4 w-4 xl:h-4.5 xl:w-4.5" />
                <span>Leave Requests</span>
              </Link>
              {user.role === 'admin' && (
                <>
                  <Link to="/admin" className={navItemClass(isActive('/admin'))}>
                    <LayoutGrid className="h-4 w-4 xl:h-4.5 xl:w-4.5" />
                    <span>Admin</span>
                  </Link>
                  <Link to="/admin/users" className={navItemClass(isActive('/admin/users'))}>
                    <Users className="h-4 w-4 xl:h-4.5 xl:w-4.5" />
                    <span>Staff</span>
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Right: User Profile & Logout (Desktop) */}
          <div className="hidden md:flex items-center gap-3 xl:gap-4">
            <div className="text-right">
              <p className="text-xs sm:text-sm xl:text-[15px] font-bold leading-tight text-[#101A2E]">
                {user.full_name}
              </p>
              <p className="text-[11px] xl:text-xs text-slate-500 leading-tight mt-0.5 font-normal">
                {user.department || 'Academic Staff'}
              </p>
            </div>

            <div className="flex h-9 w-9 xl:h-10 xl:w-10 items-center justify-center rounded-full bg-[#F5EDE4] text-xs xl:text-sm font-bold text-[#8C592B] border border-[#EADBCC]">
              {initials}
            </div>

            <button
              onClick={logout}
              title="Logout"
              aria-label="Logout"
              className="ml-1 inline-flex items-center gap-1.5 rounded-xl border border-[#E7E2DC] bg-[#FAF8F5] px-3.5 xl:px-4 py-2 text-xs xl:text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] cursor-pointer shadow-2xs"
            >
              <LogOut className="h-3.5 w-3.5 xl:h-4 xl:w-4 stroke-[1.8]" />
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-[#E7E2DC] bg-white px-4 pt-3 pb-4 md:hidden">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5EDE4] text-xs font-bold text-[#8C592B]">
                {initials}
              </div>
              <div>
                <p className="text-xs font-bold text-[#101A2E]">{user.full_name}</p>
                <p className="text-[11px] text-slate-600 font-medium">
                  {user.department || 'Sekolah Kebangsaan Taman Ilmu'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-[#E7E2DC] bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5 stroke-[1.9]" />
              <span>Sign Out</span>
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            <Link to="/" className={navItemClass(isActive('/'))}>
              <MessageSquare className="h-4.5 w-4.5" />
              <span>Policy Q&A</span>
            </Link>
            <Link to="/leaves" className={navItemClass(isActive('/leaves'))}>
              <CalendarCheck className="h-4.5 w-4.5" />
              <span>Leave Requests</span>
            </Link>
            {user.role === 'admin' && (
              <>
                <Link to="/admin" className={navItemClass(isActive('/admin'))}>
                  <LayoutGrid className="h-4.5 w-4.5" />
                  <span>Admin</span>
                </Link>
                <Link to="/admin/users" className={navItemClass(isActive('/admin/users'))}>
                  <Users className="h-4.5 w-4.5" />
                  <span>Staff</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
