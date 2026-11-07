import React, { useState, useEffect, useRef } from 'react';
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
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Settings2,
  ShieldCheck,
  CheckCircle2,
  Link2,
  Layers,
  Clock,
  Eye,
  Lock
} from 'lucide-react';
import {
  Project,
  MediaType,
  AspectRatio,
  WatermarkSpeed,
  WatermarkStyle,
  CreatorSettings,
  LinkExpiryDuration,
  ProjectVersion
} from '../types';
import {
  uploadMediaToSupabase,
  saveProjectToSupabase,
  deleteMediaFromSupabase,
  loadCreatorSettings,
  saveCreatorSettings
} from '../supabase';
import { storeMediaBlob, formatBytes, revokeMediaBlobUrl } from '../utils/mediaDb';
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
  {
    label: '🔥 9:16 Action Reel Sample',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    aspect: '9:16' as AspectRatio
  },
  {
    label: '📱 9:16 Shorts Sample',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    aspect: '9:16' as AspectRatio
  },
  {
    label: '🎬 16:9 YouTube Sample',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    aspect: '16:9' as AspectRatio
  }
];

/**
 * Validates external cloud URLs and warns if the user pastes a non-direct Google Drive viewer link
 * (which fails in HTML5 <video> due to CORS and Google's HTML virus scan wrapper).
 */
export function validateCloudVideoUrl(url: string): {
  isValid: boolean;
  warning: string | null;
} {
  const clean = (url || '').trim();
  if (!clean || clean.startsWith('blob:')) {
    return { isValid: true, warning: null };
  }

  if (
    clean.includes('drive.google.com/file/d/') ||
    clean.includes('drive.google.com/open') ||
    clean.includes('drive.google.com/drive/folders') ||
    clean.includes('docs.google.com/')
  ) {
    return {
      isValid: false,
      warning:
        '⚠️ Non-Direct Google Drive Link Detected: Standard Google Drive "/view" links return an HTML page and fail to stream on iOS Safari & Android due to CORS/virus-scan blocks. Please upload the video file directly above (free 25GB Cloud CDN) or paste a direct .mp4 / R2 / Cloudinary URL.'
    };
  }

  if (clean.includes('dropbox.com/') && !clean.includes('raw=1') && !clean.includes('dl=1')) {
    return {
      isValid: false,
      warning:
        '⚠️ Dropbox Viewer Link Detected: Replace "?dl=0" with "?raw=1" at the end of your Dropbox link so browsers can stream the raw video.'
    };
  }

  return { isValid: true, warning: null };
}

