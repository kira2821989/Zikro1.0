import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, Zap } from 'lucide-react';
import { WatermarkSettings } from '../types';

interface WatermarkOverlayProps {
  settings: WatermarkSettings;
  clientName: string;
  isUnlocked: boolean;
  currentTime: number;
  duration: number;
  customOpacity?: number; // Optional override from live player control
}

export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({
  settings,
  clientName,
  isUnlocked,
  currentTime,
  duration,
  customOpacity
}) => {
  const [showCelebration, setShowCelebration] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Position state for bouncing badge mode
  const [pos, setPos] = useState({ x: 20, y: 30, vx: 0.22, vy: 0.18 });

  // Effective opacity: default to subtle ~0.28 if settings opacity was too high
  const effectiveOpacity = customOpacity !== undefined 
    ? customOpacity 
    : Math.min(settings.opacity, 0.40);

  useEffect(() => {
    if (isUnlocked) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isUnlocked]);

  // Gentle DVD bouncing physics
  useEffect(() => {
    if (isUnlocked || settings.speed !== 'bouncing') return;

    let animId: number;
    const animate = () => {
      setPos(prev => {
        let newX = prev.x + prev.vx;
        let newY = prev.y + prev.vy;
        let newVx = prev.vx;
        let newVy = prev.vy;

        // Bounce within safe zones without covering center face constantly
        if (newX <= 5) {
          newX = 5;
          newVx = Math.abs(prev.vx);
        } else if (newX >= 60) {
          newX = 60;
          newVx = -Math.abs(prev.vx);
        }

        if (newY <= 8) {
          newY = 8;
          newVy = Math.abs(prev.vy);
        } else if (newY >= 82) {
          newY = 82;
          newVy = -Math.abs(prev.vy);
        }

        return { x: newX, y: newY, vx: newVx, vy: newVy };
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isUnlocked, settings.speed]);

  const formatSec = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  if (isUnlocked) {
    if (!showCelebration) return null;
    return (
      <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center bg-emerald-950/20 backdrop-blur-[1px] transition-all duration-700 animate-in fade-in">
        <div className="bg-emerald-600/90 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-emerald-400/40 flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-200 animate-bounce" />
          <div>
            <div className="font-bold text-xs tracking-wide flex items-center gap-1.5">
              <span>WATERMARK REMOVED</span>
              <span className="text-[9px] bg-emerald-400/30 px-1 py-0.2 rounded font-mono">100% UNLOCKED</span>
            </div>
            <div className="text-[11px] text-emerald-100">Original Clean Master File Ready</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20 flex flex-col justify-between"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* 1. Discrete Top Ribbon (Slim, Doesn't block video) */}
      <div className="w-full bg-gradient-to-b from-black/60 to-transparent p-2 sm:p-2.5 flex items-center justify-between text-[10px] font-mono text-neutral-300">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="bg-black/50 border border-neutral-700/60 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider text-amber-300/90 font-medium">
            Draft Review
          </span>
          {settings.showClientTag && (
            <span className="hidden sm:inline text-neutral-400 text-[10px]">
              For: {clientName}
            </span>
          )}
        </div>

        {settings.showTimecode && (
          <div className="bg-black/50 px-2 py-0.5 rounded text-neutral-300 font-mono text-[10px] border border-neutral-800">
            TC {formatSec(currentTime)}
          </div>
        )}
      </div>

      {/* 2. Main Studio-Grade Watermark Layer */}

      {/* Mode A: Repetitive Delicate Security Pattern (Faint like Shutterstock/Getty) */}
      {settings.style === 'screen-tile' && (
        <div 
          className="absolute inset-0 grid grid-cols-2 sm:grid-cols-3 gap-6 p-4 place-items-center pointer-events-none"
          style={{ opacity: effectiveOpacity }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div 
              key={i} 
              className="transform -rotate-25 text-center select-none"
            >
              <div 
                className="font-extrabold text-xs sm:text-sm tracking-widest uppercase text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                style={{
                  WebkitTextStroke: '0.5px rgba(255,255,255,0.7)',
                  textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                }}
              >
                {settings.text || 'DRAFT PREVIEW'}
              </div>
              <div className="text-[9px] text-amber-300 font-mono tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                PAY TO UNLOCK CLEAN 4K
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mode B: Compact Bouncing Pill (Smooth, non-blocking DVD drift) */}
      {settings.speed === 'bouncing' && settings.style !== 'screen-tile' && (
        <div 
          className="absolute transition-transform duration-100 ease-linear pointer-events-none"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            opacity: Math.max(0.35, effectiveOpacity + 0.1)
          }}
        >
          <div className="bg-black/50 border border-white/20 shadow-lg px-3 py-1.5 rounded-full backdrop-blur-[2px] flex items-center gap-1.5 whitespace-nowrap text-white">
            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="font-bold text-[11px] tracking-wide font-mono text-amber-200">
              {settings.text || 'DRAFT PREVIEW'}
            </span>
            <span className="text-[9px] text-neutral-300 font-mono bg-white/10 px-1.5 py-0.2 rounded-full">
              UNPAID
            </span>
          </div>
        </div>
      )}

      {/* Mode C: Hollow Stencil / Semi-transparent Diagonal Stamp (Default - Client Can Clearly Watch Video!) */}
      {settings.speed !== 'bouncing' && settings.style !== 'screen-tile' && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: effectiveOpacity }}
        >
          {/* Subtle Hollow Stencil Text with Zero Dark Box */}
          <div className="animate-watermark-float transform text-center select-none p-2 pointer-events-none">
            <div 
              className="text-white font-black text-xl sm:text-2xl md:text-3xl tracking-widest uppercase"
              style={{
                textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
                WebkitTextStroke: '0.8px rgba(255, 255, 255, 0.85)'
              }}
            >
              {settings.text || 'ZIKRO PREVIEW'}
            </div>
            
            <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-mono text-amber-300 tracking-wider font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              <span>UNPAID DRAFT</span>
              <span>•</span>
              <span>INSTANT UPI UNLOCK</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Subtle Non-Intrusive Bottom Strip */}
      <div className="w-full bg-gradient-to-t from-black/60 to-transparent p-1.5 text-center">
        <span className="text-[9px] font-mono text-neutral-400/80 tracking-widest">
          ZIKRO SECURE PREVIEW • RELEASES AFTER UPI APPROVAL
        </span>
      </div>
    </div>
  );
};
