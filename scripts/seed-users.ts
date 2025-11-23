import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
let env: Record<string, string> = {};

try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            env[key] = value;
        }
    });
} catch (e) {
    console.error('Could not read .env.local file');
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('\x1b[31m%s\x1b[0m', 'Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const TEST_USERS = [
    {
        email: 'dev@pharmai.com',
        password: 'Password123!',
        role: 'SUPER_ADMIN_DEV',
        full_name: 'Dev Super Admin',
        facility_type: 'NATIONAL_OFFICE'
    },
    {
        email: 'bms@pharmai.com',
        password: 'Password123!',
        role: 'SUPER_ADMIN_BMS',
        full_name: 'BMS Super Admin',
        facility_type: 'NATIONAL_OFFICE'
    },
    {
        email: 'admin@pharmai.com',
        password: 'Password123!',
        role: 'ADMIN',
        full_name: 'Facility Admin',
        facility_type: 'PHARMACY'
    },
    {
        email: 'pharmacist@pharmai.com',
        password: 'Password123!',
        role: 'PHARMACIST',
        full_name: 'Chief Pharmacist',
        facility_type: 'PHARMACY'
    },
    {
        email: 'patient@pharmai.com',
        password: 'Password123!',
        role: 'CUSTOMER',
        full_name: 'John Doe',
        facility_type: null
    }
];

async function seed() {
    console.log('🌱 Starting seed process...');

    // 1. Ensure a default facility exists
    console.log('Checking facilities...');
    let facilityId: string | null = null;

    const { data: facilities, error: facilityError } = await supabase
        .from('facilities')
        .select('id')
        .eq('name', 'Main Central Pharmacy')
        .single();

    if (facilities) {
        facilityId = facilities.id;
        console.log('✅ Found existing facility:', facilityId);
    } else {
        console.log('Creating default facility...');
        const { data: newFacility, error: createError } = await supabase
            .from('facilities')
            .insert({
                name: 'Main Central Pharmacy',
                type: 'PHARMACY',
                address: '123 Health St, Lusaka',
                phone: '+260 97 000 0000',
                email: 'info@mainpharmacy.com'
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating facility:', createError);
            process.exit(1);
        }
        facilityId = newFacility.id;
        console.log('✅ Created default facility:', facilityId);
    }

    // 2. Seed Users
    console.log('\nSeeding users...');

    for (const user of TEST_USERS) {
        try {
            // Check if user exists
            const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers();
            const existingUser = existingUsers.find(u => u.email === user.email);

            let userId = existingUser?.id;

            if (!userId) {
                console.log(`Creating user: ${user.email}`);
                const { data, error } = await supabase.auth.admin.createUser({
                    email: user.email,
                    password: user.password,
                    email_confirm: true
                });

                if (error) throw error;
                userId = data.user.id;
            } else {
                console.log(`User exists: ${user.email}`);
            }

            // Update Profile
            const userFacilityId = user.role === 'CUSTOMER' ? null : facilityId;

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    role: user.role,
                    full_name: user.full_name,
                    facility_id: userFacilityId,
                    is_active: true
                });

            if (profileError) {
                console.error(`Error updating profile for ${user.email}:`, profileError);
            } else {
                console.log(`✅ Profile updated for ${user.email} (${user.role})`);
            }

        } catch (err: any) {
            console.error(`Failed to process ${user.email}:`, err.message);
        }
    }

    console.log('\n✨ Seeding completed!');
    console.log('You can now login with the following accounts (Password: Password123!):');
    TEST_USERS.forEach(u => console.log(`- ${u.role}: ${u.email}`));
}

seed();
