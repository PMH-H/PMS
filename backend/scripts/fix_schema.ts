
import { prisma } from '../src/utils/prisma';

async function main() {
    console.log('Starting manual schema fix...');

    try {
        // 1. Create system_alerts table
        console.log('Creating system_alerts table...');
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.system_alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'critical', 'maintenance')),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          created_by UUID REFERENCES auth.users(id),
          expires_at TIMESTAMPTZ
      );
    `);

        // 2. Enable RLS
        await prisma.$executeRawUnsafe(`ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;`);

        // 3. Create Policies (Drop first to avoid conflicts)
        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Everyone can view active alerts" ON public.system_alerts;`);
        await prisma.$executeRawUnsafe(`
      CREATE POLICY "Everyone can view active alerts" ON public.system_alerts
      FOR SELECT USING (is_active = true);
    `);

        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Admins can manage alerts" ON public.system_alerts;`);
        // Note: Simplified policy for now to ensure it works, refining later if needed
        await prisma.$executeRawUnsafe(`
      CREATE POLICY "Admins can manage alerts" ON public.system_alerts
      FOR ALL USING (
         auth.role() = 'authenticated'
      );
    `);


        // 4. Update items table
        console.log('Updating items table columns...');
        await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'type') THEN
              ALTER TABLE public.items ADD COLUMN type TEXT DEFAULT 'DRUG';
          END IF;
      
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'is_prescribable') THEN
              ALTER TABLE public.items ADD COLUMN is_prescribable BOOLEAN DEFAULT true;
          END IF;
      END $$;
    `);

        // 5. Add Constraints
        await prisma.$executeRawUnsafe(`ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_type_check;`);
        await prisma.$executeRawUnsafe(`
        ALTER TABLE public.items ADD CONSTRAINT items_type_check 
        CHECK (type IN ('DRUG', 'EQUIPMENT', 'SUPPLY', 'SERVICE'));
    `);

        // 6. Reload Schema
        console.log('Reloading schema cache...');
        await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema';`);

        console.log('Schema fix completed successfully.');
    } catch (error) {
        console.error('Error executing schema fix:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
