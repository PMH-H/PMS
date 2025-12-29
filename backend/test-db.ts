import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

async function main() {
    console.log('Testing Database Connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')); // Hide password

    try {
        // Try a simple query
        const profilesCount = await prisma.profile.count();
        console.log(`Successfully connected! Found ${profilesCount} profiles.`);

        const facilitiesCount = await prisma.facility.count();
        console.log(`Found ${facilitiesCount} facilities.`);

    } catch (error) {
        console.error('Connection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
