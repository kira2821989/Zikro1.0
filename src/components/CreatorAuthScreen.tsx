import React, { useState } from 'react';
import { Lock, Mail, KeyRound, Sparkles, ArrowRight, ShieldCheck, Zap, Video, CheckCircle2 } from 'lucide-react';
import { playClickPop } from '../utils/audio';

interface CreatorAuthScreenProps {
  onLogin: (email: string) => void;
  initialEmail?: string;
}

export const CreatorAuthScreen: React.FC<CreatorAuthScreenProps> = ({
  onLogin,
  initialEmail = ''
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (pin.length < 4) {
      setErrorMsg('Please enter your 4-digit Studio PIN.');
      return;
    }

    setIsSubmitting(true);
    playClickPop();

    // Store in localStorage & authenticate
    setTimeout(() => {
      onLogin(cleanEmail);
    }, 350);
  };

  const handleQuickDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPin('9999');
    setErrorMsg('');
    playClickPop();
    setTimeout(() => {
      onLogin(demoEmail);
    }, 250);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 py-8 bg-grid-pattern selection:bg-amber-500 selection:text-neutral-950">
      
      {/* Background radial glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-neutral-950 font-black shadow-xl shadow-amber-500/25 mb-4 border border-amber-400/40">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>ZIK<span className="text-amber-400">RO</span></span>
            <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold tracking-wider">
              STUDIO
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-2 max-w-xs mx-auto">
            The anti-ghosting video review platform for freelance video editors & designers
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Creator Login & Workspace</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Enter your email & 4-digit PIN to manage client links & UPI payouts
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>Creator Email</span>
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

            {/* 4-Digit Security PIN */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>4-Digit Studio PIN / Password</span>
                </label>
                <span className="text-[10px] text-neutral-500 font-mono">Any 4 digits</span>
              </div>
              <input
                type="password"
                required
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-neutral-950 border border-neutral-700/80 focus:border-amber-500 text-amber-400 text-sm font-mono tracking-widest rounded-xl px-3.5 py-3 focus:outline-none placeholder:text-neutral-600 transition"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black py-3 px-4 rounded-xl text-sm transition shadow-lg shadow-amber-500/20 active:scale-98 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Accessing Studio...' : 'Open Creator Studio'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="mt-6 pt-5 border-t border-neutral-800 space-y-2">
            <div className="text-[10px] font-mono uppercase text-neutral-500 text-center tracking-wider">
              Quick 1-Tap Demo Logins:
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('vikram.edits@gmail.com')}
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
                onClick={() => handleQuickDemoLogin('priya.designs@gmail.com')}
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
            <span className="text-[10px] leading-tight">Anti-Ghosting Watermark</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 bg-neutral-900/40 rounded-xl border border-neutral-800/60">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] leading-tight">Instant UPI Settlement</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 bg-neutral-900/40 rounded-xl border border-neutral-800/60">
            <Video className="w-4 h-4 text-sky-400" />
            <span className="text-[10px] leading-tight">Supabase Cloud Hosting</span>
          </div>
        </div>

      </div>
    </div>
  );
};
