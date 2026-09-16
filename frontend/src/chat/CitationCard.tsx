import React, { useState } from 'react';
import { Citation } from '../api/client';
import { FileText, ChevronDown, ChevronUp, Quote } from 'lucide-react';

interface CitationCardProps {
  citation: Citation;
}

export const CitationCard: React.FC<CitationCardProps> = ({ citation }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 xl:p-4 text-xs sm:text-[13px] xl:text-sm transition-colors hover:border-slate-300 shadow-2xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-md bg-[#F7F3EE] px-2 xl:px-2.5 py-0.5 text-xs font-bold text-[#8C592B] border border-[#F0EAE3]">
            Source {citation.source_id}
          </span>
          <span className="flex items-center gap-1.5 text-xs sm:text-[13px] xl:text-sm font-semibold text-slate-900 truncate" title={citation.document_name}>
            <FileText className="h-4 w-4 xl:h-4.5 xl:w-4.5 shrink-0 text-[#8C592B]" />
            <span className="truncate">{citation.document_name}</span>
          </span>
          <span className="shrink-0 text-xs xl:text-[13px] font-medium text-slate-500">
            p. {citation.page_number}
          </span>
        </div>

        <div className="shrink-0 text-slate-500">
          {expanded ? <ChevronUp className="h-4 w-4 xl:h-4.5 xl:w-4.5" /> : <ChevronDown className="h-4 w-4 xl:h-4.5 xl:w-4.5" />}
        </div>
      </button>

      {citation.section_title && (
        <div className="mt-1.5 pl-1 text-xs xl:text-[13px] font-medium text-slate-600 truncate">
          Section: <span className="text-slate-900 font-semibold">{citation.section_title}</span>
        </div>
      )}

      {expanded && (
        <div className="mt-2.5 xl:mt-3 rounded-lg border-l-2 border-[#8C592B] bg-slate-50 p-3 xl:p-3.5 shadow-2xs">
          <div className="flex items-start gap-2.5 text-slate-800">
            <Quote className="h-4 w-4 xl:h-4.5 xl:w-4.5 shrink-0 text-[#8C592B] mt-0.5" />
            <p className="text-xs sm:text-[13px] xl:text-sm leading-relaxed italic text-slate-700">
              "{citation.exact_quote}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
