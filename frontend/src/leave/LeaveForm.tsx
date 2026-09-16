import React, { useState, useEffect } from 'react';
import { api, LeaveFields, UserProfile } from '../api/client';
import { Calendar, AlertCircle, Send, Loader2 } from 'lucide-react';

interface LeaveFormProps {
  initialFields?: LeaveFields;
  onSuccess: (leaveId: string) => void;
  onCancel?: () => void;
}

export const LeaveForm: React.FC<LeaveFormProps> = ({
  initialFields,
  onSuccess,
  onCancel,
}) => {
  const [leaveType, setLeaveType] = useState(
    initialFields?.leave_type?.toLowerCase() || 'emergency'
  );
  const [startDate, setStartDate] = useState(initialFields?.start_date || '');
  const [endDate, setEndDate] = useState(initialFields?.end_date || '');
  const [reason, setReason] = useState(initialFields?.reason || '');
  const [coveringTeacher, setCoveringTeacher] = useState(
    initialFields?.covering_teacher || ''
  );

  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    if (reason.trim().length < 5) {
      setError('Please provide a specific reason (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitLeave({
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        covering_teacher: coveringTeacher.trim() || undefined,
      });
      onSuccess(res.id);
    } catch (err: any) {
      setError(err.message || 'Failed to submit leave application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-[#E7E2DC] bg-[#FAF8F5] p-4 text-[#101A2E] shadow-xs">
      <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-[#E7E2DC]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8C592B] text-white shadow-xs">
          <Calendar className="h-4 w-4 stroke-[1.8]" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-[#101A2E]">
            Pre-filled Leave Application
          </h4>
          <p className="text-[11px] text-slate-600">
            AI extracted these details from your query. Review and confirm below to trigger approval routing.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-2"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Leave Category *
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full rounded-lg border border-[#D7BDA3] bg-white px-2.5 py-1.5 text-xs text-[#101A2E] focus:border-[#8C592B] focus:outline-none focus:ring-2 focus:ring-[#8C592B]/20"
            >
              <option value="emergency">Emergency Leave (Cuti Kecemasan)</option>
              <option value="medical">Medical / Sick Leave (MC)</option>
              <option value="annual">Annual Leave</option>
              <option value="compassionate">Compassionate Leave</option>
              <option value="maternity">Maternity Leave (98 Days)</option>
              <option value="paternity">Paternity Leave (7 Days)</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-[#D7BDA3] bg-white px-2.5 py-1.5 text-xs text-[#101A2E] focus:border-[#8C592B] focus:outline-none focus:ring-2 focus:ring-[#8C592B]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              End Date *
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-[#D7BDA3] bg-white px-2.5 py-1.5 text-xs text-[#101A2E] focus:border-[#8C592B] focus:outline-none focus:ring-2 focus:ring-[#8C592B]/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason / Justification *
          </label>
          <input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Attending urgent family matter / sudden illness"
            className="w-full rounded-lg border border-[#D7BDA3] bg-white px-2.5 py-1.5 text-xs text-[#101A2E] placeholder:text-slate-500 focus:border-[#8C592B] focus:outline-none focus:ring-2 focus:ring-[#8C592B]/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Covering / Relief Teacher (Optional)
          </label>
          {staffList.length > 0 ? (
            <select
              value={coveringTeacher}
              onChange={(e) => setCoveringTeacher(e.target.value)}
              className="w-full rounded-lg border border-[#D7BDA3] bg-white px-2.5 py-1.5 text-xs text-[#101A2E] focus:border-[#8C592B] focus:outline-none focus:ring-2 focus:ring-[#8C592B]/20"
            >
              <option value="">-- Select relief colleague (or leave for HoD assignment) --</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.full_name}>
                  {s.full_name} ({s.department})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={coveringTeacher}
              onChange={(e) => setCoveringTeacher(e.target.value)}
              placeholder="e.g. Mr. Lee Wei Hong"
              className="w-full rounded-lg border border-[#D7BDA3] bg-white px-2.5 py-1.5 text-xs text-[#101A2E] placeholder:text-slate-500 focus:border-[#8C592B] focus:outline-none focus:ring-2 focus:ring-[#8C592B]/20"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[#E7E2DC]">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-[#E7E2DC] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-[#FAF8F5] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#8C592B] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#7A4C1E] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Routing to n8n...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Submit & Route Approval</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
