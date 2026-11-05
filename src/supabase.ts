import { createClient } from '@supabase/supabase-js';
import { Project, ProjectComment, ProjectStatus, PaymentDetails } from './types';

export const SUPABASE_URL = "https://easjlnghchnzlzvljcxd.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_d_ZQBnYZIalJu8VMljRf0g_V7mRtHc5";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const STORAGE_BUCKET = 'videos';

/**
 * Computes SHA-256 hash string for passwords using standard Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Signs up a new creator in public.creators table
 */
export async function signUpCreator(
  email: string, 
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    // 1. Check if email already exists in public.creators
    const { data: existing, error: checkError } = await supabase
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

    const passwordHash = await hashPassword(password);

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

    return { success: true };
  } catch (err: any) {
    console.error('signUpCreator exception:', err);
    return { success: false, error: err.message || 'Network error during sign up.' };
  }
}

/**
 * Verifies creator credentials against public.creators table
 */
export async function loginCreator(
  email: string, 
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    // 1. Fetch creator by email
    const { data: creator, error: fetchError } = await supabase
      .from('creators')
      .select('email, password_hash')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return { success: false, error: 'Database connection error. Please try again.' };
    }

    if (!creator) {
      return { 
        success: false, 
        error: '❌ No account found with this email! Please Sign Up first.' 
      };
    }

    // 2. Hash entered password and compare with stored password_hash
    const enteredHash = await hashPassword(password);
    if (creator.password_hash !== enteredHash) {
      return { 
        success: false, 
        error: '❌ Incorrect password! Access denied.' 
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('loginCreator exception:', err);
    return { success: false, error: err.message || 'Login error.' };
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
    const payload = {
      id: project.id,
      creator_email: creatorEmail,
      status: project.status,
      project_data: {
        ...project,
        creatorEmail
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
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('creator_email', creatorEmail)
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
 * Update project status and payment details (e.g., UTR submission or Approval/Rejection)
 */
export async function updateProjectStatusInSupabase(
  projectId: string,
  status: ProjectStatus,
  paymentDetails?: PaymentDetails
): Promise<boolean> {
  try {
    // 1. Fetch current project_data to maintain integrity
    const existing = await fetchProjectById(projectId);
    if (!existing) return false;

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
 * Delete a project from Supabase
 */
export async function deleteProjectFromSupabase(projectId: string): Promise<boolean> {
  try {
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
