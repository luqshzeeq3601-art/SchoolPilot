import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { api } from '../api/client';
import loginBg from '../assets/login-bg.jpg';
import {
  GraduationCap,
  Shield,
  Users,
  AlertCircle,
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

interface DemoRole {
  role: string;
  name: string;
  email: string;
  icon: React.ElementType;
}

const DEMO_ROLES: DemoRole[] = [
  {
    role: 'Admin',
    name: 'Pn. Zaleha',
    email: 'admin@cempaka.edu.my',
    icon: Shield,
  },
  {
    role: 'HoD',
    name: 'Dr. Ramesh',
    email: 'hod.science@cempaka.edu.my',
    icon: Users,
  },
  {
    role: 'Teacher',
    name: 'Cikgu Azman',
    email: 'teacher.azman@cempaka.edu.my',
    icon: GraduationCap,
  },
];

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('teacher.azman@cempaka.edu.my');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const errorRef = useRef<HTMLDivElement>(null);

  const emailInvalid =
    touchedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  const handleLogin = async (
    e?: React.FormEvent,
    customEmail?: string,
    customPassword?: string
  ) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const emailToUse = (customEmail || email).trim();
    const passwordToUse = customPassword || password;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToUse)) {
      setError('Enter a valid staff email, e.g. teacher.azman@cempaka.edu.my.');
      setLoading(false);
      return;
    }

    try {
      const res = await api.login({ email: emailToUse, password: passwordToUse });
      login(res.access_token, {
        id: res.user_id,
        email: res.email,
        full_name: res.full_name,
        role: res.role as any,
        department: res.department,
        is_active: true,
      });
      navigate('/');
    } catch (err: any) {
      setError(
        err.message ||
          'Sign-in failed. Check your email and password, then try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoRole: DemoRole) => {
    setEmail(demoRole.email);
    setPassword('Password123!');
    handleLogin(undefined, demoRole.email, 'Password123!');
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#FAF7F2] text-[#101A2E] flex flex-col justify-between select-text">
      {/* Skip link for keyboard navigation */}
      <a
        href="#login-card"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#101A2E] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to sign-in form
      </a>

      {/* Sunlit Study Photographic Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        {/* Soft subtle warmth gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white/40" />
      </div>

      {/* Top Eyebrow */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-6 sm:pt-8 flex justify-end">
        <p className="flex items-center gap-3 text-[11px] xl:text-xs font-semibold uppercase tracking-[0.25em] text-[#8C6D48]">
          <span>PEOPLE</span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#8C6D48]" />
          <span>POLICIES</span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#8C6D48]" />
          <span>PROGRESS</span>
          <span aria-hidden="true" className="ml-2 hidden sm:inline-block h-[1.5px] w-12 bg-[#8C6D48]" />
        </p>
      </header>

      {/* Main 3-Column Layout: Left Editorial, Center Card, Right Script */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex items-center justify-between gap-6 lg:gap-10">
        {/* Left: Decorative Editorial (hidden on mobile) */}
        <aside aria-hidden="true" className="hidden lg:flex flex-col justify-center max-w-[260px] xl:max-w-[300px] select-none pl-4 xl:pl-8">
          <p className="font-serif text-[34px] xl:text-[42px] font-medium leading-[1.08] text-[#9E8669]">
            <span className="align-top text-[26px] leading-none">“</span>Better<br />
            Schools<br />
            Brighter<br />
            Tomorrows<span className="text-[24px]">’</span>
          </p>
          <div className="my-4 h-[1.5px] w-10 bg-[#8C592B]" />
          <p className="text-[10px] xl:text-[11px] font-bold uppercase leading-[1.8] tracking-[0.24em] text-[#7A6A52]">
            SUPPORTING<br />
            EDUCATORS,<br />
            EMPOWERING<br />
            COMMUNITIES.
          </p>
        </aside>

        {/* Center: Login Form Section */}
        <section aria-labelledby="login-title" className="mx-auto w-full max-w-[430px]">
          {/* Brand Header with Squircle Logo */}
          <div className="mb-4 flex items-center justify-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7A4C1E] text-white shadow-md">
              <GraduationCap aria-hidden="true" className="h-6 w-6 stroke-[2]" />
            </div>
            <div className="text-left">
              <h1 id="login-title" className="text-2xl sm:text-[26px] font-extrabold leading-none tracking-tight text-[#101A2E]">
                SchoolPilot
              </h1>
              <p className="mt-1.5 text-xs sm:text-[13px] font-medium text-slate-500">
                Institutional AI Policy &amp; Workflow Platform
              </p>
            </div>
          </div>

          {/* White Card */}
          <div
            id="login-card"
            tabIndex={-1}
            className="rounded-3xl border border-[#E7E2DC]/90 bg-white p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.03)] outline-none"
          >
            {error && (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                aria-live="polite"
                className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs sm:text-[13px] leading-relaxed text-red-800"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={(e) => handleLogin(e)} noValidate={false} className="space-y-4">
              <div>
                <label htmlFor="email-input" className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Staff Email Address
                </label>
                <div
                  className={`flex min-h-[46px] items-center rounded-xl border bg-white px-3.5 text-sm transition-colors duration-150 focus-within:border-[#8C592B] focus-within:ring-2 focus-within:ring-[#8C592B]/15 ${
                    emailInvalid || error ? 'border-red-300' : 'border-slate-200'
                  }`}
                >
                  <Mail aria-hidden="true" className="mr-2.5 h-4.5 w-4.5 shrink-0 text-slate-400" />
                  <input
                    id="email-input"
                    type="email"
                    required
                    aria-required="true"
                    aria-invalid={emailInvalid ? true : undefined}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouchedEmail(true)}
                    placeholder="teacher.azman@cempaka.edu.my"
                    className="h-[44px] w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
                {emailInvalid && (
                  <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                    Enter a valid email address.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password-input" className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <div className="flex min-h-[46px] items-center rounded-xl border border-slate-200 bg-white pl-3.5 pr-1.5 text-sm transition-colors duration-150 focus-within:border-[#8C592B] focus-within:ring-2 focus-within:ring-[#8C592B]/15">
                  <Lock aria-hidden="true" className="mr-2.5 h-4.5 w-4.5 shrink-0 text-slate-400" />
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    aria-required="true"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-[44px] w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-[#F5EDE4] hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="h-4.5 w-4.5" />
                    ) : (
                      <Eye aria-hidden="true" className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Primary Sign In Button in Warm Brown */}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="mt-2 flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#734320] hover:bg-[#603617] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C592B] disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-4.5 w-4.5 animate-spin" />
                    <span aria-live="polite">Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 stroke-[2]" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Switch Demo Accounts Divider */}
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#F0EBE5]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[10px] xl:text-[11px] font-bold tracking-[0.14em] text-slate-400 uppercase">
                  Quick Switch Demo Accounts
                </span>
              </div>
            </div>

            {/* Demo Accounts 3-Column Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {DEMO_ROLES.map((demo) => {
                const Icon = demo.icon;
                const active = email === demo.email;
                return (
                  <button
                    key={demo.role}
                    type="button"
                    onClick={() => handleQuickLogin(demo)}
                    disabled={loading}
                    aria-pressed={active}
                    aria-label={`Sign in as ${demo.role}, ${demo.name}`}
                    className={`group flex min-h-[74px] cursor-pointer flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center transition-all duration-150 ${
                      active
                        ? 'border-[#8C592B] bg-[#F7F1EA] shadow-2xs'
                        : 'border-[#EDE6DC] bg-[#FAF8F5] hover:border-[#D7BA9C] hover:bg-white hover:shadow-xs'
                    }`}
                  >
                    <Icon
                      aria-hidden="true"
                      className="mb-1 h-5 w-5 text-[#8C592B] transition-transform duration-150 group-hover:scale-110"
                    />
                    <span className="text-xs font-bold leading-tight text-[#101A2E]">
                      {demo.role}
                    </span>
                    <span className="mt-0.5 max-w-full truncate text-[11px] text-slate-500 font-normal">
                      {demo.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-Footer */}
          <div className="mt-4 text-center">
            <p className="text-xs font-bold text-slate-800">Sri Cempaka School</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Institutional Policy &amp; Workflow System
            </p>
          </div>
        </section>

        {/* Right: Script Callout (hidden on mobile) */}
        <aside aria-hidden="true" className="hidden lg:flex flex-col items-start justify-center max-w-[260px] xl:max-w-[300px] select-none pr-4 xl:pr-8">
          <div className="-rotate-[4deg]">
            <p className="font-script text-[36px] xl:text-[44px] leading-[1.08] text-[#8C6A43] font-semibold">
              Same<br />
              People.<span className="text-[24px]">”</span><br />
              Greater<br />
              Impact.
            </p>
            <div className="mt-1.5 h-[2px] w-14 bg-[#8C6A43]/50" />
          </div>
        </aside>
      </main>

      {/* Subtle bottom spacer for alignment */}
      <footer className="relative z-10 w-full pb-4" />
    </div>
  );
};
