import React, { useState } from 'react';
import { ChatResponse } from '../api/client';
import { CitationCard } from './CitationCard';
import { LeaveForm } from '../leave/LeaveForm';
import {
  BookOpen,
  User as UserIcon,
  CheckCircle2,
  Workflow,
  Cpu,
  Sparkles,
  Trash2,
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  responsePayload?: ChatResponse;
  leaveSubmitted?: boolean;
  attachmentName?: string;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onLeaveSubmitted?: (messageId: string, leaveId: string) => void;
  onDelete?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onLeaveSubmitted,
  onDelete,
}) => {
  const isUser = message.sender === 'user';
  const payload = message.responsePayload;
  const [showForm, setShowForm] = useState(true);

  // Parse basic markdown emphasis (bold) and bullet points for clean readability
  const renderFormattedText = (content?: string) => {
    if (!content || typeof content !== 'string') {
      return <p className={isUser ? 'text-slate-200 italic' : 'text-slate-500 italic'}>No content</p>;
    }
    return content.split('\n\n').map((paragraph, pIdx) => {
      const lines = paragraph.split('\n');
      return (
        <div key={pIdx} className={pIdx > 0 ? 'mt-3 xl:mt-4' : ''}>
          {lines.map((line, lIdx) => {
            const trimmed = line.trim();
            const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
            const rawText = isBullet ? trimmed.slice(2) : line;

            // Simple markdown bold parser (**text**)
            const parts = rawText.split(/(\*\*[^*]+\*\*)/g);
            const renderedContent = parts.map((part, partIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={partIdx} className="font-semibold text-slate-900">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            });

            if (isBullet) {
              return (
                <div key={lIdx} className="flex items-start gap-2.5 mt-1.5 xl:mt-2 pl-0.5">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full mt-2 xl:mt-2.5 shrink-0 ${
                      isUser ? 'bg-slate-300' : 'bg-[#8C592B]'
                    }`}
                  />
                  <span className="flex-1">{renderedContent}</span>
                </div>
              );
            }

            return (
              <p key={lIdx} className={lIdx > 0 ? 'mt-1 xl:mt-1.5' : ''}>
                {renderedContent}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div
      data-message-id={message.id}
      className={`group flex gap-3 xl:gap-4 my-4 xl:my-6 ${isUser ? 'justify-end' : 'justify-start'}`}
      role="article"
      aria-label={`${isUser ? 'User' : 'Assistant'} message`}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 xl:h-9 xl:w-9 shrink-0 items-center justify-center rounded-lg bg-[#8C592B] text-white shadow-xs mt-0.5">
          <BookOpen className="h-4.5 w-4.5 xl:h-5 xl:w-5 stroke-[1.8]" />
        </div>
      )}

      {/* Bubble Container */}
      <div
        className={`relative rounded-2xl p-4 sm:p-5 xl:p-6 shadow-xs transition-shadow ${
          isUser
            ? 'max-w-[85%] sm:max-w-[75%] xl:max-w-[70%] bg-slate-900 text-white rounded-br-xs'
            : 'w-full bg-white border border-slate-200/90 text-slate-900 rounded-bl-xs'
        }`}
      >
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            title="Delete this message"
            aria-label="Delete this message"
            className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {/* Main message text with contrast-checked colors */}
        {message.attachmentName && (
          <div
            className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isUser ? 'bg-white/10 text-slate-200' : 'bg-slate-100 text-slate-600'
            }`}
          >
            📎 <span className="max-w-[220px] truncate">{message.attachmentName}</span>
          </div>
        )}
        <div
          className={`text-sm sm:text-[15px] xl:text-base leading-relaxed ${
            isUser ? 'text-white font-normal' : 'text-slate-800'
          }`}
        >
          {renderFormattedText(message.text)}
        </div>

        {/* Assistant metadata, citations, and intent actions */}
        {!isUser && payload && (
          <div className="mt-3.5 xl:mt-5 pt-3 xl:pt-4 border-t border-slate-100 space-y-3 xl:space-y-4">
            {/* Status & Orchestration Badges */}
            <div className="flex flex-wrap items-center gap-2 xl:gap-2.5 text-xs xl:text-sm">
              {/* Orchestration badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 xl:px-3.5 py-1 xl:py-1.5 rounded-full font-semibold border text-xs xl:text-[13px] ${
                  payload.orchestration_mode === 'n8n_primary'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : payload.orchestration_mode === 'direct_api_fallback'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-[#F7F3EE] text-[#8C592B] border-[#E7E2DC]'
                }`}
                title={`Execution Mode: ${payload.orchestration_mode}`}
              >
                {payload.orchestration_mode === 'n8n_primary' ? (
                  <Workflow className="h-3.5 w-3.5 xl:h-4 xl:w-4 text-emerald-600" />
                ) : (
                  <Cpu className="h-3.5 w-3.5 xl:h-4 xl:w-4 text-amber-600" />
                )}
                {payload.orchestration_mode === 'n8n_primary'
                  ? 'n8n Orchestrated'
                  : payload.orchestration_mode === 'direct_api_fallback'
                  ? 'n8n Fallback (Direct API)'
                  : payload.orchestration_mode === 'direct_api_with_attachment'
                  ? 'Direct API + File'
                  : 'Direct API'}
              </span>

              {/* Confidence badge */}
              <span className="px-3 xl:px-3.5 py-1 xl:py-1.5 rounded-full font-semibold border border-slate-200 bg-slate-50 text-slate-800 text-xs xl:text-[13px]">
                Confidence: <span className="capitalize font-bold">{payload.confidence}</span>
              </span>

              {/* Intent detected */}
              {payload.intent === 'leave_request' && (
                <span className="inline-flex items-center gap-1.5 px-3 xl:px-3.5 py-1 xl:py-1.5 rounded-full font-semibold bg-[#F5EDE4] text-[#8C592B] border border-[#EADBCC] text-xs xl:text-[13px]">
                  <Sparkles className="h-3.5 w-3.5 xl:h-4 xl:w-4 text-[#8C592B]" />
                  Leave Request Detected
                </span>
              )}
            </div>

            {/* Citations list */}
            {payload.citations && payload.citations.length > 0 && (
              <div className="mt-3.5 xl:mt-4 pt-3 xl:pt-3.5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2 xl:mb-2.5">
                  <p className="text-xs xl:text-sm font-bold uppercase tracking-wider text-slate-700">
                    Official Citations ({payload.citations.length})
                  </p>
                  <span className="text-xs xl:text-sm text-slate-500 font-medium">Grounded source references</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 xl:gap-3">
                  {payload.citations.map((cite, idx) => (
                    <CitationCard key={idx} citation={cite} />
                  ))}
                </div>
              </div>
            )}

            {/* Actionable Leave Form Trigger */}
            {payload.intent === 'leave_request' && !message.leaveSubmitted && showForm && (
              <LeaveForm
                initialFields={payload.detected_leave_fields}
                onSuccess={(leaveId) => {
                  setShowForm(false);
                  if (onLeaveSubmitted) {
                    onLeaveSubmitted(message.id, leaveId);
                  }
                }}
                onCancel={() => setShowForm(false)}
              />
            )}

            {/* Leave Submitted confirmation badge */}
            {message.leaveSubmitted && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 xl:p-4 text-sm xl:text-base text-emerald-800 flex items-center gap-2.5 shadow-xs">
                <CheckCircle2 className="h-5 w-5 xl:h-6 xl:w-6 text-emerald-600 shrink-0" />
                <div>
                  <strong className="font-bold">Leave Request Submitted!</strong>
                  <p className="text-xs xl:text-sm text-emerald-700 mt-0.5">
                    Your application has been logged and routed to your Head of Department for review.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="flex h-8 w-8 xl:h-9 xl:w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs mt-0.5">
          <UserIcon className="h-4.5 w-4.5 xl:h-5 xl:w-5" />
        </div>
      )}
    </div>
  );
};
