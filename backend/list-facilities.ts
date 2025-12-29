import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        const facilities = await prisma.facility.findMany({ take: 5 });
        console.log('Available Facilities:');
        facilities.forEach(f => console.log(`- [${f.id}] ${f.name} (${f.type})`));
    } catch (error) {
        console.error('Error fetching facilities:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
