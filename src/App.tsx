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
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ArrowLeft,
  LogOut,
  User,
  Clock,
  Cloud,
  Loader2
} from 'lucide-react';

import { Project, ProjectComment, ProjectStatus } from './types';
import { VideoPlayerWithTimeline } from './components/VideoPlayerWithTimeline';
import { ThumbnailReviewer } from './components/ThumbnailReviewer';
import { TimestampComments } from './components/TimestampComments';
import { UpiPaymentModal } from './components/UpiPaymentModal';
import { WhatsAppShareModal } from './components/WhatsAppShareModal';
import { InvoiceModal } from './components/InvoiceModal';
import { ProjectFormModal } from './components/ProjectFormModal';
import { EditorDashboard } from './components/EditorDashboard';
import { PasscodeLockModal } from './components/PasscodeLockModal';
import { CreatorAuthScreen } from './components/CreatorAuthScreen';
import { 
  fetchProjectById, 
  fetchCreatorProjects, 
  saveProjectToSupabase, 
  updateProjectStatusInSupabase, 
  updateProjectCommentsInSupabase,
  deleteProjectFromSupabase 
} from './supabase';
import { getMediaBlobUrl } from './utils/mediaDb';
import { playClickPop, playPaymentSuccessChime } from './utils/audio';

const CREATOR_EMAIL_KEY = 'zikro_creator_email';

// Clean up old demo localStorage keys to avoid cross-contamination
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('editlock_projects_v2');
    localStorage.removeItem('zikro_projects_v2');
  } catch {
    // ignore
  }
}

const getCreatorStorageKey = (email: string | null) => {
  if (!email) return null;
  return `zikro_projects_${email.toLowerCase().trim()}`;
};

