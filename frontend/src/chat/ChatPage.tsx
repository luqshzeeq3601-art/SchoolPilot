import React, { useEffect, useRef, useState } from 'react';
import { api, ChatResponse } from '../api/client';
import { MessageBubble, ChatMessage } from './MessageBubble';
import heroBooksPlant from '../assets/hero-books-plant-transparent.png';
import {
  Loader2,
  FileText,
  Calendar,
  Users,
  Search,
  Lightbulb,
  Paperclip,
  Sparkles,
  ArrowRight,
  ArrowDown,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

const ACCEPTED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg'];
const ACCEPT_ATTR = '.pdf,.png,.jpg,.jpeg';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const SAMPLE_PROMPTS = [
  { label: 'Emergency leave', prompt: 'What is the procedure if I need emergency leave tomorrow?' },
  { label: 'MC entitlement', prompt: 'How many days of medical certificate (MC) am I entitled to each year?' },
  { label: 'Invigilation rules', prompt: 'What are the examination invigilation protocols?' },
];

const FEATURE_CARDS = [
  {
    title: 'School Policies',
    description: 'Ask about rules, guidelines and procedures',
    icon: FileText,
    colorClasses: 'bg-[#FFF7ED] text-[#EA580C] border border-[#FFEDD5]',
    prompt: 'What are the official school guidelines, staff handbook rules, and administrative procedures?',
  },
  {
    title: 'Leave & Attendance',
    description: 'Check leave eligibility and requirements',
    icon: Calendar,
    colorClasses: 'bg-[#ECFDF5] text-[#059669] border border-[#D1FAE5]',
    prompt: 'What are the staff leave entitlements, eligibility rules, and attendance requirements?',
  },
  {
    title: 'HR & Administration',
    description: 'Get information on HR processes and forms',
    icon: Users,
    colorClasses: 'bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]',
    prompt: 'What are the HR administrative processes, allowances, claims, and staff welfare benefits?',
  },
  {
    title: 'Find a Regulation',
    description: 'Search specific circulars and references',
    icon: Search,
    colorClasses: 'bg-[#FFF1F2] text-[#E11D48] border border-[#FFE4E6]',
    prompt: 'Search Ministry circulars, examination invigilation guidelines, and official regulations.',
  },
];

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', sender: 'assistant', text: 'Welcome to SchoolPilot.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const chatContainerRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isWelcomeState = messages.length === 1 && messages[0].id === 'welcome';

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceFromBottom > 120);
  };

  useEffect(() => {
    if (!chatContainerRef.current) return;
    const container = chatContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const wasNearBottom = scrollHeight - scrollTop - clientHeight < 250;

    if (loading || wasNearBottom || messages.length <= 2) {
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!showDeleteModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDeleteModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDeleteModal]);

  const deleteCount = messages.filter((m) => m.id !== 'welcome').length;

  const handleFileSelect = (file: File | undefined) => {
    setAttachmentError(null);
    if (!file) return;
    const lower = file.name.toLowerCase();
    const okExt = ACCEPTED_EXTS.some((ext) => lower.endsWith(ext));
    if (!okExt) {
      setAttachmentError('Only PDF, PNG, or JPG allowed (max 10MB).');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setAttachmentError('File exceeds 10MB session limit.');
      return;
    }
    setAttachment(file);
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const attachedFile = attachment;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: textToSend,
        attachmentName: attachedFile?.name,
      },
    ]);
    setInput('');
    setAttachment(null);
    setAttachmentError(null);
    setLoading(true);

    try {
      const response: ChatResponse = attachedFile
        ? await api.sendQueryWithFile(textToSend, attachedFile)
        : await api.sendQuery(textToSend);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: response.answer,
          responsePayload: response,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ System Error: ${
            err.message || 'Failed to process question'
          }. Please verify backend & Ollama connectivity.`,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleResetChat = () => {
    setMessages([{ id: 'welcome', sender: 'assistant', text: 'Welcome to SchoolPilot.' }]);
    setInput('');
    setAttachment(null);
    setAttachmentError(null);
  };

  const handleDeleteConversation = () => {
    if (isWelcomeState || loading) return;
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteConversation = () => {
    setShowDeleteModal(false);
    handleResetChat();
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx === -1) return prev;
      const target = prev[idx];
      // Deleting a user question also removes its paired assistant reply (next item)
      // to keep the conversation coherent.
      if (target.sender === 'user' && prev[idx + 1]?.sender === 'assistant') {
        return [...prev.slice(0, idx), ...prev.slice(idx + 2)];
      }
      return prev.filter((m) => m.id !== messageId);
    });
  };

  const handleLeaveSubmitted = (messageId: string, _leaveId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, leaveSubmitted: true } : msg
      )
    );
  };

  return (
    <div className="flex h-full flex-col bg-[#FAF8F5] text-slate-900 overflow-hidden">
      {/* Scrollable Workspace Container */}
      <div className="relative flex-1 min-h-0 w-full">
        <main
          ref={chatContainerRef}
          onScroll={handleScroll}
          tabIndex={-1}
          className="h-full w-full overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 xl:px-12 focus:outline-none"
        >
          <div className="mx-auto w-full max-w-7xl xl:max-w-[1560px] 2xl:max-w-[1680px]">
            {isWelcomeState ? (
              <div className="mx-auto flex w-full flex-col justify-start pb-4">
                {/* Hero Card matching reference design with crisp assets & typography */}
                <section
                  className="relative rounded-3xl border border-[#E7E2DC] bg-white overflow-hidden shadow-sm mb-4 flex flex-col md:flex-row items-stretch min-h-[260px] lg:min-h-[280px]"
                  aria-label="Welcome Hero"
                >
                  {/* Left Half: Typography & Branding (No artificial blur) */}
                  <div className="flex-1 p-6 sm:p-8 lg:p-10 xl:p-12 flex flex-col justify-center relative z-10">
                    <p className="text-xs lg:text-[13px] font-bold tracking-[0.22em] uppercase text-[#8C592B] mb-2.5">
                      SCHOOL OPERATIONAL ASSISTANT
                    </p>

                    <h1 className="font-sans text-3xl sm:text-4xl lg:text-[42px] xl:text-[46px] font-extrabold text-[#101A2E] leading-[1.12] tracking-tight">
                      Welcome to<br />SchoolPilot
                    </h1>

                    <p className="mt-3.5 text-sm sm:text-base xl:text-[16px] leading-relaxed text-slate-600 max-w-xl font-normal">
                      Ask questions regarding Sri Cempaka's staff handbook, leave policies, and administrative SOPs with grounded citations.
                    </p>

                    <div className="mt-4 flex items-center gap-2.5 text-xs sm:text-sm xl:text-[14px] text-[#8C592B] font-medium">
                      <span className="w-7 h-[1.5px] bg-[#8C592B]/50 inline-block" />
                      <span>Smarter answers. A more supported school community.</span>
                    </div>
                  </div>

                  {/* Right Half: Ultra-sharp Editorial Composition with SVG Curve & Crisp Typography */}
                  <div className="w-full md:w-[48%] lg:w-[50%] relative flex items-center justify-between px-6 py-4 sm:px-8 bg-[#FAF8F5] overflow-hidden min-h-[240px] lg:min-h-[275px]">
                    {/* Smooth Organic SVG Curve (Razor Sharp Vector Math, Zero Blur) */}
                    <svg
                      className="absolute inset-0 w-full h-full text-[#F4EDE3] pointer-events-none"
                      preserveAspectRatio="none"
                      viewBox="0 0 500 280"
                      fill="currentColor"
                    >
                      <path d="M70,0 C150,45 135,165 205,210 C265,250 345,230 500,280 L500,0 Z" />
                    </svg>

                    {/* Left: Script Tagline (Sharp Caveat Web Font) */}
                    <div className="relative z-10 max-w-[160px] xl:max-w-[190px] select-none pl-2">
                      <p className="font-script text-2xl xl:text-3xl font-semibold text-[#8C592B] leading-snug -rotate-3">
                        Supporting great educators, every day.
                      </p>
                    </div>

                    {/* Center: High-Resolution Crisp Potted Plant & Books (499x682 Native Asset) */}
                    <div className="relative z-10 flex items-center justify-center flex-1 max-w-[260px] xl:max-w-[290px] h-full py-2">
                      <img
                        src={heroBooksPlant}
                        alt="SchoolPilot - People, Policies, Progress"
                        className="max-h-[210px] xl:max-h-[240px] w-auto object-contain drop-shadow-sm select-none pointer-events-none"
                      />
                    </div>

                    {/* Right: Editorial Stamp Typography (Sharp Vector Font) */}
                    <div className="relative z-10 hidden sm:flex flex-col items-center gap-1.5 text-[10px] xl:text-[11px] font-bold tracking-[0.25em] text-[#8C592B] uppercase select-none pr-2">
                      <span>People</span>
                      <span>Policies</span>
                      <span>Progress</span>
                      <span className="w-6 h-[1.5px] bg-[#8C592B]/40 mt-1" />
                    </div>
                  </div>
                </section>

                {/* 4 Feature Cards in 4-Column Grid */}
                <section
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5 mb-4 xl:mb-5"
                  aria-label="Quick Navigation Cards"
                >
                  {FEATURE_CARDS.map(({ title, description, icon: Icon, colorClasses, prompt }) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      className="group rounded-2xl border border-[#E7E2DC] bg-white p-5 xl:p-6 text-left shadow-sm hover:shadow-md hover:border-[#D7BA9C] transition-all duration-150 flex flex-col justify-between relative cursor-pointer"
                    >
                      <div>
                        <div className={`flex h-11 w-11 xl:h-12 xl:w-12 items-center justify-center rounded-xl ${colorClasses}`}>
                          <Icon className="h-5 w-5 xl:h-6 xl:w-6 stroke-[1.8]" />
                        </div>
                        <h3 className="mt-3.5 text-base xl:text-lg font-bold text-[#101A2E] leading-snug">
                          {title}
                        </h3>
                        <p className="mt-1.5 text-xs sm:text-sm xl:text-[14px] text-slate-500 leading-relaxed max-w-[85%] font-normal">
                          {description}
                        </p>
                      </div>

                      <div className="absolute bottom-5 right-5 xl:bottom-6 xl:right-6 flex h-8 w-8 xl:h-9 xl:w-9 items-center justify-center rounded-full bg-[#FAF8F5] border border-[#E7E2DC] text-slate-400 group-hover:bg-[#8C592B] group-hover:text-white group-hover:border-[#8C592B] transition-all">
                        <ArrowRight className="h-4 w-4 xl:h-5 xl:w-5" />
                      </div>
                    </button>
                  ))}
                </section>

                {/* "Try asking" Suggestion Bar */}
                <section
                  className="rounded-2xl border border-[#E7E2DC] bg-white p-3.5 sm:px-6 sm:py-4 flex flex-col lg:flex-row lg:items-center gap-3.5 lg:gap-5 mb-4 xl:mb-5 shadow-sm"
                  aria-label="Prompt Suggestions"
                >
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 border border-amber-100">
                      <Lightbulb className="h-5 w-5 text-amber-600 stroke-[2]" />
                    </div>
                    <div>
                      <h4 className="text-sm xl:text-base font-bold text-[#101A2E] leading-tight">
                        Try asking
                      </h4>
                      <p className="text-xs xl:text-sm text-slate-400 font-normal mt-0.5 hidden sm:block">
                        Here are some examples to get you started.
                      </p>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-200 hidden lg:block" />

                  <div className="flex flex-wrap items-center gap-2.5">
                    {SAMPLE_PROMPTS.map(({ label, prompt }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        title={prompt}
                        className="rounded-full border border-[#E7E2DC] bg-white hover:bg-[#FAF8F5] hover:border-[#D7BA9C] hover:text-[#8C592B] px-4 py-2 text-xs sm:text-sm xl:text-[14px] text-slate-700 transition-colors shadow-sm cursor-pointer"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              /* Active Conversation Feed */
              <section className="space-y-4 pb-6 max-w-4xl mx-auto" aria-label="Conversation history">
                {/* Active Session Header with Reset Button */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E7E2DC] mb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs sm:text-sm font-semibold text-[#101A2E]">
                      Live Policy Consultation
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetChat}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E2DC] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-[#FAF8F5] hover:text-[#8C592B] transition-colors shadow-sm"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>New Topic</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteConversation}
                      disabled={loading}
                      title="Delete this conversation"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E2DC] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete chat</span>
                    </button>
                  </div>
                </div>

                {messages
                  .filter((message) => message.id !== 'welcome')
                  .map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      onLeaveSubmitted={handleLeaveSubmitted}
                      onDelete={loading ? undefined : handleDeleteMessage}
                    />
                  ))}

                {loading && (
                  <div className="my-4 flex items-center gap-3 text-sm text-slate-600 animate-pulse">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8C592B] text-white">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-[#E7E2DC] bg-white p-3.5 shadow-sm text-xs sm:text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-[#8C592B]" />
                      <span>Consulting institutional policies and generating grounded response...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </section>
            )}
          </div>
        </main>

        {/* Floating Scroll to Bottom Button */}
        {showScrollBottom && !isWelcomeState && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            aria-label="Scroll to latest messages"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 rounded-full border border-[#D7BDA3] bg-white px-4 py-2 text-xs xl:text-sm font-semibold text-[#8C592B] shadow-md transition-all hover:bg-[#FAF8F5] hover:border-[#8C592B] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
          >
            <ArrowDown className="h-4 w-4 animate-bounce" />
            <span>Scroll to bottom</span>
          </button>
        )}
      </div>

      {/* Docked Bottom Input Bar matching reference */}
      <footer className="w-full shrink-0 border-t border-[#F0EBE5] bg-[#FAF8F5] px-4 py-3 sm:px-6 lg:px-8 xl:px-12">
        <div className="mx-auto w-full max-w-7xl xl:max-w-[1560px] 2xl:max-w-[1680px]">
          {(attachment || attachmentError) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {attachment && (
                <span className="inline-flex items-center gap-2 rounded-full border border-[#E7E2DC] bg-white px-3 py-1.5 text-xs font-semibold text-[#101A2E] shadow-sm">
                  <FileText className="h-3.5 w-3.5 text-[#8C592B]" />
                  <span className="max-w-[240px] truncate">{attachment.name}</span>
                  <span className="text-slate-400 font-normal">
                    {(attachment.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    aria-label="Remove attachment"
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              {attachmentError && (
                <span className="text-xs font-medium text-red-600">{attachmentError}</span>
              )}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="rounded-2xl border border-[#E7E2DC] bg-white p-2.5 sm:p-3 shadow-sm flex items-center gap-3"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 w-10 xl:h-11 xl:w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-200/70 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0 cursor-pointer"
              title="Attach PDF or image (max 10MB)"
            >
              <Paperclip className="h-4 w-4 xl:h-5 xl:w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => {
                handleFileSelect(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                attachment
                  ? `Ask about ${attachment.name}...`
                  : 'Ask a school policy question, or request leave...'
              }
              disabled={loading}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm xl:text-base text-[#101A2E] placeholder:text-slate-400 outline-none"
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#8C592B] hover:bg-[#73461E] text-white px-6 py-2.5 xl:py-3 text-sm xl:text-base font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4 fill-white/20" />
                  <span>Ask / Apply</span>
                </>
              )}
            </button>
          </form>
          <p className="mt-1.5 text-[11px] text-slate-400">
            PDF, PNG, JPG up to 10MB. File is used for this answer only — not saved to the shared knowledge base.
          </p>
        </div>
      </footer>

      {/* Delete conversation confirmation modal — same visual language as Integration Status */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#101A2E]/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-chat-title"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[#E7E2DC] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: icon tile + title/subtitle + close, mirrors Integration Status */}
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FAF3E8] text-[#8C592B]">
                  <Trash2 aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h2
                    id="delete-chat-title"
                    className="text-xl font-extrabold tracking-tight text-[#0F1F38]"
                  >
                    Delete conversation
                  </h2>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    This clears the current consultation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close delete dialog"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            {/* Warning banner: same shape as the green operational banner, in danger tones */}
            <div
              className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-[#FDECEC] p-3.5"
              role="alert"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C81E1E] text-white">
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-[#7F1D1D]">
                  {deleteCount} message{deleteCount === 1 ? '' : 's'} will be removed permanently.
                </p>
                <p className="text-[13px] text-red-800/70">
                  This cannot be undone.
                </p>
              </div>
            </div>

            {/* Summary row: same card pattern as FastAPI/Postgres service rows */}
            <div className="rounded-xl border border-[#ECE7DC] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F9F1E5] text-[#8C592B]">
                  <Search aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0F1F38]">
                    Live Policy Consultation{' '}
                    <span className="ml-1.5 font-mono text-[11px] font-medium text-slate-400">
                      {deleteCount} msgs
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">
                    Session-only history · not saved to the knowledge base
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#FDECEC] px-2 py-1 text-[11px] font-bold uppercase text-[#C81E1E]">
                  Unsaved
                </span>
              </div>
            </div>

            {/* Actions: outline Cancel like Re-check, solid danger Delete */}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                autoFocus
                className="inline-flex h-10 items-center rounded-xl border border-[#E2E8F0] px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteConversation}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#C81E1E] px-4 text-[13px] font-semibold text-white hover:bg-[#A31616] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

