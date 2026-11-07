import React, { useState } from 'react';
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
  ExternalLink, 
  Lock, 
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Zap,
  Trash2,
  Edit3,
  KeyRound,
  HardDrive,
  Copy,
  AlertTriangle,
  Check,
  XCircle,
  Cloud,
  Search,
  LogOut,
  Settings,
  Play
} from 'lucide-react';
import { Project, CreatorSettings } from '../types';
import { formatBytes } from '../utils/mediaDb';
import { playClickPop } from '../utils/audio';

interface EditorDashboardProps {
  projects: Project[];
  activeProjectId: string;
  creatorEmail: string;
  creatorSettings?: CreatorSettings;
  onSelectProject: (id: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (project: Project) => void;
  onOpenWhatsAppModal: (project: Project) => void;
  onOpenInvoiceModal: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onSwitchToClientMode: (projectId?: string) => void;
  onCopyClientLink: (projectId: string) => void;
  onApproveUpiPayment: (projectId: string) => Promise<void> | void;
  onRejectUpiPayment: (projectId: string) => Promise<void> | void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
}

export const EditorDashboard: React.FC<EditorDashboardProps> = ({
  projects,
  activeProjectId,
  creatorEmail,
  creatorSettings,
  onSelectProject,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenWhatsAppModal,
  onOpenInvoiceModal,
  onDeleteProject,
  onSwitchToClientMode,
  onCopyClientLink,
  onApproveUpiPayment,
  onRejectUpiPayment,
  onLogout,
  onOpenSettings
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'utr' | 'pending' | 'revisions' | 'paid'>('all');
  const [copiedProjectId, setCopiedProjectId] = useState<string | null>(null);

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

  const isPendingUtrStatus = (status: string) =>
    status === 'utr_submitted' || status === 'verification_pending';

  const pendingUtrProjects = projects.filter(p => isPendingUtrStatus(p.status));

  const utrCount = pendingUtrProjects.length;
  const pendingPaymentCount = projects.filter(p => p.status !== 'paid_unlocked' && !isPendingUtrStatus(p.status)).length;
  const revisionsCount = projects.filter(p => p.comments.some(c => !c.resolved) || p.status === 'revision_requested').length;
  const paidCount = projects.filter(p => p.status === 'paid_unlocked').length;

  const filteredProjects = projects.filter(proj => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchTitle = proj.title.toLowerCase().includes(q);
      const matchClient = proj.clientName.toLowerCase().includes(q);
      if (!matchTitle && !matchClient) return false;
    }

    if (statusFilter === 'utr') return isPendingUtrStatus(proj.status);
    if (statusFilter === 'paid') return proj.status === 'paid_unlocked';
    if (statusFilter === 'revisions') return proj.comments.some(c => !c.resolved) || proj.status === 'revision_requested';
    if (statusFilter === 'pending') return proj.status !== 'paid_unlocked' && !isPendingUtrStatus(proj.status);
    return true;
  });