function computeExpiryIso(duration: LinkExpiryDuration, existingExpiresAt?: string): string | undefined {
  if (duration === 'never') return undefined;
  const hours = duration === '24h' ? 24 : duration === '48h' ? 48 : 24 * 7;
  const baseTime = existingExpiresAt ? new Date(existingExpiresAt).getTime() : Date.now();
  // Always compute fresh from now when setting/updating expiry
  const _ = baseTime;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

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
  const defaultPayeeFromEmail =
    effectiveSettings.upiPayeeName || (cleanCreatorEmail ? cleanCreatorEmail.split('@')[0] : 'Creator');

  const tempObjectUrlsRef = useRef<string[]>([]);

  const [title, setTitle] = useState(initialProject?.title || '');
  const [type, setType] = useState<MediaType>(initialProject?.type || 'video');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialProject?.aspectRatio || '9:16');
  const [clientName, setClientName] = useState(initialProject?.clientName || '');
  const [clientPhone, setClientPhone] = useState(initialProject?.clientPhone || '');
  const [editorPhone, setEditorPhone] = useState(
    initialProject?.editorPhone || effectiveSettings.editorPhone || ''
  );
  const [amountINR, setAmountINR] = useState<number>(initialProject?.amountINR || 1500);
  const [upiId, setUpiId] = useState(initialProject?.upiId || effectiveSettings.upiId || '');
  const [upiPayeeName, setUpiPayeeName] = useState(
    initialProject?.upiPayeeName || defaultPayeeFromEmail
  );

  // Two-Tier Video Links: Preview vs Clean Master
  const [mediaUrl, setMediaUrl] = useState(
    initialProject?.previewVideoUrl || initialProject?.mediaUrl || PRESET_VIDEOS[0].url
  );
  const [masterVideoUrl, setMasterVideoUrl] = useState(initialProject?.masterVideoUrl || '');
  const [localFileName, setLocalFileName] = useState(
    initialProject?.storageInfo?.originalFileName || ''
  );
  const [pendingFileBlob, setPendingFileBlob] = useState<File | null>(null);
  const [pendingMasterFileBlob, setPendingMasterFileBlob] = useState<File | null>(null);
  const [masterFileName, setMasterFileName] = useState('');
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(
    initialProject?.storageInfo?.fileSizeBytes || 0
  );
  const [useLocalDeviceOnly, setUseLocalDeviceOnly] = useState<boolean>(
    initialProject?.storageInfo?.storageType === 'indexeddb'
  );

  // Draft Version History state
  const [versions, setVersions] = useState<ProjectVersion[]>(initialProject?.versions || []);
  const [uploadAsNewVersion, setUploadAsNewVersion] = useState<boolean>(false);

  // Account Settings UPI integration
  const hasSavedAccountUpi = Boolean(effectiveSettings.upiId && effectiveSettings.autoFillUpi);
  const [isOverridingUpi, setIsOverridingUpi] = useState<boolean>(false);
  const [saveUpiToSettings, setSaveUpiToSettings] = useState<boolean>(true);
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);

  // Collapsible Advanced Options state
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    Boolean(
      initialProject?.securitySettings?.isProtected ||
        initialProject?.masterVideoUrl ||
        initialProject?.securitySettings?.expiryDuration
    )
  );

  // Cloud upload tracking
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Security, Passcode, Link Expiry & View Limits
  const [isProtected, setIsProtected] = useState(
    initialProject?.securitySettings?.isProtected ?? false
  );
  const [passcode, setPasscode] = useState(
    initialProject?.securitySettings?.passcode ||
      Math.floor(1000 + Math.random() * 9000).toString()
  );
  const [expiryDuration, setExpiryDuration] = useState<LinkExpiryDuration>(
    initialProject?.securitySettings?.expiryDuration || 'never'
  );
  const [maxViews, setMaxViews] = useState<number>(
    initialProject?.securitySettings?.maxViews || 0
  );

  // Watermark Settings
  const [watermarkText, setWatermarkText] = useState(
    initialProject?.watermarkSettings?.text ||
      effectiveSettings.defaultWatermarkText ||
      'ZIKRO • DRAFT REVIEW'
  );
  const [watermarkSpeed, setWatermarkSpeed] = useState<WatermarkSpeed>(
    initialProject?.watermarkSettings?.speed || 'medium'
  );
  const [watermarkStyle, setWatermarkStyle] = useState<WatermarkStyle>(
    initialProject?.watermarkSettings?.style || 'diagonal-floating'
  );
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(
    initialProject?.watermarkSettings?.opacity || 0.28
  );
  const [showTimecode, setShowTimecode] = useState(
    initialProject?.watermarkSettings?.showTimecode ?? true
  );
  const [showClientTag, setShowClientTag] = useState(
    initialProject?.watermarkSettings?.showClientTag ?? true
  );

  // Cleanup temporary ObjectURLs on unmount/close to prevent iOS Safari memory leaks
  const cleanupTempObjectUrls = () => {
    for (const url of tempObjectUrlsRef.current) {
      revokeMediaBlobUrl(url);
    }
    tempObjectUrlsRef.current = [];
  };

  useEffect(() => {
    return () => {
      cleanupTempObjectUrls();
    };
  }, []);

  // RESET/SYNC PROJECT FORM STATE
  useEffect(() => {
    if (!isOpen) {
      cleanupTempObjectUrls();
      return;
    }
    setUploadError(null);
    const latestSettings = creatorSettings || loadCreatorSettings(cleanCreatorEmail);
    const fallbackPayee =
      latestSettings.upiPayeeName ||
      (cleanCreatorEmail ? cleanCreatorEmail.split('@')[0] : 'Creator');

    if (initialProject) {
      setTitle(initialProject.title || '');
      setType(initialProject.type || 'video');
      setAspectRatio(initialProject.aspectRatio || '9:16');
      setClientName(initialProject.clientName || '');
      setClientPhone(initialProject.clientPhone || '');
      setEditorPhone(initialProject.editorPhone || latestSettings.editorPhone || '');
      setAmountINR(initialProject.amountINR || 1500);
      setUpiId(initialProject.upiId || latestSettings.upiId || '');
      setUpiPayeeName(initialProject.upiPayeeName || fallbackPayee);
      setMediaUrl(
        initialProject.previewVideoUrl || initialProject.mediaUrl || PRESET_VIDEOS[0].url
      );
      setMasterVideoUrl(initialProject.masterVideoUrl || '');
      setLocalFileName(initialProject.storageInfo?.originalFileName || '');
      setPendingFileBlob(null);
      setPendingMasterFileBlob(null);
      setMasterFileName('');
      setFileSizeBytes(initialProject.storageInfo?.fileSizeBytes || 0);
      setUseLocalDeviceOnly(initialProject.storageInfo?.storageType === 'indexeddb');

      setVersions(
        Array.isArray(initialProject.versions) && initialProject.versions.length > 0
          ? initialProject.versions
          : [
              {
                version: initialProject.version || 1,
                label: `v${initialProject.version || 1}`,
                previewVideoUrl: initialProject.previewVideoUrl || initialProject.mediaUrl,
                masterVideoUrl: initialProject.masterVideoUrl,
                uploadedAt: initialProject.updatedAt || initialProject.createdAt
              }
            ]
      );
      setUploadAsNewVersion(false);

      setIsOverridingUpi(false);
      setSaveUpiToSettings(true);
      setShowUrlInput(false);

      setIsProtected(initialProject.securitySettings?.isProtected ?? false);
      setExpiryDuration(initialProject.securitySettings?.expiryDuration || 'never');
      setMaxViews(initialProject.securitySettings?.maxViews || 0);
      setShowAdvanced(
        Boolean(
          initialProject.securitySettings?.isProtected ||
            initialProject.masterVideoUrl ||
            (initialProject.securitySettings?.expiryDuration &&
              initialProject.securitySettings.expiryDuration !== 'never') ||
            (initialProject.securitySettings?.maxViews &&
              initialProject.securitySettings.maxViews > 0)
        )
      );
      setPasscode(
        initialProject.securitySettings?.passcode ||
          Math.floor(1000 + Math.random() * 9000).toString()
      );

      setWatermarkText(
        initialProject.watermarkSettings?.text ||
          latestSettings.defaultWatermarkText ||
          'ZIKRO • DRAFT REVIEW'
      );
      setWatermarkSpeed(initialProject.watermarkSettings?.speed || 'medium');
      setWatermarkStyle(initialProject.watermarkSettings?.style || 'diagonal-floating');
      setWatermarkOpacity(initialProject.watermarkSettings?.opacity ?? 0.28);
      setShowTimecode(initialProject.watermarkSettings?.showTimecode ?? true);
      setShowClientTag(initialProject.watermarkSettings?.showClientTag ?? true);
    } else {
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
      setMasterVideoUrl('');
      setLocalFileName('');
      setPendingFileBlob(null);
      setPendingMasterFileBlob(null);
      setMasterFileName('');
      setFileSizeBytes(0);
      setUseLocalDeviceOnly(false);
      setVersions([]);
      setUploadAsNewVersion(false);

      setIsOverridingUpi(false);
      setSaveUpiToSettings(true);
      setShowUrlInput(false);

      setIsProtected(false);
      setExpiryDuration('never');
      setMaxViews(0);
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

  const previewUrlValidation = validateCloudVideoUrl(mediaUrl);
  const masterUrlValidation = validateCloudVideoUrl(masterVideoUrl);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadError(null);
      cleanupTempObjectUrls();
      const tempPreviewUrl = URL.createObjectURL(file);
      tempObjectUrlsRef.current.push(tempPreviewUrl);

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
          vid.src = '';
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
      if (initialProject) {
        setUploadAsNewVersion(true);
      }
      playClickPop();
    }
  };

  const handleMasterFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingMasterFileBlob(file);
      setMasterFileName(file.name);
      playClickPop();
    }
  };

  const handleSelectPreset = (preset: (typeof PRESET_VIDEOS)[0]) => {
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

    if (!previewUrlValidation.isValid) {
      setUploadError(previewUrlValidation.warning);
      return;
    }
    if (masterVideoUrl.trim() && !masterUrlValidation.isValid) {
      setUploadError(masterUrlValidation.warning);
      return;
    }

    const finalUpiId = upiId.trim() || effectiveSettings.upiId?.trim() || '';
    if (!finalUpiId.trim()) {
      setUploadError('❌ Please enter your receiving UPI ID so client payments reach your bank!');
      return;
    }

    const resolvedTitle =
      title.trim() ||
      (localFileName ? localFileName.replace(/\.[^/.]+$/, '') : `${clientName.trim()} - Video Draft`);
    const resolvedPayeeName = upiPayeeName.trim() || defaultPayeeFromEmail;

    setUploadError(null);
    setIsSavingMedia(true);
    setUploadProgress(10);
    setUploadStatusText('Preparing project data...');

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
    let finalPreviewUrl = mediaUrl.trim();
    let finalMasterUrl = masterVideoUrl.trim();
    let storageType: 'cloudinary' | 'supabase_storage' | 'indexeddb' | 'cloud_url' = 'cloud_url';

    if (pendingFileBlob && initialProject?.mediaUrl) {
      deleteMediaFromSupabase(initialProject.mediaUrl).catch((e) => {
        console.warn('Storage cleanup notice on re-upload:', e);
      });
    }

    // Upload or cache Preview Video
    if (pendingFileBlob) {
      try {
        setUploadStatusText(`Caching ${formatBytes(fileSizeBytes)} to device storage...`);
        const cached = await storeMediaBlob(
          projectId,
          pendingFileBlob,
          localFileName || 'video.mp4'
        );
        if (useLocalDeviceOnly) {
          finalPreviewUrl = cached.objectUrl;
          storageType = 'indexeddb';
        }
      } catch (idbErr) {
        console.warn('IndexedDB initial caching notice:', idbErr);
      }

      if (!useLocalDeviceOnly) {
        try {
          setUploadStatusText('Uploading Preview Video to Cloud CDN...');
          const cloudUrl = await uploadMediaToSupabase(pendingFileBlob, projectId, (pct) => {
            setUploadProgress(Math.round(pct * 0.75));
          });
          if (!cloudUrl) {
            throw new Error('Empty cloud URL returned');
          }
          finalPreviewUrl = cloudUrl;
          storageType = 'cloudinary';
        } catch (cloudErr: any) {
          console.error('Cloud storage upload failed:', cloudErr);
          setUploadError(
            cloudErr?.message ||
              '⚠️ Cloud upload failed. Please check your internet connection or paste a direct cloud URL so your client can stream it on their phone!'
          );
          setIsSavingMedia(false);
          return;
        }
      }
    } else if (initialProject?.storageInfo?.storageType) {
      storageType = initialProject.storageInfo.storageType;
    }

    // Upload separate Clean Master Video if provided
    if (pendingMasterFileBlob && !useLocalDeviceOnly) {
      try {
        setUploadStatusText('Uploading Clean 4K Master File (Encrypted until Paid)...');
        const uploadedMaster = await uploadMediaToSupabase(
          pendingMasterFileBlob,
          `${projectId}_master`,
          (pct) => {
            setUploadProgress(75 + Math.round(pct * 0.2));
          }
        );
        if (uploadedMaster) {
          finalMasterUrl = uploadedMaster;
        }
      } catch (masterErr: any) {
        console.error('Master file upload failed:', masterErr);
        setUploadError(
          masterErr?.message || '⚠️ Master file upload failed. Please try again or paste a direct master URL.'
        );
        setIsSavingMedia(false);
        return;
      }
    }

    setUploadStatusText('Syncing with Supabase Cloud Database...');
    setUploadProgress(95);

    // Build Draft Version History (v1, v2, v3...)
    const existingVersions: ProjectVersion[] =
      Array.isArray(versions) && versions.length > 0 ? [...versions] : [];
    let projectVersion = initialProject?.version || 1;
    let projectStatus = initialProject?.status || 'in_review';

    if (!initialProject || existingVersions.length === 0) {
      projectVersion = 1;
      existingVersions.push({
        version: 1,
        label: 'v1',
        previewVideoUrl: finalPreviewUrl,
        masterVideoUrl: finalMasterUrl || finalPreviewUrl,
        uploadedAt: new Date().toISOString()
      });
    } else if (uploadAsNewVersion || pendingFileBlob) {
      const nextVerNum =
        Math.max(...existingVersions.map((v) => v.version), initialProject.version || 1) + 1;
      projectVersion = nextVerNum;
      existingVersions.push({
        version: nextVerNum,
        label: `v${nextVerNum}`,
        previewVideoUrl: finalPreviewUrl,
        masterVideoUrl: finalMasterUrl || finalPreviewUrl,
        uploadedAt: new Date().toISOString()
      });
      if (initialProject.status === 'revision_requested') {
        projectStatus = 'in_review';
      }
    } else {
      // Update latest version entry in place
      const lastIdx = existingVersions.length - 1;
      existingVersions[lastIdx] = {
        ...existingVersions[lastIdx],
        previewVideoUrl: finalPreviewUrl,
        masterVideoUrl: finalMasterUrl || existingVersions[lastIdx].masterVideoUrl || finalPreviewUrl
      };
    }

    const computedExpiresAt =
      expiryDuration === 'never'
        ? undefined
        : initialProject?.securitySettings?.expiryDuration === expiryDuration &&
            initialProject?.securitySettings?.expiresAt
          ? initialProject.securitySettings.expiresAt
          : computeExpiryIso(expiryDuration);

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
      mediaUrl: finalPreviewUrl,
      previewVideoUrl: finalPreviewUrl,
      masterVideoUrl: finalMasterUrl || finalPreviewUrl,
      versions: existingVersions,
      status: projectStatus,
      version: projectVersion,
      createdAt: initialProject?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: initialProject?.comments || [],
      paymentDetails: initialProject?.paymentDetails,
      securitySettings: {
        isProtected,
        passcode: isProtected ? passcode : undefined,
        expiryDuration,
        expiresAt: computedExpiresAt,
        maxViews: maxViews > 0 ? Number(maxViews) : undefined,
        viewCount: initialProject?.securitySettings?.viewCount ?? 0
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

    await saveProjectToSupabase(savedProject, creatorEmail);

    setUploadProgress(100);
    setIsSavingMedia(false);
    cleanupTempObjectUrls();
    onSave(savedProject);
    playClickPop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-neutral-950 font-black shadow-md shadow-amber-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                {initialProject ? 'Edit / Upload New Draft Version' : 'New Client Video Link'}
              </h3>
              <p className="text-xs text-neutral-400">
                Ready in 5 seconds • Protected Canvas Watermark until UPI verified
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

        {/* Cloud Upload or Link Validator Error Banner */}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* ================= 1. LARGE FRIENDLY FILE DROP / PICKER ================= */}
          <div className="space-y-2">
            <label className="cursor-pointer group block bg-neutral-950 hover:bg-neutral-900/90 border-2 border-dashed border-neutral-700 hover:border-amber-500 p-5 rounded-2xl text-center transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-105 transition">
                {localFileName ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div className="text-sm font-bold text-white truncate px-2">
                {localFileName
                  ? localFileName
                  : initialProject
                    ? `1. Tap to Upload New Draft Revision (v${(initialProject.version || 1) + 1})`
                    : '1. Tap to Select Preview Video or Thumbnail'}
              </div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {localFileName
                  ? `${formatBytes(fileSizeBytes)} • Auto-detected ${type === 'video' ? 'Video' : 'Thumbnail'} (${aspectRatio})`
                  : 'MP4, MOV, PNG or JPG from your Phone or PC (supports large files via Cloud CDN)'}
              </div>
              <input
                type="file"
                accept="video/*,image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Local Device Preview Only Warning Badge if IndexedDB mode is enabled */}
            {useLocalDeviceOnly && (
              <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/40 flex items-center gap-2 text-[11px] text-amber-200 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Local Device Preview Only — Upload to Cloud R2/Supabase to share across devices.
                </span>
              </div>
            )}

            {/* Subtle toggle for Cloud Link or Sample Video */}
            <div className="flex items-center justify-between px-1 text-[11px] text-neutral-400">
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="inline-flex items-center gap-1 hover:text-amber-400 transition"
              >
                <Link2 className="w-3 h-3" />
                <span>
                  {showUrlInput
                    ? 'Hide external link / samples'
                    : 'Or paste cloud link / use sample video'}
                </span>
              </button>
              {title && (
                <span className="truncate max-w-[180px] font-mono text-[10px] text-neutral-500">
                  Title: {title}
                </span>
              )}
            </div>

            {showUrlInput && (
              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2 animate-in fade-in">
                <label className="text-[11px] font-semibold text-neutral-300 block">
                  Preview Video URL (Shown in Watermarked Player)
                </label>
                <input
                  type="text"
                  value={mediaUrl.startsWith('blob:') ? '' : mediaUrl}
                  onChange={(e) => {
                    setMediaUrl(e.target.value);
                    setPendingFileBlob(null);
                  }}
                  placeholder="Paste direct MP4 / Cloud R2 / Cloudinary video URL..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-500"
                />

                {!previewUrlValidation.isValid && previewUrlValidation.warning && (
                  <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-[11px] text-amber-200 leading-relaxed">
                    {previewUrlValidation.warning}
                  </div>
                )}

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
                placeholder="e.g. Acme Studio / Client"
                className="w-full bg-neutral-900 border border-neutral-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none transition"
              />
            </div>

            <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-1.5">
              <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Amount in INR (₹) *</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm text-amber-400 font-mono font-bold">
                  ₹
                </span>
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
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  0% COMMISSION
                </span>
              </div>

              <input
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. yourname@upi"
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
                <span>
                  ⚙️ Customize Watermark, Master Link, 4-Digit PIN, Expiry & Versions (Optional){' '}
                  {showAdvanced ? '▲' : '▼'}
                </span>
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
                    <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                      Custom Project Title
                    </label>
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
                      <label className="text-[11px] font-semibold text-neutral-300 mb-1 block">
                        Content Format
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setType('video')}
                          className={`p-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition ${
                            type === 'video'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>Video</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setType('thumbnail')}
                          className={`p-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition ${
                            type === 'thumbnail'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Thumbnail</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-neutral-300 mb-1 block">
                        Aspect Ratio
                      </label>
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

                {/* 2. Two-Tier Video Security: Separate Clean 4K Master Link / File */}
                <div className="p-3 bg-neutral-900/70 rounded-2xl border border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Two-Tier Delivery: Clean 4K Master Video (Optional)</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                      HIDDEN UNTIL PAID
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Keep your preview low-res/watermarked while storing a separate high-res clean master link or file. This URL is stripped from the client browser until you verify their UTR.
                  </p>
                  <input
                    type="text"
                    value={masterVideoUrl}
                    onChange={(e) => setMasterVideoUrl(e.target.value)}
                    placeholder="Optional: Paste Clean 4K Master download link (or upload below)..."
                    className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                  />
                  {!masterUrlValidation.isValid && masterUrlValidation.warning && (
                    <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/50 text-[11px] text-amber-200">
                      {masterUrlValidation.warning}
                    </div>
                  )}
                  <label className="cursor-pointer inline-flex items-center gap-2 text-xs text-amber-300 hover:text-amber-200 bg-neutral-950 border border-neutral-800 px-3 py-1.5 rounded-xl transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {masterFileName
                        ? `Master File Selected: ${masterFileName}`
                        : 'Or Upload Separate Clean Master File'}
                    </span>
                    <input
                      type="file"
                      accept="video/*,image/*"
                      onChange={handleMasterFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* 3. Draft Version History (v1, v2, v3) */}
                {initialProject && (
                  <div className="p-3 bg-neutral-900/70 rounded-2xl border border-neutral-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        <span>Draft Version History ({versions.length} versions)</span>
                      </span>
                      <label className="flex items-center gap-1.5 text-[11px] text-amber-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={uploadAsNewVersion}
                          onChange={(e) => setUploadAsNewVersion(e.target.checked)}
                          className="accent-amber-500 rounded"
                        />
                        <span>Save as v{(initialProject.version || 1) + 1}</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {versions.map((ver) => (
                        <span
                          key={ver.version}
                          className="text-[11px] font-mono bg-neutral-950 border border-neutral-800 text-neutral-300 px-2.5 py-1 rounded-lg"
                        >
                          {ver.label} • {new Date(ver.uploadedAt).toLocaleDateString('en-IN')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. 4-Digit PIN Passcode Gate + Link Expiry & Maximum Views */}
                <div className="p-3 bg-neutral-900/70 rounded-2xl border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <div>
                        <span className="text-xs font-semibold text-neutral-200 block">
                          4-Digit PIN Passcode Gate
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          Brute-force protected (15m lockout after 5 wrong tries)
                        </span>
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

                  {/* Link Expiry & Maximum Views Limits */}
                  <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] text-neutral-300 font-semibold flex items-center gap-1 mb-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Review Link Expiry</span>
                      </label>
                      <select
                        value={expiryDuration}
                        onChange={(e) => setExpiryDuration(e.target.value as LinkExpiryDuration)}
                        className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
                      >
                        <option value="never">Never Expire</option>
                        <option value="24h">Expire after 24 Hours</option>
                        <option value="48h">Expire after 48 Hours</option>
                        <option value="7d">Expire after 7 Days</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-300 font-semibold flex items-center gap-1 mb-1">
                        <Eye className="w-3 h-3 text-amber-400" />
                        <span>Max Client Views (0 = Unlimited)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={maxViews}
                        onChange={(e) => setMaxViews(Math.max(0, Number(e.target.value)))}
                        placeholder="0 (Unlimited)"
                        className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 font-mono text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Anti-Theft Watermark Settings */}
                <div className="p-3 bg-neutral-900/70 rounded-2xl border border-neutral-800 space-y-3">
                  <div className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>Canvas Anti-Screen-Recording Watermark</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      AUTO REMOVED ON PAYMENT
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">
                        Watermark Banner Text
                      </label>
                      <input
                        type="text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        placeholder="ZIKRO • DRAFT REVIEW"
                        className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 uppercase font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">
                        Watermark Layout Style
                      </label>
                      <select
                        value={watermarkStyle}
                        onChange={(e) => setWatermarkStyle(e.target.value as WatermarkStyle)}
                        className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
                      >
                        <option value="diagonal-floating">
                          Full Grid + Center Anti-Crop Badge
                        </option>
                        <option value="screen-tile">Shutterstock Repeated Grid</option>
                        <option value="bouncing-box">Bouncing Center Badge</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">
                        Movement Speed
                      </label>
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
                        <span className="font-mono text-amber-400 font-bold">
                          {Math.round(watermarkOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.18}
                        max={0.55}
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

                {/* 6. WhatsApp Numbers & Payee Name */}
                <div className="p-3 bg-neutral-900/70 rounded-2xl border border-neutral-800 space-y-2.5">
                  <div className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Numbers & Display Name</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">
                        UPI Payee / Editor Name
                      </label>
                      <input
                        type="text"
                        value={upiPayeeName}
                        onChange={(e) => setUpiPayeeName(e.target.value)}
                        placeholder={defaultPayeeFromEmail}
                        className="w-full bg-neutral-950 border border-neutral-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">
                        Client WhatsApp
                      </label>
                      <input
                        type="text"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="e.g. +91 00000 00000"
                        className="w-full bg-neutral-950 border border-neutral-700 text-white font-mono text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">
                        Editor WhatsApp (Alerts)
                      </label>
                      <input
                        type="text"
                        value={editorPhone}
                        onChange={(e) => setEditorPhone(e.target.value)}
                        placeholder="e.g. 0000000000"
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
                <span>
                  {initialProject ? 'Save Project & Version' : 'Create & Lock Review Link →'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
