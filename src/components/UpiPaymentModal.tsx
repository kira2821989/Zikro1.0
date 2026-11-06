import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { 
  X, 
  Check, 
  Copy, 
  ShieldCheck, 
  Download, 
  Smartphone, 
  Zap, 
  CreditCard, 
  Clock,
  Loader2,
  AlertCircle,
  MessageCircle,
  FileText
} from 'lucide-react';
import { Project } from '../types';
import { playPaymentSuccessChime, playClickPop } from '../utils/audio';
import { getDirectDownloadUrl } from '../supabase';

interface UpiPaymentModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onSubmitUtr: (utrNumber: string, method: string) => Promise<void> | void;
  isEditorView?: boolean;
  onOpenInvoice?: () => void;
}

const getWhatsAppUrl = (phone: string | undefined, message: string): string => {
  const encodedText = encodeURIComponent(message);
  if (!phone || !phone.trim()) {
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  }
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    clean = `91${clean}`;
  }
  return `https://api.whatsapp.com/send?phone=${clean}&text=${encodedText}`;
};

export const UpiPaymentModal: React.FC<UpiPaymentModalProps> = ({
  project,
  isOpen,
  onClose,
  onSubmitUtr,
  isEditorView = false,
  onOpenInvoice
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrInput, setUtrInput] = useState(project.paymentDetails?.utrNumber || '');
  const [selectedApp, setSelectedApp] = useState<'any' | 'gpay' | 'phonepe' | 'paytm'>('any');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [utrError, setUtrError] = useState('');

  const isPaidUnlocked = project.status === 'paid_unlocked';
  const isPendingVerification = project.status === 'utr_submitted';

  const upiId = project.upiId || 'creator@okhdfcbank';
  const payeeName = project.upiPayeeName || 'Freelance Editor';
  const amount = project.amountINR;
  const note = `Zikro - ${project.title.slice(0, 25)}`;

  // Standard NPCI UPI URI string
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

  // Sync UTR input & clear errors whenever modal opens or project payment details update
  useEffect(() => {
    if (isOpen) {
      setUtrInput(project.paymentDetails?.utrNumber || '');
      setUtrError('');
    }
  }, [project.id, project.paymentDetails?.utrNumber, isOpen]);

  // Generate QR Code on open
  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(upiUri, {
        width: 260,
        margin: 2,
        color: {
          dark: '#0a0a0a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Error generating QR:', err));
    }
  }, [isOpen, upiUri]);

  // Trigger celebration confetti when status turns to paid_unlocked
  useEffect(() => {
    if (isOpen && isPaidUnlocked) {
      playPaymentSuccessChime();
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#ffffff']
      });
    }
  }, [isOpen, isPaidUnlocked]);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    playClickPop();
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleUtrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUtrError('');

    const cleanUtr = utrInput.replace(/\s+/g, '');
    if (!/^\d{12}$/.test(cleanUtr)) {
      setUtrError('❌ Please enter a valid 12-digit numeric UPI UTR / Reference number.');
      return;
    }

    setIsSubmitting(true);
    playClickPop();
    try {
      await onSubmitUtr(cleanUtr, selectedApp.toUpperCase());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-neutral-950 font-black shadow-md">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>Instant UPI Unlock</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-medium">
                  Direct Bank UPI
                </span>
              </h2>
              <p className="text-xs text-neutral-400">Pay directly to editor's verified UPI account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* STATE 1: Paid & Unlocked by Editor */}
          {isPaidUnlocked ? (
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <ShieldCheck className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Payment Approved & Video Unlocked!</h3>
                <p className="text-xs text-neutral-300 mt-1 max-w-xs mx-auto">
                  The creator has verified your payment. Dynamic watermark removed and clean master file unlocked.
                </p>
              </div>

              <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 text-left font-mono text-xs space-y-1.5 text-neutral-300">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Amount Paid:</span>
                  <span className="text-emerald-400 font-bold">₹{amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">UTR / Ref No:</span>
                  <span className="text-neutral-200">{project.paymentDetails?.utrNumber || 'VERIFIED'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Paid To:</span>
                  <span>{payeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Watermark:</span>
                  <span className="text-emerald-400 font-semibold">REMOVED (CLEAN 4K)</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={getDirectDownloadUrl(project.mediaUrl, `${project.title}_MASTER`, project.type)}
                  download={`${project.title.replace(/\s+/g, '_')}_MASTER.${project.type === 'thumbnail' ? 'png' : 'mp4'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold py-3 px-4 rounded-xl text-sm transition shadow-lg shadow-emerald-500/30"
                >
                  <Download className="w-4 h-4" />
                  <span>{project.type === 'thumbnail' ? 'Download Clean HD Graphic' : 'Download Clean Master File'}</span>
                </a>

                {onOpenInvoice && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenInvoice();
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold py-2.5 px-4 rounded-xl text-xs transition border border-neutral-700 shadow-sm"
                  >
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>View / Download Payment Receipt (PDF)</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="w-full text-xs text-neutral-400 hover:text-white py-2"
                >
                  Return to Video Player
                </button>
              </div>
            </div>
          ) : isPendingVerification ? (
            /* STATE 2: UTR Submitted - Strict Anti-Fraud Waiting Screen */
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/60 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/10 animate-pulse">
                <Clock className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">UTR Submitted — Awaiting Verification</h3>
                <p className="text-xs text-amber-300/90 mt-1 max-w-sm mx-auto leading-relaxed">
                  Your reference number has been sent to the editor. Video will unlock automatically once they verify the bank credit.
                </p>
              </div>

              <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 text-left font-mono text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Submitted UTR:</span>
                  <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 font-mono tracking-wider">
                    {project.paymentDetails?.utrNumber || utrInput}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Amount Due:</span>
                  <span className="text-white font-bold">₹{amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Live Auto-Check:</span>
                  <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Polling Supabase Cloud (every 4s)
                  </span>
                </div>
              </div>

              {/* PING EDITOR ON WHATSAPP WITH UTR BUTTON (UX Improvement #9) */}
              <div className="pt-1">
                <a
                  href={getWhatsAppUrl(
                    project.editorPhone,
                    `Hey ${payeeName}! ⚡ Maine "${project.title}" (₹${amount}) ka UPI payment kar diya hai.\n\n🏦 12-Digit UTR: *${project.paymentDetails?.utrNumber || utrInput}*\n\nPlease Zikro Studio me verify karke clean 4K file unlock kar do!`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-lg shadow-emerald-600/30 active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>📲 Ping Editor on WhatsApp with UTR</span>
                </a>
              </div>

              <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl text-left text-[11px] text-neutral-400 space-y-1">
                <div className="font-semibold text-neutral-300">Need it unlocked faster?</div>
                <div>Ping the editor on WhatsApp with your payment screenshot so they can tap "Approve & Unlock" in their studio.</div>
              </div>

              <div className="pt-1">
                <button
                  onClick={onClose}
                  className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold py-2.5 rounded-xl transition"
                >
                  Close & Wait on Video Screen
                </button>
              </div>
            </div>
          ) : (
            /* STATE 3: Ready to Pay (Scan QR or DeepLink) */
            <>
              {/* Amount Due Pill */}
              <div className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border border-amber-500/40 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider">Total Payable</div>
                  <div className="text-2xl font-black text-amber-400 font-mono">
                    ₹{amount.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-neutral-200">{project.title}</div>
                  <div className="text-[11px] text-neutral-400 font-mono">Editor: {payeeName}</div>
                </div>
              </div>

              {/* Dynamic QR Code Box */}
              <div className="flex flex-col items-center justify-center p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
                <div className="bg-white p-2.5 rounded-xl shadow-xl border-4 border-amber-500/30">
                  {qrDataUrl ? (
                    <img 
                      src={qrDataUrl} 
                      alt="UPI QR Code" 
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-neutral-500">
                      Generating QR...
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-300">
                  <span>Scan with any UPI App:</span>
                  <span className="font-semibold text-white">GPay • PhonePe • Paytm • BHIM</span>
                </div>
              </div>

              {/* 1-Tap Mobile App Deeplinks */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Open Directly on Your Phone:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={upiUri}
                    onClick={() => setSelectedApp('gpay')}
                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex flex-col items-center text-center transition active:scale-95"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400 mb-1" />
                    <span className="text-[11px] font-semibold text-white">Google Pay</span>
                  </a>
                  <a
                    href={upiUri}
                    onClick={() => setSelectedApp('phonepe')}
                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex flex-col items-center text-center transition active:scale-95"
                  >
                    <Smartphone className="w-4 h-4 text-purple-400 mb-1" />
                    <span className="text-[11px] font-semibold text-white">PhonePe</span>
                  </a>
                  <a
                    href={upiUri}
                    onClick={() => setSelectedApp('paytm')}
                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex flex-col items-center text-center transition active:scale-95"
                  >
                    <Smartphone className="w-4 h-4 text-sky-400 mb-1" />
                    <span className="text-[11px] font-semibold text-white">Paytm / Any</span>
                  </a>
                </div>
                <div className="text-[11px] text-neutral-400 bg-neutral-950/70 border border-neutral-800/80 rounded-xl px-3 py-2 mt-1.5 leading-snug">
                  📱 iPhone (iOS) Users: Please scan the QR code above using any UPI app on your phone.
                </div>
              </div>

              {/* Copy UPI ID */}
              <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <CreditCard className="w-4 h-4 text-neutral-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-neutral-500 block">UPI ID</span>
                    <span className="font-mono text-neutral-200 select-all">{upiId}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="inline-flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2.5 py-1.5 rounded-lg border border-neutral-700 transition shrink-0"
                >
                  {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Anti-Fraud UTR Submission Form (NO FAKE AUTO-UNLOCK) */}
              <form onSubmit={handleUtrSubmit} className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Submit UTR / Ref No. for Unlock</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">12 Digits</span>
                </div>

                {utrError && (
                  <div className="p-2 bg-red-950/60 border border-red-500/40 rounded-lg text-[11px] text-red-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{utrError}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                    placeholder="Enter 12-digit UTR (e.g. 412389123456)"
                    className="flex-1 bg-neutral-900 border border-neutral-700 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 font-mono tracking-wider placeholder:text-neutral-600"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !utrInput.trim()}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-neutral-950 font-black px-4 py-2.5 rounded-xl text-xs transition shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Submit UTR</span>
                    )}
                  </button>
                </div>

                <div className="text-[10px] text-neutral-400 leading-tight">
                  🔒 Editor gets alerted immediately in their Zikro Studio to approve & clear watermark.
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
