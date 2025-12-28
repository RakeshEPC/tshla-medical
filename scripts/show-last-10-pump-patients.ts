#!/usr/bin/env tsx
/**
 * Show Last 10 Pump Assessment Patients with Full Input Data
 * Displays patient inputs: sliders, features, free text, and pump recommendations
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
  patient_id: string;
  patient_name: string;
  slider_values: Record<string, number>;
  selected_features: Array<{ id: string; title: string }>;
  lifestyle_text: string;
  challenges_text: string;
  priorities_text: string;
  clarification_responses: Record<string, string>;
  final_recommendation: any;
  first_choice_pump: string | null;
  second_choice_pump: string | null;
  third_choice_pump: string | null;
  dtsqs_baseline: any;
  created_at: string;
  recommendation_date: string;
}

function displaySliderValues(sliders: Record<string, number>) {
  const sliderLabels: Record<string, string> = {
    activity: 'Activity Level',
    techComfort: 'Tech Comfort',
    simplicity: 'Simplicity Preference',
    discreteness: 'Discreteness Importance',
    timeDedication: 'Time Dedication'
  };

  console.log('\n  📊 SLIDER VALUES:');
  Object.entries(sliders).forEach(([key, value]) => {
    const label = sliderLabels[key] || key;
    const bar = '█'.repeat(value) + '░'.repeat(10 - value);
    console.log(`    ${label.padEnd(25)}: ${bar} ${value}/10`);
  });
}

function displayFeatures(features: Array<{ id: string; title: string }>) {
  if (!features || features.length === 0) {
    console.log('\n  ✨ SELECTED FEATURES: None');
    return;
  }

  console.log('\n  ✨ SELECTED FEATURES:');
  features.forEach((feature, idx) => {
    console.log(`    ${idx + 1}. ${feature.title}`);
  });
}

function displayFreeText(lifestyle: string, challenges: string, priorities: string) {
  console.log('\n  📝 FREE TEXT RESPONSES:');

  if (lifestyle) {
    console.log(`    Lifestyle/Story:`);
    console.log(`      ${lifestyle.substring(0, 150)}${lifestyle.length > 150 ? '...' : ''}`);
  }

  if (challenges) {
    console.log(`    Challenges:`);
    console.log(`      ${challenges.substring(0, 150)}${challenges.length > 150 ? '...' : ''}`);
  }

  if (priorities) {
    console.log(`    Priorities:`);
    console.log(`      ${priorities.substring(0, 150)}${priorities.length > 150 ? '...' : ''}`);
  }
}

function displayDTSQs(dtsqs: any) {
  if (!dtsqs) {
    console.log('\n  📋 DTSQs BASELINE: Not completed');
    return;
  }

  console.log('\n  📋 DTSQs BASELINE (Diabetes Treatment Satisfaction):');
  console.log(`    Total Score: ${dtsqs.total_score || 'N/A'}`);
  console.log(`    Treatment Satisfaction: ${dtsqs.treatment_satisfaction || 'N/A'}/10`);
  console.log(`    Hyperglycemia Frequency: ${dtsqs.hyperglycemia_frequency || 'N/A'}/10`);
  console.log(`    Hypoglycemia Frequency: ${dtsqs.hypoglycemia_frequency || 'N/A'}/10`);
}

async function showLast10Patients() {
  console.log('\n' + '='.repeat(100));
  console.log('🔍 LAST 10 PUMP ASSESSMENT PATIENTS - COMPLETE INPUT DATA');
  console.log('='.repeat(100) + '\n');

  try {
    // Query last 10 pump assessments
    const { data: assessments, error } = await supabase
      .from('pump_assessments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error querying pump assessments:', error.message);
      console.error('Details:', error);
      return;
    }

    if (!assessments || assessments.length === 0) {
      console.log('⚠️  No pump assessments found in database\n');
      return;
    }

    console.log(`📊 Total assessments found: ${assessments.length}\n`);
    console.log('='.repeat(100) + '\n');

    // Track pump choice statistics
    const pumpStats = new Map<string, number>();

    // Display each assessment
    assessments.forEach((assessment: any, index: number) => {
      console.log(`\n${'#'.repeat(100)}`);
      console.log(`# PATIENT ${index + 1} of ${assessments.length}`);
      console.log(`${'#'.repeat(100)}\n`);

      console.log(`  👤 PATIENT INFORMATION:`);
      console.log(`    Name:           ${assessment.patient_name || 'N/A'}`);
      console.log(`    Patient ID:     ${assessment.patient_id || 'N/A'}`);
      console.log(`    Assessment ID:  ${assessment.id}`);
      console.log(`    Date:           ${new Date(assessment.created_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })}`);

      // Slider values
      if (assessment.slider_values) {
        displaySliderValues(assessment.slider_values);
      }

      // Selected features
      if (assessment.selected_features) {
        displayFeatures(assessment.selected_features);
      }

      // Free text responses
      displayFreeText(
        assessment.lifestyle_text,
        assessment.challenges_text,
        assessment.priorities_text
      );

      // DTSQs baseline
      if (assessment.dtsqs_baseline) {
        displayDTSQs(assessment.dtsqs_baseline);
      }

      // Clarifying responses
      if (assessment.clarification_responses && Object.keys(assessment.clarification_responses).length > 0) {
        console.log('\n  💬 CLARIFYING Q&A:');
        Object.entries(assessment.clarification_responses).forEach(([question, answer], idx) => {
          console.log(`    Q${idx + 1}: ${question}`);
          console.log(`    A${idx + 1}: ${answer}\n`);
        });
      }

      // Pump recommendations
      console.log('\n  🏆 PUMP RECOMMENDATIONS:');
      console.log(`    1st Choice:  ${assessment.first_choice_pump || 'N/A'}`);
      console.log(`    2nd Choice:  ${assessment.second_choice_pump || 'N/A'}`);
      console.log(`    3rd Choice:  ${assessment.third_choice_pump || 'N/A'}`);

      // Track 1st choice for statistics
      if (assessment.first_choice_pump) {
        pumpStats.set(
          assessment.first_choice_pump,
          (pumpStats.get(assessment.first_choice_pump) || 0) + 1
        );
      }

      // AI recommendation details
      if (assessment.final_recommendation?.topChoice) {
        const rec = assessment.final_recommendation;
        console.log('\n  💡 AI RECOMMENDATION DETAILS:');
        console.log(`    Pump:   ${rec.topChoice.name}`);
        console.log(`    Score:  ${rec.topChoice.score || 'N/A'}`);

        if (rec.topChoice.reasons && rec.topChoice.reasons.length > 0) {
          console.log('    Reasons:');
          rec.topChoice.reasons.forEach((reason: string) => {
            console.log(`      • ${reason}`);
          });
        }

        if (rec.personalizedInsights) {
          console.log('\n    Personalized Insights:');
          const insights = rec.personalizedInsights.substring(0, 300);
          console.log(`      ${insights}${rec.personalizedInsights.length > 300 ? '...' : ''}`);
        }

        if (rec.keyFactors && rec.keyFactors.length > 0) {
          console.log('\n    Key Factors:');
          rec.keyFactors.forEach((factor: string) => {
            console.log(`      • ${factor}`);
          });
        }
      }

      console.log('\n' + '─'.repeat(100));
    });

    // Summary statistics
    console.log('\n\n' + '='.repeat(100));
    console.log('📊 SUMMARY STATISTICS');
    console.log('='.repeat(100) + '\n');

    console.log(`Total Patients Shown:      ${assessments.length}`);
    console.log(`Date Range:                ${new Date(assessments[assessments.length - 1].created_at).toLocaleDateString()} - ${new Date(assessments[0].created_at).toLocaleDateString()}`);

    if (pumpStats.size > 0) {
      console.log('\n🏆 MOST POPULAR PUMP CHOICES (1st Choice):');
      const sortedPumps = Array.from(pumpStats.entries())
        .sort((a, b) => b[1] - a[1]);

      sortedPumps.forEach(([pump, count], idx) => {
        const percentage = ((count / assessments.length) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(count * 2));
        console.log(`  ${idx + 1}. ${pump.padEnd(30)} : ${count} patients (${percentage}%) ${bar}`);
      });
    }

    // Input completion statistics
    const withSliders = assessments.filter((a: any) => a.slider_values && Object.keys(a.slider_values).length > 0).length;
    const withFeatures = assessments.filter((a: any) => a.selected_features && a.selected_features.length > 0).length;
    const withLifestyle = assessments.filter((a: any) => a.lifestyle_text && a.lifestyle_text.length > 10).length;
    const withDTSQs = assessments.filter((a: any) => a.dtsqs_baseline).length;

    console.log('\n📋 INPUT COMPLETION RATES:');
    console.log(`  Slider Values:         ${withSliders}/${assessments.length} (${((withSliders / assessments.length) * 100).toFixed(0)}%)`);
    console.log(`  Selected Features:     ${withFeatures}/${assessments.length} (${((withFeatures / assessments.length) * 100).toFixed(0)}%)`);
    console.log(`  Lifestyle/Story Text:  ${withLifestyle}/${assessments.length} (${((withLifestyle / assessments.length) * 100).toFixed(0)}%)`);
    console.log(`  DTSQs Baseline:        ${withDTSQs}/${assessments.length} (${((withDTSQs / assessments.length) * 100).toFixed(0)}%)`);

    console.log('\n' + '='.repeat(100) + '\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the query
showLast10Patients().then(() => {
  console.log('✅ Query complete\n');
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
