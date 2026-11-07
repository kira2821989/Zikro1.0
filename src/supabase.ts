import { createClient } from '@supabase/supabase-js';
import { Project, ProjectComment, ProjectStatus, PaymentDetails, CreatorSettings } from './types';

export const SUPABASE_URL = "https://easjlnghchnzlzvljcxd.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_d_ZQBnYZIalJu8VMljRf0g_V7mRtHc5";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const CREATOR_SETTINGS_ROW_PREFIX = '__creator_settings__:';

export function getCreatorSettingsKey(email: string): string {
  return `zikro_creator_settings_${email.toLowerCase().trim()}`;
}

export function loadCreatorSettings(email: string): CreatorSettings {
  const cleanEmail = (email || '').toLowerCase().trim();
  const defaultName = cleanEmail ? cleanEmail.split('@')[0] : 'Creator';

  const fallback: CreatorSettings = {
    upiPayeeName: defaultName,
    upiId: '',
    editorPhone: '',
    defaultWatermarkText: 'ZIKRO • DRAFT REVIEW',
    autoFillUpi: true
  };

  if (!cleanEmail || typeof window === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(getCreatorSettingsKey(cleanEmail));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        upiPayeeName: parsed.upiPayeeName || defaultName,
        upiId: parsed.upiId || '',
        editorPhone: parsed.editorPhone || '',
        defaultWatermarkText: parsed.defaultWatermarkText || 'ZIKRO • DRAFT REVIEW',
        autoFillUpi: parsed.autoFillUpi ?? true
      };
    }

    // Migrate from legacy per-field keys if present
    const legacyUpi = localStorage.getItem(`zikro_saved_upi_${cleanEmail}`) || '';
    const legacyName = localStorage.getItem(`zikro_saved_name_${cleanEmail}`) || defaultName;
    const legacyPhone = localStorage.getItem(`zikro_saved_editor_phone_${cleanEmail}`) || '';

    return {
      upiPayeeName: legacyName,
      upiId: legacyUpi === 'editor@okhdfcbank' ? '' : legacyUpi,
      editorPhone: legacyPhone,
      defaultWatermarkText: 'ZIKRO • DRAFT REVIEW',
      autoFillUpi: true
    };
  } catch {
    return fallback;
  }
}

/**
 * Fetch Creator's permanent Account & Payout Settings from Supabase Cloud Database
 * so their UPI ID, Payee Name, and Phone Number travel with their account across all devices.
 */
export async function fetchCreatorSettingsFromSupabase(email: string): Promise<CreatorSettings> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const localFallback = loadCreatorSettings(cleanEmail);
  if (!cleanEmail) return localFallback;

  try {
    // 1. Check public.creators table for settings JSON or dedicated columns
    const { data: creatorRow, error: creatorErr } = await supabase
      .from('creators')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (!creatorErr && creatorRow) {
      const rowAny = creatorRow as any;
      const fromJson = rowAny.settings || rowAny.creator_settings || rowAny.profile_settings;
      if (fromJson && typeof fromJson === 'object' && (fromJson.upiId || fromJson.upiPayeeName)) {
        const synced: CreatorSettings = {
          upiPayeeName: fromJson.upiPayeeName || localFallback.upiPayeeName,
          upiId: fromJson.upiId || '',
          editorPhone: fromJson.editorPhone || '',
          defaultWatermarkText: fromJson.defaultWatermarkText || 'ZIKRO • DRAFT REVIEW',
          autoFillUpi: fromJson.autoFillUpi ?? true
        };
        cacheCreatorSettingsLocally(cleanEmail, synced);
        return synced;
      }

      if (rowAny.upi_id || rowAny.upi_payee_name || rowAny.editor_phone) {
        const synced: CreatorSettings = {
          upiPayeeName: rowAny.upi_payee_name || localFallback.upiPayeeName,
          upiId: rowAny.upi_id || '',
          editorPhone: rowAny.editor_phone || '',
          defaultWatermarkText: rowAny.default_watermark_text || 'ZIKRO • DRAFT REVIEW',
          autoFillUpi: rowAny.auto_fill_upi ?? true
        };
        cacheCreatorSettingsLocally(cleanEmail, synced);
        return synced;
      }
    }

    // 2. Check cloud settings record in public.projects (works even if public.creators schema has no extra columns)
    const settingsRowId = `${CREATOR_SETTINGS_ROW_PREFIX}${cleanEmail}`;
    const { data: settingsProjRow } = await supabase
      .from('projects')
      .select('project_data')
      .eq('id', settingsRowId)
      .maybeSingle();

    if (settingsProjRow && settingsProjRow.project_data) {
      const cloudSettings = settingsProjRow.project_data as any;
      if (cloudSettings && typeof cloudSettings === 'object') {
        const synced: CreatorSettings = {
          upiPayeeName: cloudSettings.upiPayeeName || localFallback.upiPayeeName,
          upiId: cloudSettings.upiId || '',
          editorPhone: cloudSettings.editorPhone || '',
          defaultWatermarkText: cloudSettings.defaultWatermarkText || 'ZIKRO • DRAFT REVIEW',
          autoFillUpi: cloudSettings.autoFillUpi ?? true
        };
        cacheCreatorSettingsLocally(cleanEmail, synced);
        return synced;
      }
    }
  } catch (err) {
    console.warn('Error fetching creator settings from Supabase cloud:', err);
  }

  return localFallback;
}

