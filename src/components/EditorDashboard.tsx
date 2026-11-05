import React from 'react';
import { 
  Plus, 
  Film, 
  Image as ImageIcon, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Share2, 
  MessageSquare, 
  FileText, 
  MoreVertical, 
  ExternalLink, 
  Lock, 
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Zap,
  Trash2,
  Edit3,
  KeyRound,
  HardDrive
} from 'lucide-react';
import { Project } from '../types';
import { formatBytes } from '../utils/mediaDb';
import { playClickPop } from '../utils/audio';

interface EditorDashboardProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (project: Project) => void;
  onOpenWhatsAppModal: (project: Project) => void;
  onOpenInvoiceModal: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onSwitchToClientMode: () => void;
}

export const EditorDashboard: React.FC<EditorDashboardProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenWhatsAppModal,
  onOpenInvoiceModal,
  onDeleteProject,
  onSwitchToClientMode
}) => {
  // Calculations
  const pendingAmount = projects
    .filter(p => p.status !== 'paid_unlocked')
    .reduce((sum, p) => sum + p.amountINR, 0);

  const collectedAmount = projects
    .filter(p => p.status === 'paid_unlocked')
    .reduce((sum, p) => sum + p.amountINR, 0);

  const pendingRevisionsCount = projects.reduce((acc, p) => {
    return acc + p.comments.filter(c => !c.resolved).length;
  }, 0);

  return (
    <div className="w-full space-y-6">
      
      {/* Top Banner / Hero Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        
        {/* Metric 1: Pending Money (Anti-Ghosting Protection) */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-amber-500/30 p-4 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span className="font-medium">Locked in Review (Protected)</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            ₹{pendingAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
            <span className="text-amber-300 font-medium">{projects.filter(p => p.status !== 'paid_unlocked').length}</span>
            <span>active client video links pending payment</span>
          </div>
        </div>

        {/* Metric 2: UPI Collected */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-emerald-500/30 p-4 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span className="font-medium">Total Earned via UPI</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            ₹{collectedAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
            <span>Direct to your UPI • ₹0 fees deducted</span>
          </div>
        </div>

        {/* Metric 3: Pending Revisions */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span className="font-medium">Open Timestamp Feedback</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {pendingRevisionsCount}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Point-to-point notes dropped by clients
          </div>
        </div>
      </div>

      {/* Projects Section Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Client Projects</span>
            <span className="text-xs font-mono bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">
              {projects.length}
            </span>
          </h2>
          <p className="text-xs text-neutral-400">Share secure watermarked links with clients and collect UPI payments</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Client Project</span>
          </button>
        </div>
      </div>

      {/* Projects Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((proj) => {
          const isSelected = activeProjectId === proj.id;
          const isPaid = proj.status === 'paid_unlocked';
          const unresolvedComments = proj.comments.filter(c => !c.resolved).length;

          return (
            <div
              key={proj.id}
              onClick={() => onSelectProject(proj.id)}
              className={`group cursor-pointer rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                isSelected 
                  ? 'bg-neutral-900 border-amber-500/80 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/50' 
                  : 'bg-neutral-900/70 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900'
              }`}
            >
              {/* Card Top: Status & Media badge */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-400">
                      {proj.type === 'video' ? <Film className="w-4 h-4 text-amber-400" /> : <ImageIcon className="w-4 h-4 text-purple-400" />}
                    </span>
                    <span className="text-[11px] font-mono uppercase text-neutral-400">
                      {proj.aspectRatio}
                    </span>
                  </div>

                  {/* Status Pill */}
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      <span>PAID & UNLOCKED</span>
                    </span>
                  ) : unresolvedComments > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      <span>{unresolvedComments} Revisions</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" />
                      <span>Pending Payment</span>
                    </span>
                  )}
                </div>

                {/* Title & Client */}
                <div>
                  <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition line-clamp-1">
                    {proj.title}
                  </h3>
                  <div className="text-xs text-neutral-400 mt-0.5 flex items-center justify-between">
                    <span className="truncate">Client: <strong className="text-neutral-300 font-medium">{proj.clientName}</strong></span>
                  </div>
                </div>

                {/* Fee & Security preview */}
                <div className="p-2.5 bg-neutral-950/70 rounded-xl border border-neutral-800/80 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-neutral-500 block">Fee Due</span>
                    <span className="font-bold text-amber-400 text-sm">₹{proj.amountINR.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-[10px] text-neutral-500 block">Protection</span>
                    {proj.securitySettings?.isProtected ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                        <KeyRound className="w-2.5 h-2.5 text-amber-400" />
                        <span>PIN: {proj.securitySettings.passcode}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-400">Direct Link</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer: Quick Actions */}
              <div className="p-3 bg-neutral-950/50 border-t border-neutral-800/80 flex items-center justify-between gap-1 text-xs">
                {/* Switch to Client View */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProject(proj.id);
                    onSwitchToClientMode();
                  }}
                  title="View as Client"
                  className="inline-flex items-center gap-1 text-neutral-300 hover:text-amber-300 font-medium py-1 px-2 rounded-lg hover:bg-neutral-800 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>

                <div className="flex items-center gap-1">
                  {/* WhatsApp */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenWhatsAppModal(proj);
                    }}
                    title="Send WhatsApp Update"
                    className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 rounded-lg transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {/* Invoice */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInvoiceModal(proj);
                    }}
                    title="View / Print Invoice"
                    className="p-1.5 text-neutral-400 hover:text-sky-400 hover:bg-neutral-800 rounded-lg transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEditModal(proj);
                    }}
                    title="Edit Settings"
                    className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  {projects.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete project "${proj.title}"?`)) {
                          onDeleteProject(proj.id);
                        }
                      }}
                      title="Delete"
                      className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
