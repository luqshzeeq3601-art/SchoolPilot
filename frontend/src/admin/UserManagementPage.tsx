import React, { useState, useEffect, useMemo } from 'react';
import { api, UserItem, CreateUserPayload, UpdateUserPayload } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { TablePagination } from '../components/TablePagination';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  Briefcase,
  GraduationCap,
  Key,
  Edit2,
  UserX,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const DEPARTMENTS = [
  'General',
  'Administration',
  'Mathematics',
  'Science',
  'English Language',
  'Bahasa Melayu',
  'Humanities',
  'Information Technology',
  'Physical Education',
  'Arts & Music',
];

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<UserItem | null>(null);
  const [statusToggleUser, setStatusToggleUser] = useState<UserItem | null>(null);

  // Form states
  const [addForm, setAddForm] = useState<CreateUserPayload>({
    full_name: '',
    email: '',
    password: '',
    role: 'teacher',
    department: 'General',
  });
  const [editForm, setEditForm] = useState<UpdateUserPayload>({
    full_name: '',
    role: 'teacher',
    department: 'General',
  });
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = !roleFilter || u.role === roleFilter;
      const matchesDept = !deptFilter || u.department === deptFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'active' && u.is_active) ||
        (statusFilter === 'inactive' && !u.is_active);

      return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, deptFilter, statusFilter]);

  // Reset to page 1 whenever any filter or page size changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, deptFilter, statusFilter, pageSize]);

  // Pagination calculations
  const safePage = Math.min(page, Math.max(1, Math.ceil(filteredUsers.length / pageSize)));
  const start = (safePage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(start, start + pageSize);

  // Metrics
  const activeCount = users.filter((u) => u.is_active).length;
  const teacherCount = users.filter((u) => u.role === 'teacher').length;
  const hodCount = users.filter((u) => u.role === 'hod').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  // Handlers
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      const created = await api.createUser(addForm);
      showNotification(`Account for "${created.full_name}" created successfully.`);
      setIsAddModalOpen(false);
      setAddForm({
        full_name: '',
        email: '',
        password: '',
        role: 'teacher',
        department: 'General',
      });
      await fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create user account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpen = (userToEdit: UserItem) => {
    setEditingUser(userToEdit);
    setEditForm({
      full_name: userToEdit.full_name,
      role: userToEdit.role,
      department: userToEdit.department,
    });
    setModalError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const updated = await api.updateUser(editingUser.id, editForm);
      showNotification(`Account details for "${updated.full_name}" updated.`);
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusToggleUser) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const targetState = !statusToggleUser.is_active;
      await api.toggleUserStatus(statusToggleUser.id, targetState);
      showNotification(
        `Account for "${statusToggleUser.full_name}" ${targetState ? 'reactivated' : 'deactivated'}.`
      );
      setStatusToggleUser(null);
      await fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to change account status.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await api.resetUserPassword(passwordResetUser.id, newPassword);
      showNotification(`Password for "${passwordResetUser.full_name}" has been reset.`);
      setPasswordResetUser(null);
      setNewPassword('');
    } catch (err: any) {
      setModalError(err.message || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 xl:px-3 xl:py-1.5 rounded-full text-xs xl:text-[13px] font-semibold bg-[#F5EDE4] text-[#8C592B] border border-[#EADBCC]">
            <Shield className="h-3.5 w-3.5 xl:h-4 xl:w-4" /> Admin
          </span>
        );
      case 'hod':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 xl:px-3 xl:py-1.5 rounded-full text-xs xl:text-[13px] font-semibold bg-[#EAF3FE] text-[#2563EB] border border-[#BFDBFE]">
            <Briefcase className="h-3.5 w-3.5 xl:h-4 xl:w-4" /> HoD
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 xl:px-3 xl:py-1.5 rounded-full text-xs xl:text-[13px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <GraduationCap className="h-3.5 w-3.5 xl:h-4 xl:w-4" /> Teacher
          </span>
        );
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col bg-[#FAF8F5] p-4 pb-12 sm:p-6 sm:pb-12 lg:p-8 lg:pb-14 xl:p-10 xl:pb-16">
      <div className="mx-auto w-full max-w-7xl xl:max-w-[1560px] 2xl:max-w-[1720px]">
        {/* Header */}
        <div className="mb-6 xl:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl xl:text-[34px] font-extrabold tracking-tight text-[#101A2E]">
              Staff &amp; User Management
            </h1>
            <p className="mt-1.5 text-sm sm:text-base xl:text-[16px] text-slate-500">
              Create, update, and manage institutional accounts with role-based access control.
            </p>
          </div>

          <button
            onClick={() => {
              setModalError(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#8C592B] px-4 py-2.5 xl:px-5 xl:py-3 text-sm xl:text-base font-semibold text-white shadow-sm hover:bg-[#7A4C1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] transition-all"
          >
            <UserPlus className="h-4 w-4 xl:h-5 xl:w-5" />
            Add Staff Member
          </button>
        </div>

        {/* Success / Error alerts */}
        {successMessage && (
          <div className="mb-5 xl:mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 xl:px-5 xl:py-3.5 text-sm xl:text-base text-emerald-800 shadow-2xs">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-5 xl:mb-6 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 xl:px-5 xl:py-3.5 text-sm xl:text-base text-rose-800 shadow-2xs">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Stat Cards */}
        <div className="mb-6 xl:mb-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:gap-4 xl:gap-6">
          <div className="rounded-2xl border border-[#ECE7DC] bg-white p-4 sm:p-5 xl:p-6 shadow-2xs hover:border-[#D7BA9C] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-[13px] xl:text-sm font-bold uppercase tracking-wider text-slate-500">Total Staff</span>
              <Users className="h-4 w-4 xl:h-5 xl:w-5 text-[#8C592B]" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl xl:text-4xl font-extrabold text-[#101A2E]">{users.length}</p>
            <p className="mt-1 text-xs sm:text-sm xl:text-[15px] text-slate-500 font-medium">{activeCount} active</p>
          </div>

          <div className="rounded-2xl border border-[#ECE7DC] bg-white p-4 sm:p-5 xl:p-6 shadow-2xs hover:border-[#D7BA9C] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-[13px] xl:text-sm font-bold uppercase tracking-wider text-slate-500">Teachers</span>
              <GraduationCap className="h-4 w-4 xl:h-5 xl:w-5 text-slate-600" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl xl:text-4xl font-extrabold text-[#101A2E]">{teacherCount}</p>
            <p className="mt-1 text-xs sm:text-sm xl:text-[15px] text-slate-500 font-medium">Academic staff</p>
          </div>

          <div className="rounded-2xl border border-[#ECE7DC] bg-white p-4 sm:p-5 xl:p-6 shadow-2xs hover:border-[#D7BA9C] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-[13px] xl:text-sm font-bold uppercase tracking-wider text-slate-500">Heads of Dept</span>
              <Briefcase className="h-4 w-4 xl:h-5 xl:w-5 text-[#2563EB]" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl xl:text-4xl font-extrabold text-[#101A2E]">{hodCount}</p>
            <p className="mt-1 text-xs sm:text-sm xl:text-[15px] text-slate-500 font-medium">Department approvers</p>
          </div>

          <div className="rounded-2xl border border-[#ECE7DC] bg-white p-4 sm:p-5 xl:p-6 shadow-2xs hover:border-[#D7BA9C] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-[13px] xl:text-sm font-bold uppercase tracking-wider text-slate-500">Administrators</span>
              <Shield className="h-4 w-4 xl:h-5 xl:w-5 text-[#8C592B]" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl xl:text-4xl font-extrabold text-[#101A2E]">{adminCount}</p>
            <p className="mt-1 text-xs sm:text-sm xl:text-[15px] text-slate-500 font-medium">Full system access</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mb-6 xl:mb-7 rounded-2xl border border-[#ECE7DC] bg-[#FAF8F5] p-4 xl:p-5 shadow-2xs">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 xl:h-4.5 xl:w-4.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#E7E2DC] bg-white py-2.5 pl-10 pr-3.5 xl:py-3 xl:pl-11 xl:pr-4 text-sm xl:text-base text-[#101A2E] placeholder-slate-400 focus:border-[#8C592B] focus:outline-none focus:ring-1 focus:ring-[#8C592B] transition-all"
              />
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full rounded-xl border border-[#E7E2DC] bg-white px-3.5 py-2.5 xl:px-4 xl:py-3 text-sm xl:text-base text-[#101A2E] focus:border-[#8C592B] focus:outline-none focus:ring-1 focus:ring-[#8C592B] transition-all"
              >
                <option value="">All Roles</option>
                <option value="teacher">Teachers</option>
                <option value="hod">Heads of Department (HoD)</option>
                <option value="admin">Administrators</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full rounded-xl border border-[#E7E2DC] bg-white px-3.5 py-2.5 xl:px-4 xl:py-3 text-sm xl:text-base text-[#101A2E] focus:border-[#8C592B] focus:outline-none focus:ring-1 focus:ring-[#8C592B] transition-all"
              >
                <option value="">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-[#E7E2DC] bg-white px-3.5 py-2.5 xl:px-4 xl:py-3 text-sm xl:text-base text-[#101A2E] focus:border-[#8C592B] focus:outline-none focus:ring-1 focus:ring-[#8C592B] transition-all"
              >
                <option value="">All Statuses</option>
                <option value="active">Active Accounts</option>
                <option value="inactive">Inactive / Deactivated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-hidden rounded-2xl border border-[#ECE7DC] bg-white shadow-2xs">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#8C592B]" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-base xl:text-lg font-semibold text-[#101A2E]">No user accounts found</p>
              <p className="mt-1 text-sm xl:text-base text-slate-500">
                Try adjusting your search query or filter criteria.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm xl:text-[15px] text-[#101A2E]">
                  <thead className="border-b border-[#ECE7DC] bg-[#FAF8F5] text-xs xl:text-sm font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th scope="col" className="px-6 py-4 xl:px-8 xl:py-5">Staff Member</th>
                      <th scope="col" className="px-6 py-4 xl:px-8 xl:py-5">Role</th>
                      <th scope="col" className="px-6 py-4 xl:px-8 xl:py-5">Department</th>
                      <th scope="col" className="px-6 py-4 xl:px-8 xl:py-5">Status</th>
                      <th scope="col" className="px-6 py-4 xl:px-8 xl:py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE7DC]">
                    {paginatedUsers.map((u) => {
                      const initials = u.full_name
                        .split(' ')
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() || 'U';
                      const isSelf = currentUser?.id === u.id;

                      return (
                        <tr key={u.id} className="hover:bg-[#FCFAF7] transition-colors">
                          <td className="px-6 py-4 xl:px-8 xl:py-4.5">
                            <div className="flex items-center gap-3.5">
                              <div className="flex h-10 w-10 xl:h-11 xl:w-11 shrink-0 items-center justify-center rounded-full bg-[#F5EDE4] text-xs xl:text-sm font-bold text-[#8C592B] border border-[#EADBCC] shadow-2xs">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-[#101A2E] text-sm xl:text-[15.5px] truncate">{u.full_name}</p>
                                  {isSelf && (
                                    <span className="rounded-md bg-[#F5EDE4] text-[#8C592B] border border-[#EADBCC] px-2 py-0.5 text-[10px] xl:text-xs font-bold">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs xl:text-sm text-slate-500 truncate mt-0.5">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 xl:px-8 xl:py-4.5 whitespace-nowrap">{getRoleBadge(u.role)}</td>

                          <td className="px-6 py-4 xl:px-8 xl:py-4.5 whitespace-nowrap text-slate-700 font-medium text-sm xl:text-[15px]">
                            {u.department}
                          </td>

                          <td className="px-6 py-4 xl:px-8 xl:py-4.5 whitespace-nowrap">
                            {u.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 xl:px-3 xl:py-1.5 rounded-full text-xs xl:text-[13px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="h-1.5 w-1.5 xl:h-2 xl:w-2 rounded-full bg-emerald-500" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 xl:px-3 xl:py-1.5 rounded-full text-xs xl:text-[13px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="h-1.5 w-1.5 xl:h-2 xl:w-2 rounded-full bg-rose-500" /> Inactive
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 xl:px-8 xl:py-4.5 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1.5 xl:gap-2">
                              {/* Edit Button */}
                              <button
                                onClick={() => handleEditOpen(u)}
                                title="Edit user details"
                                className="rounded-lg p-1.5 xl:p-2 text-slate-500 hover:bg-[#F5EDE4] hover:text-[#8C592B] transition-colors"
                              >
                                <Edit2 className="h-4 w-4 xl:h-4.5 xl:w-4.5" />
                              </button>

                              {/* Reset Password Button */}
                              <button
                                onClick={() => {
                                  setPasswordResetUser(u);
                                  setNewPassword('');
                                  setModalError(null);
                                }}
                                title="Reset user password"
                                className="rounded-lg p-1.5 xl:p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                              >
                                <Key className="h-4 w-4 xl:h-4.5 xl:w-4.5" />
                              </button>

                              {/* Deactivate / Reactivate Toggle */}
                              <button
                                onClick={() => {
                                  setStatusToggleUser(u);
                                  setModalError(null);
                                }}
                                disabled={isSelf}
                                title={
                                  isSelf
                                    ? 'You cannot deactivate your own account'
                                    : u.is_active
                                    ? 'Deactivate account'
                                    : 'Reactivate account'
                                }
                                className={`rounded-lg p-1.5 xl:p-2 transition-colors ${
                                  isSelf
                                    ? 'opacity-30 cursor-not-allowed text-slate-300'
                                    : u.is_active
                                    ? 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                                    : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                                }`}
                              >
                                {u.is_active ? <UserX className="h-4 w-4 xl:h-4.5 xl:w-4.5" /> : <UserCheck className="h-4 w-4 xl:h-4.5 xl:w-4.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer with Clickable Pagination Controls */}
              <TablePagination
                totalItems={filteredUsers.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="staff members"
              />
            </>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[#ECE7DC]">
            <div className="flex items-center justify-between pb-4 border-b border-[#ECE7DC]">
              <h2 className="text-lg font-bold text-[#101A2E]">Register New Staff Member</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cikgu Siti Nurhaliza"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  className="w-full rounded-xl border border-[#E7E2DC] px-3 py-2 text-sm focus:border-[#8C592B] focus:ring-1 focus:ring-[#8C592B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. siti@school.edu.my"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full rounded-xl border border-[#E7E2DC] px-3 py-2 text-sm focus:border-[#8C592B] focus:ring-1 focus:ring-[#8C592B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Initial Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full rounded-xl border border-[#E7E2DC] px-3 py-2 pr-10 text-sm focus:border-[#8C592B] focus:ring-1 focus:ring-[#8C592B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Role
                  </label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value as any })}
                    className="w-full rounded-xl border border-[#E7E2DC] px-3 py-2 text-sm focus:border-[#8C592B] focus:ring-1 focus:ring-[#8C592B]"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="hod">Head of Dept (HoD)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={addForm.department}
                    onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                    className="w-full rounded-xl border border-[#E7E2DC] px-3 py-2 text-sm focus:border-[#8C592B] focus:ring-1 focus:ring-[#8C592B]"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-[#ECE7DC]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#8C592B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7A4C1E] disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[#ECE7DC]">
            <div className="flex items-center justify-between pb-4 border-b border-[#ECE7DC]">
              <h2 className="text-lg font-bold text-[#101A2E]">Edit Staff Details</h2>
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email (Read-only)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingUser.email}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full rounded-xl border border-[#E7E2DC] px-3 py-2 text-sm focus:border-[#8C592B] focus:ring-1 focus:ring-[#8C592B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    disabled={currentUser?.id === editingUser.id}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                    className={`w-full rounded-xl border border-[#E7E2DC] px-3 py-2 text-sm focus:border-[#8C592B] focus:ring-1 focus:ring-[#8C592B] ${
                      currentUser?.id === editingUser.id ? 'bg-slate-50 opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="teacher">Teacher</option>
                    <option value="hod">Head of Dept (HoD)</option>
                    <option value="admin">Administrator</option>
                  </select>
                  {currentUser?.id === editingUser.id && (
                    <p className="mt-1 text-[11px] text-slate-400">You cannot demote your own admin role.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full rounded-xl border border-[#E7E2DC] px-3 py-2 text-sm focus:border-[#8C592B] focus:ring-1 focus:ring-[#8C592B]"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-[#ECE7DC]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#8C592B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7A4C1E] disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#ECE7DC]">
            <div className="flex items-center justify-between pb-4 border-b border-[#ECE7DC]">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-bold text-[#101A2E]">Reset Password</h2>
              </div>
              <button
                onClick={() => setPasswordResetUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-600">
              Set a new password for <span className="font-semibold text-[#101A2E]">{passwordResetUser.full_name}</span> ({passwordResetUser.email}).
            </p>

            {modalError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E2DC] px-3 py-2 pr-10 text-sm focus:border-[#8C592B] focus:ring-1 focus:ring-[#8C592B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={generateRandomPassword}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C592B] hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Generate secure password
              </button>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-[#ECE7DC]">
                <button
                  type="button"
                  onClick={() => setPasswordResetUser(null)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate / Reactivate Confirmation Dialog */}
      {statusToggleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#ECE7DC]">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  statusToggleUser.is_active ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {statusToggleUser.is_active ? <UserX className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-[#101A2E]">
                  {statusToggleUser.is_active ? 'Deactivate Staff Account?' : 'Reactivate Staff Account?'}
                </h2>
                <p className="text-xs text-slate-500">{statusToggleUser.email}</p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {statusToggleUser.is_active ? (
                <>
                  Deactivating <span className="font-semibold text-[#101A2E]">{statusToggleUser.full_name}</span> will prevent them from signing in. All existing leave requests, departmental approvals, and audit records will remain completely intact.
                </>
              ) : (
                <>
                  Reactivating <span className="font-semibold text-[#101A2E]">{statusToggleUser.full_name}</span> will restore their login access and allow them to resume work immediately.
                </>
              )}
            </p>

            {modalError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {modalError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatusToggleUser(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleToggleStatus}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  statusToggleUser.is_active
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {statusToggleUser.is_active ? 'Yes, Deactivate' : 'Yes, Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
