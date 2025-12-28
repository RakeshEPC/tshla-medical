#!/usr/bin/env tsx
/**
 * Query Pump Assessments from Supabase
 * Searches for specific patient pump selection reports
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface PumpAssessment {
  id: string;
  patient_name: string;
  patient_id: string;
  first_choice_pump: string | null;
  second_choice_pump: string | null;
  third_choice_pump: string | null;
  final_recommendation: any;
  created_at: string;
  recommendation_date: string;
}

// Patient names to search for (with possible misspellings)
const PATIENT_NAMES = [
  'Michael Dummer',
  'Michale Dummer',  // possible misspelling
  'Jagdeep Verma',
  'William Watson',
  'Gail Kennedy',
  'Suresh Nayak',
];

async function queryPumpAssessments() {
  console.log('🔍 Searching for pump assessment reports...\n');
  console.log('Target patients:');
  PATIENT_NAMES.forEach(name => console.log(`  - ${name}`));
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    // Query all pump assessments (we'll filter after)
    const { data: assessments, error } = await supabase
      .from('pump_assessments')
      .select(`
        id,
        patient_name,
        patient_id,
        first_choice_pump,
        second_choice_pump,
        third_choice_pump,
        final_recommendation,
        created_at,
        recommendation_date
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error querying pump assessments:', error);
      return;
    }

    if (!assessments || assessments.length === 0) {
      console.log('⚠️  No pump assessments found in database');
      return;
    }

    console.log(`📊 Total assessments in database: ${assessments.length}\n`);

    // Filter for our target patients (case-insensitive, fuzzy matching)
    const matchedAssessments = assessments.filter((assessment: PumpAssessment) => {
      const name = assessment.patient_name?.toLowerCase() || '';

      // Check for exact or partial matches
      return PATIENT_NAMES.some(targetName => {
        const target = targetName.toLowerCase();
        const firstName = target.split(' ')[0];
        const lastName = target.split(' ')[1];

        // Match if contains both first and last name (handles misspellings)
        return name.includes(firstName) && name.includes(lastName);
      });
    });

    if (matchedAssessments.length === 0) {
      console.log('⚠️  No matching assessments found for target patients\n');
      console.log('All patient names in database:');
      const uniqueNames = [...new Set(assessments.map((a: PumpAssessment) => a.patient_name))];
      uniqueNames.forEach(name => console.log(`  - ${name}`));
      return;
    }

    console.log(`✅ Found ${matchedAssessments.length} matching assessment(s)\n`);
    console.log('='.repeat(80) + '\n');

    // Display each matched assessment
    matchedAssessments.forEach((assessment: PumpAssessment, index: number) => {
      console.log(`📋 ASSESSMENT #${index + 1}`);
      console.log('─'.repeat(80));
      console.log(`Patient Name:       ${assessment.patient_name}`);
      console.log(`Patient ID:         ${assessment.patient_id}`);
      console.log(`Assessment ID:      ${assessment.id}`);
      console.log(`Assessment Date:    ${new Date(assessment.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`);
      console.log('\n🏆 PUMP RECOMMENDATIONS:');
      console.log(`  1st Choice:  ${assessment.first_choice_pump || 'N/A'}`);
      console.log(`  2nd Choice:  ${assessment.second_choice_pump || 'N/A'}`);
      console.log(`  3rd Choice:  ${assessment.third_choice_pump || 'N/A'}`);

      // Display AI recommendation details if available
      if (assessment.final_recommendation) {
        const rec = assessment.final_recommendation;

        if (rec.topChoice) {
          console.log('\n💡 TOP CHOICE DETAILS:');
          console.log(`  Pump:   ${rec.topChoice.name}`);
          console.log(`  Score:  ${rec.topChoice.score || 'N/A'}`);

          if (rec.topChoice.reasons && rec.topChoice.reasons.length > 0) {
            console.log('  Reasons:');
            rec.topChoice.reasons.forEach((reason: string) => {
              console.log(`    • ${reason}`);
            });
          }
        }

        if (rec.personalizedInsights) {
          console.log('\n📝 PERSONALIZED INSIGHTS:');
          console.log(`  ${rec.personalizedInsights}`);
        }
      }

      console.log('\n' + '='.repeat(80) + '\n');
    });

    // Summary
    console.log('📊 SUMMARY');
    console.log('─'.repeat(80));
    console.log(`Total matches found: ${matchedAssessments.length}`);

    const pumpCounts = new Map<string, number>();
    matchedAssessments.forEach((a: PumpAssessment) => {
      if (a.first_choice_pump) {
        pumpCounts.set(a.first_choice_pump, (pumpCounts.get(a.first_choice_pump) || 0) + 1);
      }
    });

    if (pumpCounts.size > 0) {
      console.log('\nMost Recommended Pumps (1st Choice):');
      Array.from(pumpCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([pump, count]) => {
          console.log(`  ${pump}: ${count} patient(s)`);
        });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the query
queryPumpAssessments().then(() => {
  console.log('\n✅ Query complete\n');
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
