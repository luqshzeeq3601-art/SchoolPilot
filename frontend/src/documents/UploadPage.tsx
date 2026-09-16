import React, { useState, useEffect, useRef } from 'react';
import { api, DocumentItem } from '../api/client';
import {
  FileText,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Loader2,
  Search,
  Database,
} from 'lucide-react';

export const UploadPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const list = await api.getDocuments();
      setDocuments(list);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load documents' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const processUpload = async (file: File) => {
    const lower = file.name.toLowerCase();
    const allowed = ['.pdf', '.docx', '.md', '.txt'];
    if (!allowed.some((ext) => lower.endsWith(ext))) {
      setMessage({ type: 'error', text: 'Unsupported file format. Please upload PDF, DOCX, MD, or TXT.' });
      return;
    }
    if (file.size === 0) {
      setMessage({ type: 'error', text: 'Uploaded file is empty.' });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File exceeds 25MB limit.' });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const res = await api.uploadDocument(file);
      setMessage({
        type: 'success',
        text: `Indexed "${file.name}" — created ${res.chunks_created} vector chunks.`,
      });
      await fetchDocs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Document upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUpload(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUpload(file);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}"? Its vectors will be purged from pgvector.`)) return;
    try {
      await api.deleteDocument(id);
      setMessage({ type: 'success', text: `Removed "${name}".` });
      await fetchDocs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete document' });
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalChunks = documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0);

  return (
    <div className="min-h-full bg-white text-[#101A2E]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10 2xl:max-w-[1400px]">
        {/* Header — matches reference: small solid icon, tight title, compact pills */}
        <div className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#8C592B] text-white lg:h-12 lg:w-12 lg:rounded-xl">
              <FileText aria-hidden="true" className="h-[18px] w-[18px] stroke-[2] lg:h-6 lg:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight tracking-tight text-[#101E33] sm:text-2xl lg:text-[28px]">
                Institutional Document Repository &amp; RAG Index
              </h1>
              <p className="mt-1 text-[13px] font-normal leading-relaxed text-[#64748B] lg:max-w-2xl lg:text-[15px]">
                Manage school handbooks, circulars, and standard operating procedures that ground the AI assistant
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2" role="status" aria-label="Repository totals">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E7E2DC] bg-white px-3.5 text-[13px] font-medium text-slate-600 lg:h-11 lg:px-4 lg:text-sm">
              <FileText aria-hidden="true" className="h-4 w-4 text-slate-500" />
              <strong className="font-bold text-[#101A2E]">{documents.length}</strong> Documents
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#EADDCB] bg-[#F7F1E6] px-3.5 text-[13px] font-medium text-[#8C592B] lg:h-11 lg:px-4 lg:text-sm">
              <Layers aria-hidden="true" className="h-4 w-4" />
              <strong className="font-bold">{totalChunks}</strong> Vector Chunks
            </span>
          </div>
        </div>

        {message && (
          <div
            role="alert"
            className={`mb-5 flex items-center gap-2 rounded-xl border p-3.5 text-[13px] lg:text-sm ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-red-600" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {/* Upload — single dashed card exactly like reference */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload document. Press Enter to browse."
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#8C592B] sm:py-14 lg:py-16 ${
            isDragOver ? 'border-solid border-[#8C592B] bg-[#FFFEFB]' : 'border-[#C9A87F]/70'
          }`}
        >
          <div className="mx-auto flex max-w-lg flex-col items-center lg:max-w-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F9F1E5] text-[#8C592B] lg:h-14 lg:w-14">
              {uploading ? (
                <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
              ) : (
                <Upload aria-hidden="true" className="h-6 w-6 stroke-[1.9]" />
              )}
            </div>
            <h2 className="text-base font-bold text-[#101E33] sm:text-[17px] lg:text-xl">
              {uploading ? 'Processing & Vectorizing…' : 'Upload School Handbook or SOP Document'}
            </h2>
            <p className="mt-2 max-w-sm text-[13px] font-normal leading-relaxed text-slate-500 lg:max-w-lg lg:text-[15px]">
              Drag &amp; drop a file here, or browse from your computer. Our pipeline performs heading-aware
              chunking and 768-dim embeddings.
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5" aria-label="Accepted formats">
              {['.PDF', '.DOCX', '.MD', '.TXT'].map((fmt) => (
                <span
                  key={fmt}
                  className="rounded-md border border-[#EDE5D6] bg-[#FAF7F2] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase text-slate-600 lg:text-xs"
                >
                  {fmt}
                </span>
              ))}
            </div>
            <button
              type="button"
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="mt-5 inline-flex h-10 cursor-pointer items-center rounded-lg bg-[#8C592B] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#7A4C1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] focus-visible:ring-offset-2 disabled:opacity-60 lg:h-12 lg:px-7 lg:text-[15px]"
            >
              {uploading ? 'Embedding Vectors…' : 'Upload'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.md,.txt"
              onChange={handleFileInputChange}
              disabled={uploading}
              className="sr-only"
              aria-label="Choose file"
            />
          </div>
        </div>

        {/* Ledger — header + thead share warm wash like reference */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)] lg:mt-8">
          <div className="flex flex-col gap-3 border-b border-[#E5E7EB] bg-[#F8FAFC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-7">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-[#1E3A5F] lg:text-[13px]">
              <Database aria-hidden="true" className="h-4 w-4 text-[#8C592B] lg:h-5 lg:w-5" />
              Indexed Documents ({filteredDocs.length})
            </h2>
            <div className="relative">
              <label htmlFor="doc-filter" className="sr-only">
                Filter documents
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="doc-filter"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter documents…"
                className="h-10 w-full rounded-lg border border-[#D1D5DB] bg-white pl-10 pr-3 text-[13px] text-[#101A2E] outline-none placeholder:text-slate-400 focus:border-[#8C592B] focus:ring-2 focus:ring-[#8C592B]/20 sm:w-64 lg:h-11 lg:w-72 lg:text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-16">
              <Loader2 aria-hidden="true" className="mb-3 h-7 w-7 animate-spin text-[#8C592B]" />
              <p className="text-sm font-semibold text-slate-700 lg:text-[15px]" role="status">Loading document repository…</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <FileText aria-hidden="true" className="mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-bold text-slate-700 lg:text-[15px]">No documents found</p>
              <p className="mt-1 text-[13px] text-slate-500 lg:text-sm">
                {searchQuery ? 'No matches for this filter.' : 'Upload your first manual above.'}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 lg:text-xs">
                      <th scope="col" className="px-6 py-4 lg:px-7">Document name</th>
                      <th scope="col" className="px-4 py-4">Format</th>
                      <th scope="col" className="px-4 py-4">Vector chunks</th>
                      <th scope="col" className="px-4 py-4">Indexed at</th>
                      <th scope="col" className="px-4 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {filteredDocs.map((doc) => (
                      <tr key={doc.id} className="transition-colors hover:bg-[#FFFEFB]">
                        <td className="px-6 py-4 lg:px-7 lg:py-5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F9F1E5] text-[#8C592B] lg:h-11 lg:w-11">
                              <FileText aria-hidden="true" className="h-[18px] w-[18px] lg:h-5 lg:w-5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-[#101E33] lg:text-[15px]">{doc.filename}</p>
                              <p className="mt-1 font-mono text-[11px] text-slate-500 lg:text-xs">
                                SHA256:{' '}
                                <span className="ml-1">{doc.file_hash.substring(0, 16)}…</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-block rounded-md border border-[#E9D5FF] bg-[#F5EDFF] px-2.5 py-1 text-[11px] font-bold uppercase text-[#7C3AED] lg:text-xs">
                            {doc.file_type.toLowerCase().includes('pdf')
                              ? 'PDF'
                              : doc.file_type.toLowerCase().includes('doc')
                                ? 'DOCX'
                                : doc.file_type.toLowerCase().includes('txt')
                                  ? 'TXT'
                                  : 'MD'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EADDCB] bg-[#FAF3E8] px-3 py-1.5 text-xs font-semibold text-[#8C592B] lg:text-[13px]">
                            <Layers aria-hidden="true" className="h-3.5 w-3.5" />
                            {doc.chunk_count} Chunks
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-xs font-normal tabular-nums text-slate-500 lg:text-[13px]">
                          {new Date(doc.created_at).toLocaleDateString()}{' '}
                          {new Date(doc.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => handleDelete(doc.id, doc.filename)}
                            aria-label={`Delete ${doc.filename}`}
                            title="Delete document"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                          >
                            <Trash2 aria-hidden="true" className="h-[18px] w-[18px]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[#EEF2F7] md:hidden">
                {filteredDocs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F9F1E5] text-[#8C592B]">
                        <FileText aria-hidden="true" className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-[#101E33]">{doc.filename}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {doc.file_hash.substring(0, 12)}… · {doc.chunk_count} chunks
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      aria-label={`Delete ${doc.filename}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 aria-hidden="true" className="h-[18px] w-[18px]" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
};
