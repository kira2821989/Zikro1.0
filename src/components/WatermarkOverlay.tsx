import React, { useEffect, useRef } from 'react';
import { WatermarkSettings } from '../types';

interface WatermarkOverlayProps {
  settings: WatermarkSettings;
  clientName: string;
  isUnlocked: boolean;
  currentTime: number;
  duration?: number;
  customOpacity?: number;
}

export interface CanvasWatermarkPhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export function formatTimecodeWithFrames(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 24);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Renders the full-frame diagonal anti-rip grid + moving center-zone badge
 * (Client Name, Live Timestamp, and "UNPAID DRAFT - DO NOT USE") directly onto a 2D Canvas context.
 */
export function drawCanvasWatermarkFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: WatermarkSettings | undefined,
  clientName: string,
  currentTime: number,
  physics: CanvasWatermarkPhysicsState,
  customOpacity?: number
): void {
  if (!width || !height) return;

  const rawOpacity = customOpacity !== undefined ? customOpacity : (settings?.opacity ?? 0.28);
  // Enforce minimum anti-theft visibility floor
  const effectiveOpacity = Math.max(0.18, Math.min(0.85, rawOpacity));
  const bannerText = (settings?.text || 'ZIKRO • DRAFT REVIEW').toUpperCase();
  const safeClient = (clientName || 'CLIENT').toUpperCase();
  const timecodeStr = formatTimecodeWithFrames(currentTime);
  const speedMode = settings?.speed || 'medium';

  // Step physics for center-zone moving badge (constrained to safe center crop zone so 9:16 Reels/Shorts crops cannot cut it out)
  const stepSpeed =
    speedMode === 'fast' ? 0.55 : speedMode === 'bouncing' ? 0.42 : speedMode === 'slow' ? 0.16 : 0.28;

  physics.phase += 0.025;
  physics.x += physics.vx * stepSpeed;
  physics.y += physics.vy * stepSpeed;

  // Constrain badge inside the central 24%..76% zone so cropping top/bottom/edges never removes it
  if (physics.x <= 24 || physics.x >= 76) {
    physics.vx *= -1;
    physics.x = Math.max(24, Math.min(76, physics.x));
  }
  if (physics.y <= 24 || physics.y >= 76) {
    physics.vy *= -1;
    physics.y = Math.max(24, Math.min(76, physics.y));
  }

  ctx.save();

  // 1. FULL-FRAME DIAGONAL ANTI-SCREEN-RECORDING GRID
  ctx.save();
  ctx.globalAlpha = Math.min(0.45, effectiveOpacity * 0.95);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-24 * Math.PI) / 180);

  const diag = Math.sqrt(width * width + height * height);
  const fontSizeGrid = Math.max(11, Math.round(Math.min(width, height) * 0.028));
  ctx.font = `700 ${fontSizeGrid}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const stepX = Math.max(210, fontSizeGrid * 16);
  const stepY = Math.max(85, fontSizeGrid * 6.2);
  const driftOffset = (physics.phase * 14) % stepX;

  for (let y = -diag / 1.5; y <= diag / 1.5; y += stepY) {
    const rowShift = (Math.round(y / stepY) % 2) * (stepX / 2);
    for (let x = -diag / 1.5; x <= diag / 1.5; x += stepX) {
      const drawX = x + rowShift - driftOffset;
      const label = `${bannerText} • ${safeClient} • UNPAID DRAFT`;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.lineWidth = 3;
      ctx.strokeText(label, drawX, y);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fillText(label, drawX, y);
    }
  }
  ctx.restore();

  // 2. ANTI-CROP CENTER RETICLE LINES (Subtle crosshair across 9:16 center crop area)
  ctx.save();
  ctx.globalAlpha = effectiveOpacity * 0.45;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(width * 0.15, height * 0.5);
  ctx.lineTo(width * 0.85, height * 0.5);
  ctx.moveTo(width * 0.5, height * 0.15);
  ctx.lineTo(width * 0.5, height * 0.85);
  ctx.stroke();
  ctx.restore();

  // 3. MOVING CENTER-ZONE ANTI-SCREEN-RECORDING BADGE
  // Displays: "UNPAID DRAFT - DO NOT USE", Client Name, and Live Timestamp
  const badgeCenterX = (physics.x / 100) * width;
  const badgeCenterY = (physics.y / 100) * height;

  const baseScale = Math.max(0.75, Math.min(1.35, Math.min(width, height) / 380));
  const badgeW = Math.min(width * 0.86, 290 * baseScale);
  const badgeH = 74 * baseScale;
  const badgeX = badgeCenterX - badgeW / 2;
  const badgeY = badgeCenterY - badgeH / 2;

  ctx.save();
  ctx.globalAlpha = Math.max(0.32, Math.min(0.92, effectiveOpacity + 0.16));

  // Rounded badge background
  const radius = 12 * baseScale;
  ctx.beginPath();
  ctx.moveTo(badgeX + radius, badgeY);
  ctx.lineTo(badgeX + badgeW - radius, badgeY);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + radius);
  ctx.lineTo(badgeX + badgeW, badgeY + badgeH - radius);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - radius, badgeY + badgeH);
  ctx.lineTo(badgeX + radius, badgeY + badgeH);
  ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - radius);
  ctx.lineTo(badgeX, badgeY + radius);
  ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
  ctx.closePath();

  ctx.fillStyle = 'rgba(10, 10, 10, 0.76)';
  ctx.fill();
  ctx.lineWidth = 1.6 * baseScale;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.78)';
  ctx.stroke();

  // Line 1: UNPAID DRAFT - DO NOT USE
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(12 * baseScale)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('⚠ UNPAID DRAFT - DO NOT USE', badgeCenterX, badgeY + 20 * baseScale);

  // Line 2: Custom Banner Text + Client Name
  ctx.font = `700 ${Math.round(11 * baseScale)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = '#ffffff';
  const clientLine = `${bannerText} • FOR: ${safeClient}`;
  ctx.fillText(clientLine.slice(0, 38), badgeCenterX, badgeY + 40 * baseScale);

  // Line 3: Live Timestamp + Anti-Crop ID
  ctx.font = `600 ${Math.round(10 * baseScale)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = '#f87171';
  ctx.fillText(`TC ${timecodeStr} • PROTECTED PREVIEW`, badgeCenterX, badgeY + 58 * baseScale);

  ctx.restore();
  ctx.restore();
}

/**
 * Standalone Canvas Watermark Overlay (used for ThumbnailReviewer and fallback layers).
 */
export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({
  settings,
  clientName,
  isUnlocked,
  currentTime,
  customOpacity
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const physicsRef = useRef<CanvasWatermarkPhysicsState>({
    x: 50,
    y: 50,
    vx: 0.9,
    vy: 0.75,
    phase: 0
  });

  useEffect(() => {
    if (isUnlocked) return;
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const targetW = Math.max(320, Math.round(rect.width || 640));
        const targetH = Math.max(240, Math.round(rect.height || 360));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawCanvasWatermarkFrame(
            ctx,
            canvas.width,
            canvas.height,
            settings,
            clientName,
            currentTime,
            physicsRef.current,
            customOpacity
          );
        }
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isUnlocked, settings, clientName, currentTime, customOpacity]);

  if (isUnlocked) return null;

  return (
    <canvas
      id="zikro-anti-theft-watermark"
      ref={canvasRef}
      data-watermark-protected="true"
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0 w-full h-full pointer-events-none select-none z-20"
    />
  );
};
