import { Project } from '../types';

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-reel-gym-01',
    title: 'Viral Gym Transformation Reel',
    type: 'video',
    aspectRatio: '9:16',
    clientName: 'Rohit Verma (IronFit Gym)',
    clientPhone: '+91 98765 43210',
    clientEmail: 'rohit@ironfit.in',
    amountINR: 1800,
    upiId: 'vikram.edits@okhdfcbank',
    upiPayeeName: 'Vikram Singh (Freelance Editor)',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    durationSeconds: 15,
    status: 'revision_requested',
    createdAt: '2026-11-03T14:30:00.000Z',
    updatedAt: '2026-11-04T18:15:00.000Z',
    watermarkSettings: {
      text: 'ZIKRO • DRAFT REVIEW',
      opacity: 0.28,
      speed: 'medium',
      style: 'diagonal-floating',
      showClientTag: true,
      showTimecode: true,
      fontSize: 'medium'
    },
    comments: [
      {
        id: 'c1',
        projectId: 'proj-reel-gym-01',
        author: 'client',
        authorName: 'Rohit Verma',
        timestampSeconds: 3.4,
        formattedTime: '0:03',
        text: 'Bhai starting me drop beat pe bass boost sound effect daal do.',
        category: 'audio',
        resolved: true,
        createdAt: '2026-11-04T09:20:00.000Z',
        replies: [
          {
            id: 'r1',
            author: 'editor',
            authorName: 'Vikram (Editor)',
            text: 'Done bro! Whoosh bass hit add kar diya hai.',
            createdAt: '2026-11-04T10:05:00.000Z'
          }
        ]
      },
      {
        id: 'c2',
        projectId: 'proj-reel-gym-01',
        author: 'client',
        authorName: 'Rohit Verma',
        timestampSeconds: 8.8,
        formattedTime: '0:08',
        text: 'Subtitle font yellow color me bold karo, white background me chhip raha hai.',
        category: 'text',
        resolved: false,
        createdAt: '2026-11-04T11:45:00.000Z'
      },
      {
        id: 'c3',
        projectId: 'proj-reel-gym-01',
        author: 'client',
        authorName: 'Rohit Verma',
        timestampSeconds: 13.1,
        formattedTime: '0:13',
        text: 'Ending CTA me "Link in Bio for 50% Off" sticker pop-up karo.',
        category: 'cut',
        resolved: false,
        createdAt: '2026-11-04T14:10:00.000Z'
      }
    ]
  },
  {
    id: 'proj-tech-shorts-02',
    title: 'Tech Shorts: iPhone 16 vs S24 Ultra',
    type: 'video',
    aspectRatio: '9:16',
    clientName: 'Aayush (TechBhaiya YT)',
    clientPhone: '+91 91234 56789',
    amountINR: 2500,
    upiId: 'vikram.edits@okhdfcbank',
    upiPayeeName: 'Vikram Singh',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    durationSeconds: 15,
    status: 'in_review',
    createdAt: '2026-11-04T16:00:00.000Z',
    updatedAt: '2026-11-04T16:00:00.000Z',
    watermarkSettings: {
      text: 'CONFIDENTIAL REVIEW • ZIKRO',
      opacity: 0.30,
      speed: 'bouncing',
      style: 'bouncing-box',
      showClientTag: true,
      showTimecode: true,
      fontSize: 'medium'
    },
    securitySettings: {
      isProtected: true,
      passcode: '4821'
    },
    comments: [
      {
        id: 'c4',
        projectId: 'proj-tech-shorts-02',
        author: 'client',
        authorName: 'Aayush',
        timestampSeconds: 5.2,
        formattedTime: '0:05',
        text: 'Camera comparison chart ko thoda zoom in karo 1 second ke liye.',
        category: 'cut',
        resolved: false,
        createdAt: '2026-11-04T17:30:00.000Z'
      }
    ]
  },
  {
    id: 'proj-vlog-cinematic-03',
    title: 'Manali Cinematic Travel Vlog (YouTube)',
    type: 'video',
    aspectRatio: '16:9',
    clientName: 'Shalini (Nomad Trails)',
    clientPhone: '+91 99887 76655',
    amountINR: 4200,
    upiId: 'vikram.edits@okhdfcbank',
    upiPayeeName: 'Vikram Singh',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    durationSeconds: 47,
    status: 'paid_unlocked',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-02T19:00:00.000Z',
    watermarkSettings: {
      text: 'FINAL APPROVED • UNLOCKED',
      opacity: 0,
      speed: 'slow',
      style: 'diagonal-floating',
      showClientTag: false,
      showTimecode: false,
      fontSize: 'small'
    },
    paymentDetails: {
      utrNumber: 'UPI/631984210984/PAY',
      paidAt: '2026-11-02T18:45:00.000Z',
      method: 'Google Pay (UPI)',
      verified: true
    },
    comments: [
      {
        id: 'c5',
        projectId: 'proj-vlog-cinematic-03',
        author: 'client',
        authorName: 'Shalini',
        timestampSeconds: 12.0,
        formattedTime: '0:12',
        text: 'Loved the color grade here! Looks awesome.',
        category: 'color',
        resolved: true,
        createdAt: '2026-11-02T11:00:00.000Z'
      }
    ]
  },
  {
    id: 'proj-thumb-finance-04',
    title: 'High CTR Thumbnail - 0 to ₹1 Lakh Guide',
    type: 'thumbnail',
    aspectRatio: '16:9',
    clientName: 'Priya Sharma (PaisaSmart)',
    clientPhone: '+91 97654 32109',
    amountINR: 750,
    upiId: 'vikram.edits@okhdfcbank',
    upiPayeeName: 'Vikram Singh',
    mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    status: 'in_review',
    createdAt: '2026-11-04T12:00:00.000Z',
    updatedAt: '2026-11-04T12:00:00.000Z',
    watermarkSettings: {
      text: 'UNPAID THUMBNAIL • ZIKRO',
      opacity: 0.30,
      speed: 'slow',
      style: 'screen-tile',
      showClientTag: true,
      showTimecode: false,
      fontSize: 'medium'
    },
    comments: [
      {
        id: 'c6',
        projectId: 'proj-thumb-finance-04',
        author: 'client',
        authorName: 'Priya Sharma',
        timestampSeconds: 0,
        formattedTime: 'Visual',
        text: 'Face expression thoda aur dramatic shock wala photo use karo.',
        category: 'general',
        resolved: false,
        createdAt: '2026-11-04T13:15:00.000Z'
      }
    ]
  }
];
