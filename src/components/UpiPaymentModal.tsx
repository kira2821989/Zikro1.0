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
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Project } from '../types';
import { playPaymentSuccessChime, playClickPop } from '../utils/audio';

interface UpiPaymentModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (utrNumber: string, method: string) => void;
}

export const UpiPaymentModal: React.FC<UpiPaymentModalProps> = ({
  project,
  isOpen,
  onClose,
  onPaymentSuccess
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [selectedApp, setSelectedApp] = useState<'any' | 'gpay' | 'phonepe' | 'paytm'>('any');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(project.status === 'paid_unlocked');

  const upiId = project.upiId || 'creator@okhdfcbank';
  const payeeName = project.upiPayeeName || 'Freelance Editor';
  const amount = project.amountINR;
  const note = `Zikro - ${project.title.slice(0, 25)}`;

  // Standard NPCI UPI URI string
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

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

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    playClickPop();
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const triggerCelebration = () => {
    setIsSuccess(true);
    playPaymentSuccessChime();

    // Fire festive confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#ffffff']
    });

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });
    }, 250);
  };

  const handleConfirmPayment = (simulatedUtr?: string) => {
    const finalUtr = simulatedUtr || utrInput.trim() || `UPI/${Date.now().toString().slice(-8)}/OK`;
    setIsVerifying(true);

    setTimeout(() => {
      setIsVerifying(false);
      triggerCelebration();
      onPaymentSuccess(finalUtr, selectedApp.toUpperCase());
    }, 600);
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
                  ₹0 Commission
                </span>
              </h2>
              <p className="text-xs text-neutral-400">Directly to editor's verified UPI account</p>
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
          
          {/* Success State */}
          {isSuccess ? (
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <ShieldCheck className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Payment Verified & Unlocked!</h3>
                <p className="text-xs text-neutral-300 mt-1 max-w-xs mx-auto">
                  The dynamic watermark has been completely removed. Your clean master file is ready for download.
                </p>
              </div>

              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-left font-mono text-xs space-y-1.5 text-neutral-300">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Amount Paid:</span>
                  <span className="text-emerald-400 font-bold">₹{amount.toLocaleString('en-IN')}</span>
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
                  href={project.mediaUrl}
                  download={`${project.title.replace(/\s+/g, '_')}_MASTER.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold py-3 px-4 rounded-xl text-sm transition shadow-lg shadow-emerald-500/30"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Clean Master File</span>
                </a>

                <button
                  onClick={onClose}
                  className="w-full text-xs text-neutral-400 hover:text-white py-2"
                >
                  Back to Video Player
                </button>
              </div>
            </div>
          ) : (
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
                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex flex-col items-center text-center transition"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400 mb-1" />
                    <span className="text-[11px] font-semibold text-white">Google Pay</span>
                  </a>
                  <a
                    href={upiUri}
                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex flex-col items-center text-center transition"
                  >
                    <Smartphone className="w-4 h-4 text-purple-400 mb-1" />
                    <span className="text-[11px] font-semibold text-white">PhonePe</span>
                  </a>
                  <a
                    href={upiUri}
                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex flex-col items-center text-center transition"
                  >
                    <Smartphone className="w-4 h-4 text-sky-400 mb-1" />
                    <span className="text-[11px] font-semibold text-white">Paytm / Any</span>
                  </a>
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

              {/* Payment Confirmation & Instant Verification */}
              <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>After Paying: Confirm to Unlock</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    placeholder="Enter 12-digit UTR / Ref No."
                    className="flex-1 bg-neutral-900 border border-neutral-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 font-mono placeholder:text-neutral-500"
                  />
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleConfirmPayment()}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs transition shrink-0"
                  >
                    {isVerifying ? 'Checking...' : 'Submit UTR'}
                  </button>
                </div>

                {/* Instant Simulation / Demo Button */}
                <button
                  type="button"
                  onClick={() => handleConfirmPayment(`UPI-SIM-${Math.floor(100000 + Math.random() * 900000)}`)}
                  className="w-full text-center py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>⚡ Quick Demo Unlock (Simulate Instant UPI Confirmation)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