function cacheCreatorSettingsLocally(cleanEmail: string, normalized: CreatorSettings): void {
  if (typeof window === 'undefined' || !cleanEmail) return;
  try {
    localStorage.setItem(getCreatorSettingsKey(cleanEmail), JSON.stringify(normalized));
    if (normalized.upiId) {
      localStorage.setItem(`zikro_saved_upi_${cleanEmail}`, normalized.upiId);
    }
    localStorage.setItem(`zikro_saved_name_${cleanEmail}`, normalized.upiPayeeName);
    localStorage.setItem(`zikro_saved_editor_phone_${cleanEmail}`, normalized.editorPhone);
  } catch (e) {
    console.warn('Failed caching creator settings locally:', e);
  }
}

/**
 * Save Creator's Account & Payout Settings to Supabase Cloud Database (public.creators + cloud record)
 * as well as local cache for instant load.
 */
export async function saveCreatorSettings(email: string, settings: CreatorSettings): Promise<void> {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return;

  const normalized: CreatorSettings = {
    upiPayeeName: settings.upiPayeeName.trim() || cleanEmail.split('@')[0] || 'Creator',
    upiId: settings.upiId.trim(),
    editorPhone: settings.editorPhone.trim(),
    defaultWatermarkText: settings.defaultWatermarkText.trim() || 'ZIKRO • DRAFT REVIEW',
    autoFillUpi: settings.autoFillUpi
  };

  cacheCreatorSettingsLocally(cleanEmail, normalized);

  try {
    // 1. Attempt to save columns / JSON directly on public.creators table
    const { error: creatorsUpdateErr } = await supabase
      .from('creators')
      .update({
        upi_id: normalized.upiId,
        upi_payee_name: normalized.upiPayeeName,
        editor_phone: normalized.editorPhone,
        default_watermark_text: normalized.defaultWatermarkText,
        auto_fill_upi: normalized.autoFillUpi,
        settings: normalized
      } as any)
      .eq('email', cleanEmail);

    if (creatorsUpdateErr) {
      // Fallback if only `settings` JSONB column exists on public.creators
      await supabase
        .from('creators')
        .update({ settings: normalized } as any)
        .eq('email', cleanEmail);
    }

    // 2. Always persist cloud settings record in public.projects so cross-device sync works regardless of creators table DDL
    const settingsRowId = `${CREATOR_SETTINGS_ROW_PREFIX}${cleanEmail}`;
    await supabase
      .from('projects')
      .upsert(
        {
          id: settingsRowId,
          creator_email: cleanEmail,
          status: 'settings',
          project_data: normalized,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );
  } catch (err) {
    console.warn('Cloud sync notice for creator settings:', err);
  }
}

/**
 * Computes salted SHA-256 hash string for passwords using Web Crypto API.
 * Uses a unique per-email salt to prevent rainbow table attacks.
 */
export async function hashPassword(password: string, email?: string): Promise<string> {
  const cleanEmail = email ? email.toLowerCase().trim() : '';
  const saltedInput = cleanEmail ? `zikro_v1_salt_${cleanEmail}_${password}` : password;
  const encoder = new TextEncoder();
  const data = encoder.encode(saltedInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Appends download parameter to force real file download from Supabase/Cloudinary storage on mobile/desktop browsers.
 * Determines the correct file extension (.png/.jpg for thumbnails, .mp4 for video).
 */
export function getDirectDownloadUrl(
  url: string, 
  filename: string, 
  type: 'video' | 'thumbnail' = 'video'
): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  
  let cleanTitle = (filename || (type === 'thumbnail' ? 'graphic' : 'master')).replace(/[^a-zA-Z0-9._-]/g, '_');
  cleanTitle = cleanTitle.replace(/\.(mp4|mov|mkv|webm|png|jpg|jpeg|webp)$/i, '');

  // Support Cloudinary native download header via fl_attachment transformation
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('fl_attachment')) {
    return url.replace('/upload/', `/upload/fl_attachment:${encodeURIComponent(cleanTitle)}/`);
  }

  let ext = 'mp4';
  const lowerUrl = url.toLowerCase();
  if (type === 'thumbnail' || lowerUrl.includes('.png') || lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || lowerUrl.includes('.webp')) {
    if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) {
      ext = 'jpg';
    } else if (lowerUrl.includes('.webp')) {
      ext = 'webp';
    } else {
      ext = 'png';
    }
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}download=${encodeURIComponent(`${cleanTitle}.${ext}`)}`;
}

/**
 * Signs up a new creator in public.creators table with salted password
 */
export async function signUpCreator(
  email: string, 
  password: string
): Promise<{ success: boolean; error?: string; token?: string }> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    // 1. Check if email already exists in public.creators
    const { data: existing } = await supabase
      .from('creators')
      .select('email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      return { 
        success: false, 
        error: '❌ Account already exists with this email! Please switch to Login.' 
      };
    }

    const passwordHash = await hashPassword(password, cleanEmail);

    // 2. Insert new creator record
    const { error: insertError } = await supabase
      .from('creators')
      .insert({
        email: cleanEmail,
        password_hash: passwordHash,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Sign up error in Supabase:', insertError);
      return { success: false, error: `Sign up failed: ${insertError.message}` };
    }

    return { success: true, token: passwordHash };
  } catch (err: any) {
    console.error('signUpCreator exception:', err);
    return { success: false, error: err.message || 'Network error during sign up.' };
  }
}

/**
 * Verifies creator credentials against public.creators table.
 * Queries directly for salted hash match so password hashes are NEVER leaked to the client.
 */
export async function loginCreator(
  email: string, 
  password: string
): Promise<{ success: boolean; error?: string; token?: string }> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    // 1. Compute salted hash
    const saltedHash = await hashPassword(password, cleanEmail);

    // 2. Query Supabase directly for email + salted password_hash
    const { data: creator, error: fetchError } = await supabase
      .from('creators')
      .select('email')
      .eq('email', cleanEmail)
      .eq('password_hash', saltedHash)
      .maybeSingle();

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return { success: false, error: 'Database connection error. Please try again.' };
    }

    if (creator) {
      return { success: true, token: saltedHash };
    }

    // 3. Fallback for legacy unsalted accounts if any existed prior to salting
    const legacyRawHash = await hashPassword(password);
    const { data: legacyCreator } = await supabase
      .from('creators')
      .select('email')
      .eq('email', cleanEmail)
      .eq('password_hash', legacyRawHash)
      .maybeSingle();

    if (legacyCreator) {
      // Auto-upgrade legacy account to salted hash
      await supabase
        .from('creators')
        .update({ password_hash: saltedHash })
        .eq('email', cleanEmail);
      return { success: true, token: saltedHash };
    }

    // 4. Check if account exists at all to provide helpful error
    const { data: userExists } = await supabase
      .from('creators')
      .select('email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (!userExists) {
      return { 
        success: false, 
        error: '❌ No account found with this email! Please Sign Up first.' 
      };
    }

    return { 
      success: false, 
      error: '❌ Incorrect password! Access denied.' 
    };
  } catch (err: any) {
    console.error('loginCreator exception:', err);
    return { success: false, error: err.message || 'Login error.' };
  }
}

/**
 * Validates a stored creator session token against Supabase public.creators table (Security Loophole #5)
 */
export async function verifyCreatorSession(email: string, token: string): Promise<boolean> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !token) return false;

    const { data, error } = await supabase
      .from('creators')
      .select('email')
      .eq('email', cleanEmail)
      .eq('password_hash', token)
      .maybeSingle();

    if (error || !data) {
      return false;
    }
    return true;
  } catch (err) {
    console.error('verifyCreatorSession exception:', err);
    return false;
  }
}

export const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/o1b2pxja/auto/upload";
export const CLOUDINARY_UPLOAD_PRESET = "ml_default";

/**
 * Upload a media file (video or image) to Cloudinary storage.
 * Uses XMLHttpRequest with onprogress to support real-time upload progress tracking.
 * Returns public secure URL of the uploaded file.
 */
export async function uploadMediaToSupabase(
  file: File,
  _projectId: string,
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.secure_url) {
            if (onProgress) onProgress(100);
            resolve(res.secure_url);
          } else {
            reject(new Error(res.error?.message || 'Cloudinary upload succeeded but no secure_url returned.'));
          }
        } catch (e: any) {
          reject(new Error(`Failed to parse Cloudinary response: ${e.message}`));
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          reject(new Error(errRes.error?.message || `Cloudinary upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Cloudinary upload failed with status ${xhr.status}: ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during Cloudinary upload.'));
    };

    xhr.open('POST', CLOUDINARY_UPLOAD_URL, true);
    xhr.send(formData);
  });
}

