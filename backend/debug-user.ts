import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const userId = '32139f75-d19e-481f-8dd8-e94e3011411d';
    console.log(`Inspecting user: ${userId}`);

    try {
        const profile = await prisma.profile.findUnique({
            where: { id: userId }
        });

        if (!profile) {
            console.log('User profile NOT found!');
        } else {
            console.log('User Profile found:');
            console.dir(profile, { depth: null });

            if (profile.facility_id) {
                const facility = await prisma.facility.findUnique({
                    where: { id: profile.facility_id }
                });
                console.log('Linked Facility:', facility);
            } else {
                console.log('WARNING: No facility_id linked to this profile.');
            }
        }

    } catch (error: any) {
        console.error('Error fetching user:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
