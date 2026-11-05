# EditLock v2: Cloud Video Storage & Passcode-Protected Client Links

Integrate seamless client video media storage (IndexedDB persistent cache + Cloudflare R2 / direct URL streaming) and a customizable Passcode Lock Screen for secure client review links.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following core product decisions have been confirmed and will guide the implementation:

- **Confirmed Decision 1 (Media Storage Strategy)**: Built for a ₹0 budget constraint on mobile devices (Codespaces/Render). Employs a hybrid media persistence pipeline: local videos uploaded from mobile/PC are stored in high-capacity browser `IndexedDB` with chunked binary blobs (persisting even across hard refreshes and browser restarts), paired with a direct Cloudflare R2 / S3 / Render public URL integration for permanent cloud video links.
- **Confirmed Decision 2 (Client Access Security)**: Each project can now feature an optional 4-digit Passcode / PIN (e.g. `4821` or custom). When enabled, clients accessing the link encounter a sleek, branded PIN entry lock screen before the protected video player loads. Editors can toggle passcode protection on/off and copy the PIN with 1 click when sharing the WhatsApp link.

---

### 1. Overview & Core Concept

- **What It Does**: Editors can upload any heavy video file (MP4/MOV) directly from their phone/PC without size truncation or cloud hosting fees. The video is cached persistently and assigned a unique review token. Editors can toggle "Require Passcode to View" and set a 4-digit PIN. Clients open the review link, enter the PIN, review with timestamp comments, and settle via UPI to unlock the clean master export.
- **Target Audience**: Indian freelance video editors, thumbnail artists, and reel/shorts creators who need to send client review links from their phones without spending on Frame.io ($25/mo) or AWS S3 bills.
- **Key Value**: Stops unauthorized leakage of unreleased marketing videos and YouTube collabs before payment, while ensuring video files don't disappear when the browser refreshes.

---

### 2. User Experience & Visual Design

- **Passcode Lock Screen Flow**:
  1. Client opens `https://.../?project=proj-reel-gym-01&mode=client`
  2. If passcode is enabled on the project, the video and comments are obscured behind a dark glassmorphic security portal:
     - Project title and editor name displayed (`"Vikram Singh has shared a protected draft"`).
     - 4-digit interactive numeric keypad or clean PIN input with auto-advance and haptic feedback.
     - Hint: `"Passcode shared by your editor via WhatsApp"` + 1-tap "Request Passcode on WhatsApp" link.
  3. Once entered correctly, the lock screen smoothly scales out, revealing the video player with transparent moving watermark and timeline feedback.
- **Media Storage & File Management**:
  1. In the "Create / Edit Project" modal:
     - New "Storage Engine" status pill: `"Local Device Cache (IndexedDB - ₹0)"` or `"Cloudflare R2 Direct URL"`.
     - File size indicator (e.g., `42.5 MB - High Definition MP4`).
     - Clear storage cache manager in Editor Studio to free up phone storage when projects are completed.
  2. One-click "Passcode in WhatsApp Message": The generated WhatsApp template automatically appends: `"🔐 Review PIN: 4821"`.
- **Aesthetic Direction**:
  - Consistent with modern creative studio tools: Dark obsidian canvas (`#0a0a0a`), warm amber highlights (`#f59e0b`), emerald approval badges (`#10b981`), and Plus Jakarta Sans typography paired with JetBrains Mono tabular figures.
  - Zero-pill metadata hierarchy: Clean unboxed metadata separated by hairline dividers and middle dots.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: IndexedDB Media Cache vs. Mandatory Cloud Object Storage**
  - *Chosen Approach*: Hybrid. Primary local storage via browser `IndexedDB` (using an asynchronous key-value blob store capable of storing hundreds of megabytes of 1080p/4K video locally without server costs), accompanied by an optional Cloud URL input for Cloudflare R2 / S3 / Google Drive direct links.
  - *Why*: Freelancers working from mobile phones on free Render/Codespaces tiers cannot afford paid AWS S3 egress or credit card requirements. IndexedDB enables 100% free, instantaneous video previews directly on their device.
  - *Alternative Considered*: Requiring AWS S3 or Cloudflare API tokens upfront. Rejected because it breaks the ₹0 budget constraint and requires complex bucket configuration.
- **Decision 2: Client-Side PIN Verification vs. Server Authentication Session**
  - *Chosen Approach*: Lightweight hashed PIN validation stored with the project entity, with session caching (`sessionStorage`).
  - *Why*: Clients do not need to register accounts, sign in with Google, or remember passwords. A 4-digit PIN prevents accidental exposure or family members opening client review links while keeping the review frictionless.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EditLock App Architecture                       │
└────────────────────────────────────────────────────────────────────────┘

    Client Review Request (?project=id&passcode=...)
                        │
                        ▼
       ┌───────────────────────────────────┐
       │     PasscodeGatekeeper.tsx        │
       │  (Validates PIN via Session/Hash) │
       └─────────────────┬─────────────────┘
                         │
        [PIN Valid]      ▼
       ┌─────────────────────────────────────────────────────────┐
       │             VideoPlayerWithTimeline.tsx                 │
       │  ┌───────────────────────────────────────────────────┐  │
       │  │  WatermarkOverlay.tsx (Sleek Transparent Burn-in) │  │
       │  └───────────────────────────────────────────────────┘  │
       │  ┌───────────────────────────────────────────────────┐  │
       │  │  Timeline Progress Bar + Colored Revision Pins    │  │
       │  └───────────────────────────────────────────────────┘  │
       └─────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
       ┌─────────────────────────────────────────────────────────┐
       │              Media Storage & Persistence Engine         │
       │  ┌─────────────────────────┐ ┌────────────────────────┐ │
       │  │ mediaDb.ts (IndexedDB)  │ │ localStorage (Projects)│ │
       │  │ - Stores video Blobs    │ │ - Project metadata     │ │
       │  │ - Instant local stream  │ │ - Comments & UPI UTR   │ │
       │  └─────────────────────────┘ └────────────────────────┘ │
       └─────────────────────────────────────────────────────────┘
```

- **Data Model Extensions (`Project` in `src/types/index.ts`)**:
  - `securitySettings?: { isProtected: boolean; passcode?: string; allowedAttempts?: number; }`
  - `storageInfo?: { storageType: 'indexeddb' | 'cloud_url'; fileSizeBytes?: number; originalFileName?: string; }`
- **Key Modules**:
  - `src/utils/mediaDb.ts`: Asynchronous IndexedDB storage engine for storing, retrieving, and streaming video blobs with object URL generation.
  - `src/components/PasscodeLockModal.tsx`: Numeric 4-digit PIN pad and validation interface with vibration/shake error animation.
  - `src/components/ProjectFormModal.tsx`: Updated with Passcode toggle and storage source indicator.
  - `src/components/WhatsAppShareModal.tsx`: Updates WhatsApp templates to automatically bundle the review PIN.
