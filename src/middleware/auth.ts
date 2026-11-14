import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';

export const DEFAULT_ADMIN_EMAIL = 'purposeandglowcareers@gmail.com';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export type TokenVerifier = (token: string) => Promise<DecodedIdToken>;

export const getConfiguredAdminEmail = (env: NodeJS.ProcessEnv = process.env): string => {
  return (env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
};

export const createRequireAuth = (verifyToken: TokenVerifier = (t) => adminAuth.verifyIdToken(t)) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Empty token' });
    }

    try {
      const decodedToken = await verifyToken(token);
      req.user = decodedToken;
      return next();
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };
};

export const createRequireAdminAuth = (
  verifyToken: TokenVerifier = (t) => adminAuth.verifyIdToken(t),
  adminEmailProvider: () => string = () => getConfiguredAdminEmail()
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing Firebase ID token' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Empty Firebase ID token' });
    }

    let decodedToken: DecodedIdToken;
    try {
      decodedToken = await verifyToken(token);
    } catch (error) {
      console.error('Admin token verification failed:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid or revoked token' });
    }

    if (decodedToken.email_verified !== true) {
      return res.status(403).json({ error: 'Forbidden: Verified email required' });
    }

    const email = (decodedToken.email || '').trim().toLowerCase();
    const allowlistedAdmin = adminEmailProvider();
    if (!email || email !== allowlistedAdmin) {
      return res.status(403).json({ error: 'Forbidden: Account not authorized for Admin access' });
    }

    req.user = decodedToken;
    return next();
  };
};

export const requireAuth = createRequireAuth();
export const requireAdminAuth = createRequireAdminAuth();

