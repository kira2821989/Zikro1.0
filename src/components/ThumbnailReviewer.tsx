import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Download,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldAlert,
  RefreshCw,
  Clock
} from 'lucide-react';
import { Project, ProjectComment } from '../types';
import { getDirectDownloadUrl } from '../supabase';
import { WatermarkOverlay } from './WatermarkOverlay';

interface ThumbnailReviewerProps {
  project: Project;
  comments: ProjectComment[];
  onOpenPaymentModal: () => void;
  onRequestCommentAtVisual?: (note: string) => void;
}

export const ThumbnailReviewer: React.FC<ThumbnailReviewerProps> = ({
  project,
  onOpenPaymentModal,
  onRequestCommentAtVisual
}) => {
  const [zoom, setZoom] = useState(1);
  const [isTampered, setIsTampered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUnlocked = project.status === 'paid_unlocked';
  const isVerificationPending =
    project.status === 'utr_submitted' || project.status === 'verification_pending';

  const previewSrc = project.previewVideoUrl || project.mediaUrl;
  const masterDownloadSrc = isUnlocked
    ? project.masterVideoUrl || previewSrc
    : '';

  useEffect(() => {
    setIsTampered(false);
    setZoom(1);
  }, [project.id, previewSrc]);

  // ANTI-INSPECT-ELEMENT CANVAS WATERMARK TAMPER SHIELD FOR THUMBNAIL
  useEffect(() => {
    if (isUnlocked || !containerRef.current) return;

    const triggerTamperLockdown = () => {
      console.warn('🚨 Thumbnail watermark tamper detected via DevTools! Locking preview.');
      setIsTampered(true);
    };

    const checkTamper = () => {
      if (isUnlocked) return;
      const watermarkCanvas = containerRef.current?.querySelector(
        '#zikro-anti-theft-watermark'
      ) as HTMLCanvasElement | null;
      if (!watermarkCanvas) {
        triggerTamperLockdown();
        return;
      }

      const style = window.getComputedStyle(watermarkCanvas);
      const opacity = parseFloat(style.opacity || '1');
      const rect = watermarkCanvas.getBoundingClientRect();
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        opacity < 0.15 ||
        rect.width < 40 ||
        rect.height < 40
      ) {
        triggerTamperLockdown();
      }
    };

    const observer = new MutationObserver(() => {
      checkTamper();
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'width', 'height']
    });

    const interval = setInterval(checkTamper, 1500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [isUnlocked, previewSrc]);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isUnlocked) {
      e.preventDefault();
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-3xl">
      <div
        ref={containerRef}
        onContextMenu={handleContextMenu}
        className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl flex items-center justify-center select-none"
      >
        {/* The Graphic Image (Hidden if tampered) */}
        {!isTampered && (
          <div
            className="w-full h-full transition-transform duration-200 flex items-center justify-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={previewSrc}
              alt={project.title}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          </div>
        )}

        {/* Anti-Inspect-Element Watermark Tamper Lockdown Screen */}
        {isTampered && (
          <div className="absolute inset-0 bg-neutral-950/98 flex flex-col items-center justify-center p-6 text-center z-40 select-none">
            <ShieldAlert className="w-12 h-12 text-red-500 mb-2 animate-bounce" />
            <div className="font-bold text-white text-sm">
              Security Lockdown: Watermark Tampering Detected
            </div>
            <p className="text-xs text-red-300 mt-1 max-w-xs leading-relaxed font-mono">
              The confidential preview watermark was removed or modified via DevTools. Graphic preview has been locked.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex items-center gap-1.5 bg-red-950 border border-red-500/50 hover:bg-red-900 text-red-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Preview Session</span>
            </button>
          </div>
        )}

        {/* Canvas Anti-Screen-Recording Watermark Overlay for Thumbnail */}
        {!isUnlocked && (
          <WatermarkOverlay
            settings={project.watermarkSettings}
            clientName={project.clientName}
            isUnlocked={isUnlocked}
            currentTime={0}
          />
        )}

        {/* Unlocked banner */}
        {isUnlocked && (
          <div className="absolute top-3 right-3 bg-emerald-600/90 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg border border-emerald-400/50">
            <ShieldCheck className="w-4 h-4" />
            <span>UNLOCKED & APPROVED</span>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-black/70 backdrop-blur-md p-1 rounded-lg border border-neutral-700/80 text-white">
          <button
            onClick={() => setZoom((z) => Math.max(0.8, z - 0.2))}
            title="Zoom out"
            className="p-1.5 hover:text-amber-400 rounded transition"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
            title="Zoom in"
            className="p-1.5 hover:text-amber-400 rounded transition"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            title="Reset Zoom"
            className="p-1.5 hover:text-amber-400 rounded transition"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Action Strip */}
      <div className="w-full mt-3 flex items-center justify-between gap-3">
        <button
          onClick={() => onRequestCommentAtVisual?.('Visual design feedback')}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 px-4 py-2.5 rounded-xl font-medium text-xs transition"
        >
          <span>Leave Thumbnail Feedback</span>
        </button>

        {isUnlocked ? (
          <a
            href={getDirectDownloadUrl(masterDownloadSrc, `${project.title}_HD`, 'thumbnail')}
            download={`${project.title.replace(/\s+/g, '_')}_HD.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition shadow-lg shadow-emerald-600/30"
          >
            <Download className="w-4 h-4" />
            <span>Download Clean Master Graphic</span>
          </a>
        ) : isVerificationPending ? (
          <button
            onClick={onOpenPaymentModal}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold px-4 py-2.5 rounded-xl text-xs transition animate-pulse"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Payment Verification Pending with Editor</span>
          </button>
        ) : (
          <button
            onClick={onOpenPaymentModal}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
          >
            <Lock className="w-4 h-4" />
            <span>Approve & Pay ₹{project.amountINR} via UPI</span>
          </button>
        )}
      </div>
    </div>
  );
};
