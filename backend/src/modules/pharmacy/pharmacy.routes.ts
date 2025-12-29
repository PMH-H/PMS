import { Router } from 'express';
import { simulateSale, logPhysicalRx, deleteInventory } from './pharmacy.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate';
import { z } from 'zod';

const router = Router();

// Validation Schemas
const saleSchema = z.object({
    body: z.object({
        items: z.array(z.object({
            itemId: z.string(),
            quantity: z.number().int().positive(),
            price: z.number().nonnegative()
        })).min(1),
        totalAmount: z.number().nonnegative(),
        paymentMethod: z.string().optional()
    })
});

const logRxSchema = z.object({
    body: z.object({
        patientId: z.string().uuid(),
        medications: z.array(z.any()), // Refine later
        notes: z.string().optional()
    })
});

const deleteInventorySchema = z.object({
    body: z.object({
        reason: z.string().min(5)
    })
});

// Roles allowed
const PHARMACY_ROLES = ['pharmacist', 'admin', 'worker', 'cashier', 'super_admin_bms'];

// Routes
router.post('/simulate/sale', authenticate, authorize(PHARMACY_ROLES), validate(saleSchema), simulateSale);
router.post('/log-rx', authenticate, authorize(['pharmacist', 'admin']), validate(logRxSchema), logPhysicalRx);
router.delete('/inventory/:id', authenticate, authorize(['pharmacist', 'admin']), validate(deleteInventorySchema), deleteInventory);

export default router;
