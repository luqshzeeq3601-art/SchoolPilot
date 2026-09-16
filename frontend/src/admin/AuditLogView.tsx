import React, { useState, useEffect, useMemo } from 'react';
import { api, AuditLogItem } from '../api/client';
import {
  RefreshCw,
  Eye,
  Search,
  Check,
  Copy,
  X,
  FileCode,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ArrowDown,
} from 'lucide-react';

const PAGE_SIZE = 6;

const formatStamp = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return `${date}, ${time}`;
};

const renderHighlightedJson = (data: unknown) => {
  const json = JSON.stringify(data, null, 2);
  const nodes: React.ReactNode[] = [];
  const tokenRe = /("(\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = tokenRe.exec(json)) !== null) {
    if (match.index > last) {
      nodes.push(
        <span key={key++} className="text-slate-300">
          {json.slice(last, match.index)}
        </span>
      );
    }
    const [full, str, , colon, bool] = match;
    if (str) {
      nodes.push(
        <span key={key++}>
          <span className="text-sky-300">{str}</span>
          {colon && <span className="text-slate-300">{colon}</span>}
        </span>
      );
    } else if (bool) {
      nodes.push(
        <span key={key++} className="text-orange-300">
          {full}
        </span>
      );
    } else {
      nodes.push(
        <span key={key++} className="text-emerald-300">
          {full}
        </span>
      );
    }
    last = match.index + full.length;
  }
  if (last < json.length) {
    nodes.push(
      <span key={key++} className="text-slate-300">
        {json.slice(last)}
      </span>
    );
  }
  return nodes;
};

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(100);
      setLogs(data);
    } catch {
      // silent — empty state covers it
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, actionFilter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedLog) {
        setSelectedLog(null);
        setCopied(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedLog]);

  const handleCopyPayload = async () => {
    if (!selectedLog) return;
    try {
      await navigator?.clipboard?.writeText(JSON.stringify(selectedLog.details, null, 2));
    } catch {
      // clipboard restricted
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActionBadge = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('delete') || a.includes('reject')) return 'bg-[#FDECEC] text-[#C81E1E]';
    if (a.includes('chat') || a.includes('query')) return 'bg-[#EAF2FF] text-[#2563EB]';
    if (a.includes('doc') || a.includes('upload') || a.includes('index')) return 'bg-[#E9F7EF] text-[#15803D]';
    if (a.includes('approv')) return 'bg-[#E9F7EF] text-[#15803D]';
    if (a.includes('submit') || a.includes('creat') || a.includes('leave')) return 'bg-[#FDF0E3] text-[#B26A1B]';
    return 'bg-slate-100 text-slate-600';
  };

  const counts = useMemo(() => {
    const isLeave = (l: AuditLogItem) => l.action.toLowerCase().includes('leave');
    const isChat = (l: AuditLogItem) =>
      l.action.toLowerCase().includes('chat') || l.action.toLowerCase().includes('query');
    const isDoc = (l: AuditLogItem) => {
      const a = l.action.toLowerCase();
      return a.includes('doc') || a.includes('upload') || a.includes('index');
    };
    return {
      all: logs.length,
      leaves: logs.filter(isLeave).length,
      chat: logs.filter(isChat).length,
      documents: logs.filter(isDoc).length,
    };
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const matches =
      (log.user_email || 'system').toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.resource_type.toLowerCase().includes(q);
    if (!matches) return false;
    if (actionFilter === 'leaves') return log.action.toLowerCase().includes('leave');
    if (actionFilter === 'chat')
      return log.action.toLowerCase().includes('chat') || log.action.toLowerCase().includes('query');
    if (actionFilter === 'documents') {
      const a = log.action.toLowerCase();
      return a.includes('doc') || a.includes('upload') || a.includes('index');
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageLogs = filteredLogs.slice(start, start + PAGE_SIZE);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 3) return [1, 2, 3, 4, 5, -1, totalPages];
    if (safePage >= totalPages - 2) return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, -1, safePage - 1, safePage, safePage + 1, -1, totalPages];
  }, [safePage, totalPages]);

  const filters = [
    { id: 'all', label: `All Events (${counts.all})` },
    { id: 'leaves', label: `Leave (${counts.leaves})` },
    { id: 'chat', label: `Policy Q&A (${counts.chat})` },
    { id: 'documents', label: `Documents (${counts.documents})` },
  ];

  return (
    <section aria-labelledby="audit-title" className="overflow-hidden rounded-2xl border border-[#ECE7DC] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
      {/* head */}
      <div className="border-b border-[#ECE7DC] px-5 pt-5 lg:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[#F9F1E5] text-[#8C592B]">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 id="audit-title" className="text-base font-extrabold tracking-tight text-[#0F1F38] lg:text-xl">
                System Audit Trail &amp; Compliance Log ({logs.length})
              </h2>
              <p className="mt-0.5 text-[13px] font-normal text-slate-500 lg:text-[15px]">
                Track system activities, user actions, and resource access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] disabled:opacity-50 lg:h-11 lg:px-5 lg:text-[15px]"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md lg:flex-1">
            <label htmlFor="audit-search" className="sr-only">Search audit log</label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="audit-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by user, action, or resource…"
              className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-white pl-10 pr-4 text-sm text-[#0F1F38] outline-none placeholder:text-slate-400 focus:border-[#8C592B] focus:ring-2 focus:ring-[#8C592B]/20 lg:h-12 lg:text-[15px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter audit events">
            {filters.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={actionFilter === f.id}
                onClick={() => setActionFilter(f.id)}
                className={`h-10 cursor-pointer rounded-xl border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] lg:h-11 lg:px-4 lg:text-sm ${
                  actionFilter === f.id
                    ? 'border-[#8C592B] bg-[#8C592B] text-white'
                    : 'border-[#E2E8F0] bg-white text-slate-600 hover:border-[#C9A87F] hover:text-[#0F1F38]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-16">
          <RefreshCw aria-hidden="true" className="mb-3 h-7 w-7 animate-spin text-[#8C592B]" />
          <p className="text-sm font-semibold text-slate-700 lg:text-[15px]" role="status">Loading audit records…</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
            <p className="text-sm font-bold text-slate-700 lg:text-[15px]">No matching audit events</p>
            <p className="mt-1 text-[13px] text-slate-500 lg:text-sm">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#ECE7DC] bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 lg:text-[13px]">
                  <th scope="col" className="px-5 py-3.5 lg:px-7">
                    <span className="inline-flex items-center gap-1.5">Timestamp <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /></span>
                  </th>
                  <th scope="col" className="px-4 py-3.5">Actor / User</th>
                  <th scope="col" className="px-4 py-3.5">Action event</th>
                  <th scope="col" className="px-4 py-3.5">Target resource</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {pageLogs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-[#FFFEFB]">
                    <td className="whitespace-nowrap px-5 py-4 text-[13px] tabular-nums text-slate-500 lg:px-7 lg:text-[15px]">
                      {formatStamp(log.timestamp)}
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-4 text-[13px] font-medium text-slate-700 lg:max-w-[320px] lg:text-[15px]">
                      {log.user_email || <span className="italic text-slate-400">System / n8n</span>}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block rounded-md px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide lg:text-[13px] ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-[12px] text-slate-500 lg:text-sm">
                      {log.resource_type}
                      {log.resource_id && <span className="text-slate-400"> #{log.resource_id.substring(0, 6)}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <span className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-[#8C592B] transition-colors hover:bg-[#F9F1E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] lg:h-10 lg:text-sm"
                        >
                          <Eye aria-hidden="true" className="h-4 w-4" /> Inspect
                        </button>
                        <button
                          onClick={() => setSelectedLog(log)}
                          aria-label={`More options for ${log.action}`}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
                        >
                          <MoreVertical aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile */}
          <ul className="divide-y divide-[#EEF2F7] md:hidden">
            {pageLogs.map((log) => (
              <li key={log.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-md px-2 py-1 font-mono text-[11px] font-bold uppercase ${getActionBadge(log.action)}`}>
                    {log.action}
                  </span>
                  <button onClick={() => setSelectedLog(log)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#8C592B]">
                    <Eye aria-hidden="true" className="h-4 w-4" /> Inspect
                  </button>
                </div>
                <p className="truncate text-[13px] font-medium text-slate-700">{log.user_email || 'System / n8n'}</p>
                <p className="font-mono text-[11px] tabular-nums text-slate-400">{formatStamp(log.timestamp)}</p>
              </li>
            ))}
          </ul>

          {/* pagination */}
          <div className="flex flex-col gap-3 border-t border-[#ECE7DC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-7">
            <p className="text-[13px] font-normal text-slate-500 lg:text-sm" role="status">
              Showing {filteredLogs.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} events
            </p>
            <nav aria-label="Audit log pages" className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
                aria-label="Previous page"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E2E8F0] text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              {pageNumbers.map((n, i) =>
                n === -1 ? (
                  <span key={`e${i}`} className="px-1 text-[13px] text-slate-400">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    aria-current={n === safePage ? 'page' : undefined}
                    className={`h-9 min-w-9 cursor-pointer rounded-lg border px-2 text-[13px] font-bold transition-colors lg:h-10 lg:min-w-10 lg:text-sm ${
                      n === safePage
                        ? 'border-[#8C592B] bg-[#8C592B] text-white'
                        : 'border-[#E2E8F0] text-slate-600 hover:border-[#C9A87F]'
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
                aria-label="Next page"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E2E8F0] text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </nav>
          </div>
        </>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101A2E]/50 p-4" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E7E2DC] bg-white p-6 shadow-xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#ECE7DC] pb-5">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F7F0E4] text-[#8C592B]">
                  <ShieldCheck aria-hidden="true" className="h-7 w-7" />
                </span>
                <div>
                  <h2 id="audit-modal-title" className="text-xl font-extrabold uppercase tracking-tight text-[#101A2E]">Audit Event Inspection</h2>
                  <p className="mt-1 font-mono text-sm text-slate-500">ID:&nbsp;&nbsp;{selectedLog.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]">
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-7 flex flex-col gap-6 rounded-xl border border-[#ECE7DC] bg-[#FDFBF7] p-6 sm:flex-row lg:p-7">
              <div className="flex-1 space-y-6">
                <div>
                  <p className="text-[15px] text-slate-500">Action</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-[#101A2E]">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-[15px] text-slate-500">Actor</p>
                  <p className="mt-0.5 truncate text-lg font-bold text-[#101A2E]">{selectedLog.user_email || 'System / n8n'}</p>
                </div>
              </div>
              <div className="flex-1 space-y-6 sm:border-l sm:border-[#ECE7DC] sm:pl-6">
                <div>
                  <p className="text-[15px] text-slate-500">Resource</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-[#101A2E]">{selectedLog.resource_type}</p>
                </div>
                <div>
                  <p className="text-[15px] text-slate-500">Timestamp</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-[#101A2E]">{formatStamp(selectedLog.timestamp)}</p>
                </div>
              </div>
            </div>
            <div className="mb-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileCode aria-hidden="true" className="h-7 w-7 shrink-0 text-[#8C592B]" />
                  <div>
                    <h3 className="text-lg font-extrabold uppercase tracking-tight text-[#101A2E]">Payload Details</h3>
                    <p className="text-sm text-slate-500">The full payload sent with this event.</p>
                  </div>
                </div>
                <button
                  onClick={handleCopyPayload}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#EADDCB] bg-[#F7F1E6] px-4 text-sm font-semibold text-[#8C592B] transition-colors hover:bg-[#F1E8D8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
                >
                  {copied
                    ? <><Check aria-hidden="true" className="h-4 w-4 text-emerald-600" /><span className="text-emerald-600">Copied</span></>
                    : <><Copy aria-hidden="true" className="h-4 w-4" /> Copy JSON</>}
                </button>
              </div>
              <div className="overflow-hidden rounded-xl bg-[#1C2739]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">JSON</span>
                  <button
                    onClick={handleCopyPayload}
                    aria-label="Copy JSON payload"
                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
                  >
                    {copied
                      ? <Check aria-hidden="true" className="h-4 w-4 text-emerald-400" />
                      : <Copy aria-hidden="true" className="h-4 w-4" />}
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto p-5">
                  <pre className="whitespace-pre-wrap break-all font-mono text-[13px] leading-[1.7] lg:text-sm">{renderHighlightedJson(selectedLog.details)}</pre>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-[#ECE7DC] pt-5">
              <button
                onClick={() => setSelectedLog(null)}
                className="inline-flex h-11 items-center rounded-lg bg-[#8C592B] px-8 text-[15px] font-semibold text-white transition-colors hover:bg-[#73461E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
