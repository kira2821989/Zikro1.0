import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Film, 
  Image as ImageIcon, 
  Shield, 
  DollarSign, 
  User, 
  Phone, 
  KeyRound, 
  Cloud, 
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Settings2,
  ShieldCheck,
  CheckCircle2,
  Link2
} from 'lucide-react';
import { Project, MediaType, AspectRatio, WatermarkSpeed, WatermarkStyle, CreatorSettings } from '../types';
import { uploadMediaToSupabase, saveProjectToSupabase, deleteMediaFromSupabase, loadCreatorSettings, saveCreatorSettings } from '../supabase';
import { storeMediaBlob, formatBytes } from '../utils/mediaDb';
import { playClickPop } from '../utils/audio';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  initialProject?: Project | null;
  creatorEmail: string;
  creatorSettings?: CreatorSettings;
  onUpdateCreatorSettings?: (newSettings: CreatorSettings) => void;
}

const PRESET_VIDEOS = [
  { label: '🔥 9:16 Action Reel Sample', url: 'https://www.w3schools.com/html/mov_bbb.mp4', aspect: '9:16' as AspectRatio },
  { label: '📱 9:16 Shorts Sample', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', aspect: '9:16' as AspectRatio },
  { label: '🎬 16:9 YouTube Sample', url: 'https://www.w3schools.com/html/mov_bbb.mp4', aspect: '16:9' as AspectRatio },
];

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProject,
  creatorEmail,
  creatorSettings,
  onUpdateCreatorSettings
}) => {
  const cleanCreatorEmail = creatorEmail.toLowerCase().trim();
  const effectiveSettings = creatorSettings || loadCreatorSettings(cleanCreatorEmail);
  const defaultPayeeFromEmail = effectiveSettings.upiPayeeName || (cleanCreatorEmail ? cleanCreatorEmail.split('@')[0] : 'Creator');

  const [title, setTitle] = useState(initialProject?.title || '');
  const [type, setType] = useState<MediaType>(initialProject?.type || 'video');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialProject?.aspectRatio || '9:16');
  const [clientName, setClientName] = useState(initialProject?.clientName || '');
  const [clientPhone, setClientPhone] = useState(initialProject?.clientPhone || '');
  const [editorPhone, setEditorPhone] = useState(
    initialProject?.editorPhone || effectiveSettings.editorPhone || ''
  );
  const [amountINR, setAmountINR] = useState<number>(initialProject?.amountINR || 1500);
  const [upiId, setUpiId] = useState(
    initialProject?.upiId || effectiveSettings.upiId || ''
  );
  const [upiPayeeName, setUpiPayeeName] = useState(
    initialProject?.upiPayeeName || defaultPayeeFromEmail
  );
  const [mediaUrl, setMediaUrl] = useState(initialProject?.mediaUrl || PRESET_VIDEOS[0].url);
  const [localFileName, setLocalFileName] = useState(initialProject?.storageInfo?.originalFileName || '');
  const [pendingFileBlob, setPendingFileBlob] = useState<File | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(initialProject?.storageInfo?.fileSizeBytes || 0);

  // Account Settings UPI integration
  const hasSavedAccountUpi = Boolean(effectiveSettings.upiId && effectiveSettings.autoFillUpi);
  const [isOverridingUpi, setIsOverridingUpi] = useState<boolean>(false);
  const [saveUpiToSettings, setSaveUpiToSettings] = useState<boolean>(true);
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);

  // Collapsible Advanced Options state
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    Boolean(initialProject?.securitySettings?.isProtected)
  );

  // Cloud upload tracking
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Security & Passcode
  const [isProtected, setIsProtected] = useState(initialProject?.securitySettings?.isProtected ?? false);
  const [passcode, setPasscode] = useState(
    initialProject?.securitySettings?.passcode || 
    Math.floor(1000 + Math.random() * 9000).toString()
  );

  // Watermark Settings
  const [watermarkText, setWatermarkText] = useState(
    initialProject?.watermarkSettings?.text || effectiveSettings.defaultWatermarkText || 'ZIKRO • DRAFT REVIEW'
  );
  const [watermarkSpeed, setWatermarkSpeed] = useState<WatermarkSpeed>(initialProject?.watermarkSettings?.speed || 'medium');
  const [watermarkStyle, setWatermarkStyle] = useState<WatermarkStyle>(initialProject?.watermarkSettings?.style || 'diagonal-floating');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(initialProject?.watermarkSettings?.opacity || 0.28);
  const [showTimecode, setShowTimecode] = useState(initialProject?.watermarkSettings?.showTimecode ?? true);
  const [showClientTag, setShowClientTag] = useState(initialProject?.watermarkSettings?.showClientTag ?? true);

  // RESET/SYNC PROJECT FORM STATE
  useEffect(() => {
    if (!isOpen) return;
    setUploadError(null);
    const latestSettings = creatorSettings || loadCreatorSettings(cleanCreatorEmail);
    const fallbackPayee = latestSettings.upiPayeeName || (cleanCreatorEmail ? cleanCreatorEmail.split('@')[0] : 'Creator');

    if (initialProject) {
      // Edit mode: populate all fields cleanly
      setTitle(initialProject.title || '');
      setType(initialProject.type || 'video');
      setAspectRatio(initialProject.aspectRatio || '9:16');
      setClientName(initialProject.clientName || '');
      setClientPhone(initialProject.clientPhone || '');
      setEditorPhone(initialProject.editorPhone || latestSettings.editorPhone || '');
      setAmountINR(initialProject.amountINR || 1500);
      setUpiId(initialProject.upiId || latestSettings.upiId || '');
      setUpiPayeeName(initialProject.upiPayeeName || fallbackPayee);
      setMediaUrl(initialProject.mediaUrl || PRESET_VIDEOS[0].url);
      setLocalFileName(initialProject.storageInfo?.originalFileName || '');
      setPendingFileBlob(null);
      setFileSizeBytes(initialProject.storageInfo?.fileSizeBytes || 0);

      setIsOverridingUpi(false);
      setSaveUpiToSettings(true);
      setShowUrlInput(false);

      setIsProtected(initialProject.securitySettings?.isProtected ?? false);
      setShowAdvanced(Boolean(initialProject.securitySettings?.isProtected));
      setPasscode(
        initialProject.securitySettings?.passcode || 
        Math.floor(1000 + Math.random() * 9000).toString()
      );

      setWatermarkText(initialProject.watermarkSettings?.text || latestSettings.defaultWatermarkText || 'ZIKRO • DRAFT REVIEW');
      setWatermarkSpeed(initialProject.watermarkSettings?.speed || 'medium');
      setWatermarkStyle(initialProject.watermarkSettings?.style || 'diagonal-floating');
      setWatermarkOpacity(initialProject.watermarkSettings?.opacity ?? 0.28);
      setShowTimecode(initialProject.watermarkSettings?.showTimecode ?? true);
      setShowClientTag(initialProject.watermarkSettings?.showClientTag ?? true);
    } else {
      // New Project mode: reset all fields to clean defaults
      setTitle('');
      setType('video');
      setAspectRatio('9:16');
      setClientName('');
      setClientPhone('');
      setEditorPhone(latestSettings.editorPhone || '');
      setAmountINR(1500);
      setUpiId(latestSettings.autoFillUpi && latestSettings.upiId ? latestSettings.upiId : '');
      setUpiPayeeName(fallbackPayee);
      setMediaUrl(PRESET_VIDEOS[0].url);
      setLocalFileName('');
      setPendingFileBlob(null);
      setFileSizeBytes(0);

      setIsOverridingUpi(false);
      setSaveUpiToSettings(true);
      setShowUrlInput(false);

      setIsProtected(false);
      setShowAdvanced(false);
      setPasscode(Math.floor(1000 + Math.random() * 9000).toString());

      setWatermarkText(latestSettings.defaultWatermarkText || 'ZIKRO • DRAFT REVIEW');
      setWatermarkSpeed('medium');
      setWatermarkStyle('diagonal-floating');
      setWatermarkOpacity(0.28);
      setShowTimecode(true);
      setShowClientTag(true);
    }
  }, [initialProject, isOpen, cleanCreatorEmail, creatorSettings]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadError(null);
      const tempPreviewUrl = URL.createObjectURL(file);

      // Auto-detect video vs thumbnail format and aspect ratio from file
      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
        setType('thumbnail');
        setAspectRatio('16:9');
        const img = new Image();
        img.onload = () => {
          if (img.width && img.height) {
            const ratio = img.width / img.height;
            if (ratio < 0.8) setAspectRatio('9:16');
            else if (ratio > 1.2) setAspectRatio('16:9');
            else setAspectRatio('1:1');
          }
        };
        img.src = tempPreviewUrl;
      } else if (file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name)) {
        setType('video');
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.onloadedmetadata = () => {
          if (vid.videoWidth && vid.videoHeight) {
            const ratio = vid.videoWidth / vid.videoHeight;
            if (ratio < 0.8) setAspectRatio('9:16');
            else if (ratio > 1.2) setAspectRatio('16:9');
            else setAspectRatio('1:1');
          }
        };
        vid.src = tempPreviewUrl;
      }

      setPendingFileBlob(file);
      setFileSizeBytes(file.size);
      setMediaUrl(tempPreviewUrl);
      setLocalFileName(file.name);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      playClickPop();
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_VIDEOS[0]) => {
    setUploadError(null);
    setPendingFileBlob(null);
    setMediaUrl(preset.url);
    setAspectRatio(preset.aspect);
    setLocalFileName('');
    setFileSizeBytes(0);
    playClickPop();
  };

  const generateRandomPin = () => {
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    setPasscode(random);
    playClickPop();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !mediaUrl.trim()) return;

    const finalUpiId = upiId.trim() || effectiveSettings.upiId || 'editor@okhdfcbank';
    const resolvedTitle = title.trim() || (localFileName ? localFileName.replace(/\.[^/.]+$/, '') : `${clientName.trim()} - Video Draft`);
    const resolvedPayeeName = upiPayeeName.trim() || defaultPayeeFromEmail;

    setUploadError(null);
    setIsSavingMedia(true);
    setUploadProgress(10);
    setUploadStatusText('Preparing project data...');

    // Save to Account Settings if requested or if updating defaults
    if (cleanCreatorEmail && (saveUpiToSettings || !effectiveSettings.upiId)) {
      const updatedSettings: CreatorSettings = {
        upiPayeeName: resolvedPayeeName,
        upiId: finalUpiId,
        editorPhone: editorPhone.trim() || effectiveSettings.editorPhone,
        defaultWatermarkText: effectiveSettings.defaultWatermarkText || 'ZIKRO • DRAFT REVIEW',
        autoFillUpi: true
      };
      await saveCreatorSettings(cleanCreatorEmail, updatedSettings);
      if (onUpdateCreatorSettings) {
        onUpdateCreatorSettings(updatedSettings);
      }
    }

    const projectId = initialProject?.id || `proj-${Date.now().toString(36)}`;
    let finalMediaUrl = mediaUrl.trim();
    let storageType: 'supabase_storage' | 'indexeddb' | 'cloud_url' = 'cloud_url';

    // 1. If a new file is uploaded, and there was an existing Supabase video, delete the previous version to save storage quota
    if (pendingFileBlob && initialProject?.mediaUrl) {
      deleteMediaFromSupabase(initialProject.mediaUrl).catch(e => {
        console.warn('Storage cleanup notice on re-upload:', e);
      });
    }

    // 2. If file was selected, store in local IndexedDB AND upload to Supabase Cloud Storage
    if (pendingFileBlob) {
      try {
        setUploadStatusText(`Caching ${formatBytes(fileSizeBytes)} to device storage...`);
        await storeMediaBlob(projectId, pendingFileBlob, localFileName || 'video.mp4');
      } catch (idbErr) {
        console.warn('IndexedDB initial caching notice:', idbErr);
      }

      // 3. Upload to Supabase Cloud Storage bucket 'videos' — stop and warn if it fails!
      try {
        setUploadStatusText(`Uploading ${formatBytes(fileSizeBytes)} to Supabase Cloud Storage...`);
        const cloudUrl = await uploadMediaToSupabase(pendingFileBlob, projectId, (pct) => {
          setUploadProgress(pct);
        });
        if (!cloudUrl) {
          throw new Error('Empty cloud URL returned');
        }
        finalMediaUrl = cloudUrl;
        storageType = 'supabase_storage';
      } catch (cloudErr) {
        console.error('Cloud storage upload failed:', cloudErr);
        setUploadError(
          "⚠️ Cloud upload failed (File may exceed Supabase's 50MB free limit). Please upload a compressed video under 50MB or paste a direct cloud URL so your client can stream it on their phone!"
        );
        setIsSavingMedia(false);
        return;
      }
    } else if (initialProject?.storageInfo?.storageType) {
      storageType = initialProject.storageInfo.storageType;
    }

    setUploadStatusText('Syncing with Supabase Cloud Database...');
    setUploadProgress(90);

    // Auto-versioning: Increment version on re-upload
    let projectVersion = initialProject?.version || 1;
    let projectStatus = initialProject?.status || 'in_review';
    if (initialProject && pendingFileBlob) {
      projectVersion = (initialProject.version || 1) + 1;
      if (initialProject.status === 'revision_requested') {
        projectStatus = 'in_review';
      }
    }

    const savedProject: Project = {
      id: projectId,
      creatorEmail,
      title: resolvedTitle,
      type,
      aspectRatio,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || undefined,
      editorPhone: editorPhone.trim() || undefined,
      amountINR: Number(amountINR) || 1000,
      upiId: finalUpiId,
      upiPayeeName: resolvedPayeeName,
      mediaUrl: finalMediaUrl,
      status: projectStatus,
      version: projectVersion,
      createdAt: initialProject?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: initialProject?.comments || [],
      paymentDetails: initialProject?.paymentDetails,
      securitySettings: {
        isProtected,
        passcode: isProtected ? passcode : undefined
      },
      storageInfo: {
        storageType,
        fileSizeBytes: fileSizeBytes || undefined,
        originalFileName: localFileName || undefined
      },
      watermarkSettings: {
        text: watermarkText.trim() || 'ZIKRO • DRAFT REVIEW',
        opacity: watermarkOpacity,
        speed: watermarkSpeed,
        style: watermarkStyle,
        showClientTag,
        showTimecode,
        fontSize: 'medium'
      }
    };

    // Save directly to Supabase public.projects table
    await saveProjectToSupabase(savedProject, creatorEmail);

    setUploadProgress(100);
    setIsSavingMedia(false);
    onSave(savedProject);
    playClickPop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Clean Minimal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-neutral-950 font-black shadow-md shadow-amber-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                {initialProject ? 'Edit Client Project' : 'New Client Video Link'}
              </h3>
              <p className="text-xs text-neutral-400">
                Ready in 5 seconds • Auto-watermarked until UPI paid
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSavingMedia}
            aria-label="Close" 
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Progress Overlay */}
        {isSavingMedia && (
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-3 animate-in fade-in">
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-bold text-amber-300">{uploadStatusText}</div>
              <div className="w-full bg-neutral-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">{uploadProgress}%</span>
          </div>
        )}

        {/* Cloud Upload Error Banner */}
        {uploadError && (
          <div className="p-3.5 bg-red-950/90 border-b border-red-500/60 flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-red-100 leading-relaxed font-medium">
              {uploadError}
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-red-300 hover:text-white text-xs font-bold px-1.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Ultra-Minimal Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* ================= 1. LARGE FRIENDLY FILE DROP / PICKER ================= */}
          <div className="space-y-2">
            <label className="cursor-pointer group block bg-neutral-950 hover:bg-neutral-900/90 border-2 border-dashed border-neutral-700 hover:border-amber-500 p-5 rounded-2xl text-center transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-105 transition">
                {localFileName ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <Upload className="w-6 h-6" />}
              </div>
              <div className="text-sm font-bold text-white truncate px-2">
                {localFileName ? localFileName : '1. Tap to Select Video or Thumbnail'}
              </div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {localFileName 
                  ? `${formatBytes(fileSizeBytes)} • Auto-detected ${type === 'video' ? 'Video' : 'Thumbnail'} (${aspectRatio})`
                  : 'MP4, MOV, PNG or JPG from your Phone or PC (up to 50MB)'}
              </div>
              <input 
                type="file" 
                accept="video/*,image/*" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>

            {/* Subtle toggle for Cloud Link or Sample Video */}
            <div className="flex items-center justify-between px-1 text-[11px] text-neutral-400">
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="inline-flex items-center gap-1 hover:text-amber-400 transition"
              >
                <Link2 className="w-3 h-3" />
                <span>{showUrlInput ? 'Hide external link / samples' : 'Or paste cloud link / use sample video'}</span>
              </button>
              {title && (
                <span className="truncate max-w-[180px] font-mono text-[10px] text-neutral-500">
                  Title: {title}
                </span>
              )}
            </div>

            {showUrlInput && (
              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2 animate-in fade-in">
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => {
                    setMediaUrl(e.target.value);
                    setPendingFileBlob(null);
                  }}
                  placeholder="Paste direct MP4 / Cloud video URL..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-500"
                />
                <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5 text-[10px]">
                  <span className="text-neutral-500 font-mono uppercase shrink-0">Samples:</span>
                  {PRESET_VIDEOS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="shrink-0 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 px-2.5 py-1 rounded-lg border border-neutral-800 transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================= 2 & 3. CLIENT NAME & AMOUNT IN INR ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-1.5">
              <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>2. Client Name *</span>
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Rohit"
                className="w-full bg-neutral-900 border border-neutral-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none transition"
              />
            </div>

            <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-1.5">
              <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Amount in INR (₹) *</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm text-amber-400 font-mono font-bold">₹</span>
                <input
                  type="number"
                  required
                  min={1}
                  value={amountINR}
                  onChange={(e) => setAmountINR(Number(e.target.value))}
                  placeholder="1500"
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-amber-500 text-amber-300 font-mono font-bold text-sm rounded-xl pl-8 pr-3.5 py-2.5 focus:outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* ================= UPI PAYOUT REASSURANCE TAG OR ONE-TIME SETUP ================= */}
          {hasSavedAccountUpi && !isOverridingUpi ? (
            <div className="px-3.5 py-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  💳 Payout to: <strong className="font-mono text-white">{upiId}</strong>{' '}
                  <span className="text-[11px] text-emerald-400/80">(from Account Settings)</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOverridingUpi(true);
                  playClickPop();
                }}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline"
              >
                [Change for this project]
              </button>
            </div>
          ) : (
            <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                  <span>Your Receiving UPI ID *</span>
                </label>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">0% COMMISSION</span>
              </div>

              <input
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. rohit@okaxis or 9876543210@ybl"
                className="w-full bg-neutral-900 border border-neutral-700 focus:border-amber-500 text-white font-mono text-sm rounded-xl px-3.5 py-2.5 focus:outline-none transition"
              />

              <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300 pt-0.5">
                <input
                  type="checkbox"
                  checked={saveUpiToSettings}
                  onChange={(e) => setSaveUpiToSettings(e.target.checked)}
                  className="accent-amber-500 rounded cursor-pointer"
                />
                <span>Save this UPI ID to my Account Settings (auto-fill next time)</span>
              </label>

              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  🛡️ 100% Safe: Your UPI ID is only used to generate a receiving QR code for your client. No bank permissions or OTPs are ever asked.
                </span>
              </div>
            </div>
          )}

          {/* ================= COLLAPSIBLE ADVANCED OPTIONS ACCORDION ================= */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setShowAdvanced(!showAdvanced);
                playClickPop();
              }}
              className="w-full px-3.5 py-3 flex items-center justify-between text-xs font-semibold text-neutral-400 hover:text-amber-300 hover:bg-neutral-900/80 transition"
            >
              <span className="flex items-center gap-2 text-left">
                <Settings2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>⚙️ Advanced Protection & Watermark Options (Optional) {showAdvanced ? '▲' : '▼'}</span>
              </span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-neutral-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-3.5 pt-2 border-t border-neutral-800 space-y-4 animate-in fade-in">
                
                {/* 1. Project Title Override & Format / Aspect Ratio Selector */}
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-300 block mb-1">Custom Project Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Auto-filled from video filename"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-300 mb-1 block">Content Format</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setType('video')}
                          className={`p-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition ${
                            type === 'video' ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>Video</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setType('thumbnail')}
                          className={`p-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition ${
                            type === 'thumbnail' ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Thumbnail</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-neutral-300 mb-1 block">Aspect Ratio</label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                        className="w-full bg-neutral-900 border border-neutral-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                      >
                        <option value="9:16">9:16 (Reel / Shorts)</option>
                        <option value="16:9">16:9 (YouTube / Landscape)</option>
                        <option value="1:1">1:1 (Square Post)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. 4-Digit PIN Passcode Gate */}
                <div className="p-3 bg-neutral-900/70 rounded-2xl border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <div>
                        <span className="text-xs font-semibold text-neutral-200 block">4-Digit PIN Passcode Gate</span>
                        <span className="text-[10px] text-neutral-400">Client must enter this PIN before watching preview</span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isProtected}
                        onChange={(e) => setIsProtected(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {isProtected && (
                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-3 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400">Access PIN:</span>
                        <input
                          type="text"
                          maxLength={4}
                          value={passcode}
                          onChange={(e) => setPasscode(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-24 bg-neutral-950 border border-neutral-700 text-amber-400 font-mono font-bold text-center text-sm py-1 rounded-lg focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={generateRandomPin}
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-amber-400 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800 transition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Random PIN</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Anti-Theft Watermark Settings */}
                <div className="p-3 bg-neutral-900/70 rounded-2xl border border-neutral-800 space-y-3">
                  <div className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>Anti-Theft Watermark Settings</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">AUTO REMOVED ON PAYMENT</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Watermark Banner Text</label>
                      <input
                        type="text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        placeholder="ZIKRO • DRAFT REVIEW"
                        className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 uppercase font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Watermark Layout Style</label>
                      <select
                        value={watermarkStyle}
                        onChange={(e) => setWatermarkStyle(e.target.value as WatermarkStyle)}
                        className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
                      >
                        <option value="diagonal-floating">Diagonal Stamp (Floating)</option>
                        <option value="screen-tile">Shutterstock Repeated Grid</option>
                        <option value="bouncing-box">Bouncing Badge (Corner Drift)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Movement Speed</label>
                      <select
                        value={watermarkSpeed}
                        onChange={(e) => setWatermarkSpeed(e.target.value as WatermarkSpeed)}
                        className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
                      >
                        <option value="medium">Continuous Floating Drift (Subtle)</option>
                        <option value="bouncing">DVD Bouncing Physics (Anti-AI Mask)</option>
                        <option value="slow">Gentle Drift</option>
                        <option value="fast">Fast Jitter</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                        <span>Watermark Opacity</span>
                        <span className="font-mono text-amber-400 font-bold">{Math.round(watermarkOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.15}
                        max={0.50}
                        step={0.05}
                        value={watermarkOpacity}
                        onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500 mt-1.5"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-300 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTimecode}
                        onChange={(e) => setShowTimecode(e.target.checked)}
                        className="accent-amber-500 rounded"
                      />
                      <span className="text-[11px]">Show Live Video Timecode</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showClientTag}
                        onChange={(e) => setShowClientTag(e.target.checked)}
                        className="accent-amber-500 rounded"
                      />
                      <span className="text-[11px]">Show Client Tag</span>
                    </label>
                  </div>
                </div>

                {/* 4. WhatsApp Numbers & Payee Name */}
                <div className="p-3 bg-neutral-900/70 rounded-2xl border border-neutral-800 space-y-2.5">
                  <div className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Numbers & Display Name</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">UPI Payee / Editor Name</label>
                      <input
                        type="text"
                        value={upiPayeeName}
                        onChange={(e) => setUpiPayeeName(e.target.value)}
                        placeholder={defaultPayeeFromEmail}
                        className="w-full bg-neutral-950 border border-neutral-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Client WhatsApp</label>
                      <input
                        type="text"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full bg-neutral-950 border border-neutral-700 text-white font-mono text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Editor WhatsApp (Alerts)</label>
                      <input
                        type="text"
                        value={editorPhone}
                        onChange={(e) => setEditorPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full bg-neutral-950 border border-neutral-700 text-white font-mono text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSavingMedia}
              className="flex-1 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-2xl text-xs font-semibold transition disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingMedia}
              className="flex-2 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black rounded-2xl text-xs sm:text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
            >
              {isSavingMedia ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading & Locking Video...</span>
                </>
              ) : (
                <span>{initialProject ? 'Save Changes' : 'Create & Lock Review Link →'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

