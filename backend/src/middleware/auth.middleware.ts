import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { prisma } from '../utils/prisma';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

export interface AuthenticatedRequest extends Request {
    user?: any;
    profile?: any;
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Malformed authorization header' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.error('Auth error:', error?.message);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('Unexpected auth error:', err);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
};

export const authorize = (allowedRoles: string[]) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        try {
            const profile = await prisma.profile.findUnique({
                where: { id: req.user.id }
            });

            if (!profile) {
                return res.status(403).json({ error: 'User profile not found' });
            }

            req.profile = profile;

            // Normalize roles to lowercase for comparison
            const userRole = profile.role.toLowerCase();
            const allowed = allowedRoles.map(r => r.toLowerCase());

            if (!allowed.includes(userRole)) {
                // Allow super_admin_dev to access everything for debugging
                if (userRole === 'super_admin_dev') {
                    return next();
                }
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({ error: 'Internal server error during authorization' });
        }
    };
};
