/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  Settings
} from 'lucide-react';

import { Project, ProjectComment, ProjectStatus, CreatorSettings } from './types';
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
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { 
  fetchProjectById, 
  fetchCreatorProjects, 
  saveProjectToSupabase, 
  updateProjectStatusInSupabase, 
  updateProjectCommentsInSupabase,
  deleteProjectFromSupabase,
  deleteMediaFromSupabase,
  verifyCreatorSession,
  loadCreatorSettings,
  saveCreatorSettings
} from './supabase';
import { getMediaBlobUrl, deleteMediaBlob } from './utils/mediaDb';
import { playClickPop, playPaymentSuccessChime, playAlertChime } from './utils/audio';

const CREATOR_EMAIL_KEY = 'zikro_creator_email';
const CREATOR_TOKEN_KEY = 'zikro_creator_token';

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
  const [isDirectClientLink, setIsDirectClientLink] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 
      (new URLSearchParams(window.location.search).get('mode') === 'client');
  });

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

  // Timeline playback position & sync state (Bug #1)
  const [playerCurrentTime, setPlayerCurrentTime] = useState<number>(0);
  const [requestedCommentTime, setRequestedCommentTime] = useState<number | null>(null);
  const [requestedCommentTrigger, setRequestedCommentTrigger] = useState<number>(0);

  // Anti-flicker mutation flag to avoid overwriting optimistic UI updates during 4s polling (Bug #3)
  const isMutatingRef = useRef(false);

  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isCreatorPreviewingClient, setIsCreatorPreviewingClient] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Actor role: creator retains 'editor' status even when previewing client mode
  const isClientModeOnly = viewMode === 'client' && !isCreatorPreviewingClient;
  const isEditorActor = !isClientModeOnly;

  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Creator permanent Account & Payout Settings
  const [creatorSettings, setCreatorSettings] = useState<CreatorSettings>(() =>
    loadCreatorSettings(creatorEmail || '')
  );

  useEffect(() => {
    if (creatorEmail) {
      setCreatorSettings(loadCreatorSettings(creatorEmail));
    }
  }, [creatorEmail]);

  const handleSaveAccountSettings = async (newSettings: CreatorSettings) => {
    setCreatorSettings(newSettings);
    if (creatorEmail) {
      await saveCreatorSettings(creatorEmail, newSettings);
    }
  };

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

  // PREVENT localStorage SESSION SPOOFING (Security Loophole #5)
  // Strict session token verification against Supabase public.creators table
  useEffect(() => {
    if (creatorEmail && viewMode === 'editor') {
      const token = typeof window !== 'undefined' ? localStorage.getItem(CREATOR_TOKEN_KEY) : null;
      if (!token) {
        console.warn('⚠️ Missing creator token in session. Resetting to login.');
        handleLogout();
        return;
      }

      verifyCreatorSession(creatorEmail, token).then(isValid => {
        if (!isValid) {
          console.warn('⛔ Invalid or expired creator session. Forcing login screen.');
          handleLogout();
        }
      });
    }
  }, [creatorEmail, viewMode]);

  // ================= 2. CLIENT AUTO-POLLING (Every 4 seconds for instant unlock) =================
  useEffect(() => {
    // Pause polling while creator is previewing client so simulator toggle isn't overwritten
    if (viewMode !== 'client' || !activeProjectId || isMutatingRef.current || isCreatorPreviewingClient) return;

    const interval = setInterval(async () => {
      if (isMutatingRef.current) return;
      const latest = await fetchProjectById(activeProjectId);
      if (latest && !isMutatingRef.current) {
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
  }, [viewMode, activeProjectId, isCreatorPreviewingClient]);

  // ================= 2B. CREATOR STUDIO LIVE POLLING (Every 4 seconds for live UTR & comments) =================
  useEffect(() => {
    if (viewMode !== 'editor' || !creatorEmail || isMutatingRef.current) return;

    const interval = setInterval(async () => {
      if (isMutatingRef.current) return;
      const latestProjects = await fetchCreatorProjects(creatorEmail);
      if (latestProjects && !isMutatingRef.current) {
        setProjects(prev => {
          // Detect if any project transitioned to 'utr_submitted'
          latestProjects.forEach(latestProj => {
            const current = prev.find(p => p.id === latestProj.id);
            if (current && current.status !== 'utr_submitted' && latestProj.status === 'utr_submitted') {
              playAlertChime();
            }
          });
          return latestProjects;
        });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [viewMode, creatorEmail]);

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

  // Hydrate video mediaUrl from IndexedDB ONLY if mediaUrl is missing or already a local blob (Bug #1)
  useEffect(() => {
    if (activeProject) {
      const hasRealCloudUrl = activeProject.mediaUrl && 
        (activeProject.mediaUrl.startsWith('http://') || activeProject.mediaUrl.startsWith('https://'));
      
      // NEVER overwrite a real Supabase Cloud URL with an IndexedDB blob URL!
      if (!hasRealCloudUrl) {
        getMediaBlobUrl(activeProject.id).then(blobUrl => {
          if (blobUrl && blobUrl !== activeProject.mediaUrl) {
            handleUpdateActiveProject({ mediaUrl: blobUrl });
          }
        });
      }
    }
  }, [activeProjectId, activeProject?.mediaUrl]);

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

  const computeStatusFromComments = (currentStatus: ProjectStatus, commentsList: ProjectComment[]): ProjectStatus => {
    if (currentStatus === 'paid_unlocked' || currentStatus === 'utr_submitted') {
      return currentStatus;
    }
    const hasUnresolved = commentsList.some(c => !c.resolved);
    return hasUnresolved ? 'revision_requested' : 'in_review';
  };

  const handleAddComment = async (commentData: Omit<ProjectComment, 'id' | 'createdAt' | 'resolved' | 'replies'>) => {
    if (!activeProject) return;
    isMutatingRef.current = true;
    const authorRole = isEditorActor ? 'editor' : 'client';
    const authorName = commentData.authorName?.trim() || (isEditorActor ? (activeProject.upiPayeeName || 'Editor') : 'Client');
    const newComment: ProjectComment = {
      ...commentData,
      author: authorRole,
      authorName,
      id: `comm-${Date.now().toString(36)}`,
      projectId: activeProject.id,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: []
    };

    const updatedComments = [...activeProject.comments, newComment];
    const nextStatus = computeStatusFromComments(activeProject.status, updatedComments);
    handleUpdateActiveProject({
      comments: updatedComments,
      status: nextStatus
    });

    try {
      await updateProjectCommentsInSupabase(activeProject.id, updatedComments, nextStatus);
    } finally {
      setTimeout(() => { isMutatingRef.current = false; }, 1000);
    }
  };

  const handleToggleResolve = async (commentId: string) => {
    if (!activeProject) return;
    isMutatingRef.current = true;
    const updated = activeProject.comments.map(c => {
      if (c.id === commentId) {
        return { ...c, resolved: !c.resolved };
      }
      return c;
    });
    const nextStatus = computeStatusFromComments(activeProject.status, updated);
    handleUpdateActiveProject({
      comments: updated,
      status: nextStatus
    });
    try {
      await updateProjectCommentsInSupabase(activeProject.id, updated, nextStatus);
    } finally {
      setTimeout(() => { isMutatingRef.current = false; }, 1000);
    }
  };

  const handleAddReply = async (commentId: string, replyText: string, authorName: string) => {
    if (!activeProject) return;
    isMutatingRef.current = true;
    const authorRole = isEditorActor ? ('editor' as const) : ('client' as const);
    const resolvedAuthorName = authorName.trim() || (isEditorActor ? (activeProject.upiPayeeName || 'Editor') : 'Client');
    const updated = activeProject.comments.map(c => {
      if (c.id === commentId) {
        const newReply = {
          id: `rep-${Date.now()}`,
          author: authorRole,
          authorName: resolvedAuthorName,
          text: replyText,
          createdAt: new Date().toISOString()
        };
        return { ...c, replies: [...(c.replies || []), newReply] };
      }
      return c;
    });
    const nextStatus = computeStatusFromComments(activeProject.status, updated);
    handleUpdateActiveProject({
      comments: updated,
      status: nextStatus
    });
    try {
      await updateProjectCommentsInSupabase(activeProject.id, updated, nextStatus);
    } finally {
      setTimeout(() => { isMutatingRef.current = false; }, 1000);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activeProject) return;
    isMutatingRef.current = true;
    const updated = activeProject.comments.filter(c => c.id !== commentId);
    const nextStatus = computeStatusFromComments(activeProject.status, updated);
    handleUpdateActiveProject({
      comments: updated,
      status: nextStatus
    });
    try {
      await updateProjectCommentsInSupabase(activeProject.id, updated, nextStatus);
      playClickPop();
    } finally {
      setTimeout(() => { isMutatingRef.current = false; }, 1000);
    }
  };

  const handleResolveAllComments = async () => {
    if (!activeProject) return;
    isMutatingRef.current = true;
    const updated = activeProject.comments.map(c => ({ ...c, resolved: true }));
    const nextStatus = computeStatusFromComments(activeProject.status, updated);
    handleUpdateActiveProject({
      comments: updated,
      status: nextStatus
    });
    try {
      await updateProjectCommentsInSupabase(activeProject.id, updated, nextStatus);
      playPaymentSuccessChime();
    } finally {
      setTimeout(() => { isMutatingRef.current = false; }, 1000);
    }
  };

  // ================= 3. STRICT ANTI-FRAUD UPI HANDLING =================
  
  // Client submits UTR: Updates project to 'utr_submitted'
  const handleSubmitUtr = async (utrNumber: string, method: string) => {
    if (!activeProject) return;
    isMutatingRef.current = true;
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

    try {
      await updateProjectStatusInSupabase(activeProject.id, 'utr_submitted', paymentDetails);
    } finally {
      setTimeout(() => { isMutatingRef.current = false; }, 1000);
    }
  };

  // Creator in Studio clicks "✅ Approve & Unlock"
  const handleApproveUpiPayment = async (projectId: string) => {
    const target = projects.find(p => p.id === projectId);
    if (!target) return;
    isMutatingRef.current = true;

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

    try {
      await updateProjectStatusInSupabase(projectId, 'paid_unlocked', paymentDetails, creatorEmail);
      playPaymentSuccessChime();
    } finally {
      setTimeout(() => { isMutatingRef.current = false; }, 1000);
    }
  };

  // Creator in Studio clicks "❌ Reject Fake UTR"
  const handleRejectUpiPayment = async (projectId: string) => {
    isMutatingRef.current = true;
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

    try {
      await updateProjectStatusInSupabase(projectId, 'in_review', undefined, creatorEmail);
      playClickPop();
    } finally {
      setTimeout(() => { isMutatingRef.current = false; }, 1000);
    }
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
    const target = projects.find(p => p.id === id);
    if (target?.mediaUrl) {
      deleteMediaFromSupabase(target.mediaUrl).catch(() => {});
    }
    deleteMediaBlob(id).catch(() => {});
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

  const handleLogin = (email: string, token?: string) => {
    const cleanEmail = email.toLowerCase().trim();
    setCreatorEmail(cleanEmail);
    localStorage.setItem(CREATOR_EMAIL_KEY, cleanEmail);
    if (token) {
      localStorage.setItem(CREATOR_TOKEN_KEY, token);
    }
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
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    setIsDirectClientLink(false);
    setViewMode('editor');
  };

  const handleLogout = () => {
    setCreatorEmail(null);
    setProjects([]);
    setActiveProjectId('');
    setIsProjectFormOpen(false);
    setIsAccountSettingsOpen(false);
    setIsProfileMenuOpen(false);
    setEditingProject(null);
    setIsWhatsAppOpen(false);
    setIsInvoiceOpen(false);
    setIsPaymentOpen(false);
    setIsCreatorPreviewingClient(false);
    setActiveCommentId(null);
    setUnlockedPinProjects(new Set());
    try {
      localStorage.removeItem(CREATOR_EMAIL_KEY);
      localStorage.removeItem(CREATOR_TOKEN_KEY);
      sessionStorage.removeItem('zikro_unlocked_pins');
    } catch {
      // ignore
    }
    playClickPop();
  };

  const isUnlocked = activeProject?.status === 'paid_unlocked';
  const isPaidUnlocked = isUnlocked;
  const isUtrSubmitted = activeProject?.status === 'utr_submitted';
  const isPinLocked = (isClientModeOnly || isCreatorPreviewingClient) && Boolean(activeProject?.securitySettings?.isProtected && !unlockedPinProjects.has(activeProject.id));
  const clientReviewUrl = typeof window !== 'undefined' && activeProject
    ? `${window.location.origin}${window.location.pathname}?project=${activeProject.id}&mode=client` 
    : '';

  // ================= 4. AUTH GATE FOR CREATORS (Clients skip auth!) =================
  if (viewMode === 'editor' && !creatorEmail) {
    return (
      <CreatorAuthScreen
        onLogin={handleLogin}
        clientProjectTitle={activeProject?.title}
        onBackToClientReview={
          activeProject
            ? () => {
                setIsDirectClientLink(true);
                setViewMode('client');
                if (typeof window !== 'undefined') {
                  window.history.replaceState(
                    {},
                    '',
                    `${window.location.pathname}?project=${activeProject.id}&mode=client`
                  );
                }
                playClickPop();
              }
            : undefined
        }
      />
    );
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Creator PIN Lock Simulator Toggle */}
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
                className="bg-neutral-950/20 hover:bg-neutral-950/30 text-neutral-950 font-mono text-[11px] px-2.5 py-1 rounded-lg transition font-bold"
                title="Toggle PIN lock screen for testing"
              >
                {unlockedPinProjects.has(activeProject.id) 
                  ? `Re-Lock PIN (${activeProject.securitySettings.passcode})` 
                  : `Unlock PIN (${activeProject.securitySettings.passcode})`}
              </button>
            )}

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
            <div className="flex items-center gap-2.5">
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

            {/* Creator Studio Top-Right: Single Golden Profile Avatar Button + Dropdown Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(prev => !prev);
                  playClickPop();
                }}
                title="Creator Account Menu"
                aria-label="Creator Account Menu"
                aria-expanded={isProfileMenuOpen}
                className="w-[38px] h-[38px] rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 text-neutral-950 font-black text-base flex items-center justify-center shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/30 hover:ring-amber-400/70 active:scale-95 transition cursor-pointer select-none"
              >
                {(creatorSettings?.upiPayeeName?.trim()?.[0] || creatorEmail?.trim()?.[0] || 'K').toUpperCase()}
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2.5 w-64 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Creator Email & Active Status */}
                  <div className="px-4 py-2.5 border-b border-neutral-800/80">
                    <div className="text-xs font-mono text-neutral-300 truncate">{creatorEmail}</div>
                    <div className="text-[11px] font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <span>●</span>
                      <span>Studio Active</span>
                    </div>
                  </div>

                  {/* Menu Item 1: Account Settings */}
                  <div className="py-1 px-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountSettingsOpen(true);
                        setIsProfileMenuOpen(false);
                        playClickPop();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-neutral-200 hover:text-amber-300 hover:bg-neutral-800/90 transition flex items-center gap-2"
                    >
                      <span>⚙️ Account Settings</span>
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="my-1 border-t border-neutral-800" />

                  {/* Menu Item 2: Logout */}
                  <div className="py-1 px-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/40 transition flex items-center gap-2"
                    >
                      <span>🚪 Logout</span>
                    </button>
                  </div>
                </div>
              )}
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
                {activeProject && !isPinLocked && (
                  <div className="text-[10px] text-neutral-400 truncate max-w-[200px] sm:max-w-xs">
                    Reviewing for: <strong className="text-neutral-200">{activeProject.clientName}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Client Top Action: Direct UPI Unlock CTA (Hidden when PIN is locked) */}
            {activeProject && !isPinLocked && (
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsInvoiceOpen(true);
                    playClickPop();
                  }}
                  title="View GST-Exempt Freelance Invoice / Receipt"
                  className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition flex items-center gap-1.5 text-xs font-medium"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Invoice</span>
                </button>

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

      {/* 3. STATUS BAR (Explaining watermark / unlocked status - Only shown in Client Review mode & hidden when PIN is locked) */}
      {viewMode === 'client' && activeProject && !isPinLocked && (
        <div className={`w-full py-2 px-4 text-xs font-medium border-b flex items-center justify-between flex-wrap gap-2 transition-colors ${
          isPaidUnlocked 
            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200' 
            : isUtrSubmitted
              ? 'bg-amber-950/70 border-amber-700/80 text-amber-200 animate-pulse-subtle'
              : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
        }`}>
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
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

            {/* PING EDITOR ON WHATSAPP WITH UTR BUTTON (UX Improvement #9) */}
            {isUtrSubmitted && (
              <a
                href={`https://api.whatsapp.com/send?${
                  activeProject.editorPhone 
                    ? `phone=${activeProject.editorPhone.replace(/[^0-9]/g, '').length === 10 ? '91' + activeProject.editorPhone.replace(/[^0-9]/g, '') : activeProject.editorPhone.replace(/[^0-9]/g, '')}&` 
                    : ''
                }text=${encodeURIComponent(
                  `Hey ${activeProject.upiPayeeName || 'Editor'}! ⚡ Maine "${activeProject.title}" (₹${activeProject.amountINR}) ka UPI payment kar diya hai.\n\n🏦 12-Digit UTR: *${activeProject.paymentDetails?.utrNumber}*\n\nPlease Zikro Studio me verify karke clean 4K file unlock kar do!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-md shadow-emerald-600/30 active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5 fill-current" />
                <span>📲 Ping Editor on WhatsApp with UTR</span>
              </a>
            )}

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
            creatorSettings={creatorSettings}
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
            onLogout={handleLogout}
            onOpenSettings={() => {
              setIsAccountSettingsOpen(true);
              playClickPop();
            }}
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
        ) : isPinLocked ? (
          /* Strictly isolated PIN lock screen: NO video/audio/invoice/metadata nodes rendered in DOM until correct PIN entered! */
          <PasscodeLockModal
            project={{
              ...activeProject,
              creatorEmail: undefined,
              mediaUrl: ''
            }}
            onUnlockSuccess={() => handleUnlockPasscode(activeProject.id)}
            isEditorViewing={isCreatorPreviewingClient}
          />
        ) : (
          /* ================= CLIENT REVIEW VIEW ================= */
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
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{activeProject.title}</span>
                  <span className="text-xs font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md">
                    v{activeProject.version || 1}
                  </span>
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
                    onCurrentTimeChange={setPlayerCurrentTime}
                    onRequestCommentAtTime={(timeSec) => {
                      setActiveCommentId(null);
                      setPlayerCurrentTime(timeSec);
                      setRequestedCommentTime(timeSec);
                      setRequestedCommentTrigger(prev => prev + 1);
                    }}
                    onOpenPaymentModal={() => setIsPaymentOpen(true)}
                    isEditorView={isEditorActor}
                  />
                ) : (
                  <ThumbnailReviewer
                    project={activeProject}
                    comments={activeProject.comments}
                    onOpenPaymentModal={() => setIsPaymentOpen(true)}
                    onRequestCommentAtVisual={() => {
                      const input = document.querySelector('input[placeholder*="feedback"], input[placeholder*="comment"], input[placeholder*="subtitle"]') as HTMLInputElement;
                      input?.focus();
                      input?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
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
                  currentTime={playerCurrentTime}
                  activeCommentId={activeCommentId}
                  mediaType={activeProject.type}
                  requestedSnapTime={requestedCommentTime}
                  requestedSnapTrigger={requestedCommentTrigger}
                  onSeekTo={(sec) => {
                    const videoEl = document.querySelector('video');
                    if (videoEl) {
                      videoEl.currentTime = sec;
                      setPlayerCurrentTime(sec);
                      videoEl.play().catch(() => {});
                    }
                  }}
                  onAddComment={handleAddComment}
                  onToggleResolve={handleToggleResolve}
                  onAddReply={handleAddReply}
                  onDeleteComment={handleDeleteComment}
                  onResolveAll={handleResolveAllComments}
                  isEditorView={isEditorActor}
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
                    setIsCreatorPreviewingClient(false);
                    setViewMode('editor');
                    playClickPop();
                  }}
                  className="text-neutral-400 hover:text-amber-400 transition flex items-center gap-1 font-medium"
                >
                  <span>Are you the editor/creator? Open Creator Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
        )}
      </main>

      {/* 5. MODALS */}
      {activeProject && !isPinLocked && (
        <>
          <UpiPaymentModal
            project={activeProject}
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            onSubmitUtr={handleSubmitUtr}
            onOpenInvoice={() => setIsInvoiceOpen(true)}
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
        creatorSettings={creatorSettings}
        onUpdateCreatorSettings={handleSaveAccountSettings}
      />

      <AccountSettingsModal
        isOpen={isAccountSettingsOpen}
        onClose={() => setIsAccountSettingsOpen(false)}
        creatorEmail={creatorEmail || ''}
        settings={creatorSettings}
        onSaveSettings={handleSaveAccountSettings}
      />
    </div>
  );
}
