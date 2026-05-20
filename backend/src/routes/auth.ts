import { Router } from 'express';
import { register, login, getUsers } from '../controllers/auth';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/users', authenticate, getUsers);

export default router;
