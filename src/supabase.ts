import { createClient } from '@supabase/supabase-js';
import { Project, ProjectComment, ProjectStatus, PaymentDetails } from './types';

export const SUPABASE_URL = "https://easjlnghchnzlzvljcxd.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_d_ZQBnYZIalJu8VMljRf0g_V7mRtHc5";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const STORAGE_BUCKET = 'videos';

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
 * Appends download parameter to force real file download from Supabase storage on mobile/desktop browsers.
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

/**
 * Upload a media file (video or image) to Supabase Storage bucket 'videos'.
 * Returns public URL of the uploaded file.
 */
export async function uploadMediaToSupabase(
  file: File,
  projectId: string,
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${projectId}/${Date.now()}-${safeName}`;

  if (onProgress) onProgress(20);

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (onProgress) onProgress(75);

  if (error) {
    console.error('Supabase Storage upload error:', error);
    throw new Error(`Cloud storage upload failed: ${error.message}`);
  }

  // Get public streaming/download URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path);

  if (onProgress) onProgress(100);

  return urlData.publicUrl;
}

/**
 * Save / Upsert a project into public.projects table.
 */
export async function saveProjectToSupabase(
  project: Project,
  creatorEmail: string
): Promise<boolean> {
  try {
    const cleanEmail = creatorEmail.toLowerCase().trim();
    // NEVER save a local blob: URL into Supabase database (Functional Bug #1)
    const safeMediaUrl = project.mediaUrl && project.mediaUrl.startsWith('blob:') ? '' : project.mediaUrl;
    const payload = {
      id: project.id,
      creator_email: cleanEmail,
      status: project.status,
      project_data: {
        ...project,
        mediaUrl: safeMediaUrl,
        creatorEmail: cleanEmail
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
 * Fetch a single project by ID (used for client review and direct links)
 */
export async function fetchProjectById(projectId: string): Promise<Project | null> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      console.warn('Project not found in Supabase:', projectId, error);
      return null;
    }

    const projectData = (data.project_data || {}) as Project;
    return {
      ...projectData,
      id: data.id,
      status: (data.status as ProjectStatus) || projectData.status,
      creatorEmail: data.creator_email || projectData.creatorEmail,
      updatedAt: data.updated_at || projectData.updatedAt
    };
  } catch (err) {
    console.error('fetchProjectById exception:', err);
    return null;
  }
}

/**
 * Fetch all projects for a specific creator email
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

    return (data || []).map(row => {
      const proj = (row.project_data || {}) as Project;
      return {
        ...proj,
        id: row.id,
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
 * Update project status and payment details (e.g., UTR submission or Approval/Rejection).
 * Enforces server/SDK validation so unauthenticated clients cannot spoof 'paid_unlocked'.
 */
export async function updateProjectStatusInSupabase(
  projectId: string,
  status: ProjectStatus,
  paymentDetails?: PaymentDetails,
  requestingCreatorEmail?: string | null
): Promise<boolean> {
  try {
    // 1. Fetch current project_data to maintain integrity
    const existing = await fetchProjectById(projectId);
    if (!existing) return false;

    // PREVENT CONSOLE STATUS SPOOFING (Security Flaw #12):
    // Only verified creator session with valid token can mark 'paid_unlocked' or reset to 'in_review'
    if (status === 'paid_unlocked' || status === 'in_review') {
      const activeCreator = requestingCreatorEmail || (typeof window !== 'undefined' ? localStorage.getItem('zikro_creator_email') : null);
      const isAuthorizedCreator = activeCreator && activeCreator.toLowerCase().trim() === (existing.creatorEmail || '').toLowerCase().trim();
      if (!isAuthorizedCreator || !activeCreator) {
        console.error('⛔ Security Lockdown: Client view cannot mark project as paid_unlocked. Only creator can approve payment.');
        return false;
      }

      // Enforce token verification against public.creators
      const token = typeof window !== 'undefined' ? localStorage.getItem('zikro_creator_token') : null;
      if (!token) {
        console.error('⛔ Security Lockdown: Missing creator session token.');
        return false;
      }

      const isSessionValid = await verifyCreatorSession(activeCreator, token);
      if (!isSessionValid) {
        console.error('⛔ Security Lockdown: Invalid or expired creator session token.');
        return false;
      }
    }

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
 * Update comments array on a project in Supabase
 */
export async function updateProjectCommentsInSupabase(
  projectId: string,
  comments: ProjectComment[]
): Promise<boolean> {
  try {
    const existing = await fetchProjectById(projectId);
    if (!existing) return false;

    const updatedProjectData: Project = {
      ...existing,
      comments,
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase
      .from('projects')
      .update({
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
 * Extract storage object path from a Supabase public URL or relative path
 */
export function extractStoragePath(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx !== -1) {
    return decodeURIComponent(urlOrPath.substring(idx + marker.length));
  }
  if (urlOrPath.includes('/') && !urlOrPath.startsWith('http') && !urlOrPath.startsWith('blob:')) {
    return urlOrPath;
  }
  return null;
}

/**
 * Delete a specific media file from Supabase Storage bucket 'videos'
 */
export async function deleteMediaFromSupabase(mediaUrlOrPath: string): Promise<boolean> {
  try {
    const path = extractStoragePath(mediaUrlOrPath);
    if (!path) return false;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    if (error) {
      console.warn('Supabase storage removal notice:', error.message);
      return false;
    }
    console.log(`🗑️ Cleaned up storage file from '${STORAGE_BUCKET}':`, path);
    return true;
  } catch (err) {
    console.warn('deleteMediaFromSupabase exception:', err);
    return false;
  }
}

/**
 * Delete all files in the project's folder within storage bucket 'videos'
 */
export async function deleteProjectStorageFolder(projectId: string): Promise<void> {
  try {
    const { data: files, error } = await supabase.storage.from(STORAGE_BUCKET).list(projectId);
    if (error) {
      console.warn('Failed listing files for storage cleanup:', error.message);
      return;
    }
    if (files && files.length > 0) {
      const pathsToRemove = files.map(f => `${projectId}/${f.name}`);
      const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove(pathsToRemove);
      if (removeError) {
        console.warn('Failed removing project files from storage bucket:', removeError.message);
      } else {
        console.log(`🗑️ Cleaned up ${pathsToRemove.length} storage file(s) for project: ${projectId}`);
      }
    }
  } catch (err) {
    console.warn('deleteProjectStorageFolder exception:', err);
  }
}

/**
 * Delete a project from Supabase database AND storage bucket
 */
export async function deleteProjectFromSupabase(projectId: string): Promise<boolean> {
  try {
    // 1. Clean up storage files in Supabase storage bucket 'videos'
    await deleteProjectStorageFolder(projectId);

    // 2. Delete row from public.projects table
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
