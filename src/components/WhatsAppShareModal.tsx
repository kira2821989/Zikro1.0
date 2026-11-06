import React, { useState, useEffect } from 'react';
import { X, Send, Copy, Check, MessageSquare, RotateCcw } from 'lucide-react';
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
  const [language, setLanguage] = useState<'hinglish' | 'english'>('hinglish');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const clientName = project.clientName.split(' ')[0] || (language === 'hinglish' ? 'Bhai' : 'there');
  const amount = project.amountINR.toLocaleString('en-IN');
  const versionTag = `v${project.version || 1}`;
  const pinNotice = project.securitySettings?.isProtected && project.securitySettings.passcode 
    ? `\n🔐 Review Passcode: *${project.securitySettings.passcode}*` 
    : '';

  const getTemplateMessage = (
    type: 'draft' | 'revision' | 'payment_reminder' | 'unlocked',
    lang: 'hinglish' | 'english'
  ) => {
    if (lang === 'english') {
      const enTemplates = {
        draft: `Hi ${clientName}, the draft preview for "${project.title}" (${versionTag}) is ready for your review on Zikro.\n\nYou can watch the preview and drop frame-accurate timestamp notes directly on the timeline here:\n🔗 Review Link: ${reviewUrl}${pinNotice}\n\n(Note: The draft watermark is automatically removed and the 4K master file unlocks immediately upon approval & UPI settlement.)`,
        revision: `Hi ${clientName}, all requested revisions for "${project.title}" (${versionTag}) have been completed and updated.\n\nPlease review the updated cut here:\n🔗 Review Link: ${reviewUrl}${pinNotice}`,
        payment_reminder: `Hi ${clientName}, "${project.title}" (${versionTag}) is finalized and ready for master delivery. Total invoice amount: ₹${amount}.\n\nPlease click "Approve & Pay via UPI" on the review link to settle the invoice and unlock the unwatermarked master file:\n🔗 ${reviewUrl}${pinNotice}`,
        unlocked: `Payment received — thank you, ${clientName}! 🎉 The unwatermarked master file for "${project.title}" (${versionTag}) is now unlocked and ready for direct download:\n🔗 ${reviewUrl}`
      };
      return enTemplates[type];
    }

    const hiTemplates = {
      draft: `Hey ${clientName}! 🎬 Aapki "${project.title}" (${versionTag}) ka draft preview ready hai!\n\nMaine Zikro pe upload kar diya hai. Video dekh kar kisi bhi second pe tap karke timeline feedback daal do:\n🔗 Review Link: ${reviewUrl}${pinNotice}\n\n(Watermark removed automatically once approved & UPI settled via the link!)`,
      revision: `Bhai ${clientName}! ⚡ Aapne jo feedback diya tha, sab revisions "${project.title}" (${versionTag}) me update kar diye hain.\n\nEk baar new preview check kar lo:\n🔗 ${reviewUrl}${pinNotice}`,
      payment_reminder: `Hey ${clientName}! 👋 "${project.title}" (${versionTag}) finalize ho gayi hai. Total payment: ₹${amount}.\n\nReview link pe "Approve & Pay" tap karke UPI se pay kar do, turant bina watermark wali Original 4K export download ho jayegi:\n🔗 ${reviewUrl}${pinNotice}`,
      unlocked: `Payment received! 🎉 Thank you ${clientName}. "${project.title}" (${versionTag}) ka original master file unlock ho chuka hai. Aap link se download kar sakte hain:\n🔗 ${reviewUrl}`
    };
    return hiTemplates[type];
  };

  useEffect(() => {
    if (!isOpen) return;
    setCustomMessage(getTemplateMessage(templateType, language));
  }, [isOpen, templateType, language, project.id, project.title, project.version, project.amountINR, reviewUrl, pinNotice]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(customMessage);
    setCopied(true);
    playClickPop();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    let cleanPhone = project.clientPhone ? project.clientPhone.replace(/[^0-9]/g, '') : '';
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const phoneParam = cleanPhone.length >= 10 ? `phone=${cleanPhone}&` : '';
    const url = `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(customMessage)}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
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
          {/* Language Switcher Toggle */}
          <div className="grid grid-cols-2 gap-1.5 bg-neutral-950 p-1 rounded-2xl border border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setLanguage('hinglish');
                playClickPop();
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                language === 'hinglish'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>🇮🇳 Hinglish (Friendly)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLanguage('english');
                playClickPop();
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                language === 'english'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>🌐 English (Professional)</span>
            </button>
          </div>

          {/* Template Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setTemplateType('draft');
                playClickPop();
              }}
              className={`p-2 rounded-xl text-xs font-semibold text-center border transition ${
                templateType === 'draft' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              1. Draft Ready
            </button>
            <button
              type="button"
              onClick={() => {
                setTemplateType('revision');
                playClickPop();
              }}
              className={`p-2 rounded-xl text-xs font-semibold text-center border transition ${
                templateType === 'revision' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              2. Revisions Done
            </button>
            <button
              type="button"
              onClick={() => {
                setTemplateType('payment_reminder');
                playClickPop();
              }}
              className={`p-2 rounded-xl text-xs font-semibold text-center border transition ${
                templateType === 'payment_reminder' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              3. Payment Ping
            </button>
            <button
              type="button"
              onClick={() => {
                setTemplateType('unlocked');
                playClickPop();
              }}
              className={`p-2 rounded-xl text-xs font-semibold text-center border transition ${
                templateType === 'unlocked' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              4. Unlocked!
            </button>
          </div>

          {/* Editable Message Preview Box */}
          <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 focus-within:border-amber-500/60 transition space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-neutral-400">
                WhatsApp Message (Editable — customize before sending):
              </span>
              <button
                type="button"
                onClick={() => {
                  setCustomMessage(getTemplateMessage(templateType, language));
                  playClickPop();
                }}
                title="Reset message to template default"
                className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-mono"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
            <textarea
              rows={6}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full bg-transparent text-xs text-neutral-200 font-sans leading-relaxed focus:outline-none resize-y"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 py-3 rounded-xl text-xs font-semibold border border-neutral-700 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Message'}</span>
            </button>

            <button
              type="button"
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

