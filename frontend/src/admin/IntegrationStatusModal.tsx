import React, { useState, useEffect } from 'react';
import { api, SystemStatus } from '../api/client';
import {
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Server,
  Database,
  BrainCircuit,
  Workflow,
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const IntegrationStatusModal: React.FC<Props> = ({ onClose }) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSystemStatus();
      setStatus(data);
      setCheckedAt(new Date());
    } catch (err: any) {
      setError(err.message || 'Could not reach the backend. Is the FastAPI service running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard restricted — still show feedback
    }
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const services = status
    ? [
        {
          key: 'backend',
          icon: Server,
          name: 'FastAPI Backend',
          state: status.backend.status,
          detail: `v${status.backend.version} · serves this console`,
          latency: null as number | null,
          error: undefined as string | undefined,
        },
        {
          key: 'database',
          icon: Database,
          name: 'PostgreSQL + pgvector',
          state: status.database.status,
          detail: status.database.detail,
          latency: status.database.latency_ms,
          error: status.database.error,
        },
        {
          key: 'ollama',
          icon: BrainCircuit,
          name: 'Local Ollama',
          state: status.ollama.status,
          detail: status.ollama.status === 'up'
            ? `${status.ollama.llm_model} · ${status.ollama.embedding_model}${
                status.ollama.models && status.ollama.models.length > 0
                  ? ` · ${status.ollama.models.length} model${status.ollama.models.length === 1 ? '' : 's'} pulled`
                  : ''
              }`
            : status.ollama.base_url,
          latency: status.ollama.latency_ms,
          error: status.ollama.error,
        },
        {
          key: 'n8n',
          icon: Workflow,
          name: 'n8n Workflows',
          state: status.n8n.status,
          detail: status.n8n.workflows.map((w) => w.name).join(' · '),
          latency: status.n8n.latency_ms,
          error: status.n8n.error,
        },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#101A2E]/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="integration-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E7E2DC] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="integration-title" className="text-lg font-extrabold tracking-tight text-[#0F1F38]">
              Integration Status
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Live health of every service behind SchoolPilot.
              {checkedAt && (
                <> Last checked {checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E2E8F0] px-3.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Re-check
            </button>
            <button
              onClick={onClose}
              aria-label="Close integration status"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading && !status ? (
          <div className="flex flex-col items-center py-12">
            <RefreshCw aria-hidden="true" className="mb-3 h-7 w-7 animate-spin text-[#8C592B]" />
            <p className="text-sm font-semibold text-slate-700" role="status">Probing services…</p>
          </div>
        ) : error && !status ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        ) : (
          status && (
            <>
              <div
                className={`mb-4 flex items-center gap-2 rounded-xl border p-3.5 text-sm font-semibold ${
                  status.overall === 'operational'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
                role="status"
              >
                {status.overall === 'operational' ? (
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
                ) : (
                  <XCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
                )}
                {status.overall === 'operational'
                  ? 'All systems operational — chat, leave routing, and search are live.'
                  : 'Degraded — one or more services are down. The app falls back to direct mode where possible.'}
              </div>

              <ul className="space-y-2.5">
                {services.map((s) => (
                  <li key={s.key} className="rounded-xl border border-[#ECE7DC] p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F9F1E5] text-[#8C592B]">
                        <s.icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-bold text-[#0F1F38]">
                          {s.name}
                          {s.latency != null && (
                            <span className="font-mono text-[11px] font-medium text-slate-400">{s.latency} ms</span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-slate-500">{s.detail}</p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold uppercase ${
                          s.state === 'up' ? 'bg-[#E9F7EF] text-[#15803D]' : 'bg-[#FDECEC] text-[#C81E1E]'
                        }`}
                        role="status"
                        aria-label={`${s.name} is ${s.state === 'up' ? 'up' : 'down'}`}
                      >
                        {s.state === 'up' ? (
                          <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {s.state === 'up' ? 'Up' : 'Down'}
                      </span>
                    </div>
                    {s.error && (
                      <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs leading-relaxed text-red-700" role="alert">
                        {s.error}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {/* webhook URLs */}
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  n8n webhook endpoints
                </p>
                <ul className="space-y-1.5">
                  {status.n8n.workflows.map((w) => (
                    <li
                      key={w.url}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
                    >
                      <span className="min-w-0 truncate" title={w.url}>
                        <span className="mr-2 font-sans font-semibold text-slate-700">{w.name}</span>
                        {w.url}
                      </span>
                      <button
                        onClick={() => copyUrl(w.url)}
                        className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 font-sans text-[11px] font-semibold text-[#8C592B] hover:bg-[#F1E8D8]"
                        aria-label={`Copy ${w.name} webhook URL`}
                      >
                        {copiedUrl === w.url ? (
                          <><Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" /> Copied</>
                        ) : (
                          <><Copy aria-hidden="true" className="h-3.5 w-3.5" /> Copy</>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <a
                  href="http://localhost:5678"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E2E8F0] px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open n8n dashboard <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </a>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};
