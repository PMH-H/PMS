import { eventBus, EVENTS } from '../../services/event.service';
import { createNotification } from './notification.controller';
import { prisma } from '../../utils/prisma';

export const initNotificationListeners = () => {
    // Listener: SALE_COMPLETED
    eventBus.on(EVENTS.SALE_COMPLETED, async (sale) => {
        try {
            // Notify the pharmacist (or user who processed it) that sale is recorded
            // In a real app, maybe notify the Manager? For now, confirm to user.
            await createNotification(
                sale.processed_by,
                'SALE_COMPLETED',
                'Sale Recorded',
                `Sale of ZMW ${sale.total_amount} was successfully recorded.`,
                { saleId: sale.id }
            );

            // TODO: Notify admin if high value?
        } catch (err) {
            console.error('Error handling SALE_COMPLETED event:', err);
        }
    });

    console.log('Notification Listeners Initialized');
};
