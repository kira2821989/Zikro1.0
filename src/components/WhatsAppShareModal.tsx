import React, { useState } from 'react';
import { X, Send, Copy, Check, MessageSquare, ExternalLink } from 'lucide-react';
import { Project } from '../types';
import { playClickPop } from '../utils/audio';

interface WhatsAppShareModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  reviewUrl: string;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  project,
  isOpen,
  onClose,
  reviewUrl
}) => {
  const [templateType, setTemplateType] = useState<'draft' | 'revision' | 'payment_reminder' | 'unlocked'>('draft');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const clientName = project.clientName.split(' ')[0] || 'Bhai';
  const amount = project.amountINR.toLocaleString('en-IN');
  const pinNotice = project.securitySettings?.isProtected && project.securitySettings.passcode 
    ? `\n🔐 Review Passcode: *${project.securitySettings.passcode}*` 
    : '';

  const templates = {
    draft: `Hey ${clientName}! 🎬 Aapki "${project.title}" ka draft preview ready hai!\n\nMaine Zikro pe upload kar diya hai. Video dekh kar kisi bhi second pe tap karke timeline feedback daal do:\n🔗 Review Link: ${reviewUrl}${pinNotice}\n\n(Watermark removed automatically once approved & UPI settled via the link!)`,
    revision: `Bhai ${clientName}! ⚡ Aapne jo feedback diya tha, sab revisions update kar diye hain.\n\nEk baar new preview check kar lo:\n🔗 ${reviewUrl}${pinNotice}`,
    payment_reminder: `Hey ${clientName}! 👋 Video finalize ho gayi hai. Total payment: ₹${amount}.\n\nReview link pe "Approve & Pay" tap karke UPI se pay kar do, turant bina watermark wali Original 4K export download ho jayegi:\n🔗 ${reviewUrl}${pinNotice}`,
    unlocked: `Payment received! 🎉 Thank you ${clientName}. "${project.title}" ka original master file unlock ho chuka hai. Aap link se download kar sakte hain:\n🔗 ${reviewUrl}`
  };

  const currentMessage = templates[templateType];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    playClickPop();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const cleanPhone = project.clientPhone ? project.clientPhone.replace(/[^0-9]/g, '') : '';
    const phoneParam = cleanPhone.length >= 10 ? `phone=${cleanPhone}&` : '';
    const url = `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(currentMessage)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Share via WhatsApp</h3>
              <p className="text-xs text-neutral-400">Pre-made client templates in Hinglish & English</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-neutral-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Template Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              onClick={() => setTemplateType('draft')}
              className={`p-2 rounded-xl text-xs font-semibold text-center border transition ${
                templateType === 'draft' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              1. Draft Ready
            </button>
            <button
              onClick={() => setTemplateType('revision')}
              className={`p-2 rounded-xl text-xs font-semibold text-center border transition ${
                templateType === 'revision' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              2. Revisions Done
            </button>
            <button
              onClick={() => setTemplateType('payment_reminder')}
              className={`p-2 rounded-xl text-xs font-semibold text-center border transition ${
                templateType === 'payment_reminder' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              3. Payment Ping
            </button>
            <button
              onClick={() => setTemplateType('unlocked')}
              className={`p-2 rounded-xl text-xs font-semibold text-center border transition ${
                templateType === 'unlocked' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              4. Unlocked!
            </button>
          </div>

          {/* Message Preview Box */}
          <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 relative">
            <div className="text-[10px] font-mono text-neutral-500 mb-1">WhatsApp Message Preview:</div>
            <pre className="text-xs text-neutral-200 whitespace-pre-wrap font-sans leading-relaxed">
              {currentMessage}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 py-3 rounded-xl text-xs font-semibold border border-neutral-700 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Message'}</span>
            </button>

            <button
              onClick={handleOpenWhatsApp}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/30"
            >
              <Send className="w-4 h-4" />
              <span>Open in WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