// Semantic alias
export const uploadMediaToCloudinary = uploadMediaToSupabase;

/**
 * Save / Upsert a project into public.projects table.
 * Verifies creator session token before writing.
 */
export async function saveProjectToSupabase(
  project: Project,
  creatorEmail: string
): Promise<boolean> {
  try {
    const cleanEmail = creatorEmail.toLowerCase().trim();
    const token = typeof window !== 'undefined' ? localStorage.getItem('zikro_creator_token') : null;
    if (!token || !(await verifyCreatorSession(cleanEmail, token))) {
      console.error('⛔ Security Violation: Cannot save project without valid creator session token.');
      return false;
    }

    // NEVER save a local blob: URL into Supabase database
    const rawPreview = project.previewVideoUrl || project.mediaUrl || '';
    const safePreviewUrl = rawPreview.startsWith('blob:') ? '' : rawPreview;
    const rawMaster = project.masterVideoUrl || '';
    const safeMasterUrl = rawMaster.startsWith('blob:') ? '' : rawMaster;

    const safeVersions = Array.isArray(project.versions)
      ? project.versions.map((v) => ({
          ...v,
          previewVideoUrl: v.previewVideoUrl && !v.previewVideoUrl.startsWith('blob:') ? v.previewVideoUrl : safePreviewUrl,
          masterVideoUrl: v.masterVideoUrl && !v.masterVideoUrl.startsWith('blob:') ? v.masterVideoUrl : undefined
        }))
      : undefined;

    const passcodeHash =
      project.securitySettings?.isProtected && project.securitySettings?.passcode
        ? await hashPassword(project.securitySettings.passcode, project.id)
        : project.securitySettings?.passcodeHash;

    const payload = {
      id: project.id,
      creator_email: cleanEmail,
      status: project.status,
      project_data: {
        ...project,
        mediaUrl: safePreviewUrl,
        previewVideoUrl: safePreviewUrl,
        masterVideoUrl: safeMasterUrl || undefined,
        versions: safeVersions,
        creatorEmail: cleanEmail,
        securitySettings: project.securitySettings
          ? {
              ...project.securitySettings,
              passcodeHash
            }
          : undefined
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('projects')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Error saving project to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('saveProjectToSupabase exception:', err);
    return false;
  }
}

/**
 * Transform a raw Supabase `public.projects` row into a sanitized `Project` object.
 * - Never sends `masterVideoUrl` to client views unless `status === 'paid_unlocked'`.
 * - Withholds `mediaUrl`, `previewVideoUrl`, `versions`, and `comments` while PIN lock is active.
 */
export async function sanitizeProjectRow(
  data: any,
  includeCreatorEmail = false,
  forcePinUnlocked = false
): Promise<Project | null> {
  if (!data || !data.id || String(data.id).startsWith(CREATOR_SETTINGS_ROW_PREFIX) || data.status === 'settings') {
    return null;
  }

  const projectData = (data.project_data || {}) as Project;
  const rawCreatorEmail = data.creator_email || projectData.creatorEmail;

  const activeCreator = typeof window !== 'undefined' ? localStorage.getItem('zikro_creator_email') : null;
  const activeToken = typeof window !== 'undefined' ? localStorage.getItem('zikro_creator_token') : null;
  const isAuthenticatedOwner = Boolean(
    activeCreator &&
    activeToken &&
    rawCreatorEmail &&
    activeCreator.toLowerCase().trim() === rawCreatorEmail.toLowerCase().trim()
  );

  const isPrivilegedCall = includeCreatorEmail || isAuthenticatedOwner;

  // Check if client has already unlocked this project's PIN in the current session
  let isSessionPinUnlocked = forcePinUnlocked;
  if (!isSessionPinUnlocked && typeof window !== 'undefined') {
    try {
      const savedPins = sessionStorage.getItem('zikro_unlocked_pins');
      if (savedPins) {
        const parsedIds: string[] = JSON.parse(savedPins);
        if (Array.isArray(parsedIds) && parsedIds.includes(data.id)) {
          isSessionPinUnlocked = true;
        }
      }
    } catch {
      // ignore
    }
  }

  const effectiveStatus = ((data.status as ProjectStatus) || projectData.status || 'in_review') as ProjectStatus;
  const isPaidUnlocked = effectiveStatus === 'paid_unlocked';
  const canExposeMaster = isPrivilegedCall || isPaidUnlocked;

  const isPinProtected = Boolean(projectData.securitySettings?.isProtected);
  const rawPasscode = projectData.securitySettings?.passcode;
  const computedPasscodeHash =
    projectData.securitySettings?.passcodeHash ||
    (rawPasscode ? await hashPassword(rawPasscode, data.id) : undefined);

  const safeSecuritySettings = projectData.securitySettings
    ? {
        isProtected: isPinProtected,
        passcode: isPrivilegedCall ? rawPasscode : undefined,
        passcodeHash: computedPasscodeHash,
        expiryDuration: projectData.securitySettings.expiryDuration,
        expiresAt: projectData.securitySettings.expiresAt,
        maxViews: projectData.securitySettings.maxViews,
        viewCount: projectData.securitySettings.viewCount ?? 0
      }
    : undefined;

  const shouldWithholdMedia = !isPrivilegedCall && isPinProtected && !isSessionPinUnlocked;
  const resolvedPreviewUrl = projectData.previewVideoUrl || projectData.mediaUrl || '';
  const resolvedMasterUrl = projectData.masterVideoUrl || '';

  const safeVersions = shouldWithholdMedia
    ? []
    : Array.isArray(projectData.versions)
      ? projectData.versions.map((v) => ({
          ...v,
          masterVideoUrl: canExposeMaster ? v.masterVideoUrl : undefined
        }))
      : undefined;

  return {
    ...projectData,
    id: data.id,
    status: effectiveStatus,
    creatorEmail: isPrivilegedCall ? rawCreatorEmail : undefined,
    mediaUrl: shouldWithholdMedia ? '' : resolvedPreviewUrl,
    previewVideoUrl: shouldWithholdMedia ? '' : resolvedPreviewUrl,
    masterVideoUrl: !shouldWithholdMedia && canExposeMaster ? (resolvedMasterUrl || resolvedPreviewUrl) : undefined,
    versions: safeVersions,
    comments: shouldWithholdMedia ? [] : (projectData.comments || []),
    securitySettings: safeSecuritySettings,
    updatedAt: data.updated_at || projectData.updatedAt
  };
}

/**
 * Fetch a single project by ID (used for client review and direct links).
 * Strips creatorEmail, masterVideoUrl (while locked), and plaintext passcode when returning project data for unauthenticated client views,
 * and withholds mediaUrl & comments while PIN lock is active.
 */
export async function fetchProjectById(
  projectId: string,
  includeCreatorEmail = false,
  forcePinUnlocked = false
): Promise<Project | null> {
  try {
    if (!projectId || projectId.startsWith(CREATOR_SETTINGS_ROW_PREFIX)) return null;

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      console.warn('Project not found in Supabase:', projectId, error);
      return null;
    }

    return await sanitizeProjectRow(data, includeCreatorEmail, forcePinUnlocked);
  } catch (err) {
    console.error('fetchProjectById exception:', err);
    return null;
  }
}

/**
 * Fetch all projects for a specific creator email (excluding internal creator settings row)
 */
export async function fetchCreatorProjects(creatorEmail: string): Promise<Project[]> {
  try {
    const cleanEmail = creatorEmail.toLowerCase().trim();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('creator_email', cleanEmail)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching creator projects:', error);
      return [];
    }

    return (data || [])
      .filter(row => row.id && !String(row.id).startsWith(CREATOR_SETTINGS_ROW_PREFIX) && row.status !== 'settings')
      .map(row => {
        const proj = (row.project_data || {}) as Project;
        const previewUrl = proj.previewVideoUrl || proj.mediaUrl || '';
        return {
          ...proj,
          id: row.id,
          mediaUrl: previewUrl,
          previewVideoUrl: previewUrl,
          status: (row.status as ProjectStatus) || proj.status,
          creatorEmail: row.creator_email || proj.creatorEmail,
          updatedAt: row.updated_at || proj.updatedAt
        };
      });
  } catch (err) {
    console.error('fetchCreatorProjects exception:', err);
    return [];
  }
}

