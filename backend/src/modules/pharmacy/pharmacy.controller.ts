import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { prisma } from '../../utils/prisma';
import { eventBus, EVENTS } from '../../services/event.service';

// --- SALES SIMULATION ---
export const simulateSale = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { items, totalAmount, paymentMethod } = req.body; // items: [{ itemId, quantity, price }]

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items in sale' });
    }

    try {
        // 1. Get User Profile for Facility ID
        const user = await prisma.profile.findUnique({ where: { id: userId } });
        if (!user || !user.facility_id) {
            return res.status(400).json({ error: 'User not linked to facility' });
        }

        // 2. Transact: Create Sale & Deduct Inventory (Simplified FIFO)
        const result = await prisma.$transaction(async (tx) => {
            // Create Sale Record
            const sale = await tx.sale.create({
                data: {
                    facility_id: user.facility_id!,
                    processed_by: userId!,
                    total_amount: totalAmount,
                    payment_method: paymentMethod || 'CASH',
                    items: items
                }
            });

            // Update Inventory (Simple decrement from latest batch for MVP)
            // Real FEFO/FIFO logic is complex, for simulation we just decrement count from random batch
            for (const item of items) {
                const batches = await tx.itemBatch.findMany({
                    where: { item_id: item.itemId, current_quantity: { gt: 0 } },
                    orderBy: { expiry_date: 'asc' }
                });

                let remainingToDeduct = item.quantity;

                for (const batch of batches) {
                    if (remainingToDeduct <= 0) break;

                    const deduct = Math.min(batch.current_quantity, remainingToDeduct);

                    await tx.itemBatch.update({
                        where: { id: batch.id },
                        data: { current_quantity: { decrement: deduct } }
                    });

                    remainingToDeduct -= deduct;
                }
            }

            return sale;
        });

        // 3. Emit Event for KPIs
        eventBus.emit(EVENTS.SALE_COMPLETED, result);

        res.json({ success: true, saleId: result.id });

    } catch (error) {
        console.error('Simulate Sale Error:', error);
        res.status(500).json({ error: 'Failed to process sale', details: (error as any).message });
    }
};

// --- LOG PHYSICAL PRESCRIPTION ---
export const logPhysicalRx = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { patientName, medications, notes } = req.body;

    try {
        const user = await prisma.profile.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'pharmacist') {
            return res.status(403).json({ error: 'Only pharmacists can log physical Rx' });
        }

        // Create a Mock Patient ID? Or use a generic "Walk-in" ID if exists. 
        // For now, we enforce patient_id is required by schema, likely need a "guest" patient or create one on fly.
        // We will fail if no patient_id provided. For this feature to work well, we might need a "Walk-In" generic profile.
        // Or we use the Pharmacist ID as the "patient" effectively for tracking, or create a shadow profile.
        // Let's assume we pass a valid patient_id or we fail.

        // MVP: Just fail if incomplete, user must register patient first? 
        // Or commonly: "Walk In Patient"

        // let walkInId = ... (skipping for now, strict schema)

        // Assuming we are just logging "completed" prescriptions for existing patients:
        const { patientId } = req.body;
        if (!patientId) return res.status(400).json({ error: 'Patient ID required for logging' });

        const rx = await prisma.prescription.create({
            data: {
                patient_id: patientId,
                facility_id: user.facility_id,
                status: 'completed', // Immediately completed
                medications: medications, // JSON
                notes: `Physical Rx Logged by ${user.full_name}. ${notes || ''}`
            }
        });

        res.json(rx);

    } catch (error: any) {
        console.error('Log Rx Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// --- DELETE INVENTORY (AUDITED) ---
export const deleteInventory = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ error: 'Reason required for deletion' });

    try {
        const user = await prisma.profile.findUnique({ where: { id: userId } });

        const item = await prisma.inventoryItem.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: 'Item not found' });

        // Check ownership/facility match if needed

        await prisma.$transaction([
            // Delete Item (or Cascade delete batches usually?)
            // If Cascade not set in DB, manual delete
            prisma.itemBatch.deleteMany({ where: { item_id: id } }),
            prisma.inventoryItem.delete({ where: { id } }),

            // Audit Log
            prisma.auditLog.create({
                data: {
                    facility_id: user?.facility_id,
                    performed_by: userId!,
                    action: 'DELETE_INVENTORY',
                    details: {
                        itemId: id,
                        itemName: item.name,
                        reason: reason,
                        snapshot: item
                    }
                }
            })
        ]);

        res.json({ success: true });

    } catch (error) {
        console.error('Delete Inventory Error:', error);
        res.status(500).json({ error: 'Failed to delete inventory', details: (error as any).message });
    }
};
