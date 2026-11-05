/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  Unlock, 
  Share2, 
  Plus, 
  MessageSquare, 
  FileText, 
  Copy, 
  Check, 
  Smartphone, 
  Eye, 
  LayoutDashboard, 
  ChevronDown, 
  Sparkles,
  Zap,
  ArrowRight,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';

import { Project, ProjectComment } from './types';
import { INITIAL_PROJECTS } from './data/sampleProjects';
import { VideoPlayerWithTimeline } from './components/VideoPlayerWithTimeline';
import { ThumbnailReviewer } from './components/ThumbnailReviewer';
import { TimestampComments } from './components/TimestampComments';
import { UpiPaymentModal } from './components/UpiPaymentModal';
import { WhatsAppShareModal } from './components/WhatsAppShareModal';
import { InvoiceModal } from './components/InvoiceModal';
import { ProjectFormModal } from './components/ProjectFormModal';
import { EditorDashboard } from './components/EditorDashboard';
import { PasscodeLockModal } from './components/PasscodeLockModal';
import { getMediaBlobUrl } from './utils/mediaDb';
import { playClickPop, playPaymentSuccessChime } from './utils/audio';

const STORAGE_KEY = 'editlock_projects_v2';

export default function App() {
  // Initialize projects from localStorage or default seed
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: Project[] = JSON.parse(saved);
        // Normalize any old heavy opacities to subtle ~0.28
        return parsed.map(p => ({
          ...p,
          watermarkSettings: {
            ...p.watermarkSettings,
            opacity: Math.min(p.watermarkSettings?.opacity || 0.28, 0.35)
          }
        }));
      }
    } catch (e) {
      console.warn('Failed reading from localStorage:', e);
    }
    return INITIAL_PROJECTS;
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || 'proj-reel-gym-01');
  const [viewMode, setViewMode] = useState<'client' | 'editor'>('client');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.warn('Failed saving to localStorage:', e);
    }
  }, [projects]);

  // Session-cached unlocked PIN project IDs
  const [unlockedPinProjects, setUnlockedPinProjects] = useState<Set<string>>(() => {
    const set = new Set<string>();
    try {
      const saved = sessionStorage.getItem('editlock_unlocked_pins');
      if (saved) {
        JSON.parse(saved).forEach((id: string) => set.add(id));
      }
    } catch {
      // ignore
    }
    return set;
  });

  const handleUnlockPasscode = (projectId: string) => {
    setUnlockedPinProjects(prev => {
      const next = new Set(prev);
      next.add(projectId);
      try {
        sessionStorage.setItem('editlock_unlocked_pins', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    playPaymentSuccessChime();
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // Hydrate video mediaUrl from IndexedDB if stored locally
  useEffect(() => {
    if (activeProject && activeProject.storageInfo?.storageType === 'indexeddb') {
      getMediaBlobUrl(activeProject.id).then(blobUrl => {
        if (blobUrl && blobUrl !== activeProject.mediaUrl) {
          handleUpdateActiveProject({ mediaUrl: blobUrl });
        }
      });
    }
  }, [activeProjectId]);

  const handleUpdateActiveProject = (updated: Partial<Project>) => {
    setProjects(prev => prev.map(p => {
      if (p.id === activeProject.id) {
        return { ...p, ...updated, updatedAt: new Date().toISOString() };
      }
      return p;
    }));
  };

  const handleAddComment = (commentData: Omit<ProjectComment, 'id' | 'createdAt' | 'resolved' | 'replies'>) => {
    const newComment: ProjectComment = {
      ...commentData,
      id: `comm-${Date.now().toString(36)}`,
      projectId: activeProject.id,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: []
    };

    handleUpdateActiveProject({
      comments: [...activeProject.comments, newComment],
      status: activeProject.status === 'paid_unlocked' ? 'paid_unlocked' : 'revision_requested'
    });
  };

  const handleToggleResolve = (commentId: string) => {
    const updated = activeProject.comments.map(c => {
      if (c.id === commentId) {
        return { ...c, resolved: !c.resolved };
      }
      return c;
    });
    handleUpdateActiveProject({ comments: updated });
  };

  const handleAddReply = (commentId: string, replyText: string, authorName: string) => {
    const updated = activeProject.comments.map(c => {
      if (c.id === commentId) {
        const newReply = {
          id: `rep-${Date.now()}`,
          author: viewMode === 'editor' ? ('editor' as const) : ('client' as const),
          authorName,
          text: replyText,
          createdAt: new Date().toISOString()
        };
        return { ...c, replies: [...(c.replies || []), newReply] };
      }
      return c;
    });
    handleUpdateActiveProject({ comments: updated });
  };

  const handlePaymentSuccess = (utrNumber: string, method: string) => {
    handleUpdateActiveProject({
      status: 'paid_unlocked',
      paymentDetails: {
        utrNumber,
        method,
        paidAt: new Date().toISOString(),
        verified: true
      }
    });
  };

  const handleSaveProject = (savedProj: Project) => {
    setProjects(prev => {
      const exists = prev.some(p => p.id === savedProj.id);
      if (exists) {
        return prev.map(p => p.id === savedProj.id ? savedProj : p);
      }
      return [savedProj, ...prev];
    });
    setActiveProjectId(savedProj.id);
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (activeProjectId === id && filtered.length > 0) {
        setActiveProjectId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleResetSampleData = () => {
    if (confirm('Reset to initial sample projects for testing?')) {
      setProjects(INITIAL_PROJECTS);
      setActiveProjectId(INITIAL_PROJECTS[0].id);
      localStorage.removeItem(STORAGE_KEY);
      playClickPop();
    }
  };

  const handleCopyClientLink = () => {
    const shareUrl = `${window.location.origin}?project=${activeProject.id}&mode=client`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    playClickPop();
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isUnlocked = activeProject.status === 'paid_unlocked';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col bg-grid-pattern pb-12 selection:bg-amber-500 selection:text-neutral-950">
      
      {/* 1. Global Navigation Bar */}
      <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-amber-500/20">
                <Lock className="w-4 h-4" />
              </div>
              <div className="leading-none">
                <div className="font-extrabold text-base tracking-tight flex items-center gap-1.5">
                  <span>ZIK<span className="text-amber-400">RO</span></span>
                  <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-medium">
                    ANTI-GHOSTING
                  </span>
                </div>
                <div className="text-[10px] text-neutral-400 font-mono hidden sm:block">
                  Watermark Preview • Instant UPI Unlock
                </div>
              </div>
            </div>

            {/* Project Switcher Pill */}
            <div className="relative hidden md:block">
              <select
                value={activeProjectId}
                onChange={(e) => {
                  setActiveProjectId(e.target.value);
                  playClickPop();
                }}
                className="bg-neutral-900 border border-neutral-700/80 hover:border-amber-500 text-neutral-200 text-xs rounded-xl px-3 py-1.5 pr-8 appearance-none focus:outline-none cursor-pointer max-w-[200px] truncate"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} (₹{p.amountINR})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Center: Dual Experience Switcher */}
          <div className="flex items-center bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => {
                setViewMode('client');
                playClickPop();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'client' 
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-bold' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Client Review</span>
            </button>

            <button
              onClick={() => {
                setViewMode('editor');
                playClickPop();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'editor' 
                  ? 'bg-neutral-800 text-amber-400 shadow-md font-bold border border-neutral-700' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Editor Studio</span>
            </button>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClientLink}
              title="Copy shareable link for client"
              className="inline-flex items-center gap-1.5 text-xs bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 px-3 py-1.5 rounded-xl transition"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
              <span className="hidden sm:inline">{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={() => setIsWhatsAppOpen(true)}
              title="Share via WhatsApp"
              className="inline-flex items-center gap-1.5 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl transition font-medium"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              onClick={() => setIsInvoiceOpen(true)}
              title="View Invoice"
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition hidden sm:block"
            >
              <FileText className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setEditingProject(null);
                setIsProjectFormOpen(true);
              }}
              title="New Project"
              className="inline-flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-3 py-1.5 rounded-xl transition shadow-md shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Project</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Top Status Notification Strip */}
      <div className={`w-full py-2 px-4 text-xs font-medium border-b flex items-center justify-between flex-wrap gap-2 transition-colors ${
        isUnlocked 
          ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200' 
          : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
      }`}>
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {isUnlocked ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Payment Confirmed (₹{activeProject.amountINR}). Watermark removed & 4K Clean Master File is Unlocked!</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Client Protected Mode:</strong> Dynamic moving watermark active on video. Pay ₹{activeProject.amountINR.toLocaleString('en-IN')} via UPI to unlock clean master video.
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs flex-wrap">
            {/* Passcode State Toggle */}
            {activeProject.securitySettings?.isProtected && (
              <button
                onClick={() => {
                  setUnlockedPinProjects(prev => {
                    const next = new Set(prev);
                    if (next.has(activeProject.id)) {
                      next.delete(activeProject.id);
                    } else {
                      next.add(activeProject.id);
                    }
                    return next;
                  });
                  playClickPop();
                }}
                className="text-[11px] font-mono text-amber-300 hover:text-white underline"
                title="Toggle PIN lock state for testing"
              >
                {unlockedPinProjects.has(activeProject.id) 
                  ? `[Re-Lock PIN: ${activeProject.securitySettings.passcode}]` 
                  : `[PIN: ${activeProject.securitySettings.passcode} (Locked)]`}
              </button>
            )}

            {/* Quick Demo Toggle: Paid vs Unpaid */}
            <button
              onClick={() => {
                handleUpdateActiveProject({
                  status: isUnlocked ? 'in_review' : 'paid_unlocked',
                  paymentDetails: isUnlocked ? undefined : {
                    utrNumber: 'UPI/SIMULATED/DEMO',
                    paidAt: new Date().toISOString(),
                    method: 'Google Pay',
                    verified: true
                  }
                });
                if (!isUnlocked) {
                  playPaymentSuccessChime();
                } else {
                  playClickPop();
                }
              }}
              className="underline text-amber-300 hover:text-white font-mono"
            >
              [Toggle: {isUnlocked ? 'Simulate Unpaid' : 'Simulate Paid'}]
            </button>

            <button
              onClick={handleResetSampleData}
              title="Reset Sample Projects"
              className="text-neutral-400 hover:text-white flex items-center gap-1 font-mono text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset Demo</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Workspace Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 flex-1 w-full">
        
        {viewMode === 'editor' ? (
          /* Editor Studio View */
          <EditorDashboard
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={(id) => setActiveProjectId(id)}
            onOpenCreateModal={() => {
              setEditingProject(null);
              setIsProjectFormOpen(true);
            }}
            onOpenEditModal={(proj) => {
              setEditingProject(proj);
              setIsProjectFormOpen(true);
            }}
            onOpenWhatsAppModal={(proj) => {
              setActiveProjectId(proj.id);
              setIsWhatsAppOpen(true);
            }}
            onOpenInvoiceModal={(proj) => {
              setActiveProjectId(proj.id);
              setIsInvoiceOpen(true);
            }}
            onDeleteProject={handleDeleteProject}
            onSwitchToClientMode={() => setViewMode('client')}
          />
        ) : (
          /* Client Review Mode (What the client sees on mobile) */
          <>
            {/* If Project is Protected and PIN not entered, show Passcode Lock Screen */}
            {activeProject.securitySettings?.isProtected && !unlockedPinProjects.has(activeProject.id) && (
              <PasscodeLockModal
                project={activeProject}
                onUnlockSuccess={() => handleUnlockPasscode(activeProject.id)}
                isEditorViewing={false}
              />
            )}

            <div className="space-y-6">
            
            {/* Project Header Info */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-neutral-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono uppercase bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5 rounded-md">
                    {activeProject.type === 'video' ? `Video • ${activeProject.aspectRatio}` : 'Thumbnail Graphic'}
                  </span>
                  <span className="text-xs text-neutral-400">
                    Client: <strong className="text-neutral-200">{activeProject.clientName}</strong>
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {activeProject.title}
                </h1>
              </div>

              {/* Price & Approval CTA */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-neutral-400 uppercase font-mono">Invoice Fee</div>
                  <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                    ₹{activeProject.amountINR.toLocaleString('en-IN')}
                  </div>
                </div>

                {!isUnlocked ? (
                  <button
                    onClick={() => setIsPaymentOpen(true)}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black px-4 py-3 rounded-2xl text-xs sm:text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Approve & Pay via UPI</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 font-bold px-4 py-2.5 rounded-2xl text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Unlocked & Settled</span>
                  </div>
                )}
              </div>
            </div>

            {/* Split Grid: Video Player + Timeline Comments */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Player (takes 7 cols on landscape or 6 on mobile) */}
              <div className="lg:col-span-7 flex flex-col items-center">
                {activeProject.type === 'video' ? (
                  <VideoPlayerWithTimeline
                    project={activeProject}
                    comments={activeProject.comments}
                    activeCommentId={activeCommentId}
                    onSelectComment={(comm) => setActiveCommentId(comm.id)}
                    onRequestCommentAtTime={(timeSec) => {
                      // Handled inside comments
                      setActiveCommentId(null);
                    }}
                    onOpenPaymentModal={() => setIsPaymentOpen(true)}
                  />
                ) : (
                  <ThumbnailReviewer
                    project={activeProject}
                    comments={activeProject.comments}
                    onOpenPaymentModal={() => setIsPaymentOpen(true)}
                  />
                )}

                {/* Freelance Safety Hint for Client */}
                <div className="w-full mt-4 p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-2xl flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-neutral-200">How Zikro Review Works:</div>
                      <div className="text-[11px] text-neutral-400">
                        1. Tap timeline to leave point-to-point notes • 2. Hit "Approve & Pay" when satisfied • 3. Instant watermark removal!
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Timeline Feedback List */}
              <div className="lg:col-span-5">
                <TimestampComments
                  comments={activeProject.comments}
                  currentTime={0}
                  activeCommentId={activeCommentId}
                  onSeekTo={(sec) => {
                    // Seek video directly
                    const videoEl = document.querySelector('video');
                    if (videoEl) {
                      videoEl.currentTime = sec;
                      videoEl.play().catch(() => {});
                    }
                  }}
                  onAddComment={handleAddComment}
                  onToggleResolve={handleToggleResolve}
                  onAddReply={handleAddReply}
                  isEditorView={false}
                />
              </div>
            </div>
          </div>
        </>
      )}
      </main>

      {/* 4. Modals */}
      <UpiPaymentModal
        project={activeProject}
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <WhatsAppShareModal
        project={activeProject}
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        reviewUrl={window.location.href}
      />

      <InvoiceModal
        project={activeProject}
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
      />

      <ProjectFormModal
        isOpen={isProjectFormOpen}
        onClose={() => {
          setIsProjectFormOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        initialProject={editingProject}
      />
    </div>
  );
}
