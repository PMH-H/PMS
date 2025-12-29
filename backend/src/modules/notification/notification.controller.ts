import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { prisma } from '../../utils/prisma';

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const notifications = await prisma.notification.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            take: 20 // Limit for now
        });

        const unreadCount = await prisma.notification.count({
            where: { user_id: userId, read: false }
        });

        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications', details: (error as any).message });
    }
};

export const markRead = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params; // Notification ID or 'all'

    try {
        if (id === 'all') {
            await prisma.notification.updateMany({
                where: { user_id: userId, read: false },
                data: { read: true }
            });
        } else {
            // Ensure ownership
            const exists = await prisma.notification.findFirst({ where: { id, user_id: userId } });
            if (!exists) return res.status(404).json({ error: 'Notification not found' });

            await prisma.notification.update({
                where: { id },
                data: { read: true }
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Mark Read Error:', error);
        res.status(500).json({ error: 'Failed to update notification', details: (error as any).message });
    }
};

// Internal Helper to Create Notification (to be used by Event Listeners)
export const createNotification = async (userId: string, type: string, title: string, message: string, data?: any) => {
    try {
        return await prisma.notification.create({
            data: {
                user_id: userId,
                type,
                title,
                message,
                data
            }
        });
    } catch (err) {
        console.error('Failed to create notification', err);
    }
};