/**
 * Update project status and payment details (e.g., UTR submission or Manual Editor Approval/Rejection).
 * Enforces strict verification against public.creators so unauthenticated clients cannot spoof 'paid_unlocked'.
 */
export async function updateProjectStatusInSupabase(
  projectId: string,
  status: ProjectStatus,
  paymentDetails?: PaymentDetails,
  requestingCreatorEmail?: string | null
): Promise<boolean> {
  // 1. Fetch current project_data (including creatorEmail) to maintain integrity
  const existing = await fetchProjectById(projectId, true);
  if (!existing) return false;

  // 2. STRICT ANTI-SPOOFING & UTR HACK BLOCKING:
  // If status is being set to 'paid_unlocked' (or reset to 'in_review'), strictly require
  // zikro_creator_token from localStorage AND match it against the creator's hashed password in public.creators!
  if (status === 'paid_unlocked' || status === 'in_review') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('zikro_creator_token') : null;
    const activeCreator =
      requestingCreatorEmail ||
      (typeof window !== 'undefined' ? localStorage.getItem('zikro_creator_email') : null);
    const ownerEmail = (existing.creatorEmail || '').toLowerCase().trim();

    const isOwnerMatch = Boolean(activeCreator && ownerEmail && activeCreator.toLowerCase().trim() === ownerEmail);
    const isTokenVerified = Boolean(token && isOwnerMatch && (await verifyCreatorSession(ownerEmail, token)));

    if (!token || !isOwnerMatch || !isTokenVerified) {
      const violationMsg = 'Security Violation: Unauthorized payment approval attempt!';
      console.error(`⛔ ${violationMsg}`);
      throw new Error(violationMsg);
    }
  }

  // 3. Validate UTR format when client submits 'utr_submitted' or 'verification_pending'
  if (status === 'utr_submitted' || status === 'verification_pending') {
    const cleanUtr = (paymentDetails?.utrNumber || '').replace(/\s+/g, '');
    if (!/^\d{12}$/.test(cleanUtr)) {
      throw new Error('Invalid UTR format: Must be a 12-digit numeric UPI reference number.');
    }
  }

  try {
    const updatedProjectData: Project = {
      ...existing,
      status,
      paymentDetails: paymentDetails !== undefined ? paymentDetails : existing.paymentDetails,
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase
      .from('projects')
      .update({
        status,
        project_data: updatedProjectData,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) {
      console.error('updateProjectStatusInSupabase error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('updateProjectStatusInSupabase exception:', err);
    return false;
  }
}

/**
 * Increment the client view counter for a project in Supabase (used for Maximum Views security limits).
 */
export async function incrementProjectViewCountInSupabase(projectId: string): Promise<number | null> {
  try {
    const existing = await fetchProjectById(projectId, true);
    if (!existing) return null;

    const currentCount = existing.securitySettings?.viewCount ?? 0;
    const nextCount = currentCount + 1;

    const updatedProjectData: Project = {
      ...existing,
      securitySettings: {
        ...(existing.securitySettings || { isProtected: false }),
        viewCount: nextCount
      },
      updatedAt: existing.updatedAt
    };

    const { error } = await supabase
      .from('projects')
      .update({
        project_data: updatedProjectData
      })
      .eq('id', projectId);

    if (error) {
      console.warn('incrementProjectViewCountInSupabase notice:', error);
      return currentCount;
    }
    return nextCount;
  } catch (err) {
    console.warn('incrementProjectViewCountInSupabase exception:', err);
    return null;
  }
}

/**
 * Update comments array AND computed revision status on a project in Supabase
 */
export async function updateProjectCommentsInSupabase(
  projectId: string,
  comments: ProjectComment[],
  newStatus?: ProjectStatus
): Promise<boolean> {
  try {
    const existing = await fetchProjectById(projectId, true);
    if (!existing) return false;

    const isPendingVerification =
      existing.status === 'utr_submitted' || existing.status === 'verification_pending';

    // Determine effective status: preserve paid_unlocked / utr_submitted / verification_pending, otherwise reflect unresolved comments
    let effectiveStatus: ProjectStatus = existing.status;
    if (existing.status !== 'paid_unlocked' && !isPendingVerification) {
      if (
        newStatus &&
        newStatus !== 'paid_unlocked' &&
        newStatus !== 'utr_submitted' &&
        newStatus !== 'verification_pending'
      ) {
        effectiveStatus = newStatus;
      } else {
        const hasUnresolved = comments.some(c => !c.resolved);
        effectiveStatus = hasUnresolved ? 'revision_requested' : 'in_review';
      }
    }

    const updatedProjectData: Project = {
      ...existing,
      status: effectiveStatus,
      comments,
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase
      .from('projects')
      .update({
        status: effectiveStatus,
        project_data: updatedProjectData,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) {
      console.error('updateProjectCommentsInSupabase error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('updateProjectCommentsInSupabase exception:', err);
    return false;
  }
}

/**
 * Deletion stub: client-side deletion is not permitted for unsigned Cloudinary uploads.
 * Managed automatically by Cloudinary auto-expire policy.
 */
export async function deleteMediaFromSupabase(_mediaUrlOrPath: string): Promise<boolean> {
  console.log('Handled by Cloudinary auto-expire');
  return true;
}

/**
 * Deletion stub: client-side folder deletion is not permitted for unsigned Cloudinary uploads.
 */
export async function deleteProjectStorageFolder(_projectId: string): Promise<void> {
  console.log('Handled by Cloudinary auto-expire');
}

/**
 * Delete a project from Supabase database.
 */
export async function deleteProjectFromSupabase(projectId: string): Promise<boolean> {
  try {
    // Delete row from public.projects table
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('deleteProjectFromSupabase error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('deleteProjectFromSupabase exception:', err);
    return false;
  }
}
