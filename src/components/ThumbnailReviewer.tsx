import React, { useState, useEffect, useRef } from 'react';
import { Lock, Download, ShieldCheck, ZoomIn, ZoomOut, RotateCcw, ShieldAlert, RefreshCw } from 'lucide-react';
import { Project, ProjectComment } from '../types';
import { getDirectDownloadUrl } from '../supabase';

interface ThumbnailReviewerProps {
  project: Project;
  comments: ProjectComment[];
  onOpenPaymentModal: () => void;
  onRequestCommentAtVisual?: (note: string) => void;
}

export const ThumbnailReviewer: React.FC<ThumbnailReviewerProps> = ({
  project,
  comments,
  onOpenPaymentModal,
  onRequestCommentAtVisual
}) => {
  const [zoom, setZoom] = useState(1);
  const [isTampered, setIsTampered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUnlocked = project.status === 'paid_unlocked';

  // Reset tamper state when switching projects
  useEffect(() => {
    setIsTampered(false);
    setZoom(1);
  }, [project.id, project.mediaUrl]);

  // ANTI-INSPECT-ELEMENT WATERMARK TAMPER SHIELD FOR THUMBNAIL
  useEffect(() => {
    if (isUnlocked || !containerRef.current) return;

    const triggerTamperLockdown = () => {
      console.warn('🚨 Thumbnail watermark tamper detected via DevTools! Locking preview.');
      setIsTampered(true);
    };

    const checkTamper = () => {
      if (isUnlocked) return;
      const watermarkEl = containerRef.current?.querySelector('#zikro-thumbnail-watermark') as HTMLElement | null;
      if (!watermarkEl) {
        triggerTamperLockdown();
        return;
      }

      const style = window.getComputedStyle(watermarkEl);
      const opacity = parseFloat(style.opacity || '1');
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        opacity < 0.10
      ) {
        triggerTamperLockdown();
        return;
      }

      const text = (watermarkEl.innerText || watermarkEl.textContent || '').trim();
      if (text.length <= 3) {
        triggerTamperLockdown();
        return;
      }

      const protectedElements = watermarkEl.querySelectorAll('[data-watermark-protected="true"]');
      if (protectedElements.length === 0) {
        triggerTamperLockdown();
        return;
      }

      for (let i = 0; i < protectedElements.length; i++) {
        const el = protectedElements[i] as HTMLElement;
        const elStyle = window.getComputedStyle(el);
        const elOpacity = parseFloat(elStyle.opacity || '1');
        if (
          elStyle.display === 'none' ||
          elStyle.visibility === 'hidden' ||
          elOpacity < 0.10
        ) {
          triggerTamperLockdown();
          return;
        }
      }
    };

    const observer = new MutationObserver(() => {
      checkTamper();
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ['style', 'class', 'hidden']
    });

    const interval = setInterval(checkTamper, 1500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [isUnlocked, project.mediaUrl]);

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
              src={project.mediaUrl}
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
            <div className="font-bold text-white text-sm">Security Lockdown: Watermark Tampering Detected</div>
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

        {/* Watermark Overlay for Thumbnail */}
        {!isUnlocked && (
          <div 
            id="zikro-thumbnail-watermark"
            className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between"
          >
            {/* Top Bar */}
            <div 
              data-watermark-protected="true"
              className="p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-xs font-mono text-amber-300"
            >
              <span className="bg-red-950/80 border border-red-500/50 text-red-200 px-2 py-0.5 rounded font-semibold text-[10px]">
                THUMBNAIL DRAFT PREVIEW
              </span>
              <span>FOR: {project.clientName}</span>
            </div>

            {/* Delicate Stencil Watermark Grid without heavy dark boxes */}
            <div 
              data-watermark-protected="true"
              className="grid grid-cols-2 sm:grid-cols-3 gap-6 p-6 place-items-center select-none"
              style={{ opacity: project.watermarkSettings?.opacity || 0.30 }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div 
                  key={i} 
                  data-watermark-protected="true"
                  className="transform -rotate-20 text-center select-none"
                >
                  <div 
                    className="text-white font-extrabold text-xs sm:text-sm uppercase tracking-widest"
                    style={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                      WebkitTextStroke: '0.5px rgba(255,255,255,0.8)'
                    }}
                  >
                    {project.watermarkSettings.text || 'ZIKRO PREVIEW'}
                  </div>
                  <div className="text-[9px] text-amber-300 font-mono tracking-wider drop-shadow">
                    UNPAID • DO NOT PUBLISH
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Bar */}
            <div 
              data-watermark-protected="true"
              className="p-2 bg-gradient-to-t from-black/60 to-transparent text-center text-[9px] font-mono text-neutral-400"
            >
              PROTECTED BY ZIKRO • UNLOCK CLEAN HD IMAGE VIA UPI
            </div>
          </div>
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
            onClick={() => setZoom(z => Math.max(0.8, z - 0.2))} 
            title="Zoom out"
            className="p-1.5 hover:text-amber-400 rounded transition"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono px-1">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(2, z + 0.2))} 
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
            href={getDirectDownloadUrl(project.mediaUrl, `${project.title}_HD`, 'thumbnail')}
            download={`${project.title.replace(/\s+/g, '_')}_HD.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition shadow-lg shadow-emerald-600/30"
          >
            <Download className="w-4 h-4" />
            <span>Download Ultra HD Thumbnail</span>
          </a>
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
