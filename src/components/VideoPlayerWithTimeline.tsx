import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  RotateCcw, 
  MessageSquarePlus,
  Sparkles,
  Lock,
  Download,
  AlertTriangle,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { Project, ProjectComment } from '../types';
import { WatermarkOverlay } from './WatermarkOverlay';
import { getMediaBlobUrl } from '../utils/mediaDb';
import { getDirectDownloadUrl } from '../supabase';

interface VideoPlayerProps {
  project: Project;
  comments: ProjectComment[];
  activeCommentId?: string | null;
  onSelectComment?: (comment: ProjectComment) => void;
  onRequestCommentAtTime?: (timeSeconds: number) => void;
  onCurrentTimeChange?: (time: number) => void;
  onOpenPaymentModal: () => void;
  isEditorView?: boolean;
}

export const VideoPlayerWithTimeline: React.FC<VideoPlayerProps> = ({
  project,
  comments,
  activeCommentId,
  onSelectComment,
  onRequestCommentAtTime,
  onCurrentTimeChange,
  onOpenPaymentModal,
  isEditorView = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(project.durationSeconds || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [liveOpacity, setLiveOpacity] = useState<number>(0.28);
  const [isTampered, setIsTampered] = useState(false);
  const isUnlocked = project.status === 'paid_unlocked';

  // FIX 1: Reset error and reload video immediately whenever project or mediaUrl changes!
  useEffect(() => {
    setVideoError(false);
    setCurrentTime(0);
    setIsPlaying(false);
    onCurrentTimeChange?.(0);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [project.id, project.mediaUrl]);

  // Sync duration when metadata loads
  const handleLoadedMetadata = () => {
    setVideoError(false);
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (dur && !isNaN(dur) && isFinite(dur)) {
        setDuration(dur);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);
      onCurrentTimeChange?.(cur);
    }
  };

  // FIX 3: Automatic fallback to local IndexedDB blob if remote/cloud URL fails on user's device
  const handleVideoError = async () => {
    try {
      const fallbackBlobUrl = await getMediaBlobUrl(project.id);
      if (fallbackBlobUrl && videoRef.current && videoRef.current.src !== fallbackBlobUrl) {
        console.log('🔄 Remote video error: falling back to local device IndexedDB blob...');
        videoRef.current.src = fallbackBlobUrl;
        videoRef.current.load();
        setVideoError(false);
        return;
      }
    } catch (e) {
      console.warn('Error reading fallback IndexedDB blob:', e);
    }

    // Only set video error if genuine playback failure occurred
    if (project.mediaUrl) {
      setVideoError(true);
    }
  };

  // ANTI-INSPECT-ELEMENT WATERMARK TAMPER SHIELD (Security Loophole #6)
  useEffect(() => {
    if (isUnlocked || !containerRef.current) return;

    const triggerTamperLockdown = () => {
      console.warn('🚨 Watermark tamper detected via DevTools! Locking video playback.');
      setIsTampered(true);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };

    const checkTamper = () => {
      if (isUnlocked) return;
      const watermarkEl = containerRef.current?.querySelector('#zikro-anti-theft-watermark') as HTMLElement | null;
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

      // Deep subtree verification: must contain visible text and protected elements must remain visible
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

  const togglePlay = () => {
    if (!videoRef.current || isTampered) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    onCurrentTimeChange?.(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const jumpToSeconds = (sec: number) => {
    const clamped = Math.max(0, Math.min(sec, duration));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
      setCurrentTime(clamped);
      onCurrentTimeChange?.(clamped);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePauseAndComment = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    onRequestCommentAtTime?.(currentTime);
  };

  // Block right-click save to prevent casual theft
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isUnlocked) {
      e.preventDefault();
    }
  };

  const handleRetryLoad = () => {
    setVideoError(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  // Aspect ratio classes
  const isVertical = project.aspectRatio === '9:16';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Video Container Frame */}
      <div 
        ref={containerRef}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className={`relative w-full overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl flex items-center justify-center ${
          isVertical 
            ? 'max-w-[340px] sm:max-w-[380px] aspect-[9/16] min-h-[500px]' 
            : 'max-w-3xl aspect-[16/9]'
        }`}
      >
        {/* HTML5 Video with Anti-Download Shield */}
        <video
          ref={videoRef}
          key={`${project.id}-${project.mediaUrl}`}
          src={project.mediaUrl}
          playsInline
          loop
          preload="auto"
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture={true}
          onContextMenu={(e) => {
            if (!isUnlocked) e.preventDefault();
          }}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={() => setVideoError(false)}
          onLoadedData={() => setVideoError(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          onError={handleVideoError}
          className="w-full h-full object-cover select-none pointer-events-auto"
          onClick={togglePlay}
        />

        {/* Fallback if external video cannot load */}
        {videoError && (
          <div className="absolute inset-0 bg-neutral-900/95 flex flex-col items-center justify-center p-6 text-center z-20">
            <AlertTriangle className="w-10 h-10 text-amber-400 mb-2 animate-bounce" />
            <div className="font-semibold text-neutral-200 text-sm">Preview Video Offline / Format Check</div>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs leading-relaxed">
              Direct video source could not stream in this browser session.
            </p>
            <button
              onClick={handleRetryLoad}
              className="mt-3 inline-flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-neutral-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Playback</span>
            </button>
          </div>
        )}

        {/* Anti-Inspect-Element Watermark Tamper Lockdown Screen (Security Flaw #10) */}
        {isTampered && (
          <div className="absolute inset-0 bg-neutral-950/98 flex flex-col items-center justify-center p-6 text-center z-40 select-none">
            <ShieldAlert className="w-12 h-12 text-red-500 mb-2 animate-bounce" />
            <div className="font-bold text-white text-sm">Security Lockdown: Watermark Tampering Detected</div>
            <p className="text-xs text-red-300 mt-1 max-w-xs leading-relaxed font-mono">
              The confidential preview watermark was removed or modified via DevTools. Video streaming has been paused and secured.
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

        {/* Dynamic Anti-Ghosting Watermark Engine */}
        <WatermarkOverlay
          settings={project.watermarkSettings}
          clientName={project.clientName}
          isUnlocked={isUnlocked}
          currentTime={currentTime}
          duration={duration}
          customOpacity={liveOpacity}
        />

        {/* Play/Pause Center Tap Badge overlay (Briefly visible on pause) */}
        {!isPlaying && !videoError && (
          <button
            onClick={togglePlay}
            aria-label="Play video"
            className="absolute z-25 p-4 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white shadow-xl hover:scale-110 active:scale-95 transition-transform"
          >
            <Play className="w-8 h-8 fill-white ml-1" />
          </button>
        )}

        {/* Custom Video Controls Bar */}
        <div 
          className={`absolute bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity duration-200 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Timeline Bar with Comment Markers */}
          <div className="relative w-full mb-2 group">
            {/* Markers on the track */}
            <div className="absolute inset-x-0 -top-1 h-3 pointer-events-none z-10">
              {duration > 0 && comments.map((comment) => {
                const percent = Math.min(100, Math.max(0, (comment.timestampSeconds / duration) * 100));
                const isActive = activeCommentId === comment.id;
                return (
                  <button
                    key={comment.id}
                    title={`${comment.formattedTime}: ${comment.text}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      jumpToSeconds(comment.timestampSeconds);
                      onSelectComment?.(comment);
                    }}
                    style={{ left: `${percent}%` }}
                    className={`absolute top-0 -translate-x-1/2 pointer-events-auto transition-transform ${
                      isActive ? 'scale-125 z-20' : 'hover:scale-125'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      comment.resolved 
                        ? 'bg-emerald-500 border-white' 
                        : isActive 
                          ? 'bg-amber-400 border-white ring-2 ring-amber-400/50' 
                          : 'bg-red-500 border-white ring-1 ring-black'
                    }`} />
                  </button>
                );
              })}
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              aria-label="Video timeline scrubber"
              className="w-full h-1.5 bg-neutral-700/80 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-3">
              <button 
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="hover:text-amber-400 transition p-1"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>

              <button 
                onClick={() => jumpToSeconds(currentTime - 2)}
                title="Rewind 2s"
                className="hover:text-amber-400 transition p-1 hidden sm:block"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-300">
                <span className="text-white font-medium">{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Volume */}
              <div className="hidden sm:flex items-center gap-1 ml-1 group/vol">
                <button onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'} className="hover:text-amber-400">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Volume slider"
                  className="w-14 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Playback speed */}
              <select
                value={playbackRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value);
                  setPlaybackRate(rate);
                  if (videoRef.current) videoRef.current.playbackRate = rate;
                }}
                className="bg-neutral-800/80 border border-neutral-700 text-neutral-200 text-[10px] rounded px-1.5 py-0.5 font-mono focus:outline-none"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1.0x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2.0x</option>
              </select>

              <button 
                onClick={toggleFullscreen} 
                aria-label="Toggle Fullscreen"
                className="p-1 hover:text-amber-400 transition"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Strip Directly Below Player (Mobile Friendly) */}
      <div className={`w-full mt-3 flex flex-wrap items-center justify-between gap-2.5 ${
        isVertical ? 'max-w-[340px] sm:max-w-[380px]' : 'max-w-3xl'
      }`}>
        {/* 1. One-tap "Comment at current time" */}
        <button
          onClick={handlePauseAndComment}
          className="flex-1 min-w-[170px] inline-flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 active:scale-95 border border-neutral-700/80 hover:border-amber-500/50 text-neutral-100 px-3.5 py-2.5 rounded-xl font-medium text-xs transition shadow-sm"
        >
          <MessageSquarePlus className="w-4 h-4 text-amber-400" />
          <span>Comment at <span className="font-mono text-amber-300 font-semibold">{formatTime(currentTime)}</span></span>
        </button>

        {/* 2. Direct Unlock or Download Button */}
        {isUnlocked ? (
          <a
            href={getDirectDownloadUrl(project.mediaUrl, `${project.title}_MASTER`)}
            download={`${project.title.replace(/\s+/g, '_')}_MASTER.mp4`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[170px] inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3.5 py-2.5 rounded-xl font-semibold text-xs transition shadow-lg shadow-emerald-600/30"
          >
            <Download className="w-4 h-4" />
            <span>Download Clean Video</span>
          </a>
        ) : (
          <button
            onClick={onOpenPaymentModal}
            className="flex-1 min-w-[170px] inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-neutral-950 font-bold px-3.5 py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
          >
            <Lock className="w-4 h-4" />
            <span>Approve & Pay ₹{project.amountINR.toLocaleString('en-IN')}</span>
          </button>
        )}
      </div>

      {/* 3. Watermark Transparency & Review Clarity Tuner (ONLY VISIBLE TO EDITOR - Security Flaw #8) */}
      {!isUnlocked && isEditorView && (
        <div className={`w-full mt-2.5 p-2 bg-neutral-900/60 border border-neutral-800/80 rounded-xl flex items-center justify-between flex-wrap gap-2 text-[11px] ${
          isVertical ? 'max-w-[340px] sm:max-w-[380px]' : 'max-w-3xl'
        }`}>
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium">Watermark Visibility:</span>
          </div>

          <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
            <button
              type="button"
              onClick={() => setLiveOpacity(0.15)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                liveOpacity === 0.15 
                  ? 'bg-amber-500 text-neutral-950 font-bold' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Ghost (15%)
            </button>
            <button
              type="button"
              onClick={() => setLiveOpacity(0.28)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                liveOpacity === 0.28 
                  ? 'bg-amber-500 text-neutral-950 font-bold' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Subtle (28%)
            </button>
            <button
              type="button"
              onClick={() => setLiveOpacity(0.42)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                liveOpacity === 0.42 
                  ? 'bg-amber-500 text-neutral-950 font-bold' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Standard (42%)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
