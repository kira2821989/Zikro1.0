import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Video, 
  Eye, 
  EyeOff, 
  UserPlus, 
  LogIn, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { signUpCreator, loginCreator } from '../supabase';
import { playClickPop, playPaymentSuccessChime } from '../utils/audio';

interface CreatorAuthScreenProps {
  onLogin: (email: string, token?: string) => void;
  initialEmail?: string;
  clientProjectTitle?: string;
  onBackToClientReview?: () => void;
}

export const CreatorAuthScreen: React.FC<CreatorAuthScreenProps> = ({
  onLogin,
  initialEmail = '',
  clientProjectTitle,
  onBackToClientReview
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    playClickPop();

    try {
      if (mode === 'signup') {
        const result = await signUpCreator(cleanEmail, password);
        if (!result.success) {
          setErrorMsg(result.error || 'Failed to create account.');
          setIsSubmitting(false);
          return;
        }

        playPaymentSuccessChime();
        setSuccessMsg('Account created successfully! Logging you into Studio...');
        setTimeout(() => {
          onLogin(cleanEmail, result.token);
        }, 600);
      } else {
        const result = await loginCreator(cleanEmail, password);
        if (!result.success) {
          setErrorMsg(result.error || 'Login failed.');
          setIsSubmitting(false);
          return;
        }

        playPaymentSuccessChime();
        onLogin(cleanEmail, result.token);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected authentication error occurred.');
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoAuth = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    playClickPop();

    // Try login first; if account does not exist yet, sign up automatically
    const loginResult = await loginCreator(demoEmail, demoPass);
    if (loginResult.success) {
      playPaymentSuccessChime();
      onLogin(demoEmail, loginResult.token);
      return;
    }

    // If no account found, register the demo account
    if (loginResult.error && loginResult.error.includes('No account found')) {
      const signupResult = await signUpCreator(demoEmail, demoPass);
      if (signupResult.success) {
        playPaymentSuccessChime();
        onLogin(demoEmail, signupResult.token);
        return;
      }
    }

    setErrorMsg(loginResult.error || 'Demo login failed.');
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 py-8 bg-grid-pattern selection:bg-amber-500 selection:text-neutral-950">
      
      {/* Background radial glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-neutral-950 font-black shadow-xl shadow-amber-500/25 mb-3 border border-amber-400/40">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>ZIK<span className="text-amber-400">RO</span></span>
            <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold tracking-wider">
              CREATOR STUDIO
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1.5 max-w-xs mx-auto">
            Secure multi-user cloud workspace for freelance video editors & designers
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          
          {/* Prominent Back to Client Video Review Button */}
          {onBackToClientReview && (
            <button
              type="button"
              onClick={onBackToClientReview}
              className="w-full mb-5 py-2.5 px-3.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm active:scale-98"
            >
              <span className="truncate">
                ← Back to Client Video Review ({clientProjectTitle || 'Video'})
              </span>
            </button>
          )}

          {/* Mode Switcher Tabs (Login vs Create Account) */}
          <div className="grid grid-cols-2 gap-1.5 bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
                playClickPop();
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition ${
                mode === 'login'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
                setSuccessMsg('');
                playClickPop();
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition ${
                mode === 'signup'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>

          {/* Context subtitle */}
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">
              {mode === 'login' ? 'Creator Studio Login' : 'Create New Creator Account'}
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {mode === 'login' 
                ? 'Enter your registered email & password to access your projects.' 
                : 'Sign up to protect your client review videos with anti-ghosting watermarks.'}
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>Creator Email Address</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. editor.vikram@gmail.com"
                className="w-full bg-neutral-950 border border-neutral-700/80 focus:border-amber-500 text-white text-xs sm:text-sm rounded-xl px-3.5 py-3 focus:outline-none placeholder:text-neutral-600 transition"
              />
            </div>

            {/* Password Field with Show/Hide toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Password</span>
                </label>
                <span className="text-[10px] text-neutral-500 font-mono">Min. 6 chars</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-950 border border-neutral-700/80 focus:border-amber-500 text-white text-sm rounded-xl pl-3.5 pr-10 py-3 focus:outline-none placeholder:text-neutral-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-neutral-500 hover:text-neutral-300 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black py-3.5 px-4 rounded-xl text-sm transition shadow-lg shadow-amber-500/20 active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{mode === 'signup' ? 'Creating Account in Supabase...' : 'Verifying Password...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signup' ? 'Create Creator Account' : 'Login to Creator Studio'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-6 pt-5 border-t border-neutral-800 space-y-2">
            <div className="text-[10px] font-mono uppercase text-neutral-500 text-center tracking-wider">
              Quick Test Demo Accounts:
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoAuth('vikram.edits@gmail.com', 'Vikram@1234')}
                className="text-left p-2.5 rounded-xl bg-neutral-950/70 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 transition text-xs group"
              >
                <div className="font-semibold text-neutral-200 group-hover:text-amber-300 truncate">
                  Vikram Edits
                </div>
                <div className="text-[10px] text-neutral-500 truncate">
                  vikram.edits@...
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoAuth('priya.designs@gmail.com', 'Priya@1234')}
                className="text-left p-2.5 rounded-xl bg-neutral-950/70 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 transition text-xs group"
              >
                <div className="font-semibold text-neutral-200 group-hover:text-amber-300 truncate">
                  Priya Designs
                </div>
                <div className="text-[10px] text-neutral-500 truncate">
                  priya.designs@...
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Feature Badges Footer */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs text-neutral-400">
          <div className="flex flex-col items-center gap-1 p-2 bg-neutral-900/40 rounded-xl border border-neutral-800/60">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] leading-tight">SHA-256 Passwords</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 bg-neutral-900/40 rounded-xl border border-neutral-800/60">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] leading-tight">Supabase Auth Table</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 bg-neutral-900/40 rounded-xl border border-neutral-800/60">
            <Video className="w-4 h-4 text-sky-400" />
            <span className="text-[10px] leading-tight">Private Workspaces</span>
          </div>
        </div>

      </div>
    </div>
  );
};
