import { Request, Response } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { getProfile } from '../lib/profileStore';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secure-jwt-secret-key-change-in-production';
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;

type LoginAttempt = {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
};

const loginAttempts = new Map<string, LoginAttempt>();

const getLoginAttemptKey = (req: Request, email: string) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}:${email.trim().toLowerCase()}`;
};

const getLimitedLoginAttempt = (key: string) => {
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt) {
    return null;
  }

  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    return attempt;
  }

  if (now - attempt.firstAttemptAt > LOGIN_RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(key);
    return null;
  }

  return null;
};

const recordFailedLoginAttempt = (key: string) => {
  const now = Date.now();
  const existing = loginAttempts.get(key);
  const attempt =
    existing && now - existing.firstAttemptAt <= LOGIN_RATE_LIMIT_WINDOW_MS
      ? existing
      : { count: 0, firstAttemptAt: now };

  attempt.count += 1;

  if (attempt.count >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    attempt.lockedUntil = now + LOGIN_RATE_LIMIT_WINDOW_MS;
  }

  loginAttempts.set(key, attempt);
  return attempt;
};

const sendRateLimitResponse = (res: Response, attempt: LoginAttempt) => {
  const lockedUntil = attempt.lockedUntil || Date.now() + LOGIN_RATE_LIMIT_WINDOW_MS;
  const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));

  res.setHeader('Retry-After', retryAfterSeconds.toString());
  res.status(429).json({
    error: `Too many failed login attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, publicKey } = req.body;

    // Validate
    if (!username || !email || !password || !publicKey) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await argon2.hash(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        publicKey
      }
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Missing credentials' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const rateLimitKey = getLoginAttemptKey(req, normalizedEmail);
    const limitedAttempt = getLimitedLoginAttempt(rateLimitKey);

    if (limitedAttempt) {
      sendRateLimitResponse(res, limitedAttempt);
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      const attempt = recordFailedLoginAttempt(rateLimitKey);

      if (attempt.lockedUntil) {
        sendRateLimitResponse(res, attempt);
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
      return;
    }

    const validPassword = await argon2.verify(user.password, password);
    if (!validPassword) {
      const attempt = recordFailedLoginAttempt(rateLimitKey);

      if (attempt.lockedUntil) {
        sendRateLimitResponse(res, attempt);
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
      return;
    }

    loginAttempts.delete(rateLimitKey);

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        publicKey: user.publicKey,
        ...getProfile(user.id)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        publicKey: true
      }
    });
    res.status(200).json(users.map((user) => ({ ...user, ...getProfile(user.id) })));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
