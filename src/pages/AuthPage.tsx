import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, KeyRound, Library, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export function AuthPage() {
  const {
    needsBootstrap,
    allowMemberSelfRegistration,
    libraryName,
    adminContactName,
    adminContactEmail,
    login,
    bootstrap,
    registerMember,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();

  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Login / Bootstrap / Register fields
  const [name, setName] = useState(needsBootstrap ? adminContactName || 'Raghuraj Pratap Singh' : '');
  const [email, setEmail] = useState(
    needsBootstrap ? adminContactEmail || 'raghurajpratapsingh8787@gmail.com' : ''
  );
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [seedSampleData, setSeedSampleData] = useState(true);
  const [createDemoStaff, setCreateDemoStaff] = useState(false);
  const [demoStaffPassword, setDemoStaffPassword] = useState('');

  // Reset password fields
  const [resetToken, setResetToken] = useState('');
  const [devResetHint, setDevResetHint] = useState('');

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await bootstrap({
        name: name.trim(),
        email: email.trim(),
        password,
        seedSampleData,
        demoStaffPassword: createDemoStaff ? demoStaffPassword : undefined,
      });
      pushToast('Workspace initialized and Super Admin signed in.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      pushToast('Signed in successfully.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await registerMember({
        name: name.trim(),
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
        address: address.trim(),
      });
      pushToast('Member account created.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string; devResetToken?: string }>(
        '/api/auth/forgot-password',
        { method: 'POST', body: JSON.stringify({ email: email.trim() }) }
      );
      if (res.devResetToken) {
        setDevResetHint(res.devResetToken);
        setResetToken(res.devResetToken);
      }
      pushToast(res.message, 'info');
      setMode('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          token: resetToken.trim(),
          newPassword: password,
        }),
      });
      pushToast('Password reset complete. Sign in with your new password.', 'success');
      setPassword('');
      setMode('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
      {/* Left editorial showcase column */}
      <div className="lg:w-[46%] bg-slate-900 text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-display font-bold text-xs tracking-tight">
              LMS
            </div>
            <span className="font-display font-semibold text-base tracking-tight">
              {libraryName}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="text-xs text-slate-300 hover:text-white underline underline-offset-4"
          >
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
        </div>

        <div className="my-10 lg:my-0 space-y-6">
          <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-balance">
            Modern circulation, physical copy control, and collection analytics.
          </h1>
          <p className="text-slate-300 text-sm lg:text-base max-w-md leading-relaxed">
            Manage catalog inventory, atomic lending workflows, member waitlists, overdue fine ledgers, and audit-verified reporting from a single workspace.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 max-w-md">
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4">
              <div className="text-xs text-slate-400">Database Engine</div>
              <div className="text-sm font-medium mt-1">MongoDB + Mongoose</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4">
              <div className="text-xs text-slate-400">Access Control</div>
              <div className="text-sm font-medium mt-1">JWT + RBAC Sessions</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Library Management System · {adminContactName} ({adminContactEmail})
        </div>
      </div>

      {/* Right auth form column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm"
        >
          {needsBootstrap ? (
            <form onSubmit={handleBootstrap} className="space-y-4">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  First-Run Setup
                </span>
              </div>
              <h2 className="font-display text-xl font-bold">
                Claim Super Admin Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create the primary administrator credentials for this library instance. This setup locks automatically once completed.
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="boot-name" className="block text-xs font-medium mb-1.5">
                  Administrator Name
                </label>
                <input
                  id="boot-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Raghuraj Pratap Singh"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div>
                <label htmlFor="boot-email" className="block text-xs font-medium mb-1.5">
                  Administrator Email
                </label>
                <input
                  id="boot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="raghurajpratapsingh8787@gmail.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div>
                <label htmlFor="boot-password" className="block text-xs font-medium mb-1.5">
                  Super Admin Password (min 8 chars)
                </label>
                <div className="relative">
                  <input
                    id="boot-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a strong password"
                    className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide secret characters' : 'Show secret characters'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seedSampleData}
                    onChange={(e) => setSeedSampleData(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Populate sample catalog, members, and circulation records
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createDemoStaff}
                    onChange={(e) => setCreateDemoStaff(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Also create sample Librarian & Member logins
                </label>

                {createDemoStaff && (
                  <div className="pl-5 pt-1">
                    <input
                      type="password"
                      minLength={8}
                      required
                      value={demoStaffPassword}
                      onChange={(e) => setDemoStaffPassword(e.target.value)}
                      placeholder="Password for librarian@ & member@library.local"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {submitting ? 'Initializing Workspace...' : 'Initialize Workspace'}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Library className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="font-display text-xl font-bold">
                    {mode === 'login' && `Sign in to ${libraryName}`}
                    {mode === 'register' && 'Member Registration'}
                    {mode === 'forgot' && 'Recover Password'}
                    {mode === 'reset' && 'Reset Password'}
                  </h2>
                </div>
              </div>

              {allowMemberSelfRegistration && (mode === 'login' || mode === 'register') && (
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setMode('login');
                    }}
                    className={`py-1.5 rounded-md transition-colors ${
                      mode === 'login'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setMode('register');
                    }}
                    className={`py-1.5 rounded-md transition-colors ${
                      mode === 'register'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Member Sign Up
                  </button>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-medium mb-1.5">
                      Email Address
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@library.local"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="login-password" className="text-xs font-medium">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setError('');
                          setMode('forgot');
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide secret characters' : 'Show secret characters'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                  >
                    {submitting ? 'Signing In...' : 'Sign In to Workspace'}
                  </button>
                </form>
              )}

              {mode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-medium mb-1">
                      Full Name
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-medium mb-1">
                      Email Address
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-phone" className="block text-xs font-medium mb-1">
                        Phone Number
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-pass" className="block text-xs font-medium mb-1">
                        Password
                      </label>
                      <input
                        id="reg-pass"
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="reg-addr" className="block text-xs font-medium mb-1">
                      Address
                    </label>
                    <input
                      id="reg-addr"
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                  >
                    {submitting ? 'Creating Account...' : 'Register Member Account'}
                  </button>
                </form>
              )}

              {mode === 'forgot' && (
                <form onSubmit={handleForgot} className="space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter your account email to generate a time-limited password reset token.
                  </p>
                  <div>
                    <label htmlFor="forgot-email" className="block text-xs font-medium mb-1.5">
                      Email Address
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Back to Sign In
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                    >
                      Send Reset Token
                    </button>
                  </div>
                </form>
              )}

              {mode === 'reset' && (
                <form onSubmit={handleReset} className="space-y-4">
                  {devResetHint && (
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <KeyRound className="w-4 h-4 shrink-0" />
                      <span className="break-all">Dev Reset Token: {devResetHint}</span>
                    </div>
                  )}
                  <div>
                    <label htmlFor="reset-token" className="block text-xs font-medium mb-1.5">
                      Reset Token
                    </label>
                    <input
                      id="reset-token"
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="reset-pass" className="block text-xs font-medium mb-1.5">
                      New Password
                    </label>
                    <input
                      id="reset-pass"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Back to Sign In
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                    >
                      Update Password
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
