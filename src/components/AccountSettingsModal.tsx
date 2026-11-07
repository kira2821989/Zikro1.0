import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  User,
  DollarSign,
  Phone,
  Shield,
  ShieldCheck,
  Check,
  AlertCircle,
  Cloud,
  Loader2
} from 'lucide-react';
import { CreatorSettings } from '../types';
import { playClickPop, playPaymentSuccessChime } from '../utils/audio';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorEmail: string;
  settings: CreatorSettings;
  onSaveSettings: (newSettings: CreatorSettings) => Promise<void> | void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  creatorEmail,
  settings,
  onSaveSettings
}) => {
  const [upiPayeeName, setUpiPayeeName] = useState(settings.upiPayeeName || '');
  const [upiId, setUpiId] = useState(settings.upiId || '');
  const [editorPhone, setEditorPhone] = useState(settings.editorPhone || '');
  const [defaultWatermarkText, setDefaultWatermarkText] = useState(
    settings.defaultWatermarkText || 'ZIKRO • DRAFT REVIEW'
  );
  const [autoFillUpi, setAutoFillUpi] = useState(settings.autoFillUpi ?? true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setUpiPayeeName(settings.upiPayeeName || creatorEmail.split('@')[0] || '');
    setUpiId(settings.upiId || '');
    setEditorPhone(settings.editorPhone || '');
    setDefaultWatermarkText(settings.defaultWatermarkText || 'ZIKRO • DRAFT REVIEW');
    setAutoFillUpi(settings.autoFillUpi ?? true);
    setErrorMsg(null);
    setIsSaving(false);
    setSavedToast(false);
  }, [isOpen, settings, creatorEmail]);

  if (!isOpen) return null;

  const isValidUpiFormat = (val: string) => {
    const clean = val.trim();
    if (!clean) return true; // allow empty if clearing, or validate when provided
    return /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z0-9.\-_]{2,}$/.test(clean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUpi = upiId.trim();
    if (!cleanUpi || !isValidUpiFormat(cleanUpi)) {
      setErrorMsg('Please enter a valid UPI ID in the format name@bank (e.g. creator@upi).');
      return;
    }

    const updated: CreatorSettings = {
      upiPayeeName: upiPayeeName.trim() || creatorEmail.split('@')[0] || 'Creator',
      upiId: cleanUpi,
      editorPhone: editorPhone.replace(/[^0-9+]/g, '').trim(),
      defaultWatermarkText: defaultWatermarkText.trim() || 'ZIKRO • DRAFT REVIEW',
      autoFillUpi
    };

    setIsSaving(true);
    try {
      await onSaveSettings(updated);
      playPaymentSuccessChime();
      setSavedToast(true);
      setTimeout(() => {
        setSavedToast(false);
        onClose();
      }, 700);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-neutral-950 font-bold shadow-md shadow-amber-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>Account & Payout Settings</span>
                <span className="text-[10px] font-mono bg-sky-500/15 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                  <Cloud className="w-3 h-3" />
                  <span>Cloud Synced</span>
                </span>
              </h3>
              <p className="text-xs text-neutral-400 truncate max-w-[230px]">
                Set up once for <strong className="text-neutral-200">{creatorEmail}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-2xl flex items-start gap-2 text-xs text-red-200 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {savedToast && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center gap-2 text-xs text-emerald-200 font-semibold animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Synced to Supabase Cloud! Your UPI ID now auto-fills on all devices.</span>
            </div>
          )}

          {/* 1. Permanent Receiving UPI ID */}
          <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>Permanent Receiving UPI ID *</span>
              </label>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">0% FEE</span>
            </div>
            <input
              type="text"
              required
              value={upiId}
              onChange={(e) => {
                setUpiId(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="e.g. creator@upi"
              className="w-full bg-neutral-900 border border-neutral-700 focus:border-amber-500 text-white font-mono text-sm rounded-xl px-3.5 py-2.5 focus:outline-none transition"
            />
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                🛡️ 100% Safe: Only used to generate a receiving QR code for your client. No bank login or OTP is ever asked.
              </span>
            </div>
          </div>

          {/* 2. Creator / Studio Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Your Name / Studio Name (Shown on Invoice & UPI)</span>
            </label>
            <input
              type="text"
              value={upiPayeeName}
              onChange={(e) => setUpiPayeeName(e.target.value)}
              placeholder="e.g. Studio Edits"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none transition"
            />
          </div>

          {/* 3. Creator WhatsApp Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Your WhatsApp Number (For Client UTR & PIN Alerts)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-mono text-neutral-400">+91</span>
              <input
                type="tel"
                value={editorPhone.replace(/^\+?91/, '')}
                onChange={(e) => setEditorPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="0000000000"
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 text-white font-mono text-sm rounded-xl pl-12 pr-3.5 py-2.5 focus:outline-none transition"
              />
            </div>
          </div>

          {/* 4. Default Watermark Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Default Watermark Text</span>
            </label>
            <input
              type="text"
              value={defaultWatermarkText}
              onChange={(e) => setDefaultWatermarkText(e.target.value)}
              placeholder="ZIKRO • DRAFT REVIEW"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 text-white font-mono uppercase text-xs rounded-xl px-3.5 py-2.5 focus:outline-none transition"
            />
          </div>

          {/* 5. Auto-fill Toggle */}
          <label className="flex items-center justify-between p-3 bg-neutral-950 rounded-2xl border border-neutral-800 cursor-pointer hover:border-neutral-700 transition">
            <div className="pr-3">
              <span className="text-xs font-semibold text-white block">
                Auto-fill this UPI ID for all my new projects
              </span>
              <span className="text-[11px] text-neutral-400">
                Skip typing your UPI ID every time you upload a video
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoFillUpi}
              onChange={(e) => {
                setAutoFillUpi(e.target.checked);
                playClickPop();
              }}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
            />
          </label>

          {/* Save Button */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-2 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-neutral-950 font-black rounded-xl text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing to Cloud...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Account Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