export default function App() {
  // Check if client accessed via shared review link (e.g. ?project=id&mode=client)
  const isDirectClientLink = typeof window !== 'undefined' && 
    (new URLSearchParams(window.location.search).get('mode') === 'client');

  const urlProjectId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('project')
    : null;

  // Multi-user Creator session
  const [creatorEmail, setCreatorEmail] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CREATOR_EMAIL_KEY);
      return saved ? saved.toLowerCase().trim() : null;
    }
    return null;
  });

  // Default: 'client' if link explicitly requested client mode, otherwise 'editor'
  const [viewMode, setViewMode] = useState<'client' | 'editor'>(() => {
    return isDirectClientLink ? 'client' : 'editor';
  });

  // Projects state: strictly starts empty or loaded from user-scoped storage key
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const email = localStorage.getItem(CREATOR_EMAIL_KEY);
        if (email) {
          const key = `zikro_projects_${email.toLowerCase().trim()}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            const parsed: Project[] = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              return parsed;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed reading from localStorage:', e);
    }
    return [];
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    if (urlProjectId) return urlProjectId;
    return projects[0]?.id || '';
  });

  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isCreatorPreviewingClient, setIsCreatorPreviewingClient] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Session-cached unlocked PIN project IDs
  const [unlockedPinProjects, setUnlockedPinProjects] = useState<Set<string>>(() => {
    const set = new Set<string>();
    try {
      const saved = sessionStorage.getItem('zikro_unlocked_pins');
      if (saved) {
        JSON.parse(saved).forEach((id: string) => set.add(id));
      }
    } catch {
      // ignore
    }
    return set;
  });

  // ================= 1. SUPABASE DATA SYNC =================

  // If Client opens a specific project URL, fetch immediately from Supabase
  useEffect(() => {
    if (urlProjectId) {
      setIsLoadingCloud(true);
      fetchProjectById(urlProjectId).then(cloudProj => {
        setIsLoadingCloud(false);
        if (cloudProj) {
          setProjects(prev => {
            const exists = prev.some(p => p.id === cloudProj.id);
            if (exists) {
              return prev.map(p => p.id === cloudProj.id ? cloudProj : p);
            }
            return [cloudProj, ...prev];
          });
          setActiveProjectId(cloudProj.id);
        }
      });
    }
  }, [urlProjectId]);

  // When Creator logs in, fetch all projects belonging to their email from Supabase
  // NEVER seed or fallback to sample projects if empty—keep list empty with ₹0 metrics!
  useEffect(() => {
    if (creatorEmail && viewMode === 'editor') {
      setIsLoadingCloud(true);
      fetchCreatorProjects(creatorEmail).then(cloudProjects => {
        setIsLoadingCloud(false);
        setProjects(cloudProjects);
        if (cloudProjects.length > 0) {
          setActiveProjectId(cloudProjects[0].id);
        } else {
          setActiveProjectId('');
        }
      });
    }
  }, [creatorEmail, viewMode]);

  // ================= 2. CLIENT AUTO-POLLING (Every 4 seconds for instant unlock) =================
  useEffect(() => {
    if (viewMode !== 'client' || !activeProjectId) return;

    const interval = setInterval(async () => {
      const latest = await fetchProjectById(activeProjectId);
      if (latest) {
        setProjects(prev => {
          const idx = prev.findIndex(p => p.id === latest.id);
          if (idx >= 0) {
            const oldStatus = prev[idx].status;
            // Detect if creator approved and unlocked payment
            if (oldStatus !== 'paid_unlocked' && latest.status === 'paid_unlocked') {
              playPaymentSuccessChime();
            }
            const copy = [...prev];
            copy[idx] = latest;
            return copy;
          }
          return [latest, ...prev];
        });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [viewMode, activeProjectId]);

  // Sync to user-scoped localStorage as backup
  useEffect(() => {
    try {
      const key = getCreatorStorageKey(creatorEmail);
      if (key) {
        localStorage.setItem(key, JSON.stringify(projects));
      }
    } catch (e) {
      console.warn('Failed saving to localStorage:', e);
    }
  }, [projects, creatorEmail]);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || null;

  // Hydrate video mediaUrl from IndexedDB if stored locally on this device
  useEffect(() => {
    if (activeProject) {
      getMediaBlobUrl(activeProject.id).then(blobUrl => {
        if (blobUrl && blobUrl !== activeProject.mediaUrl) {
          handleUpdateActiveProject({ mediaUrl: blobUrl });
        }
      });
    }
  }, [activeProjectId]);

  const handleUnlockPasscode = (projectId: string) => {
    setUnlockedPinProjects(prev => {
      const next = new Set(prev);
      next.add(projectId);
      try {
        sessionStorage.setItem('zikro_unlocked_pins', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    playPaymentSuccessChime();
  };

  const handleUpdateActiveProject = (updated: Partial<Project>) => {
    if (!activeProject) return;
    setProjects(prev => prev.map(p => {
      if (p.id === activeProject.id) {
        return { ...p, ...updated, updatedAt: new Date().toISOString() };
      }
      return p;
    }));
  };

  const handleAddComment = (commentData: Omit<ProjectComment, 'id' | 'createdAt' | 'resolved' | 'replies'>) => {
    if (!activeProject) return;
    const newComment: ProjectComment = {
      ...commentData,
      id: `comm-${Date.now().toString(36)}`,
      projectId: activeProject.id,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: []
    };

    const updatedComments = [...activeProject.comments, newComment];
    handleUpdateActiveProject({
      comments: updatedComments,
      status: activeProject.status === 'paid_unlocked' ? 'paid_unlocked' : 'revision_requested'
    });

    // Sync comments to Supabase
    updateProjectCommentsInSupabase(activeProject.id, updatedComments);
  };

  const handleToggleResolve = (commentId: string) => {
    if (!activeProject) return;
    const updated = activeProject.comments.map(c => {
      if (c.id === commentId) {
        return { ...c, resolved: !c.resolved };
      }
      return c;
    });
    handleUpdateActiveProject({ comments: updated });
    updateProjectCommentsInSupabase(activeProject.id, updated);
  };

  const handleAddReply = (commentId: string, replyText: string, authorName: string) => {
    if (!activeProject) return;
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
    updateProjectCommentsInSupabase(activeProject.id, updated);
  };

  // ================= 3. STRICT ANTI-FRAUD UPI HANDLING =================
  
  // Client submits UTR: Updates project to 'utr_submitted'
  const handleSubmitUtr = async (utrNumber: string, method: string) => {
    if (!activeProject) return;
    const paymentDetails = {
      utrNumber,
      method,
      paidAt: new Date().toISOString(),
      verified: false
    };

    handleUpdateActiveProject({
      status: 'utr_submitted',
      paymentDetails
    });

    await updateProjectStatusInSupabase(activeProject.id, 'utr_submitted', paymentDetails);
  };

  // Creator in Studio clicks "✅ Approve & Unlock"
  const handleApproveUpiPayment = async (projectId: string) => {
    const target = projects.find(p => p.id === projectId);
    if (!target) return;

    const paymentDetails = {
      ...(target.paymentDetails || {}),
      paidAt: target.paymentDetails?.paidAt || new Date().toISOString(),
      verified: true
    };

    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          status: 'paid_unlocked',
          paymentDetails,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    }));

    await updateProjectStatusInSupabase(projectId, 'paid_unlocked', paymentDetails);
    playPaymentSuccessChime();
  };

  // Creator in Studio clicks "❌ Reject Fake UTR"
  const handleRejectUpiPayment = async (projectId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          status: 'in_review',
          paymentDetails: undefined,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    }));

    await updateProjectStatusInSupabase(projectId, 'in_review', undefined);
    playClickPop();
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

  const handleDeleteProject = async (id: string) => {
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (activeProjectId === id) {
        setActiveProjectId(filtered.length > 0 ? filtered[0].id : '');
      }
      return filtered;
    });
    await deleteProjectFromSupabase(id);
  };

  const handleCopyClientLink = (projectId?: string) => {
    const targetId = projectId || activeProject?.id;
    if (!targetId) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const shareUrl = `${origin}${pathname}?project=${targetId}&mode=client`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    playClickPop();
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleLogin = (email: string) => {
    const cleanEmail = email.toLowerCase().trim();
    setCreatorEmail(cleanEmail);
    localStorage.setItem(CREATOR_EMAIL_KEY, cleanEmail);
    // Load that creator's cached projects or start completely fresh
    try {
      const key = `zikro_projects_${cleanEmail}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setProjects(parsed);
          setActiveProjectId(parsed[0]?.id || '');
        } else {
          setProjects([]);
          setActiveProjectId('');
        }
      } else {
        setProjects([]);
        setActiveProjectId('');
      }
    } catch {
      setProjects([]);
      setActiveProjectId('');
    }
    setViewMode('editor');
  };

  const handleLogout = () => {
    setCreatorEmail(null);
    setProjects([]);
    setActiveProjectId('');
    localStorage.removeItem(CREATOR_EMAIL_KEY);
    playClickPop();
  };

  const isUnlocked = activeProject?.status === 'paid_unlocked';
  const isPaidUnlocked = isUnlocked;
  const isUtrSubmitted = activeProject?.status === 'utr_submitted';
  const clientReviewUrl = typeof window !== 'undefined' && activeProject
    ? `${window.location.origin}${window.location.pathname}?project=${activeProject.id}&mode=client` 
    : '';

  // ================= 4. AUTH GATE FOR CREATORS (Clients skip auth!) =================
  if (viewMode === 'editor' && !creatorEmail && !isDirectClientLink) {
    return <CreatorAuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col bg-grid-pattern pb-12 selection:bg-amber-500 selection:text-neutral-950">
      
      {/* 1. CREATOR PREVIEW NOTIFICATION BANNER (Only shown when Creator is previewing Client View) */}
      {viewMode === 'client' && isCreatorPreviewingClient && activeProject && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-neutral-950 px-3 sm:px-6 py-2 text-xs font-semibold flex items-center justify-between shadow-lg sticky top-0 z-50 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 shrink-0" />
            <span>
              <strong>Creator Preview Mode:</strong> You are testing what <u>{activeProject.clientName}</u> sees on their phone.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Creator Demo Simulator */}
            <button
              onClick={() => {
                const nextStatus: ProjectStatus = isUnlocked ? 'in_review' : 'paid_unlocked';
                handleUpdateActiveProject({
                  status: nextStatus,
                  paymentDetails: nextStatus === 'paid_unlocked' ? {
                    utrNumber: 'UPI/CREATOR/TEST',
                    paidAt: new Date().toISOString(),
                    method: 'Google Pay',
                    verified: true
                  } : undefined
                });
                if (nextStatus === 'paid_unlocked') playPaymentSuccessChime();
                else playClickPop();
              }}
              className="bg-neutral-950/20 hover:bg-neutral-950/30 text-neutral-950 font-mono text-[11px] px-2.5 py-1 rounded-lg transition font-bold"
            >
              {isUnlocked ? 'Simulate Unpaid' : 'Simulate Paid'}
            </button>

            {/* Return to Creator Studio button */}
            <button
              onClick={() => {
                setViewMode('editor');
                setIsCreatorPreviewingClient(false);
                playClickPop();
              }}
              className="bg-neutral-950 text-amber-400 hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Creator Studio</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. HEADER - DEDICATED FOR CREATOR VS DEDICATED FOR CLIENT */}
      {viewMode === 'editor' ? (
        /* ================= CREATOR STUDIO HEADER ================= */
        <header className="sticky top-0 z-40 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-800">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
            
            {/* Creator Logo & Studio Badge */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-amber-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="leading-tight">
                  <div className="font-extrabold text-base tracking-tight flex items-center gap-1.5">
                    <span>ZIK<span className="text-amber-400">RO</span></span>
                    <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold tracking-wider">
                      CREATOR STUDIO
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono hidden sm:block">
                    Freelancer Workspace • Anti-Ghosting UPI
                  </div>
                </div>
              </div>

              {/* Project Switcher for Creator (only shown when creator has projects) */}
              {projects.length > 0 && (
                <div className="relative hidden md:block ml-2">
                  <select
                    value={activeProjectId}
                    onChange={(e) => {
                      setActiveProjectId(e.target.value);
                      playClickPop();
                    }}
                    className="bg-neutral-900 border border-neutral-700/80 hover:border-amber-500 text-neutral-200 text-xs rounded-xl px-3 py-1.5 pr-8 appearance-none focus:outline-none cursor-pointer max-w-[210px] truncate"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title} (₹{p.amountINR})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Creator Studio Right Actions */}
            <div className="flex items-center gap-2">
              
              {/* Creator Account Pill with Logout */}
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate max-w-[130px] font-mono text-[11px]">{creatorEmail}</span>
                <button
                  onClick={handleLogout}
                  title="Logout from Creator Studio"
                  className="text-neutral-500 hover:text-red-400 ml-1 p-0.5 rounded transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Preview as Client button */}
              {activeProject && (
                <button
                  onClick={() => {
                    setViewMode('client');
                    setIsCreatorPreviewingClient(true);
                    playClickPop();
                  }}
                  title="See exactly what client sees on their screen"
                  className="inline-flex items-center gap-1.5 text-xs bg-neutral-900 hover:bg-neutral-800 border border-amber-500/40 text-amber-300 font-semibold px-3 py-1.5 rounded-xl transition shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Preview Client View</span>
                </button>
              )}

              {/* Copy Client Link */}
              {activeProject && (
                <button
                  onClick={() => handleCopyClientLink()}
                  title="Copy secret review link to send client"
                  className="inline-flex items-center gap-1.5 text-xs bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 px-3 py-1.5 rounded-xl transition"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                  <span className="hidden sm:inline">{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
                </button>
              )}

              {/* WhatsApp Share */}
              {activeProject && (
                <button
                  onClick={() => setIsWhatsAppOpen(true)}
                  title="Share via WhatsApp"
                  className="inline-flex items-center gap-1.5 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl transition font-medium"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
              )}

              {/* Invoice Generator */}
              {activeProject && (
                <button
                  onClick={() => setIsInvoiceOpen(true)}
                  title="Generate GST-Exempt Freelance Invoice"
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition hidden sm:block"
                >
                  <FileText className="w-4 h-4" />
                </button>
              )}

              {/* New Project CTA */}
              <button
                onClick={() => {
                  setEditingProject(null);
                  setIsProjectFormOpen(true);
                  playClickPop();
                }}
                title="Create New Client Project"
                className="inline-flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-3.5 py-1.5 rounded-xl transition shadow-md shadow-amber-500/20 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            </div>
          </div>
        </header>
      ) : (
        /* ================= CLIENT REVIEW PORTAL HEADER ================= */
        <header className="sticky top-0 z-40 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-800/90 shadow-md">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
            
            {/* Client Portal Branding */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-neutral-950 font-black shadow-md shadow-amber-500/20">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                    ZIK<span className="text-amber-400">RO</span>
                  </span>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>CLIENT REVIEW PORTAL</span>
                  </span>
                </div>
                {activeProject && (
                  <div className="text-[10px] text-neutral-400 truncate max-w-[200px] sm:max-w-xs">
                    Reviewing for: <strong className="text-neutral-200">{activeProject.clientName}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Client Top Action: Direct UPI Unlock CTA */}
            {activeProject && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] text-neutral-400 uppercase font-mono">Invoice Total</div>
                  <div className="text-sm font-black text-amber-400 font-mono">
                    ₹{activeProject.amountINR.toLocaleString('en-IN')}
                  </div>
                </div>

                {isPaidUnlocked ? (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold px-3 py-1.5 rounded-xl text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Payment Settled</span>
                  </div>
                ) : isUtrSubmitted ? (
                  <button
                    onClick={() => setIsPaymentOpen(true)}
                    className="inline-flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold px-3 py-2 rounded-xl text-xs animate-pulse"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>UTR Pending Check</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsPaymentOpen(true);
                      playClickPop();
                    }}
                    className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Approve & Pay via UPI</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </header>
      )}

      {/* 3. STATUS BAR (Explaining watermark / unlocked status) */}
      {activeProject && (
        <div className={`w-full py-2 px-4 text-xs font-medium border-b flex items-center justify-between flex-wrap gap-2 transition-colors ${
          isPaidUnlocked 
            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200' 
            : isUtrSubmitted
              ? 'bg-amber-950/70 border-amber-700/80 text-amber-200 animate-pulse-subtle'
              : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
        }`}>
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {isPaidUnlocked ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Payment Confirmed (₹{activeProject.amountINR.toLocaleString('en-IN')}). Watermark removed & clean 4K master file is unlocked!</span>
                </>
              ) : isUtrSubmitted ? (
                <>
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
                  <span>
                    <strong>⏳ UTR Submitted ({activeProject.paymentDetails?.utrNumber}):</strong> Waiting for editor to verify bank credit. Video will unlock automatically once approved.
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Draft Watermark Active:</strong> Pay ₹{activeProject.amountINR.toLocaleString('en-IN')} via UPI to automatically unlock and download the clean original file.
                  </span>
                </>
              )}
            </div>

            {/* Creator Preview Passcode state toggle */}
            {isCreatorPreviewingClient && activeProject.securitySettings?.isProtected && (
              <div className="flex items-center gap-3 text-xs flex-wrap font-mono text-[11px]">
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
                  className="text-amber-300 hover:text-white underline"
                  title="Toggle PIN lock state for testing"
                >
                  {unlockedPinProjects.has(activeProject.id) 
                    ? `[Re-Lock PIN: ${activeProject.securitySettings.passcode}]` 
                    : `[PIN: ${activeProject.securitySettings.passcode} (Locked)]`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MAIN WORKSPACE */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 flex-1 w-full">
        {viewMode === 'editor' ? (
          /* ================= CREATOR STUDIO VIEW ================= */
          <EditorDashboard
            projects={projects}
            activeProjectId={activeProjectId}
            creatorEmail={creatorEmail || ''}
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
            onSwitchToClientMode={(id) => {
              if (id) {
                setActiveProjectId(id);
              }
              setViewMode('client');
              setIsCreatorPreviewingClient(true);
              playClickPop();
            }}
            onCopyClientLink={(id) => handleCopyClientLink(id)}
            onApproveUpiPayment={handleApproveUpiPayment}
            onRejectUpiPayment={handleRejectUpiPayment}
          />
        ) : !activeProject ? (
          /* Client View: No Project Found */
          <div className="text-center py-20 p-6 bg-neutral-900/60 rounded-3xl border border-neutral-800 max-w-lg mx-auto my-8">
            <Lock className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white">Review Link Not Found</h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto leading-relaxed">
              This project could not be found or has not been uploaded yet. Please ask your freelance editor for an active Zikro link.
            </p>
          </div>
        ) : (
          /* ================= CLIENT REVIEW VIEW ================= */
          <>
            {/* Passcode Lock Screen if protected and not yet unlocked */}
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

                  {isPaidUnlocked ? (
                    <div className="inline-flex items-center gap-2 bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 font-bold px-4 py-2.5 rounded-2xl text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Unlocked & Settled</span>
                    </div>
                  ) : isUtrSubmitted ? (
                    <button
                      onClick={() => setIsPaymentOpen(true)}
                      className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold px-4 py-3 rounded-2xl text-xs sm:text-sm animate-pulse"
                    >
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>UTR Pending Editor Check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsPaymentOpen(true)}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black px-4 py-3 rounded-2xl text-xs sm:text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Approve & Pay via UPI</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Split Grid: Video Player + Timeline Comments */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Column: Player */}
                <div className="lg:col-span-7 flex flex-col items-center">
                  {activeProject.type === 'video' ? (
                    <VideoPlayerWithTimeline
                      project={activeProject}
                      comments={activeProject.comments}
                      activeCommentId={activeCommentId}
                      onSelectComment={(comm) => setActiveCommentId(comm.id)}
                      onRequestCommentAtTime={(_timeSec) => {
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

                  {/* Client Guidance Hint Card */}
                  <div className="w-full mt-4 p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-2xl flex items-center justify-between text-xs text-neutral-400">
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-neutral-200">How to review:</div>
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

              {/* Discrete Footer for Client View with Creator Access link */}
              <div className="mt-12 pt-6 border-t border-neutral-900 flex items-center justify-between flex-wrap gap-3 text-xs text-neutral-500">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Secured by <strong>Zikro</strong> Anti-Ghosting Protocol</span>
                </div>
                
                {/* Creator Switch Link */}
                <button
                  onClick={() => {
                    setViewMode('editor');
                    setIsCreatorPreviewingClient(false);
                    playClickPop();
                  }}
                  className="text-neutral-400 hover:text-amber-400 transition flex items-center gap-1 font-medium"
                >
                  <span>Are you the editor/creator? Open Creator Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* 5. MODALS */}
      {activeProject && (
        <>
          <UpiPaymentModal
            project={activeProject}
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            onSubmitUtr={handleSubmitUtr}
            isEditorView={viewMode === 'editor' || isCreatorPreviewingClient}
          />

          <WhatsAppShareModal
            project={activeProject}
            isOpen={isWhatsAppOpen}
            onClose={() => setIsWhatsAppOpen(false)}
            reviewUrl={clientReviewUrl}
          />

          <InvoiceModal
            project={activeProject}
            isOpen={isInvoiceOpen}
            onClose={() => setIsInvoiceOpen(false)}
          />
        </>
      )}

      <ProjectFormModal
        isOpen={isProjectFormOpen}
        onClose={() => {
          setIsProjectFormOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        initialProject={editingProject}
        creatorEmail={creatorEmail || ''}
      />
    </div>
  );
}