  return (
    <div className="w-full space-y-6">
      
      {/* Urgent Action Banner: Pending UTRs awaiting bank verification */}
      {pendingUtrProjects.length > 0 && (
        <div className="bg-gradient-to-r from-amber-600/30 via-amber-500/20 to-amber-600/30 border border-amber-500/60 p-4 rounded-2xl shadow-xl flex items-center justify-between flex-wrap gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center font-black shrink-0 animate-bounce">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{pendingUtrProjects.length} Payment(s) Awaiting Bank Verification!</span>
                <span className="text-[10px] bg-amber-500 text-neutral-950 font-bold px-1.5 py-0.5 rounded font-mono">
                  ACTION REQUIRED
                </span>
              </h3>
              <p className="text-xs text-neutral-300 mt-0.5">
                Client has submitted their 12-digit UTR. Check your GPay/PhonePe bank statement and approve below to unlock their clean video.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-amber-300 font-bold">
            Total Pending: ₹{pendingUtrProjects.reduce((s, p) => s + p.amountINR, 0).toLocaleString('en-IN')}
          </div>
        </div>
      )}

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
            <span>Direct to your bank • 100% verified</span>
          </div>
        </div>

        {/* Metric 3: Pending Revisions */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span className="font-medium">Open Timestamp Notes</span>
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
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>Client Projects</span>
          <span className="text-xs font-mono bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">
            {projects.length}
          </span>
        </h2>

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

      {/* Search & Status Filter Controls (Workflow Feature #6) */}
      {projects.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects by title or client name..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Project counter pill */}
            <div className="text-xs text-neutral-400 font-mono">
              Showing {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition border ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-neutral-950 border-amber-500 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
              }`}
            >
              All ({projects.length})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('utr')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition border flex items-center gap-1.5 ${
                statusFilter === 'utr'
                  ? 'bg-amber-500 text-neutral-950 border-amber-500 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900 text-amber-300 border-neutral-800 hover:border-amber-500/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>UTR Submitted ({utrCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition border ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-neutral-950 border-amber-500 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-white hover:border-neutral-700'
              }`}
            >
              Pending Payment ({pendingPaymentCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('revisions')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition border flex items-center gap-1.5 ${
                statusFilter === 'revisions'
                  ? 'bg-amber-500 text-neutral-950 border-amber-500 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900 text-sky-300 border-neutral-800 hover:border-sky-500/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Revisions ({revisionsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition border flex items-center gap-1.5 ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-md shadow-emerald-600/20'
                  : 'bg-neutral-900 text-emerald-300 border-neutral-800 hover:border-emerald-500/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Paid & Unlocked ({paidCount})</span>
            </button>
          </div>
        </div>
      )}

      {/* Projects Grid / List */}
      {projects.length === 0 ? (
        <div className="text-center py-16 p-6 bg-neutral-900/40 rounded-3xl border border-neutral-800/80 border-dashed max-w-xl mx-auto my-6">
          <Film className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No client projects yet</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Click "+ New Client Project" to upload your first video!
          </p>
          <button
            onClick={onOpenCreateModal}
            className="mt-5 inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Client Project</span>
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 p-6 bg-neutral-900/40 rounded-3xl border border-neutral-800 max-w-md mx-auto my-6">
          <Search className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No projects found</h3>
          <p className="text-xs text-neutral-400 mt-1">
            No projects matched your search "{searchQuery}" or selected status filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-4 text-xs font-semibold text-amber-400 hover:underline"
          >
            Clear Search & Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((proj) => {
            const isSelected = activeProjectId === proj.id;
            const isPaid = proj.status === 'paid_unlocked';
            const isUtrSubmitted = isPendingUtrStatus(proj.status);
            const unresolvedComments = proj.comments.filter(c => !c.resolved).length;
            const isCopied = copiedProjectId === proj.id;
            const isLocalOnly =
              proj.storageInfo?.storageType === 'indexeddb' ||
              !proj.mediaUrl ||
              proj.mediaUrl.startsWith('blob:');

            return (
              <div
                key={proj.id}
                onClick={() => {
                  onSelectProject(proj.id);
                  onSwitchToClientMode(proj.id);
                }}
                className={`group cursor-pointer rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                  isUtrSubmitted
                    ? 'bg-neutral-900 border-amber-500 ring-2 ring-amber-500/40 shadow-xl shadow-amber-500/20 animate-pulse-subtle'
                    : isSelected 
                      ? 'bg-neutral-900 border-amber-500/80 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/50' 
                      : 'bg-neutral-900/70 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900'
                }`}
              >
                <div>
                  {/* Visual Media Poster Preview */}
                  <div className="relative w-full h-36 bg-black object-cover rounded-t-xl overflow-hidden border-b border-neutral-800/80">
                    {proj.mediaUrl && proj.type === 'video' ? (
                      <>
                        <video
                          src={`${proj.mediaUrl}#t=0.5`}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/20 to-black/40 pointer-events-none" />
                        {/* Center Play Overlay Icon */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-neutral-950/75 border border-amber-400/50 text-amber-400 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-neutral-950 transition duration-200">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        </div>
                      </>
                    ) : proj.mediaUrl && proj.type === 'thumbnail' ? (
                      <>
                        <img
                          src={proj.mediaUrl}
                          alt={proj.title}
                          className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-transparent to-black/40 pointer-events-none" />
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-950 text-neutral-600 gap-1.5">
                        {proj.type === 'video' ? (
                          <Film className="w-7 h-7 text-neutral-700" />
                        ) : (
                          <ImageIcon className="w-7 h-7 text-neutral-700" />
                        )}
                        <span className="text-[10px] font-mono text-neutral-500">No Media Preview</span>
                      </div>
                    )}

                    {/* Top-Left Overlay Badges: Aspect Ratio + Version + Cloud/Local */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase bg-neutral-950/85 backdrop-blur-md text-neutral-200 border border-neutral-700/80 px-2 py-0.5 rounded-md font-bold">
                        {proj.type === 'video' ? (
                          <Film className="w-3 h-3 text-amber-400" />
                        ) : (
                          <ImageIcon className="w-3 h-3 text-purple-400" />
                        )}
                        <span>{proj.aspectRatio}</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-neutral-950/85 backdrop-blur-md text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-md">
                        v{proj.version || 1}
                        {proj.versions && proj.versions.length > 1 ? ` (${proj.versions.length} drafts)` : ''}
                      </span>
                      {isLocalOnly ? (
                        <span className="text-[10px] text-amber-300 bg-neutral-950/90 border border-amber-500/40 px-1.5 py-0.5 rounded-md font-mono">
                          ⚠️ Local Preview
                        </span>
                      ) : proj.storageInfo?.storageType === 'cloudinary' ? (
                        <span className="text-[10px] text-purple-300 bg-purple-950/80 border border-purple-500/40 px-1.5 py-0.5 rounded-md font-mono flex items-center gap-1 font-semibold">
                          <Cloud className="w-3 h-3 text-purple-400" />
                          <span>Cloudinary CDN</span>
                        </span>
                      ) : proj.storageInfo?.storageType === 'supabase_storage' ? (
                        <span className="text-[10px] text-sky-400 bg-neutral-950/85 border border-sky-500/30 px-1.5 py-0.5 rounded-md font-mono flex items-center gap-0.5">
                          <Cloud className="w-2.5 h-2.5" />
                          <span>Cloud</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Top-Right Status Pill */}
                    <div className="absolute top-2.5 right-2.5">
                      {isUtrSubmitted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-500 text-neutral-950 px-2 py-0.5 rounded-full shadow-md">
                          <Zap className="w-3 h-3 fill-current" />
                          <span>VERIFICATION PENDING</span>
                        </span>
                      ) : isPaid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-950/90 backdrop-blur-md text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" />
                          <span>PAID & UNLOCKED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-neutral-950/85 backdrop-blur-md text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                          <Lock className="w-3 h-3" />
                          <span>Pending Payment</span>
                        </span>
                      )}
                    </div>

                    {/* Bottom-Left Amber Unresolved Revision Notes Badge */}
                    {unresolvedComments > 0 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(proj.id);
                          onSwitchToClientMode(proj.id);
                        }}
                        title="Click to review client revision notes"
                        className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 text-[11px] font-bold bg-amber-500 text-neutral-950 px-2.5 py-0.5 rounded-full shadow-lg hover:bg-amber-400 transition"
                      >
                        <span>🔔 {unresolvedComments} Revision Note{unresolvedComments > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Body: Title, Client, Fee & Protection */}
                  <div className="p-4 space-y-3">
                    {/* Cross-Device Local IndexedDB Warning Badge */}
                    {isLocalOnly && (
                      <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-500/40 text-[10px] text-amber-200 flex items-start gap-1.5 leading-snug">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          Local Device Preview Only — Upload to Cloud R2/Supabase to share across devices.
                        </span>
                      </div>
                    )}

                    {/* Title & Client */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition line-clamp-1">
                          {proj.title}
                        </h3>
                        <div className="text-xs text-neutral-400 mt-0.5 truncate">
                          Client: <strong className="text-neutral-200 font-medium">{proj.clientName}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Fee & Security preview */}
                    <div className="p-2.5 bg-neutral-950/70 rounded-xl border border-neutral-800/80 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">Fee Due</span>
                        <span className="font-bold text-amber-400 text-sm">₹{proj.amountINR.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-right flex flex-col items-end gap-0.5">
                        <span className="text-[10px] text-neutral-500 block">Protection</span>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {proj.securitySettings?.isProtected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                              <KeyRound className="w-2.5 h-2.5 text-amber-400" />
                              <span>PIN: {proj.securitySettings.passcode}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-neutral-400">Direct Link</span>
                          )}
                          {proj.securitySettings?.maxViews && proj.securitySettings.maxViews > 0 ? (
                            <span className="text-[10px] bg-neutral-900 border border-neutral-700 text-neutral-300 px-1.5 py-0.5 rounded">
                              {proj.securitySettings.viewCount || 0}/{proj.securitySettings.maxViews} views
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* ================= MANUAL UTR VERIFICATION GATE CARD ================= */}
                    {isUtrSubmitted && (
                      <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl space-y-2 animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-xs text-amber-950 font-bold bg-amber-400 px-2.5 py-1.5 rounded-lg animate-bounce shadow-md">
                          <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
                          <span>⚡ Payment Verification Pending with Editor</span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-amber-300 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Client 12-Digit UTR:</span>
                          </span>
                          <span className="font-mono font-bold text-white bg-black/60 px-2 py-0.5 rounded border border-amber-500/30">
                            {proj.paymentDetails?.utrNumber || 'N/A'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onApproveUpiPayment(proj.id);
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition shadow-md"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Verify UTR & Unlock Master</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Reject UTR "${proj.paymentDetails?.utrNumber}" as invalid or unpaid?`)) {
                                onRejectUpiPayment(proj.id);
                              }
                            }}
                            className="w-full inline-flex items-center justify-center gap-1 bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 font-semibold py-1.5 px-2 rounded-lg text-xs transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject Fake UTR</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Clear Primary & High-Priority Action Buttons + Secondary Tooltips */}
                <div className="p-3 bg-neutral-950/60 border-t border-neutral-800/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    {/* Primary Button: Review */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(proj.id);
                        onSwitchToClientMode(proj.id);
                      }}
                      title="Open Interactive Client Review Player"
                      className="inline-flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-1.5 px-2.5 rounded-lg border border-neutral-700 transition"
                    >
                      <span>👁️ Review</span>
                    </button>

                    {/* High-Priority Button: Copy Link */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyClientLink(proj.id);
                        setCopiedProjectId(proj.id);
                        setTimeout(() => {
                          setCopiedProjectId(prev => (prev === proj.id ? null : prev));
                        }, 2000);
                      }}
                      title="Copy Secret Review Link for Client"
                      className={`inline-flex items-center gap-1 font-bold py-1.5 px-2.5 rounded-lg border transition ${
                        isCopied
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {isCopied ? (
                        <span>✓ Copied!</span>
                      ) : (
                        <span>📋 Copy Link</span>
                      )}
                    </button>
                  </div>

                  {/* Secondary Icon Actions with Tooltips */}
                  <div className="flex items-center gap-0.5">
                    {/* WhatsApp */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenWhatsAppModal(proj);
                      }}
                      title="Share on WhatsApp"
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
                      title="Edit Project Settings"
                      className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete project "${proj.title}" from cloud database?`)) {
                          onDeleteProject(proj.id);
                        }
                      }}
                      title="Delete Project"
                      className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
