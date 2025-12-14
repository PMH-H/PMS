
-- 042_seed_essential_meds.sql
-- Seeds the database with common Zambia Essential Medicines

DO $$
DECLARE
    -- Categories
    cat_infectious UUID;
    cat_pain UUID;
    cat_cv UUID;
    cat_endocrine UUID;
    
    -- Indications
    ind_bacterial_infection UUID;
    ind_pain UUID;
    ind_fever UUID;
    ind_malaria UUID;
    ind_diabetes UUID;
    ind_hypertension UUID;
    
    -- Drugs
    drug_amox UUID;
    drug_para UUID;
    drug_coartem UUID;
    drug_metformin UUID;
    drug_losartan UUID;
    
BEGIN
    -- 1. SEED CATEGORIES
    INSERT INTO public.clinical_categories (name, description) VALUES 
        ('Infectious Diseases', 'Drugs used to treat bacterial, viral, fungal, and parasitic infections'),
        ('Analgesics & Antipyretics', 'Pain relievers and fever reducers'),
        ('Cardiovascular', 'Drugs for heart and blood vessel conditions'),
        ('Endocrine', 'Hormonal and metabolic drugs')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
    
    -- Fetch IDs
    SELECT id INTO cat_infectious FROM public.clinical_categories WHERE name = 'Infectious Diseases';
    SELECT id INTO cat_pain FROM public.clinical_categories WHERE name = 'Analgesics & Antipyretics';
    SELECT id INTO cat_cv FROM public.clinical_categories WHERE name = 'Cardiovascular';
    SELECT id INTO cat_endocrine FROM public.clinical_categories WHERE name = 'Endocrine';

    -- 2. SEED INDICATIONS
    INSERT INTO public.clinical_indications (name) VALUES 
        ('Bacterial Infection'), ('Pain'), ('Fever'), ('Uncomplicated Malaria'), ('Type 2 Diabetes'), ('Hypertension')
    ON CONFLICT (name) DO NOTHING;
    
    SELECT id INTO ind_bacterial_infection FROM public.clinical_indications WHERE name = 'Bacterial Infection';
    SELECT id INTO ind_pain FROM public.clinical_indications WHERE name = 'Pain';
    SELECT id INTO ind_fever FROM public.clinical_indications WHERE name = 'Fever';
    SELECT id INTO ind_malaria FROM public.clinical_indications WHERE name = 'Uncomplicated Malaria';
    SELECT id INTO ind_diabetes FROM public.clinical_indications WHERE name = 'Type 2 Diabetes';
    SELECT id INTO ind_hypertension FROM public.clinical_indications WHERE name = 'Hypertension';

    -- 3. SEED DRUGS
    
    -- AMOXICILLIN
    INSERT INTO public.clinical_drugs (name, description, mechanism_of_action, ven_category, aware_category, category_id)
    VALUES (
        'Amoxicillin', 
        'Broad-spectrum penicillin antibiotic.',
        'Inhibits bacterial cell wall synthesis.',
        'V', 'Access', cat_infectious
    )
    ON CONFLICT DO NOTHING -- Name is not unique constraint by default in schema but good practice in seed
    RETURNING id INTO drug_amox;
    
    IF drug_amox IS NULL THEN SELECT id INTO drug_amox FROM public.clinical_drugs WHERE name = 'Amoxicillin'; END IF;

    -- PARACETAMOL
    INSERT INTO public.clinical_drugs (name, description, mechanism_of_action, ven_category, aware_category, category_id)
    VALUES (
        'Paracetamol', 
        'Common pain reliever and fever reducer.',
        'Unknown; may block prostaglandins.',
        'E', NULL, cat_pain
    ) RETURNING id INTO drug_para;
     IF drug_para IS NULL THEN SELECT id INTO drug_para FROM public.clinical_drugs WHERE name = 'Paracetamol'; END IF;

    -- COARTEM (Artemether/Lumefantrine)
    INSERT INTO public.clinical_drugs (name, description, mechanism_of_action, ven_category, aware_category, category_id)
    VALUES (
        'Artemether/Lumefantrine', 
        'Fixed-dose combination antimalarial.',
        'Artemether destroys parasite; Lumefantrine prevents recrudescence.',
        'V', NULL, cat_infectious
    ) RETURNING id INTO drug_coartem;
     IF drug_coartem IS NULL THEN SELECT id INTO drug_coartem FROM public.clinical_drugs WHERE name = 'Artemether/Lumefantrine'; END IF;

    -- METFORMIN
     INSERT INTO public.clinical_drugs (name, description, mechanism_of_action, ven_category, aware_category, category_id)
    VALUES (
        'Metformin', 
        'First-line oral medication for type 2 diabetes.',
        'Decreases glucose production by the liver.',
        'V', NULL, cat_endocrine
    ) RETURNING id INTO drug_metformin;
     IF drug_metformin IS NULL THEN SELECT id INTO drug_metformin FROM public.clinical_drugs WHERE name = 'Metformin'; END IF;


    -- 4. SEED PRESENTATIONS (Dosage Forms)
    INSERT INTO public.clinical_presentations (drug_id, form, strength, packaging) VALUES
        (drug_amox, 'Capsule', '500mg', 'Blister 10x10'),
        (drug_amox, 'Suspension', '125mg/5ml', 'Bottle 100ml'),
        (drug_para, 'Tablet', '500mg', 'Blister 10'),
        (drug_para, 'Syrup', '120mg/5ml', 'Bottle 60ml'),
        (drug_coartem, 'Tablet', '20mg/120mg', 'Blister Pack (6x4)'),
        (drug_metformin, 'Tablet', '500mg', 'Blister 10x10'),
        (drug_metformin, 'Tablet', '850mg', 'Blister 10x10');

    -- 5. LINK INDICATIONS
    INSERT INTO public.clinical_drug_indications (drug_id, indication_id) VALUES
        (drug_amox, ind_bacterial_infection),
        (drug_para, ind_pain),
        (drug_para, ind_fever),
        (drug_coartem, ind_malaria),
        (drug_metformin, ind_diabetes)
    ON CONFLICT DO NOTHING;

    -- 6. INTERACTIONS (Example)
    -- Ensure IDs are ordered properly for the check constraint (id1 < id2)
    -- Just a dummy logic for seeding
    
    -- No severe interactions in this small set, but let's add a dummy one if we had alcohol or similar.
    
END $$;
