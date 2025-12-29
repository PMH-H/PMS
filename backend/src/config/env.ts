import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('3000'),
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1).optional(), // Optional for now until Prisma is setup
});

export const env = envSchema.parse(process.env);
