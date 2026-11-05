import React, { useState } from 'react';
import { Lock, Download, ShieldCheck, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Project, ProjectComment } from '../types';

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
  const isUnlocked = project.status === 'paid_unlocked';

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isUnlocked) {
      e.preventDefault();
      alert('Saving thumbnail preview is disabled. Please unlock via UPI to download the high-resolution clean image.');
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-3xl">
      <div 
        onContextMenu={handleContextMenu}
        className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl flex items-center justify-center select-none"
      >
        {/* The Graphic Image */}
        <div 
          className="w-full h-full transition-transform duration-200 flex items-center justify-center"
          style={{ transform: `scale(${zoom})` }}
        >
          <img
            src={project.mediaUrl}
            alt={project.title}
            className="w-full h-full object-contain pointer-events-none"
          />
        </div>

        {/* Watermark Overlay for Thumbnail */}
        {!isUnlocked && (
          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between">
            {/* Top Bar */}
            <div className="p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-xs font-mono text-amber-300">
              <span className="bg-red-950/80 border border-red-500/50 text-red-200 px-2 py-0.5 rounded font-semibold text-[10px]">
                THUMBNAIL DRAFT PREVIEW
              </span>
              <span>FOR: {project.clientName}</span>
            </div>

            {/* Delicate Stencil Watermark Grid without heavy dark boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 p-6 opacity-30 place-items-center select-none">
              {Array.from({ length: 6 }).map((_, i) => (
                <div 
                  key={i} 
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
            <div className="p-2 bg-gradient-to-t from-black/60 to-transparent text-center text-[9px] font-mono text-neutral-400">
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
            href={project.mediaUrl}
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
