import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY is required in .env.local');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || '');

const DRUG_DB_PATH = path.join(__dirname, '../Drugs sample/Drug_DB.md');

// Column Mapping based on the file header
// Medicine | Presentation | Description | Mechanism Of Action | Indications | Contraindications | Adverse Effects | Dosage And Administration | Drug Interactions | Geriatric Use | Pediatric Use | Pregnancy & Breastfeeding use | Overdose | Storage
interface DrugRow {
    medicine: string;
    presentation: string;
    description: string;
    mechanism: string;
    indications: string;
    contraindications: string;
    adverse: string;
    dosage: string;
    interactions: string;
    geriatric: string;
    pediatric: string;
    pregnancy: string;
    overdose: string;
    storage: string;
    category?: string; // Derived
}

async function main() {
    console.log('Starting Drug DB Seeding...');

    if (!fs.existsSync(DRUG_DB_PATH)) {
        console.error(`File not found: ${DRUG_DB_PATH}`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(DRUG_DB_PATH, 'utf-8');
    const lines = fileContent.split('\n');

    let currentCategory = 'Uncategorized';

    const drugs: DrugRow[] = [];

    console.log('Parsing file...');

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = line.split('\t').map(c => c.trim());

        if (columns.length < 3) {
            const firstCol = columns[0];
            if (/^[\d.]+$/.test(firstCol)) {
                if (columns[1]) {
                    currentCategory = columns[1];
                }
            }
            continue;
        }

        if (!/^[\d.]+$/.test(columns[0])) {
            continue;
        }

        const drug: DrugRow = {
            medicine: columns[1],
            presentation: columns[2],
            description: columns[3],
            mechanism: columns[4],
            indications: columns[5],
            contraindications: columns[6],
            adverse: columns[7],
            dosage: columns[8],
            interactions: columns[9],
            geriatric: columns[10],
            pediatric: columns[11],
            pregnancy: columns[12],
            overdose: columns[13],
            storage: columns[14] || '',
            category: currentCategory
        };

        if (drug.medicine) {
            drugs.push(drug);
        }
    }

    console.log(`Parsed ${drugs.length} drugs.`);

    const uniqueCategories = Array.from(new Set(drugs.map(d => d.category!)));
    const categoryMap = new Map<string, string>(); // Name -> UUID

    for (const catName of uniqueCategories) {
        if (!catName) continue;
        const { data: catData, error: catError } = await supabase
            .from('clinical_categories')
            .select('id')
            .eq('name', catName)
            .maybeSingle();

        if (catData) {
            categoryMap.set(catName, catData.id);
        } else {
            const { data: newCat, error: insertError } = await supabase
                .from('clinical_categories')
                .insert({ name: catName })
                .select('id')
                .single();
            if (newCat) categoryMap.set(catName, newCat.id);
        }
    }

    for (const drug of drugs) {
        console.log(`Processing ${drug.medicine}...`);

        let drugId: string | null = null;

        // Check if exists
        const { data: existingDrug, error: searchError } = await supabase
            .from('clinical_drugs')
            .select('id')
            .eq('name', drug.medicine)
            .maybeSingle();

        const payload = {
            name: drug.medicine,
            description: drug.description,
            mechanism_of_action: drug.mechanism,
            category_id: categoryMap.get(drug.category!) || null,
            indications_text: drug.indications,
            contraindications_text: drug.contraindications,
            adverse_effects_text: drug.adverse,
            dosage_text: drug.dosage,
            geriatric_use_text: drug.geriatric,
            pediatric_use_text: drug.pediatric,
            pregnancy_use_text: drug.pregnancy,
            overdose_text: drug.overdose,
            storage_text: drug.storage,
            ven_category: 'E',
            aware_category: 'Access'
        };

        if (existingDrug) {
            // Update
            const { error: updateError } = await supabase
                .from('clinical_drugs')
                .update(payload)
                .eq('id', existingDrug.id);

            if (updateError) {
                console.error(`Failed to update drug ${drug.medicine}:`, updateError);
                continue;
            }
            drugId = existingDrug.id;
        } else {
            // Insert
            const { data: newDrug, error: insertError } = await supabase
                .from('clinical_drugs')
                .insert(payload)
                .select('id')
                .single();

            if (insertError || !newDrug) {
                console.error(`Failed to insert drug ${drug.medicine}:`, insertError);
                continue;
            }
            drugId = newDrug.id;
        }

        if (!drugId) continue;

        const presentRaw = drug.presentation;
        const presentations = presentRaw.split(/[,;]/).map(p => p.trim()).filter(p => p);

        // Clear old presentations? Or just append?
        // If we are re-running, appending duplicates presentations.
        // Ideally delete old ones first.
        await supabase.from('clinical_presentations').delete().eq('drug_id', drugId);

        for (const p of presentations) {
            await supabase.from('clinical_presentations').insert({
                drug_id: drugId,
                form: p,
            });
        }

        // Interactions
        // Clear old?
        // await supabase.from('clinical_interactions').delete().or(`drug_id_1.eq.${drugId},drug_id_2.eq.${drugId}`);
        // Check if deletions work with OR logic in supabase-js? syntax is complex.
        // Let's just delete where drug_id_1 = drugId. (This handles outgoing).
        // Incoming ones (where drug_id_2 is this drug) are harder to track from here without scanning all others.
        // For now, let's keep it simple: Add new ones. (Idempotency is hard here without specific IDs).
        // Actually, we can assume we only write Outgoing interactions from the Monograph.
        await supabase.from('clinical_interactions').delete().eq('drug_id_1', drugId);

        const interactionText = drug.interactions;
        if (interactionText && interactionText !== 'Nil') {
            const regex = /\[(.*?)\] (.*?) \+ (.*?) [→\->] (.*?)(?=\[|$)/g;
            let match;
            while ((match = regex.exec(interactionText)) !== null) {
                const tag = match[1];
                const drugA_Name = match[2].trim();
                const drugB_Raw = match[3].trim();
                const warning = match[4].trim();

                const severityMap: any = {
                    'CRITICAL-INTRA': 'SEVERE',
                    'CRITICAL-OUT': 'SEVERE',
                    'CRITICAL-CLASS': 'SEVERE',
                    'MODERATE-INTRA': 'MODERATE',
                    'MODERATE-OUT': 'MODERATE',
                    'MODERATE-CLASS': 'MODERATE',
                    'MINOR-INTRA': 'MILD'
                };

                const severity = severityMap[tag] || 'MODERATE';
                const cleanerDrugB = drugB_Raw.replace(/\(.*?\)/g, '');
                const targets = cleanerDrugB.split(/,| or /).map(t => t.trim()).filter(t => t && t.length > 2);

                for (const targetName of targets) {
                    const { data: targetData } = await supabase
                        .from('clinical_drugs')
                        .select('id')
                        .ilike('name', targetName)
                        .maybeSingle();

                    const targetId = targetData ? targetData.id : null;

                    // Logic: 
                    // We always insert as drug_id_1 = current drug.
                    // drug_id_2 = targetID if exists.
                    // If we enforce drug_id_1 < drug_id_2, we can't just blind insert.
                    // BUT the constraint is `CHECK (drug_id_1 < drug_id_2)`.
                    // So if drugId > targetId, we MUST swap.

                    let d1 = drugId;
                    let d2 = targetId;
                    let entityName = targetName;
                    let note = warning;

                    if (d2) {
                        // We have a linked drug.
                        // Must respect order.
                        if (d1 > d2) {
                            // Swap
                            [d1, d2] = [d2, d1];
                            // If we swap, the "Description" is still valid? Yes, interaction is typically symmetric.
                        }

                        // Check if exists to avoid UNIQUE violation
                        const { data: existInt } = await supabase
                            .from('clinical_interactions')
                            .select('id')
                            .eq('drug_id_1', d1)
                            .eq('drug_id_2', d2)
                            .maybeSingle();

                        if (!existInt) {
                            await supabase.from('clinical_interactions').insert({
                                drug_id_1: d1,
                                drug_id_2: d2,
                                interaction_type: tag,
                                severity: severity,
                                description: note // "Propofol + Morphine -> warning"
                            });
                        }
                    } else {
                        // External / Class
                        // Interaction is "Propofol" (d1) + "Alcohol" (EntityName)
                        // We don't verify Unique constraint strongly for EntityName yet, but let's avoid dupes.
                        await supabase.from('clinical_interactions').insert({
                            drug_id_1: d1,
                            drug_id_2: null,
                            interacting_entity_name: entityName,
                            interaction_type: tag,
                            severity: severity,
                            description: note
                        });
                    }
                }
            }
        }
    }

    console.log('Done!');
}

main().catch(console.error);
