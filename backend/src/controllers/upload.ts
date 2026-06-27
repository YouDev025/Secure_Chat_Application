import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { verifyFileContent } from '../utils/fileVerifier';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// Configure multer to store files in memory first for verification
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE }
}).single('file');

export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { buffer, originalname, mimetype, size } = req.file;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Perform security verification
    const verification = verifyFileContent(buffer, originalname, mimetype);
    if (!verification.isValid) {
      console.warn(`Blocked malicious file upload: Name="${originalname}", Mime="${mimetype}", IP="${req.ip}", Reason="${verification.error}"`);
      res.status(400).json({ 
        error: 'Security verification failed', 
        details: verification.error 
      });
      return;
    }

    // Generate secure unique ID for the file
    const fileId = crypto.randomUUID();
    const filePath = path.join(UPLOADS_DIR, fileId);
    const metaPath = path.join(UPLOADS_DIR, `${fileId}.json`);

    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    // Write file content and metadata to disk
    await fs.promises.writeFile(filePath, buffer);
    await fs.promises.writeFile(
      metaPath,
      JSON.stringify({
        originalName: originalname,
        mimeType: verification.detectedMime,
        size,
        uploadedBy: userId,
        createdAt: new Date().toISOString()
      }, null, 2)
    );

    console.log(`File uploaded successfully: ID=${fileId}, Name="${originalname}", Mime="${verification.detectedMime}"`);

    res.status(200).json({
      fileId,
      name: originalname,
      mimeType: verification.detectedMime,
      size,
      verificationStatus: 'passed'
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Internal server error during upload' });
  }
};

export const downloadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Prevent directory traversal
    if (typeof fileId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
      res.status(400).json({ error: 'Invalid file ID format' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, fileId);
    const metaPath = path.join(UPLOADS_DIR, `${fileId}.json`);

    if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Read metadata
    const metaDataStr = await fs.promises.readFile(metaPath, 'utf-8');
    const metadata = JSON.parse(metaDataStr);

    // Apply security headers
    // 1. Force attachment download behavior to prevent XSS/execution
    const safeName = encodeURIComponent(metadata.originalName);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
    
    // 2. Prevent browser from sniffing MIME type (security hardening)
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 3. Strict CSP so that even if browser tries to render it, nothing can execute
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");

    res.setHeader('Content-Type', metadata.mimeType);

    // Stream the file contents back
    const readStream = fs.createReadStream(filePath);
    readStream.on('error', (err) => {
      console.error('Error streaming file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read file' });
      }
    });

    readStream.pipe(res);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Internal server error during download' });
  }
};
