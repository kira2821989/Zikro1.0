import React, { useState, useEffect } from 'react';
import { KeyRound, MessageSquare, ShieldAlert, Delete, Clock } from 'lucide-react';
import { Project } from '../types';
import { hashPassword } from '../supabase';
import { playClickPop } from '../utils/audio';

interface PasscodeLockModalProps {
  project: Project;
  onUnlockSuccess: () => void;
  isEditorViewing?: boolean;
}

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface PinLockoutState {
  attempts: number;
  lockedUntil: number | null;
}

function getLockoutStorageKey(projectId: string): string {
  return `zikro_pin_lockout_${projectId}`;
}

function loadLockoutState(projectId: string): PinLockoutState {
  if (typeof window === 'undefined' || !projectId) {
    return { attempts: 0, lockedUntil: null };
  }
  try {
    const raw = localStorage.getItem(getLockoutStorageKey(projectId));
    if (!raw) return { attempts: 0, lockedUntil: null };
    const parsed = JSON.parse(raw);
    const now = Date.now();
    if (parsed.lockedUntil && parsed.lockedUntil > now) {
      return { attempts: parsed.attempts || MAX_PIN_ATTEMPTS, lockedUntil: parsed.lockedUntil };
    }
    if (parsed.lockedUntil && parsed.lockedUntil <= now) {
      localStorage.removeItem(getLockoutStorageKey(projectId));
      return { attempts: 0, lockedUntil: null };
    }
    return { attempts: Number(parsed.attempts) || 0, lockedUntil: null };
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function saveLockoutState(projectId: string, state: PinLockoutState): void {
  if (typeof window === 'undefined' || !projectId) return;
  try {
    if (state.attempts === 0 && !state.lockedUntil) {
      localStorage.removeItem(getLockoutStorageKey(projectId));
    } else {
      localStorage.setItem(getLockoutStorageKey(projectId), JSON.stringify(state));
    }
  } catch {
    // ignore
  }
}

export const PasscodeLockModal: React.FC<PasscodeLockModalProps> = ({
  project,
  onUnlockSuccess,
  isEditorViewing = false
}) => {
  const [pin, setPin] = useState('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutState, setLockoutState] = useState<PinLockoutState>(() =>
    loadLockoutState(project.id)
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const targetPasscode = project.securitySettings?.passcode;
  const targetPasscodeHash = project.securitySettings?.passcodeHash;

  const isLockedOut = Boolean(lockoutState.lockedUntil && lockoutState.lockedUntil > Date.now());

  // Sync lockout countdown every second
  useEffect(() => {
    const updateTimer = () => {
      const current = loadLockoutState(project.id);
      setLockoutState(current);
      if (current.lockedUntil && current.lockedUntil > Date.now()) {
        setRemainingSeconds(Math.ceil((current.lockedUntil - Date.now()) / 1000));
      } else {
        setRemainingSeconds(0);
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [project.id, lockoutState.lockedUntil]);

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyPress = (digit: string) => {
    if (isLockedOut) return;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      playClickPop();

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (isLockedOut) return;
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setHasError(false);
      setErrorMessage('');
      playClickPop();
    }
  };

  const verifyPin = async (candidatePin: string) => {
    if (isLockedOut) return;

    const candidateHash = await hashPassword(candidatePin, project.id);
    const isMatch =
      (targetPasscodeHash && candidateHash === targetPasscodeHash) ||
      (targetPasscode && candidatePin === targetPasscode);

    if (isMatch) {
      setHasError(false);
      saveLockoutState(project.id, { attempts: 0, lockedUntil: null });
      setLockoutState({ attempts: 0, lockedUntil: null });
      onUnlockSuccess();
    } else {
      const nextAttempts = lockoutState.attempts + 1;
      if (nextAttempts >= MAX_PIN_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_DURATION_MS;
        const nextState: PinLockoutState = { attempts: nextAttempts, lockedUntil: until };
        saveLockoutState(project.id, nextState);
        setLockoutState(nextState);
        setRemainingSeconds(Math.ceil(LOCKOUT_DURATION_MS / 1000));
        setHasError(true);
        setErrorMessage('Too many wrong attempts! Locked for 15 minutes.');
      } else {
        const remainingTries = MAX_PIN_ATTEMPTS - nextAttempts;
        const nextState: PinLockoutState = { attempts: nextAttempts, lockedUntil: null };
        saveLockoutState(project.id, nextState);
        setLockoutState(nextState);
        setHasError(true);
        setErrorMessage(
          `Incorrect PIN (${remainingTries} ${remainingTries === 1 ? 'attempt' : 'attempts'} left before 15m lockout).`
        );
      }
      setTimeout(() => {
        setPin('');
      }, 600);
    }
  };

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLockedOut) return;
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isLockedOut, lockoutState.attempts]);

  const handleAskOnWhatsApp = () => {
    const text = encodeURIComponent(
      `Hey ${project.upiPayeeName || 'Editor'}! What is the 4-digit PIN to access the "${project.title}" review link on Zikro?`
    );
    const phoneToUse = project.editorPhone || '';
    let cleanPhone = phoneToUse.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const targetUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
    const a = document.createElement('a');
    a.href = targetUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/95 backdrop-blur-xl animate-in fade-in">
      <div className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        {/* Top Lock Badge */}
        <div
          className={`relative mx-auto w-16 h-16 rounded-2xl border flex items-center justify-center shadow-xl ${
            isLockedOut
              ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-red-500/10'
              : 'bg-gradient-to-tr from-amber-500/20 to-amber-600/20 border-amber-500/40 text-amber-400 shadow-amber-500/10'
          }`}
        >
          {isLockedOut ? (
            <Clock className="w-8 h-8 animate-pulse" />
          ) : (
            <KeyRound className="w-8 h-8 animate-pulse" />
          )}
        </div>

        {/* Title & Context */}
        <div className="space-y-1.5">
          <div
            className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
              isLockedOut ? 'text-red-400' : 'text-amber-400'
            }`}
          >
            {isLockedOut ? 'Brute-Force Protection Active' : 'Protected Client Review'}
          </div>
          <h2 className="text-xl font-bold text-white">
            {isLockedOut ? 'Access Temporarily Locked' : 'Enter 4-Digit Passcode'}
          </h2>
          <p className="text-xs text-neutral-400 max-w-xs mx-auto">
            {isLockedOut ? (
              <>
                5 wrong PIN attempts were detected for <strong className="text-neutral-200">{project.clientName}</strong>. Please wait{' '}
                <strong className="text-red-300 font-mono">{formatCountdown(remainingSeconds)}</strong> or contact your editor.
              </>
            ) : (
              <>
                This draft for <strong className="text-neutral-200">{project.clientName}</strong> is confidential. Enter the PIN provided by your editor.
              </>
            )}
          </p>
        </div>

        {/* PIN Display Dots or Lockout Countdown */}
        {isLockedOut ? (
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-1.5">
            <div className="text-[11px] text-red-300 font-mono uppercase">Cooldown Timer</div>
            <div className="text-2xl font-mono font-black text-red-400 tracking-wider">
              {formatCountdown(remainingSeconds)}
            </div>
            <div className="text-[11px] text-red-200/80">
              Video URLs & comments remain encrypted and unrendered.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className={`flex justify-center items-center gap-3.5 py-3 ${hasError ? 'animate-shake' : ''}`}>
              {[0, 1, 2, 3].map((index) => {
                const isFilled = index < pin.length;
                return (
                  <div
                    key={index}
                    className={`w-12 h-14 rounded-2xl flex items-center justify-center font-mono text-xl font-bold transition-all duration-200 ${
                      hasError
                        ? 'border-2 border-red-500 bg-red-950/30 text-red-300'
                        : isFilled
                          ? 'border-2 border-amber-500 bg-amber-500/10 text-amber-300 shadow-md shadow-amber-500/20 scale-105'
                          : 'border border-neutral-700 bg-neutral-950 text-neutral-600'
                    }`}
                  >
                    {isFilled ? '●' : '—'}
                  </div>
                );
              })}
            </div>

            {hasError && (
              <div className="text-xs text-red-400 font-medium flex items-center justify-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Touch Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 pt-2 max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isLockedOut}
              onClick={() => handleKeyPress(digit)}
              className="h-12 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 active:scale-95 disabled:opacity-35 disabled:pointer-events-none text-white font-mono text-lg font-bold transition border border-neutral-700/60 flex items-center justify-center"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={isLockedOut}
            onClick={() => setPin('')}
            className="h-12 rounded-2xl bg-neutral-950 hover:bg-neutral-800 active:scale-95 disabled:opacity-35 disabled:pointer-events-none text-neutral-400 text-xs font-semibold transition border border-neutral-800 flex items-center justify-center"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={isLockedOut}
            onClick={() => handleKeyPress('0')}
            className="h-12 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 active:scale-95 disabled:opacity-35 disabled:pointer-events-none text-white font-mono text-lg font-bold transition border border-neutral-700/60 flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            disabled={isLockedOut}
            onClick={handleBackspace}
            aria-label="Backspace"
            className="h-12 rounded-2xl bg-neutral-950 hover:bg-neutral-800 active:scale-95 disabled:opacity-35 disabled:pointer-events-none text-neutral-400 hover:text-white transition border border-neutral-800 flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Actions / WhatsApp Request */}
        <div className="pt-2 space-y-2 border-t border-neutral-800/80 text-xs">
          <button
            type="button"
            onClick={handleAskOnWhatsApp}
            className="w-full inline-flex items-center justify-center gap-2 text-neutral-400 hover:text-emerald-400 transition py-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Need PIN? Request on WhatsApp</span>
          </button>

          {/* Editor Quick Bypass */}
          {isEditorViewing && (
            <div className="p-2 bg-neutral-950 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
              <span>
                Editor Passcode: <strong className="text-amber-400 font-mono">{targetPasscode}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  saveLockoutState(project.id, { attempts: 0, lockedUntil: null });
                  setLockoutState({ attempts: 0, lockedUntil: null });
                  onUnlockSuccess();
                }}
                className="text-amber-400 hover:underline font-semibold"
              >
                1-Click Bypass
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
