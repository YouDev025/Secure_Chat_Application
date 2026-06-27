import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadMiddleware, uploadFile, downloadFile } from '../controllers/upload';

const router = Router();

// Secure file upload endpoint (Authenticated, max 25MB, validated)
router.post('/upload', authenticate, uploadMiddleware, uploadFile);

// Secure file download/streaming endpoint (Authenticated, safe headers)
router.get('/download/:fileId', authenticate, downloadFile);

export default router;
