
-- 041_clinical_drug_db.sql
-- Implements the Zambia Essential Medicines List (ZEML) Schema
-- Adapted for Supabase (UUIDs, RLS)

-- =============================================
-- 1. REFERENCE TABLES (Lookups)
-- =============================================

-- Special Populations (Adult, Pediatric, etc.)
CREATE TABLE IF NOT EXISTS public.clinical_populations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
ALTER TABLE public.clinical_populations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read populations" ON public.clinical_populations FOR SELECT USING (true);

-- Indications (Conditions/Diseases)
CREATE TABLE IF NOT EXISTS public.clinical_indications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);
ALTER TABLE public.clinical_indications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read indications" ON public.clinical_indications FOR SELECT USING (true);

-- Contraindications
CREATE TABLE IF NOT EXISTS public.clinical_contraindications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);
ALTER TABLE public.clinical_contraindications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read contraindications" ON public.clinical_contraindications FOR SELECT USING (true);

-- Adverse Effects
CREATE TABLE IF NOT EXISTS public.clinical_adverse_effects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);
ALTER TABLE public.clinical_adverse_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read adverse_effects" ON public.clinical_adverse_effects FOR SELECT USING (true);

-- Therapeutic Categories (Anaesthesia, CNS, etc.)
CREATE TABLE IF NOT EXISTS public.clinical_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);
ALTER TABLE public.clinical_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.clinical_categories FOR SELECT USING (true);


-- =============================================
-- 2. CORE DRUG TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.clinical_drugs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    mechanism_of_action TEXT,
    storage_handling TEXT,
    overdosage_management TEXT,
    ven_category TEXT CHECK (ven_category IN ('V', 'E', 'N')), -- Vital, Essential, Non-essential
    aware_category TEXT CHECK (aware_category IN ('Access', 'Watch', 'Reserve')), -- Antibiotics
    category_id UUID REFERENCES public.clinical_categories(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.clinical_drugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read drugs" ON public.clinical_drugs FOR SELECT USING (true);


-- =============================================
-- 3. PRESENTATIONS (Forms/Strengths)
-- =============================================

CREATE TABLE IF NOT EXISTS public.clinical_presentations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_id UUID REFERENCES public.clinical_drugs(id) ON DELETE CASCADE,
    form TEXT NOT NULL,       -- e.g. Tablet, Syrup
    strength TEXT NOT NULL,   -- e.g. 500mg
    unit TEXT,                -- e.g. mg, ml
    packaging TEXT            -- e.g. Blister pack of 10
);
ALTER TABLE public.clinical_presentations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read presentations" ON public.clinical_presentations FOR SELECT USING (true);


-- =============================================
-- 4. JUNCTION TABLES (Many-to-Many)
-- =============================================

-- Drugs <-> Indications
CREATE TABLE IF NOT EXISTS public.clinical_drug_indications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_id UUID REFERENCES public.clinical_drugs(id) ON DELETE CASCADE,
    indication_id UUID REFERENCES public.clinical_indications(id) ON DELETE CASCADE,
    UNIQUE(drug_id, indication_id)
);
ALTER TABLE public.clinical_drug_indications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read drug_indications" ON public.clinical_drug_indications FOR SELECT USING (true);

-- Drugs <-> Contraindications
CREATE TABLE IF NOT EXISTS public.clinical_drug_contraindications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_id UUID REFERENCES public.clinical_drugs(id) ON DELETE CASCADE,
    contraindication_id UUID REFERENCES public.clinical_contraindications(id) ON DELETE CASCADE,
    UNIQUE(drug_id, contraindication_id)
);
ALTER TABLE public.clinical_drug_contraindications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read drug_contraindications" ON public.clinical_drug_contraindications FOR SELECT USING (true);

-- Drugs <-> Adverse Effects
CREATE TABLE IF NOT EXISTS public.clinical_drug_adverse_effects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_id UUID REFERENCES public.clinical_drugs(id) ON DELETE CASCADE,
    adverse_effect_id UUID REFERENCES public.clinical_adverse_effects(id) ON DELETE CASCADE,
    UNIQUE(drug_id, adverse_effect_id)
);
ALTER TABLE public.clinical_drug_adverse_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read drug_adverse_effects" ON public.clinical_drug_adverse_effects FOR SELECT USING (true);


-- =============================================
-- 5. COMPLEX RELATIONSHIPS
-- =============================================

-- Drug Interactions (Self-Referencing)
CREATE TABLE IF NOT EXISTS public.clinical_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_id_1 UUID REFERENCES public.clinical_drugs(id) ON DELETE CASCADE,
    drug_id_2 UUID REFERENCES public.clinical_drugs(id) ON DELETE CASCADE,
    severity TEXT CHECK (severity IN ('MILD', 'MODERATE', 'SEVERE', 'CONTRAINDICATED')),
    description TEXT,
    UNIQUE(drug_id_1, drug_id_2),
    CHECK (drug_id_1 < drug_id_2) -- Enforce single direction for uniqueness
);
ALTER TABLE public.clinical_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read interactions" ON public.clinical_interactions FOR SELECT USING (true);

-- Population Specific Info (Pregnancy, etc.)
CREATE TABLE IF NOT EXISTS public.clinical_population_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_id UUID REFERENCES public.clinical_drugs(id) ON DELETE CASCADE,
    population_id UUID REFERENCES public.clinical_populations(id) ON DELETE CASCADE,
    info TEXT, -- Guidelines
    UNIQUE(drug_id, population_id)
);
ALTER TABLE public.clinical_population_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pop info" ON public.clinical_population_info FOR SELECT USING (true);

-- Standard Dosages
CREATE TABLE IF NOT EXISTS public.clinical_dosages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    drug_id UUID REFERENCES public.clinical_drugs(id) ON DELETE CASCADE,
    population_id UUID REFERENCES public.clinical_populations(id), -- Optional, null means general
    route TEXT,
    dose_amount TEXT,
    frequency TEXT,
    duration TEXT,
    notes TEXT
);
ALTER TABLE public.clinical_dosages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dosages" ON public.clinical_dosages FOR SELECT USING (true);


-- =============================================
-- 6. FULL TEXT SEARCH (Optional but recommended)
-- =============================================
-- Create index on drug names
CREATE INDEX IF NOT EXISTS idx_clinical_drugs_name ON public.clinical_drugs USING gin(to_tsvector('english', name));
