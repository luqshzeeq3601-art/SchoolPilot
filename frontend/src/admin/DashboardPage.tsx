import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, DocumentItem, LeaveRecord, SystemStatus } from '../api/client';
import { AuditLogView } from './AuditLogView';
import { IntegrationStatusModal } from './IntegrationStatusModal';
import {
  FileText,
  Layers,
  ArrowRight,
  ChevronRight,
  Database,
  Link2,
  Users,
  Settings,
  ClipboardList,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docsData, leavesData] = await Promise.all([
          api.getDocuments(),
          api.getLeaves(),
        ]);
        setDocs(docsData);
        setLeaves(leavesData);
      } catch {
        // handled silently — cards show zero state
      }
      try {
        setSysStatus(await api.getSystemStatus());
      } catch {
        // card falls back to neutral state; modal shows the error
      }
    };
    fetchData();
  }, []);

  const totalChunks = docs.reduce((acc, d) => acc + (d.chunk_count || 0), 0);
  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const engineDown =
    sysStatus != null &&
    (sysStatus.n8n.status === 'down' || sysStatus.ollama.status === 'down');

  return (
    <div className="min-h-full bg-white text-[#101A2E]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10 2xl:max-w-[1440px]">
        {/* Briefing header */}
        <div className="relative mb-6 lg:mb-8">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F1F38] sm:text-3xl lg:text-[34px] lg:leading-[1.15]">
              Administrative Console &amp; System Health
            </h1>
            <p className="mt-1.5 text-sm font-normal leading-relaxed text-slate-500 lg:text-[15px]">
              Stay informed and in control. Monitor key activities, documents, and system integrations.
            </p>
          </div>
          {/* faint school watermark + script — decorative */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-4 right-0 hidden select-none xl:block">
            <div className="flex items-start gap-4 opacity-70">
              <svg viewBox="0 0 220 120" className="h-[104px] w-[190px] text-[#D8C6A8]" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M70 40 L110 16 L150 40 V96 H70 V40 Z" />
                <path d="M104 22 V8 M104 8 L116 10 V16" />
                <circle cx="110" cy="50" r="4" />
                <path d="M70 52 H48 V58 H34 V96 H70 M150 52 H172 V58 H186 V96 H150" />
                <path d="M42 96 H178" opacity="0.7" />
              </svg>
              <p className="font-script text-[22px] leading-[1.1] text-[#B9976B]">
                Better<br />Schools<br />Brighter<br />Tomorrows
              </p>
            </div>
          </div>
        </div>

        {/* Health ledger — 4 cards */}
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mb-6 lg:grid-cols-4 lg:gap-5">
          {/* Pending */}
          <div className="flex flex-col rounded-2xl border border-[#ECE7DC] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition-colors hover:border-[#D7BA9C] lg:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDF0E3] text-[#B26A1B]">
                <ClipboardList aria-hidden="true" className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600 lg:text-xs">Pending approvals</p>
                <p className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-[28px] font-extrabold leading-none text-[#0F1F38] lg:text-[32px]">{pendingLeaves.length}</span>
                  <span className="text-[13px] font-normal text-slate-500">/ {leaves.length} total requests</span>
                </p>
              </div>

            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <Link to="/leaves" className="inline-flex items-center gap-1.5 rounded text-[13px] font-semibold text-[#8C592B] hover:text-[#7A4C1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] lg:text-sm">
                Manage approval queue <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Indexed */}
          <div className="flex flex-col rounded-2xl border border-[#ECE7DC] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition-colors hover:border-[#D7BA9C] lg:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF3FE] text-[#2563EB]">
                <FileText aria-hidden="true" className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600 lg:text-xs">Indexed documents</p>
                <p className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-[28px] font-extrabold leading-none text-[#0F1F38] lg:text-[32px]">{docs.length}</span>
                  <span className="text-[13px] font-normal text-slate-500">SOP manuals &amp; circulars</span>
                </p>
              </div>

            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <Link to="/documents" className="inline-flex items-center gap-1.5 rounded text-[13px] font-semibold text-[#8C592B] hover:text-[#7A4C1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] lg:text-sm">
                Repository &amp; Vector Store <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Chunks */}
          <div className="flex flex-col rounded-2xl border border-[#ECE7DC] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition-colors hover:border-[#D7BA9C] lg:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F1E6] text-[#8C592B]">
                <Database aria-hidden="true" className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600 lg:text-xs">pgvector chunks</p>
                <p className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-[28px] font-extrabold leading-none text-[#0F1F38] lg:text-[32px]">{totalChunks}</span>
                  <span className="text-[13px] font-normal text-slate-500">768-dim embeddings</span>
                </p>
              </div>

            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <Link to="/documents" className="inline-flex items-center gap-1.5 rounded text-[13px] font-semibold text-[#8C592B] hover:text-[#7A4C1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] lg:text-sm">
                Database storage and sync <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Engine — opens live integration status */}
          <button
            type="button"
            onClick={() => setStatusOpen(true)}
            aria-haspopup="dialog"
            className="flex cursor-pointer flex-col rounded-2xl border border-[#ECE7DC] bg-white p-5 text-left shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition-colors hover:border-[#D7BA9C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] lg:p-6"
          >
            <span className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E7F6EC] text-[#15803D]">
                <Link2 aria-hidden="true" className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600 lg:text-xs">Automations engine</span>
                <span className={`mt-1.5 block text-[22px] font-extrabold leading-none lg:text-2xl ${engineDown ? 'text-amber-600' : 'text-[#15803D]'}`}>
                  {sysStatus == null ? 'Checking…' : engineDown ? 'Degraded' : 'Connected'}
                </span>
                <span className="mt-1.5 block text-[13px] font-normal leading-snug text-slate-500">n8n CE Webhooks + Local Ollama</span>
              </span>

            </span>
            <span className="mt-4 border-t border-slate-100 pt-3">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#8C592B] lg:text-sm">
                View integration status <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </span>
            </span>
          </button>
        </div>

        {/* Shortcuts */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:mb-8 lg:gap-5">
          {[
            { to: '/leaves', icon: Users, bg: 'bg-[#F9F1E5] text-[#8C592B]', title: 'Staff Leave Management', sub: 'Review and dig teacher applications' },
            { to: '/documents', icon: FileText, bg: 'bg-[#F9F1E5] text-[#8C592B]', title: 'Manage Documents & SOPs', sub: 'Upload and manage to vector store' },
            { to: '/', icon: Settings, bg: 'bg-[#E7F6EC] text-[#15803D]', title: 'Launch Policy Assistant', sub: 'Query regulations with citations' },
          ].map((c) => (
            <Link
              key={c.title}
              to={c.to}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-[#ECE7DC] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition-colors hover:border-[#D7BA9C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] lg:p-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.bg}`}>
                  <c.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold text-[#0F1F38] lg:text-base">{c.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] font-normal text-slate-500 lg:text-sm">{c.sub}</span>
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-700 transition-transform group-hover:translate-x-0.5 group-hover:text-[#8C592B]" />
            </Link>
          ))}
        </div>

        <div className="hidden">
          <Layers aria-hidden="true" />
        </div>

        <AuditLogView />

        {statusOpen && <IntegrationStatusModal onClose={() => setStatusOpen(false)} />}
      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
};
