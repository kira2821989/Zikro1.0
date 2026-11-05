import express from 'express';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Uploads Folder ensure karo
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Multer Storage Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'))
});
const upload = multer({ storage });

// 3. Database File (projects.json - Refresh se data kabhi delete nahi hoga)
const DB_FILE = path.join(__dirname, 'projects.json');

function getDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('DB Read Error:', e);
  }
  return {};
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('DB Write Error:', e);
  }
}

// ================= API ROUTES =================

// API 1: Create / Upload Project
app.post('/api/projects', upload.single('video'), (req, res) => {
  const file = req.file;
  const body = req.body;
  const projectId = 'proj-' + Math.random().toString(36).substring(2, 9);

  const videoUrl = file ? `/uploads/${file.filename}` : (body.mediaUrl || '');

  const newProject = {
    id: projectId,
    title: body.title || 'Untitled Project',
    type: body.type || 'video',
    aspectRatio: body.aspectRatio || '9:16',
    clientName: body.clientName || 'Client',
    clientPhone: body.clientPhone || '',
    amountINR: Number(body.amountINR) || 1500,
    upiId: body.upiId || 'creator@upi',
    upiPayeeName: body.upiPayeeName || 'Editor',
    mediaUrl: videoUrl,
    status: 'in_review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    securitySettings: {
      isProtected: body.isProtected === 'true',
      passcode: body.passcode || ''
    },
    watermarkSettings: {
      text: body.watermarkText || 'ZIKRO • DRAFT REVIEW',
      opacity: Number(body.watermarkOpacity) || 0.28,
      speed: body.watermarkSpeed || 'medium',
      style: body.watermarkStyle || 'diagonal-floating',
      showClientTag: body.showClientTag !== 'false',
      showTimecode: body.showTimecode !== 'false',
      fontSize: 'medium'
    }
  };

  const db = getDB();
  db[projectId] = newProject;
  saveDB(db);

  console.log(`✅ [Uploaded] Project ${projectId}: "${newProject.title}"`);
  res.json({ success: true, project: newProject });
});

// API 2: Get All Projects (For Editor Dashboard)
app.get('/api/projects', (req, res) => {
  const db = getDB();
  res.json(Object.values(db).reverse());
});

// API 3: Get Single Project (For Client Review Page)
app.get('/api/projects/:id', (req, res) => {
  const db = getDB();
  const project = db[req.params.id];
  if (!project) return res.status(404).json({ error: 'Project nahi mila!' });
  res.json(project);
});

// API 4: Add Timestamp Comment
app.post('/api/projects/:id/comments', (req, res) => {
  const db = getDB();
  const project = db[req.params.id];
  if (!project) return res.status(404).json({ error: 'Project nahi mila!' });

  const comment = {
    id: 'comm-' + Date.now().toString(36),
    projectId: project.id,
    author: req.body.author || 'client',
    authorName: req.body.authorName || 'Client',
    timestampSeconds: Number(req.body.timestampSeconds) || 0,
    formattedTime: req.body.formattedTime || '0:00',
    text: req.body.text || '',
    category: req.body.category || 'general',
    resolved: false,
    createdAt: new Date().toISOString(),
    replies: []
  };

  project.comments.push(comment);
  project.updatedAt = new Date().toISOString();
  saveDB(db);

  console.log(`💬 [Comment] on ${project.id} at ${comment.formattedTime}`);
  res.json({ success: true, comment });
});

// API 5: Submit UTR
app.post('/api/projects/:id/utr', (req, res) => {
  const db = getDB();
  const project = db[req.params.id];
  if (!project) return res.status(404).json({ error: 'Project nahi mila!' });

  project.status = 'paid_unlocked';
  project.paymentDetails = {
    utrNumber: req.body.utrNumber,
    method: req.body.method || 'UPI',
    paidAt: new Date().toISOString(),
    verified: true
  };
  project.updatedAt = new Date().toISOString();
  saveDB(db);

  console.log(`💳 [Payment] Verified for ${project.id} with UTR: ${req.body.utrNumber}`);
  res.json({ success: true, project });
});

// Static Video Files Serve karo
app.use('/uploads', express.static(uploadDir));

// React Frontend Serve karo (dist folder)
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Zikro Backend running! Please build the frontend.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Zikro Full-Stack Server running on http://localhost:${PORT}`);
});
