import React, { useState, useEffect } from 'react';
import { Lock, Unlock, KeyRound, MessageSquare, ArrowRight, ShieldAlert, Delete } from 'lucide-react';
import { Project } from '../types';
import { playClickPop } from '../utils/audio';

interface PasscodeLockModalProps {
  project: Project;
  onUnlockSuccess: () => void;
  isEditorViewing?: boolean;
}

export const PasscodeLockModal: React.FC<PasscodeLockModalProps> = ({
  project,
  onUnlockSuccess,
  isEditorViewing = false
}) => {
  const [pin, setPin] = useState('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const targetPasscode = project.securitySettings?.passcode || '1234';

  const handleKeyPress = (digit: string) => {
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
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setHasError(false);
      setErrorMessage('');
      playClickPop();
    }
  };

  const verifyPin = (candidatePin: string) => {
    if (candidatePin === targetPasscode) {
      setHasError(false);
      onUnlockSuccess();
    } else {
      setHasError(true);
      setErrorMessage('Incorrect PIN. Please try again or ask your editor.');
      setTimeout(() => {
        setPin('');
      }, 600);
    }
  };

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  const handleAskOnWhatsApp = () => {
    const text = encodeURIComponent(`Hey ${project.upiPayeeName}! What is the 4-digit PIN to access the "${project.title}" review link?`);
    const cleanPhone = project.clientPhone ? project.clientPhone.replace(/[^0-9]/g, '') : '';
    window.open(`https://api.whatsapp.com/send?${cleanPhone ? `phone=${cleanPhone}&` : ''}text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/95 backdrop-blur-xl animate-in fade-in">
      <div className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        
        {/* Top Lock Badge */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
          <KeyRound className="w-8 h-8 animate-pulse" />
        </div>

        {/* Title & Context */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
            Protected Client Review
          </div>
          <h2 className="text-xl font-bold text-white">Enter 4-Digit Passcode</h2>
          <p className="text-xs text-neutral-400 max-w-xs mx-auto">
            This draft for <strong className="text-neutral-200">{project.clientName}</strong> is confidential. Enter the PIN provided by your editor.
          </p>
        </div>

        {/* PIN Display Dots */}
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
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Touch Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 pt-2 max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="h-12 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 active:scale-95 text-white font-mono text-lg font-bold transition border border-neutral-700/60 flex items-center justify-center"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="h-12 rounded-2xl bg-neutral-950 hover:bg-neutral-800 active:scale-95 text-neutral-400 text-xs font-semibold transition border border-neutral-800 flex items-center justify-center"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-12 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 active:scale-95 text-white font-mono text-lg font-bold transition border border-neutral-700/60 flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace"
            className="h-12 rounded-2xl bg-neutral-950 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white transition border border-neutral-800 flex items-center justify-center"
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
              <span>Editor Passcode: <strong className="text-amber-400 font-mono">{targetPasscode}</strong></span>
              <button
                type="button"
                onClick={() => onUnlockSuccess()}
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
