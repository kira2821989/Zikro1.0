export type MediaType = 'video' | 'thumbnail';
export type AspectRatio = '9:16' | '16:9' | '1:1';
export type ProjectStatus = 'draft' | 'in_review' | 'revision_requested' | 'paid_unlocked';
export type CommentCategory = 'cut' | 'text' | 'audio' | 'color' | 'general';
export type WatermarkSpeed = 'slow' | 'medium' | 'fast' | 'bouncing';
export type WatermarkStyle = 'diagonal-floating' | 'bouncing-box' | 'screen-tile' | 'anti-rip-crosshair' | 'ghost-outline' | 'compact-pill';

export interface CommentReply {
  id: string;
  author: 'client' | 'editor';
  authorName: string;
  text: string;
  createdAt: string;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  author: 'client' | 'editor';
  authorName: string;
  timestampSeconds: number; // e.g. 14.2
  formattedTime: string; // "0:14"
  text: string;
  category: CommentCategory;
  resolved: boolean;
  createdAt: string;
  replies?: CommentReply[];
}

export interface WatermarkSettings {
  text: string;
  opacity: number; // 0.2 to 0.9
  speed: WatermarkSpeed;
  style: WatermarkStyle;
  showClientTag: boolean;
  showTimecode: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

export interface PaymentDetails {
  utrNumber?: string;
  paidAt?: string;
  method?: string;
  verified?: boolean;
}

export interface SecuritySettings {
  isProtected: boolean;
  passcode?: string; // 4-digit PIN e.g. "4821"
}

export interface StorageInfo {
  storageType: 'indexeddb' | 'cloud_url';
  fileSizeBytes?: number;
  originalFileName?: string;
  blobKey?: string;
}

export interface Project {
  id: string;
  title: string;
  type: MediaType;
  aspectRatio: AspectRatio;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  amountINR: number;
  upiId: string;
  upiPayeeName: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  watermarkSettings: WatermarkSettings;
  securitySettings?: SecuritySettings;
  storageInfo?: StorageInfo;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  comments: ProjectComment[];
  paymentDetails?: PaymentDetails;
  notes?: string;
}
