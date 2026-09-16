import React, { useState, useEffect } from 'react';
import { api, LeaveRecord, LeaveSummary, UserProfile } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  X,
  Loader2,
  Search,
  Inbox,
  CalendarDays,
  Calendar,
  Siren,
  Activity,
  Clock,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Eye,
  Info,
} from 'lucide-react';

export const LeaveListPage: React.FC = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reviewer rejection modal state
  const [rejectingLeave, setRejectingLeave] = useState<LeaveRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Teacher CRUD Modal states
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRecord | null>(null);
  const [resubmittingLeave, setResubmittingLeave] = useState<LeaveRecord | null>(null);
  const [viewingLeave, setViewingLeave] = useState<LeaveRecord | null>(null);
  const [deletingLeave, setDeletingLeave] = useState<LeaveRecord | null>(null);

  // Form State for Create / Edit / Resubmit
  const todayStr = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    leave_type: 'emergency',
    start_date: todayStr,
    end_date: todayStr,
    reason: '',
    covering_teacher: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchLeavesAndSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const [leavesData, summaryData] = await Promise.all([
        api.getLeaves(),
        api.getLeaveSummary().catch(() => null),
      ]);
      setLeaves(leavesData);
      if (summaryData) {
        setSummary(summaryData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeavesAndSummary();
    const fetchStaff = async () => {
      try {
        const staff = await api.getStaff();
        setStaffList(staff);
      } catch {
        // Fallback silently
      }
    };
    fetchStaff();
  }, []);

  // Handle ESC key to close all modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllModals();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeAllModals = () => {
    setIsApplyModalOpen(false);
    setEditingLeave(null);
    setResubmittingLeave(null);
    setViewingLeave(null);
    setDeletingLeave(null);
    setRejectingLeave(null);
    setReviewNotes('');
    setFormError(null);
  };

  const handleOpenCreate = () => {
    setFormData({
      leave_type: 'emergency',
      start_date: todayStr,
      end_date: todayStr,
      reason: '',
      covering_teacher: '',
    });
    setFormError(null);
    setIsApplyModalOpen(true);
  };

  const handleOpenEdit = (lr: LeaveRecord) => {
    setEditingLeave(lr);
    setFormData({
      leave_type: lr.leave_type || 'emergency',
      start_date: lr.start_date || todayStr,
      end_date: lr.end_date || todayStr,
      reason: lr.reason || '',
      covering_teacher: lr.covering_teacher || '',
    });
    setFormError(null);
  };

  const handleOpenResubmit = (lr: LeaveRecord) => {
    setResubmittingLeave(lr);
    setFormData({
      leave_type: lr.leave_type || 'emergency',
      start_date: lr.start_date || todayStr,
      end_date: lr.end_date || todayStr,
      reason: lr.reason || '',
      covering_teacher: lr.covering_teacher || '',
    });
    setFormError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }

    if (formData.reason.trim().length < 5) {
      setFormError('Please provide a specific reason (at least 5 characters).');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingLeave) {
        await api.updateLeave(editingLeave.id, {
          leave_type: formData.leave_type,
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason.trim(),
          covering_teacher: formData.covering_teacher.trim() || undefined,
        });
      } else if (resubmittingLeave) {
        await api.updateLeave(resubmittingLeave.id, {
          leave_type: formData.leave_type,
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason.trim(),
          covering_teacher: formData.covering_teacher.trim() || undefined,
        });
      } else {
        await api.submitLeave({
          leave_type: formData.leave_type,
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason.trim(),
          covering_teacher: formData.covering_teacher.trim() || undefined,
        });
      }
      closeAllModals();
      await fetchLeavesAndSummary();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingLeave) return;
    setActionLoading(true);
    try {
      await api.deleteLeave(deletingLeave.id);
      setDeletingLeave(null);
      await fetchLeavesAndSummary();
    } catch (err: any) {
      alert(err.message || 'Failed to withdraw leave application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await api.approveLeave(id, 'Approved. Relief work confirmed.');
      await fetchLeavesAndSummary();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingLeave || !reviewNotes.trim()) return;

    setActionLoading(true);
    try {
      await api.rejectLeave(rejectingLeave.id, reviewNotes.trim());
      setRejectingLeave(null);
      setReviewNotes('');
      await fetchLeavesAndSummary();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const isReviewer = user?.role === 'admin' || user?.role === 'hod';

  // Live count calculations
  const counts = {
    all: leaves.length,
    pending: leaves.filter((l) => l.status === 'pending').length,
    approved: leaves.filter((l) => l.status === 'approved').length,
    rejected: leaves.filter((l) => l.status === 'rejected').length,
  };

  // Instant client-side search & status filtering
  const filteredLeaves = leaves.filter((lr) => {
    const matchesStatus = !statusFilter || lr.status === statusFilter;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesStatus;

    const matchesSearch =
      (lr.teacher_name && lr.teacher_name.toLowerCase().includes(query)) ||
      (lr.teacher_department && lr.teacher_department.toLowerCase().includes(query)) ||
      (lr.reason && lr.reason.toLowerCase().includes(query)) ||
      (lr.covering_teacher && lr.covering_teacher.toLowerCase().includes(query)) ||
      (lr.leave_type && lr.leave_type.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  const filterTabs = [
    { id: '', label: 'All Requests', count: counts.all },
    { id: 'pending', label: 'Pending', count: counts.pending, alert: counts.pending > 0 },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'rejected', label: 'Rejected', count: counts.rejected },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          label: 'Approved',
          classes: 'bg-[#DCFCE7] text-[#15803D]',
          icon: CheckCircle2,
        };
      case 'rejected':
        return {
          label: 'Rejected',
          classes: 'bg-[#FFE4E6] text-[#BE123C]',
          icon: XCircle,
        };
      case 'pending':
      default:
        return {
          label: 'Pending',
          classes: 'bg-[#FEF3C7] text-[#B45309]',
          icon: Clock,
        };
    }
  };

  const getCategoryBadge = (type: string) => {
    const raw = (type || '').trim();
    const t = raw.toLowerCase();

    const formatLabel = (defaultText: string) => {
      if (!raw) return defaultText;
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    };

    if (t.includes('emergency') || t.includes('kecemasan')) {
      return {
        label: formatLabel('Emergency'),
        classes: 'bg-[#FFF1F2] text-[#E11D48] border border-[#FFE4E6]/80',
        icon: Siren,
      };
    }
    if (t.includes('medical') || t.includes('mc') || t.includes('sick') || t.includes('sakit')) {
      return {
        label: formatLabel('Medical'),
        classes: 'bg-[#F0F9FF] text-[#0284C7] border border-[#E0F2FE]',
        icon: Activity,
      };
    }
    if (t.includes('annual') || t.includes('rehat') || t.includes('cuti')) {
      return {
        label: formatLabel('Annual Leave'),
        classes: 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]',
        icon: Calendar,
      };
    }
    if (t.includes('unpaid') || t.includes('tanpa')) {
      return {
        label: formatLabel('Unpaid Leave'),
        classes: 'bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7]',
        icon: Clock,
      };
    }
    return {
      label: formatLabel('General'),
      classes: 'bg-slate-100 text-slate-700 border border-slate-200',
      icon: FileText,
    };
  };

  const getDurationText = (start: string, end: string) => {
    try {
      const s = new Date(start);
      const e = new Date(end);
      const diffTime = e.getTime() - s.getTime();
      const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (isNaN(days) || days <= 0) return '1 day';
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    } catch {
      return '1 day';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-full bg-[#FAF8F5] px-4 py-5 pb-6 sm:px-6 lg:px-8 xl:px-12">
      <div className="mx-auto max-w-7xl xl:max-w-[1560px] 2xl:max-w-[1680px] w-full">
        {/* Page Header */}
        <div className="relative mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F7F3EE] text-[#8C592B] border border-[#EADBCC] shadow-2xs">
              <CalendarDays className="h-6 w-6 stroke-[1.8]" />
            </div>
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#101A2E] leading-tight">
                {isReviewer ? 'Staff Leave Requests' : 'My Leave Requests'}
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-normal">
                {isReviewer
                  ? 'Review staff applications and confirm departmental relief coverage.'
                  : 'Submit and manage leave applications, track approval status, and check entitlements.'}
              </p>
            </div>
          </div>

          {/* Action Buttons & Script Watermark */}
          <div className="flex items-center gap-4">
            <div className="hidden xl:block select-none pointer-events-none pr-2">
              <span className="font-script text-2xl text-[#C9AA8B]/80 font-medium tracking-wide rotate-[-3deg] inline-block">
                People Make Tomorrow
              </span>
            </div>

            {/* Apply For Leave Button */}
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-[#8C592B] hover:bg-[#73461E] text-white px-4 py-2 text-xs sm:text-sm font-semibold shadow-2xs transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] shrink-0"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Apply for Leave</span>
            </button>
          </div>
        </div>

        {/* Leave Entitlement & Balance Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 xl:gap-4 mb-4 xl:mb-5">
            {/* Annual Leave Card */}
            <div className="rounded-xl border border-[#E7E2DC] bg-white p-3.5 xl:p-4 shadow-2xs flex items-center gap-3.5">
              <div className="flex h-10 w-10 xl:h-11 xl:w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]">
                <Calendar className="h-5 w-5 xl:h-5.5 xl:w-5.5 stroke-[1.8]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs xl:text-[13px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                  Annual Leave
                </p>
                <p className="text-base xl:text-lg font-bold text-[#101A2E] tabular-nums mt-0.5">
                  {summary.annual_used} / {summary.annual_total}{' '}
                  <span className="text-xs xl:text-sm font-normal text-slate-400">used</span>
                </p>
                <p className="text-xs xl:text-[13px] text-emerald-600 font-medium truncate mt-0.5">
                  {Math.max(0, summary.annual_total - summary.annual_used)} days remaining
                </p>
              </div>
            </div>

            {/* Medical Leave Card */}
            <div className="rounded-xl border border-[#E7E2DC] bg-white p-3.5 xl:p-4 shadow-2xs flex items-center gap-3.5">
              <div className="flex h-10 w-10 xl:h-11 xl:w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0F9FF] text-[#0284C7] border border-[#E0F2FE]">
                <Activity className="h-5 w-5 xl:h-5.5 xl:w-5.5 stroke-[1.8]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs xl:text-[13px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                  Medical (MC)
                </p>
                <p className="text-base xl:text-lg font-bold text-[#101A2E] tabular-nums mt-0.5">
                  {summary.medical_used} / {summary.medical_total}{' '}
                  <span className="text-xs xl:text-sm font-normal text-slate-400">used</span>
                </p>
                <p className="text-xs xl:text-[13px] text-sky-600 font-medium truncate mt-0.5">
                  {Math.max(0, summary.medical_total - summary.medical_used)} days remaining
                </p>
              </div>
            </div>

            {/* Emergency Leave Card */}
            <div className="rounded-xl border border-[#E7E2DC] bg-white p-3.5 xl:p-4 shadow-2xs flex items-center gap-3.5">
              <div className="flex h-10 w-10 xl:h-11 xl:w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF1F2] text-[#E11D48] border border-[#FFE4E6]">
                <Siren className="h-5 w-5 xl:h-5.5 xl:w-5.5 stroke-[1.8]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs xl:text-[13px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                  Emergency Leave
                </p>
                <p className="text-base xl:text-lg font-bold text-[#101A2E] tabular-nums mt-0.5">
                  {summary.emergency_used} / {summary.emergency_total}{' '}
                  <span className="text-xs xl:text-sm font-normal text-slate-400">used</span>
                </p>
                <p className="text-xs xl:text-[13px] text-rose-600 font-medium truncate mt-0.5">
                  {Math.max(0, summary.emergency_total - summary.emergency_used)} days remaining
                </p>
              </div>
            </div>

            {/* Pending Requests Card */}
            <div className="rounded-xl border border-[#E7E2DC] bg-white p-3.5 xl:p-4 shadow-2xs flex items-center gap-3.5">
              <div className="flex h-10 w-10 xl:h-11 xl:w-11 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                <Clock className="h-5 w-5 xl:h-5.5 xl:w-5.5 stroke-[1.8]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs xl:text-[13px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                  Pending Review
                </p>
                <p className="text-base xl:text-lg font-bold text-[#101A2E] tabular-nums mt-0.5">
                  {summary.pending_count}{' '}
                  <span className="text-xs xl:text-sm font-normal text-slate-400">
                    {summary.pending_count === 1 ? 'application' : 'applications'}
                  </span>
                </p>
                <p className="text-xs xl:text-[13px] text-amber-700 font-medium truncate mt-0.5">
                  Awaiting HOD/Admin review
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar: Segmented Control Tabs + Search Bar */}
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented Control */}
          <div
            className="inline-flex items-center gap-1.5 rounded-2xl bg-white/90 p-1.5 border border-[#E7E2DC] shadow-2xs overflow-x-auto"
            role="tablist"
            aria-label="Filter leave requests"
          >
            {filterTabs.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] ${
                    active
                      ? 'bg-[#F5EDE4] text-[#101A2E] shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-[#FAF8F5]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                      active
                        ? tab.id === ''
                          ? 'bg-[#E6DACB] text-[#101A2E]'
                          : tab.id === 'pending'
                          ? 'bg-[#FEF3C7] text-[#B45309]'
                          : tab.id === 'approved'
                          ? 'bg-[#DCFCE7] text-[#15803D]'
                          : 'bg-slate-200 text-slate-700'
                        : tab.id === 'pending'
                        ? 'bg-[#FEF3C7] text-[#B45309]'
                        : tab.id === 'approved'
                        ? 'bg-[#DCFCE7] text-[#15803D]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-72 lg:w-84">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reason or relief cover..."
              aria-label="Search leave requests"
              className="w-full rounded-2xl border border-[#E7E2DC] bg-white py-2.5 pl-10 pr-8 text-xs sm:text-sm text-[#101A2E] placeholder:text-slate-400 focus:border-[#8C592B] focus:outline-none focus:ring-2 focus:ring-[#8C592B]/15 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 text-xs"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-700 flex items-center gap-2.5"
            role="alert"
          >
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Main Table Container */}
        <div className="flex max-h-[calc(100dvh-20rem)] xl:max-h-[calc(100dvh-20.5rem)] flex-col overflow-hidden rounded-2xl border border-[#E7E2DC] bg-white shadow-sm">
          {loading ? (
            /* Skeleton Loading State */
            <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading leave applications">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0 animate-pulse"
                >
                  <div className="flex items-center gap-3 w-1/4">
                    <div className="h-9 w-9 rounded-full bg-slate-200" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 w-28 bg-slate-200 rounded" />
                      <div className="h-2.5 w-20 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="h-6 w-24 bg-slate-100 rounded-xl" />
                  <div className="h-4 w-36 bg-slate-100 rounded" />
                  <div className="h-4 w-52 bg-slate-100 rounded" />
                  <div className="h-6 w-24 bg-slate-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredLeaves.length === 0 ? (
            /* Context-Aware Empty State */
            <div className="py-10 sm:py-12 lg:py-16 xl:py-20 px-6 text-center max-w-md xl:max-w-lg mx-auto my-auto" role="status">
              <div className="mx-auto mb-4 xl:mb-5 flex h-12 w-12 lg:h-14 lg:w-14 xl:h-16 xl:w-16 items-center justify-center rounded-2xl xl:rounded-[20px] bg-[#F7F3EE] text-[#8C592B] border border-[#EADBCC]">
                {statusFilter === 'pending' ? (
                  <CheckCircle2 className="h-6 w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8 text-emerald-600 stroke-[1.8]" />
                ) : (
                  <Inbox className="h-6 w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8 text-[#8C592B] stroke-[1.8]" />
                )}
              </div>
              <h3 className="text-base lg:text-xl xl:text-[22px] font-bold tracking-tight text-[#101A2E] leading-tight">
                {searchQuery
                  ? 'No matching requests'
                  : statusFilter === 'pending'
                  ? 'All Caught Up!'
                  : statusFilter === 'rejected'
                  ? 'No Rejected Requests'
                  : statusFilter === 'approved'
                  ? 'No Approved Requests Yet'
                  : 'No Leave Applications'}
              </h3>
              <p className="mt-2 text-xs sm:text-sm xl:text-[15px] text-slate-500 leading-relaxed">
                {searchQuery
                  ? `No applications matched "${searchQuery}".`
                  : statusFilter === 'pending'
                  ? 'There are currently no leave requests awaiting approval.'
                  : statusFilter === 'rejected'
                  ? 'All applications have either been approved or are pending.'
                  : 'Submitted leave applications will appear here.'}
              </p>
              <div className="mt-5 xl:mt-6 flex items-center justify-center gap-2.5">
                {(statusFilter || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('');
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#D7BDA3] bg-white px-3.5 py-1.5 sm:px-4 sm:py-2 xl:px-5 xl:py-2.5 text-xs sm:text-sm font-semibold text-[#8C592B] hover:bg-[#FAF8F5] transition-colors shadow-2xs"
                  >
                    Clear Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#8C592B] px-3.5 py-1.5 sm:px-4 sm:py-2 xl:px-5 xl:py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#73461E] transition-colors shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Apply Now</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 border-b border-[#F0EBE5] bg-white">
                    <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {isReviewer && <th className="py-3.5 px-6">APPLICANT</th>}
                      <th className="py-3.5 px-6">CATEGORY</th>
                      <th className="py-3.5 px-6">DATES &amp; DURATION</th>
                      <th className="py-3.5 px-6">REASON &amp; RELIEF COVER</th>
                      <th className="py-3.5 px-6">STATUS</th>
                      <th className="py-3.5 px-6 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EBE5]/80">
                    {filteredLeaves.map((lr) => {
                      const cat = getCategoryBadge(lr.leave_type);
                      const stat = getStatusBadge(lr.status);
                      const CatIcon = cat.icon;
                      const StatIcon = stat.icon;

                      const applicantName = lr.teacher_name || 'Staff Member';
                      const applicantDept = lr.teacher_department || 'Academic Staff';
                      const applicantInitials =
                        applicantName
                          .split(' ')
                          .filter(Boolean)
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || 'SM';

                      const duration = getDurationText(lr.start_date, lr.end_date);
                      const isOwner = user?.id === lr.teacher_id || !isReviewer;

                      return (
                        <tr key={lr.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                          {isReviewer && (
                            <td className="py-4 px-6 align-top">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F7F3EE] text-xs font-semibold text-[#8C592B] border border-[#EADBCC]">
                                  {applicantInitials}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-[#101A2E] leading-snug">
                                    {applicantName}
                                  </p>
                                  <p className="text-xs font-normal text-slate-500 leading-snug mt-0.5">
                                    {applicantDept}
                                  </p>
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Category Badge with Icon */}
                          <td className="py-4 px-6 whitespace-nowrap align-top">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${cat.classes}`}
                            >
                              <CatIcon className="h-4 w-4 shrink-0 stroke-[2.2]" />
                              <span>{cat.label}</span>
                            </span>
                          </td>

                          {/* Dates & Duration */}
                          <td className="py-4 px-6 whitespace-nowrap align-top">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#101A2E] tabular-nums">
                                {formatDate(lr.start_date)}
                                {lr.start_date !== lr.end_date && ` – ${formatDate(lr.end_date)}`}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 tabular-nums">
                                {duration}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 tabular-nums font-normal">
                              Applied {formatDate(lr.submitted_at)}
                            </p>
                          </td>

                          {/* Reason & Relief Cover */}
                          <td className="py-4 px-6 max-w-sm xl:max-w-md align-top">
                            <p className="font-semibold text-sm text-[#101A2E] leading-snug">
                              {lr.reason}
                            </p>
                            {lr.covering_teacher && (
                              <div className="mt-2 flex items-center gap-2 text-xs">
                                <span className="text-slate-400 font-normal">Relief:</span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                  <User className="h-3.5 w-3.5 text-slate-500" />
                                  <span>{lr.covering_teacher}</span>
                                </span>
                              </div>
                            )}
                            {lr.review_notes && (
                              <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-50/90 border border-slate-200/70 px-3 py-1.5 text-xs text-slate-600 italic">
                                <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>Note: {lr.review_notes}</span>
                              </div>
                            )}
                          </td>

                          {/* Status Badge with Icon */}
                          <td className="py-4 px-6 whitespace-nowrap align-top">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${stat.classes}`}
                            >
                              <StatIcon className="h-3.5 w-3.5 shrink-0 stroke-[2.2]" />
                              <span>{stat.label}</span>
                            </span>
                            {lr.reviewed_at && (
                              <p className="text-xs text-slate-400 mt-1 tabular-nums font-normal">
                                Reviewed {formatDate(lr.reviewed_at)}
                              </p>
                            )}
                          </td>

                          {/* Actions Column */}
                          <td className="py-4 px-6 text-right whitespace-nowrap align-top">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Reviewer Action Buttons */}
                              {isReviewer && lr.status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApprove(lr.id)}
                                    disabled={actionLoading}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-semibold shadow-2xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"
                                    title="Approve leave request"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectingLeave(lr)}
                                    disabled={actionLoading}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 text-slate-700 px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-50"
                                    title="Reject leave request"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {/* Teacher Actions (Edit / Delete for Pending, Resubmit for Rejected) */}
                              {isOwner && lr.status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(lr)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-[#E7E2DC] bg-white hover:bg-[#F5EDE4] hover:text-[#8C592B] text-slate-700 px-2.5 py-1 text-xs font-semibold transition-colors shadow-2xs"
                                    title="Edit pending application"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingLeave(lr)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 text-slate-600 px-2 py-1 text-xs font-medium transition-colors shadow-2xs"
                                    title="Withdraw / Cancel application"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Withdraw</span>
                                  </button>
                                </>
                              )}

                              {isOwner && lr.status === 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenResubmit(lr)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#EADBCC] bg-[#F7F3EE] hover:bg-[#EADBCC] text-[#8C592B] px-2.5 py-1 text-xs font-semibold transition-colors shadow-2xs"
                                  title="Edit details and resubmit"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Resubmit</span>
                                </button>
                              )}

                              {/* Details View Button */}
                              <button
                                type="button"
                                onClick={() => setViewingLeave(lr)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
                                title="View full details"
                                aria-label="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Responsive Mobile / Tablet Layout (< lg) */}
              <div className="divide-y divide-[#F0EBE5] lg:hidden flex-1 min-h-0 overflow-y-auto">
                {filteredLeaves.map((lr) => {
                  const cat = getCategoryBadge(lr.leave_type);
                  const stat = getStatusBadge(lr.status);
                  const CatIcon = cat.icon;
                  const StatIcon = stat.icon;

                  const applicantName = lr.teacher_name || 'Staff Member';
                  const applicantDept = lr.teacher_department || 'Academic Staff';
                  const applicantInitials =
                    applicantName
                      .split(' ')
                      .filter(Boolean)
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'SM';

                  const duration = getDurationText(lr.start_date, lr.end_date);
                  const isOwner = user?.id === lr.teacher_id || !isReviewer;

                  return (
                    <div key={lr.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        {isReviewer ? (
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F7F3EE] text-xs font-semibold text-[#8C592B] border border-[#EADBCC]">
                              {applicantInitials}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#101A2E] leading-snug">
                                {applicantName}
                              </p>
                              <p className="text-xs text-slate-500 font-normal">
                                {applicantDept}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${cat.classes}`}
                          >
                            <CatIcon className="h-3.5 w-3.5 shrink-0 stroke-[2.2]" />
                            <span>{cat.label}</span>
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${stat.classes}`}
                          >
                            <StatIcon className="h-3.5 w-3.5 shrink-0 stroke-[2.2]" />
                            <span>{stat.label}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setViewingLeave(lr)}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {isReviewer && (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold ${cat.classes}`}
                          >
                            <CatIcon className="h-3 w-3 stroke-[2.2]" />
                            <span>{cat.label}</span>
                          </span>
                        )}
                        <span className="font-bold text-[#101A2E] text-xs tabular-nums">
                          {formatDate(lr.start_date)}
                          {lr.start_date !== lr.end_date && ` – ${formatDate(lr.end_date)}`}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 tabular-nums">
                          {duration}
                        </span>
                      </div>

                      {/* Reason & Relief */}
                      <div className="text-xs space-y-1.5 pt-2 border-t border-slate-100">
                        <p className="text-[#101A2E] font-semibold leading-snug">
                          {lr.reason}
                        </p>
                        {lr.covering_teacher && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span>Relief:</span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-medium text-slate-700">
                              <User className="h-3 w-3 text-slate-500" />
                              <span>{lr.covering_teacher}</span>
                            </span>
                          </div>
                        )}
                        {lr.review_notes && (
                          <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 italic border border-slate-200/60">
                            <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>Note: {lr.review_notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Mobile Reviewer Actions */}
                      {isReviewer && lr.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleApprove(lr.id)}
                            disabled={actionLoading}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingLeave(lr)}
                            disabled={actionLoading}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}

                      {/* Mobile Teacher Actions */}
                      {isOwner && lr.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(lr)}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-[#E7E2DC] bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-[#F5EDE4]"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingLeave(lr)}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50/50 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Withdraw</span>
                          </button>
                        </div>
                      )}

                      {isOwner && lr.status === 'rejected' && (
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleOpenResubmit(lr)}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#EADBCC] bg-[#F7F3EE] py-1.5 text-xs font-semibold text-[#8C592B] hover:bg-[#EADBCC]"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Edit & Resubmit Application</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Table Footer with Pagination Controls */}
              <div className="shrink-0 border-t border-[#F0EBE5] bg-white px-6 py-3 text-xs font-medium text-slate-500 flex items-center justify-between">
                <div>
                  Showing <strong className="text-[#101A2E] tabular-nums">{filteredLeaves.length}</strong> of{' '}
                  <strong className="text-[#101A2E] tabular-nums">{leaves.length}</strong> applications
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
                    disabled
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs font-medium text-slate-700 px-1">1 / 1</span>
                  <button
                    type="button"
                    className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
                    disabled
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Leave Application & Edit Modal (Create / Edit / Resubmit) — paper-form style */}
      {(isApplyModalOpen || editingLeave || resubmittingLeave) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#3F4756]/50 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          onClick={closeAllModals}
        >
          <div
            className="w-full max-w-[720px] rounded-[22px] bg-[#FFFEFB] shadow-[0_24px_80px_-12px_rgba(16,26,46,0.35)] p-6 sm:p-8 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[16px] bg-[#FBF0E2] text-[#8C592B]">
                {resubmittingLeave ? (
                  <RotateCcw className="h-7 w-7 stroke-[1.8]" />
                ) : editingLeave ? (
                  <Pencil className="h-7 w-7 stroke-[1.8]" />
                ) : (
                  <Calendar className="h-7 w-7 stroke-[1.8]" />
                )}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#0F172A] leading-[1.1]">
                  {resubmittingLeave
                    ? 'Resubmit Leave Application'
                    : editingLeave
                    ? 'Edit Leave Application'
                    : 'Apply for Leave'}
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#64748B]">
                  {resubmittingLeave
                    ? 'Update justification or relief teacher and resubmit for approval.'
                    : editingLeave
                    ? 'Modify dates, reasons, or relief arrangement before review.'
                    : 'Submit your leave request for departmental and administrative approval.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAllModals}
                className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F1EC] text-[#6B7280] hover:bg-[#E9E2D6] hover:text-[#111827] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <hr className="my-6 border-t border-[#EDE6DD]" />

            {/* Resubmission Alert with Previous Rejection Notes */}
            {resubmittingLeave && resubmittingLeave.review_notes && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 flex items-start gap-2.5">
                <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong className="font-semibold block">Previous Reviewer Feedback:</strong>
                  <span>{resubmittingLeave.review_notes}</span>
                </div>
              </div>
            )}

            {formError && (
              <div
                className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 flex items-center gap-2"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div>
                <label className="block text-[15px] font-bold text-[#101A2E] mb-2">
                  Leave Category<span className="ml-1 text-[#8C592B]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.leave_type}
                    onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                    className="w-full appearance-none h-[52px] rounded-[12px] border border-[#DDCBB6] bg-white pl-4 pr-12 text-[16px] font-medium text-[#111827] shadow-[0_1px_2px_rgba(16,26,46,0.04)] focus:border-[#8C592B] focus:outline-none focus:ring-[3px] focus:ring-[#8C592B]/15"
                  >
                    <option value="emergency">Emergency Leave (Cuti Kecemasan)</option>
                    <option value="medical">Medical / Sick Leave (MC)</option>
                    <option value="annual">Annual Leave</option>
                    <option value="compassionate">Compassionate Leave</option>
                    <option value="maternity">Maternity Leave (98 Days)</option>
                    <option value="paternity">Paternity Leave (7 Days)</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 rotate-90 text-[#111827]" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[15px] font-bold text-[#101A2E] mb-2">
                    Start Date<span className="ml-1 text-[#8C592B]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full h-[52px] rounded-[12px] border border-[#DDCBB6] bg-white pl-4 pr-12 text-[16px] text-[#111827] tabular-nums shadow-[0_1px_2px_rgba(16,26,46,0.04)] focus:border-[#8C592B] focus:outline-none focus:ring-[3px] focus:ring-[#8C592B]/15 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <Calendar className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#111827]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[15px] font-bold text-[#101A2E] mb-2">
                    End Date<span className="ml-1 text-[#8C592B]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full h-[52px] rounded-[12px] border border-[#DDCBB6] bg-white pl-4 pr-12 text-[16px] text-[#111827] tabular-nums shadow-[0_1px_2px_rgba(16,26,46,0.04)] focus:border-[#8C592B] focus:outline-none focus:ring-[3px] focus:ring-[#8C592B]/15 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <Calendar className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#111827]" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[15px] font-bold text-[#101A2E] mb-2">
                  Reason / Justification<span className="ml-1 text-[#8C592B]">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g. Attending official training workshop / acute gastroenteritis (MC attached)"
                  className="w-full min-h-[124px] rounded-[12px] border border-[#DDCBB6] bg-white p-4 text-[15px] leading-relaxed text-[#111827] placeholder:text-[#9CA3AF] shadow-[0_1px_2px_rgba(16,26,46,0.04)] focus:border-[#8C592B] focus:outline-none focus:ring-[3px] focus:ring-[#8C592B]/15 resize-y"
                />
              </div>

              <div>
                <label className="block text-[15px] font-bold text-[#101A2E] mb-2">
                  Covering / Relief Teacher (Optional)
                </label>
                {staffList.length > 0 ? (
                  <div className="relative">
                    <select
                      value={formData.covering_teacher}
                      onChange={(e) => setFormData({ ...formData, covering_teacher: e.target.value })}
                      className="w-full appearance-none h-[52px] rounded-[12px] border border-[#DDCBB6] bg-white pl-4 pr-12 text-[16px] text-[#374151] shadow-[0_1px_2px_rgba(16,26,46,0.04)] focus:border-[#8C592B] focus:outline-none focus:ring-[3px] focus:ring-[#8C592B]/15"
                    >
                      <option value="">-- Select relief colleague (or leave for HOD assignment) --</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.full_name}>
                          {s.full_name} ({s.department})
                        </option>
                      ))}
                    </select>
                    <ChevronRight className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 rotate-90 text-[#111827]" />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={formData.covering_teacher}
                    onChange={(e) => setFormData({ ...formData, covering_teacher: e.target.value })}
                    placeholder="e.g. Mr. Lee Wei Hong"
                    className="w-full h-[52px] rounded-[12px] border border-[#DDCBB6] bg-white px-4 text-[16px] text-[#111827] placeholder:text-[#9CA3AF] shadow-[0_1px_2px_rgba(16,26,46,0.04)] focus:border-[#8C592B] focus:outline-none focus:ring-[3px] focus:ring-[#8C592B]/15"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 mt-1 border-t border-[#EDE6DD]">
                <button
                  type="button"
                  onClick={closeAllModals}
                  className="rounded-[12px] border border-[#D8CFC0] bg-white px-7 py-3 text-[15px] font-semibold text-[#0F172A] hover:bg-[#FAF7F2] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#9A6530] hover:bg-[#7E521F] px-8 py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(140,89,43,0.6)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] focus-visible:ring-offset-2"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : resubmittingLeave ? (
                    <span>Confirm & Resubmit</span>
                  ) : editingLeave ? (
                    <span>Save Changes</span>
                  ) : (
                    <span>Submit</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Leave View Modal */}
      {viewingLeave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE5] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F7F3EE] text-[#8C592B] border border-[#EADBCC]">
                  <FileText className="h-5 w-5 stroke-[1.8]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#101A2E]">
                    Leave Application Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Reference ID: #{viewingLeave.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAllModals}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              {/* Applicant & Status Row */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#E7E2DC]">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Applicant
                  </p>
                  <p className="font-bold text-[#101A2E] text-sm mt-0.5">
                    {viewingLeave.teacher_name || user?.full_name || 'Staff Member'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {viewingLeave.teacher_department || user?.department || 'Academic Staff'}
                  </p>
                </div>
                <div>
                  {(() => {
                    const stat = getStatusBadge(viewingLeave.status);
                    const StatIcon = stat.icon;
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${stat.classes}`}
                      >
                        <StatIcon className="h-3.5 w-3.5 stroke-[2.2]" />
                        <span>{stat.label}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Category & Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Leave Category
                  </p>
                  <p className="font-bold text-[#101A2E] mt-1 capitalize">
                    {viewingLeave.leave_type}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Duration
                  </p>
                  <p className="font-bold text-[#101A2E] mt-1">
                    {getDurationText(viewingLeave.start_date, viewingLeave.end_date)}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Date Period
                </p>
                <p className="font-bold text-[#101A2E] mt-1 tabular-nums">
                  {formatDate(viewingLeave.start_date)} &rarr; {formatDate(viewingLeave.end_date)}
                </p>
              </div>

              {/* Justification */}
              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Reason / Justification
                </p>
                <p className="text-slate-800 mt-1 leading-relaxed">{viewingLeave.reason}</p>
              </div>

              {/* Relief Teacher */}
              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Nominated Relief Teacher
                </p>
                <p className="font-semibold text-slate-800 mt-1">
                  {viewingLeave.covering_teacher || 'None designated (HoD to assign)'}
                </p>
              </div>

              {/* Reviewer Details (if reviewed) */}
              {viewingLeave.reviewed_at && (
                <div className="p-3 rounded-xl border border-slate-200 bg-[#F7F3EE]/60 space-y-1">
                  <p className="text-[11px] font-semibold text-[#8C592B] uppercase tracking-wide">
                    Review Details
                  </p>
                  <p className="text-slate-700">
                    <strong>Reviewer:</strong> {viewingLeave.reviewer_name || 'Department HoD'}
                  </p>
                  <p className="text-slate-700">
                    <strong>Date:</strong> {formatDate(viewingLeave.reviewed_at)}
                  </p>
                  {viewingLeave.review_notes && (
                    <p className="text-slate-700">
                      <strong>Remarks:</strong> {viewingLeave.review_notes}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-[#F0EBE5]">
              <button
                type="button"
                onClick={closeAllModals}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Withdraw Confirmation Dialog */}
      {deletingLeave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-2.5 mb-2 text-rose-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 border border-rose-100">
                <Trash2 className="h-5 w-5 stroke-[1.8]" />
              </div>
              <h3 className="text-base font-bold text-[#101A2E]">Withdraw Leave Request</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
              Are you sure you want to withdraw and delete this pending{' '}
              <strong>{deletingLeave.leave_type}</strong> application for{' '}
              <strong>{formatDate(deletingLeave.start_date)}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingLeave(null)}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep Request
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                <span>Withdraw Application</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reviewer Rejection Justification Modal */}
      {rejectingLeave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                <XCircle className="h-4.5 w-4.5" />
              </div>
              <h3 id="reject-modal-title" className="text-base font-bold text-[#101A2E]">
                Reject Leave Application
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
              Provide justification for rejecting {rejectingLeave.teacher_name || 'Staff Member'}'s{' '}
              {rejectingLeave.leave_type || 'leave'} request ({formatDate(rejectingLeave.start_date)}{' '}
              &rarr; {formatDate(rejectingLeave.end_date)}).
            </p>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason for Rejection *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Clashes with examination invigilation duties; relief arrangement required."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs sm:text-sm leading-relaxed text-[#101A2E] placeholder:text-slate-400 focus:border-[#8C592B] focus:outline-none focus:ring-2 focus:ring-[#8C592B]/20"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingLeave(null);
                    setReviewNotes('');
                  }}
                  className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !reviewNotes.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-rose-700 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <span>Confirm Rejection</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


