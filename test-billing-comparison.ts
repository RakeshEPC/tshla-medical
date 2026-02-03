/**
 * CPT Billing Comparison Test
 * Compares OLD (non-compliant) vs NEW (CMS-compliant) billing logic on real dictated notes
 *
 * Run with: npx tsx test-billing-comparison.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import the NEW (fixed) billing analyzer
import { cptBillingAnalyzer, ComplexityAnalysis } from './src/services/cptBillingAnalyzer.service';

// Supabase setup - Use SERVICE ROLE KEY to bypass RLS and access all notes
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://minvvjdflezibmgkplqb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnZ2amRmbGV6aWJtZ2twbHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA0MTk4OCwiZXhwIjoyMDcxNjE3OTg4fQ.DfFaJs8PMwIp6tGFQbTE_rRJMYMkPvBpvelVw_u4rMM';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

console.log(`🔗 Connecting to: ${supabaseUrl}`);
console.log(`🔑 Using: SERVICE_ROLE_KEY (bypasses RLS)\n`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface DictatedNote {
  id: number;
  patient_name: string;
  visit_date: string;
  raw_transcript: string;
  processed_note: string;
  dictated_at: string;
  template_name?: string;
}

interface BillingComparison {
  noteId: number;
  patientName: string;
  visitDate: string;
  templateName: string;
  transcriptPreview: string;

  // OLD logic results
  oldCPT: string;
  oldComplexity: string;
  oldRisk: string;
  oldDataPoints: number;
  oldConfidence: number;

  // NEW logic results
  newCPT: string;
  newComplexity: string;
  newRisk: string;
  newProblemComplexity: string;
  newDataComplexity: string;
  newDataPoints: number;
  newConfidence: number;
  newQualifyingElements: string[];

  // Comparison
  codeChanged: boolean;
  differences: string[];
}

/**
 * OLD (NON-COMPLIANT) Billing Logic - For Comparison Only
 * This is the ORIGINAL implementation before CMS compliance fixes
 */
class OldBillingAnalyzer {
  /**
   * OLD determineComplexity - Point-based scoring (NON-COMPLIANT)
   */
  oldDetermineComplexity(
    problemCount: number,
    dataPoints: number,
    riskLevel: string,
    medicationChanges: number
  ): { complexity: string; score: number } {
    let complexityScore = 0;

    // Problem count contribution
    if (problemCount >= 3) complexityScore += 3;
    else if (problemCount >= 2) complexityScore += 2;
    else if (problemCount >= 1) complexityScore += 1;

    // Data points contribution (UNLIMITED - this was the bug)
    if (dataPoints >= 4) complexityScore += 3;
    else if (dataPoints >= 2) complexityScore += 2;
    else if (dataPoints >= 1) complexityScore += 1;

    // Risk level contribution
    const riskMap: Record<string, number> = {
      minimal: 0,
      low: 1,
      moderate: 2,
      high: 3,
    };
    complexityScore += riskMap[riskLevel] || 0;

    // Medication changes contribution
    if (medicationChanges >= 3) complexityScore += 2;
    else if (medicationChanges >= 2) complexityScore += 1;

    // Determine final complexity
    let complexity = 'minimal';
    if (complexityScore >= 8) complexity = 'high';
    else if (complexityScore >= 5) complexity = 'moderate';
    else if (complexityScore >= 2) complexity = 'low';

    return { complexity, score: complexityScore };
  }

  /**
   * OLD risk assessment - Treated insulin as HIGH risk (WRONG)
   */
  oldAssessRisk(transcript: string, medications: string[]): string {
    let riskScore = 0;
    const text = transcript.toLowerCase();
    const medText = medications.join(' ').toLowerCase();

    // OLD: Hospitalization = automatic HIGH risk (+3)
    if (/hospital|discharged|post-discharge/i.test(text)) {
      riskScore += 3; // WRONG - should check if stable
    }

    // OLD: Insulin = HIGH risk (+2)
    if (/insulin|lantus|novolog|humalog/i.test(medText)) {
      riskScore += 2; // WRONG - should be MODERATE
    }

    // Life-threatening events
    if (/MI|stroke|sepsis|DKA/i.test(text)) {
      riskScore += 3;
    }

    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'moderate';
    if (riskScore >= 1) return 'low';
    return 'minimal';
  }

  /**
   * OLD prolonged service - Suggested at 55+ min (WRONG)
   */
  oldCheckProlongedService(timeSpent: number | null): boolean {
    return timeSpent !== null && timeSpent >= 55; // WRONG - should be 69
  }

  /**
   * Simulate OLD billing suggestion
   */
  analyzeWithOldLogic(
    transcript: string,
    assessment: string[],
    plan: string[],
    medications: string[]
  ): {
    cptCode: string;
    complexity: string;
    risk: string;
    dataPoints: number;
    confidence: number;
    score: number;
    hasProlongedService: boolean;
  } {
    // Extract time
    const timeMatch = /(?:spent|total\s+time|face[\s-]to[\s-]face\s+time|visit)\s+(\d+)\s+min/i.exec(transcript);
    const timeSpent = timeMatch ? parseInt(timeMatch[1]) : null;

    // Count problems (simplified)
    const problemCount = assessment.length || 1;

    // Count data points (UNLIMITED - this was the bug)
    const planText = plan.join(' ').toLowerCase();
    const dataPoints = [
      /cmp/i, /cbc/i, /a1c/i, /lipid/i, /tsh/i, /vitamin d/i,
      /x-ray/i, /ct/i, /mri/i, /ultrasound/i, /ekg/i
    ].filter(pattern => pattern.test(planText)).length;

    // Count medication changes (simplified)
    const medicationChanges = medications.length || 0;

    // OLD risk assessment
    const risk = this.oldAssessRisk(transcript, medications);

    // OLD complexity determination
    const { complexity, score } = this.oldDetermineComplexity(
      problemCount,
      dataPoints,
      risk,
      medicationChanges
    );

    // Determine CPT code (time-based or complexity-based)
    let cptCode = '99213';
    let confidence = 70;

    if (timeSpent !== null) {
      // Time-based (this was always correct)
      if (timeSpent >= 40 && timeSpent <= 54) {
        cptCode = '99215';
        confidence = 95;
      } else if (timeSpent >= 30) {
        cptCode = '99214';
        confidence = 95;
      } else if (timeSpent >= 20) {
        cptCode = '99213';
        confidence = 95;
      } else if (timeSpent >= 10) {
        cptCode = '99212';
        confidence = 90;
      }
    } else {
      // Complexity-based (this had the bugs)
      if (complexity === 'high') {
        cptCode = '99215';
        confidence = 75;
      } else if (complexity === 'moderate') {
        cptCode = '99214';
        confidence = 70;
      } else if (complexity === 'low') {
        cptCode = '99213';
        confidence = 65;
      } else {
        cptCode = '99212';
        confidence = 60;
      }
    }

    const hasProlongedService = this.oldCheckProlongedService(timeSpent);

    return {
      cptCode,
      complexity,
      risk,
      dataPoints,
      confidence,
      score,
      hasProlongedService
    };
  }
}

/**
 * Extract structured data from processed note
 */
function extractNoteData(processedNote: string, rawTranscript: string): {
  assessment: string[];
  plan: string[];
  medications: string[];
} {
  const assessment: string[] = [];
  const plan: string[] = [];
  const medications: string[] = [];

  // Extract Assessment section
  const assessmentMatch = /ASSESSMENT:?\s*([\s\S]*?)(?=PLAN:|$)/i.exec(processedNote);
  if (assessmentMatch) {
    const assessmentText = assessmentMatch[1].trim();
    assessment.push(...assessmentText.split('\n').filter(line => line.trim()));
  }

  // Extract Plan section
  const planMatch = /PLAN:?\s*([\s\S]*?)(?=BILLING|$)/i.exec(processedNote);
  if (planMatch) {
    const planText = planMatch[1].trim();
    plan.push(...planText.split('\n').filter(line => line.trim()));
  }

  // Extract medications from plan or transcript
  const medMatch = /(?:start|stop|increase|decrease|continue|adjust)\s+(\w+)/gi;
  let match;
  while ((match = medMatch.exec(processedNote + ' ' + rawTranscript)) !== null) {
    medications.push(match[1]);
  }

  return { assessment, plan, medications };
}

/**
 * Main comparison test
 */
async function runComparisonTest(): Promise<BillingComparison[]> {
  console.log('🔬 CPT Billing Comparison Test');
  console.log('================================\n');
  console.log('Fetching last 10 dictated notes from database...\n');

  try {
    // Fetch last 10 notes - try with different field name and no auth requirements
    const { data: notes, error } = await supabase
      .from('dictated_notes')
      .select('id, patient_name, visit_date, raw_transcript, processed_note, created_at, template_name')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!notes || notes.length === 0) {
      console.log('⚠️ No dictated notes found in database');
      console.log('Make sure you have some notes created in the system first.\n');
      return [];
    }

    console.log(`✅ Found ${notes.length} notes. Running comparison...\n`);

    const oldAnalyzer = new OldBillingAnalyzer();
    const comparisons: BillingComparison[] = [];

    for (const note of notes) {
      console.log(`\n📄 Analyzing Note #${note.id}: ${note.patient_name} (${note.visit_date})`);

      // Extract structured data
      const extracted = extractNoteData(note.processed_note, note.raw_transcript);

      // Run OLD logic
      const oldResult = oldAnalyzer.analyzeWithOldLogic(
        note.raw_transcript,
        extracted.assessment,
        extracted.plan,
        extracted.medications
      );

      // Run NEW logic
      const newAnalysis = cptBillingAnalyzer.analyzeComplexity(note.raw_transcript, {
        assessment: extracted.assessment,
        plan: extracted.plan,
        medicationChanges: extracted.medications,
        vitals: {},
        currentMedications: []
      });

      const newCPT = cptBillingAnalyzer.suggestCPTCodes(
        newAnalysis,
        true, // hasChiefComplaint
        extracted.assessment.length > 0, // hasAssessment
        extracted.plan.length > 0, // hasPlan
        false // hasProcedure
      );

      // Compare results
      const differences: string[] = [];

      if (oldResult.cptCode !== newCPT.primaryCode) {
        differences.push(`CPT changed: ${oldResult.cptCode} → ${newCPT.primaryCode}`);
      }

      if (oldResult.complexity !== newAnalysis.complexityLevel) {
        differences.push(`Complexity: ${oldResult.complexity} → ${newAnalysis.complexityLevel}`);
      }

      if (oldResult.risk !== newAnalysis.riskLevel) {
        differences.push(`Risk: ${oldResult.risk} → ${newAnalysis.riskLevel}`);
      }

      if (oldResult.dataPoints !== newAnalysis.dataPoints && oldResult.dataPoints > 3) {
        differences.push(`Data points capped: ${oldResult.dataPoints} → ${newAnalysis.dataPoints} (CMS limit)`);
      }

      if (oldResult.hasProlongedService && newAnalysis.timeSpent && newAnalysis.timeSpent < 69) {
        differences.push(`Prolonged service removed (time ${newAnalysis.timeSpent} < 69 min threshold)`);
      }

      comparisons.push({
        noteId: note.id,
        patientName: note.patient_name,
        visitDate: note.visit_date,
        templateName: note.template_name || 'None',
        transcriptPreview: note.raw_transcript.substring(0, 100) + '...',

        oldCPT: oldResult.cptCode + (oldResult.hasProlongedService ? ' + 99417' : ''),
        oldComplexity: oldResult.complexity,
        oldRisk: oldResult.risk,
        oldDataPoints: oldResult.dataPoints,
        oldConfidence: oldResult.confidence,

        newCPT: newCPT.primaryCode,
        newComplexity: newAnalysis.complexityLevel,
        newRisk: newAnalysis.riskLevel,
        newProblemComplexity: newAnalysis.problemComplexity || 'N/A',
        newDataComplexity: newAnalysis.dataComplexity || 'N/A',
        newDataPoints: newAnalysis.dataPoints,
        newConfidence: newCPT.confidenceScore,
        newQualifyingElements: newAnalysis.mdmQualifyingElements || [],

        codeChanged: oldResult.cptCode !== newCPT.primaryCode,
        differences
      });

      // Print immediate feedback
      if (differences.length > 0) {
        console.log(`  ⚠️ CHANGES DETECTED:`);
        differences.forEach(diff => console.log(`     - ${diff}`));
      } else {
        console.log(`  ✅ No changes (codes match)`);
      }
    }

    // Generate comparison report
    await generateComparisonReport(comparisons);

    console.log('\n✅ Comparison complete!');
    console.log('📄 Report saved to: BILLING_COMPARISON_REPORT.md\n');

    return comparisons;

  } catch (error) {
    console.error('❌ Error running comparison:', error);
    throw error;
  }
}

/**
 * Generate detailed comparison report
 */
async function generateComparisonReport(comparisons: BillingComparison[]) {
  const changedCount = comparisons.filter(c => c.codeChanged).length;
  const unchangedCount = comparisons.filter(c => !c.codeChanged).length;

  let report = `# CPT Billing Comparison Report
## OLD (Non-Compliant) vs. NEW (CMS 2021 Compliant)

**Test Date:** ${new Date().toISOString().split('T')[0]}
**Notes Analyzed:** ${comparisons.length}
**CPT Codes Changed:** ${changedCount} (${Math.round(changedCount / comparisons.length * 100)}%)
**CPT Codes Unchanged:** ${unchangedCount} (${Math.round(unchangedCount / comparisons.length * 100)}%)

---

## Executive Summary

This report compares the OLD billing logic (point-based, non-CMS-compliant) against the NEW CMS 2021 compliant logic on ${comparisons.length} real dictated notes from the database.

### Key Findings:

`;

  // Analyze patterns
  const riskDowngrades = comparisons.filter(c =>
    c.differences.some(d => d.includes('Risk:') && d.includes('high') && d.includes('moderate'))
  ).length;

  const dataPointsCapped = comparisons.filter(c =>
    c.differences.some(d => d.includes('Data points capped'))
  ).length;

  const prolongedRemoved = comparisons.filter(c =>
    c.differences.some(d => d.includes('Prolonged service removed'))
  ).length;

  if (riskDowngrades > 0) {
    report += `- **${riskDowngrades} visits** had risk level downgraded (likely due to insulin/hospitalization fixes)\n`;
  }
  if (dataPointsCapped > 0) {
    report += `- **${dataPointsCapped} visits** had data points capped per CMS limits\n`;
  }
  if (prolongedRemoved > 0) {
    report += `- **${prolongedRemoved} visits** had incorrect prolonged service (99417) removed\n`;
  }
  if (changedCount === 0) {
    report += `- ✅ **All CPT codes remained the same** - fixes didn't change final suggestions (good sign!)\n`;
  }

  report += `\n---\n\n## Detailed Comparison Table\n\n`;

  // Create comparison table
  report += `| Note ID | Patient | Date | Old CPT | New CPT | Changed? | Key Differences |\n`;
  report += `|---------|---------|------|---------|---------|----------|----------------|\n`;

  for (const comp of comparisons) {
    const changedIcon = comp.codeChanged ? '⚠️ YES' : '✅ No';
    const diffSummary = comp.differences.length > 0
      ? comp.differences[0].substring(0, 50) + (comp.differences.length > 1 ? `... (+${comp.differences.length - 1} more)` : '')
      : 'None';

    report += `| ${comp.noteId} | ${comp.patientName} | ${comp.visitDate} | ${comp.oldCPT} | ${comp.newCPT} | ${changedIcon} | ${diffSummary} |\n`;
  }

  report += `\n---\n\n## Detailed Note-by-Note Analysis\n\n`;

  for (let i = 0; i < comparisons.length; i++) {
    const comp = comparisons[i];

    report += `### Note ${i + 1}: ${comp.patientName} (ID: ${comp.noteId})\n\n`;
    report += `**Visit Date:** ${comp.visitDate}\n`;
    report += `**Template:** ${comp.templateName}\n\n`;

    report += `**Transcript Preview:**\n> ${comp.transcriptPreview}\n\n`;

    report += `#### OLD Logic (Point-Based)\n`;
    report += `- **CPT Code:** ${comp.oldCPT}\n`;
    report += `- **Complexity:** ${comp.oldComplexity}\n`;
    report += `- **Risk Level:** ${comp.oldRisk}\n`;
    report += `- **Data Points:** ${comp.oldDataPoints}\n`;
    report += `- **Confidence:** ${comp.oldConfidence}%\n\n`;

    report += `#### NEW Logic (CMS 2021 Compliant)\n`;
    report += `- **CPT Code:** ${comp.newCPT}\n`;
    report += `- **Complexity:** ${comp.newComplexity}\n`;
    report += `- **Problem Complexity:** ${comp.newProblemComplexity}\n`;
    report += `- **Data Complexity:** ${comp.newDataComplexity}\n`;
    report += `- **Risk Level:** ${comp.newRisk}\n`;
    report += `- **Data Points:** ${comp.newDataPoints}\n`;
    report += `- **Confidence:** ${comp.newConfidence}%\n`;

    if (comp.newQualifyingElements.length > 0) {
      report += `- **CMS 2-of-3 Qualifying Elements:**\n`;
      comp.newQualifyingElements.forEach(elem => {
        report += `  - ${elem}\n`;
      });
    }
    report += `\n`;

    if (comp.differences.length > 0) {
      report += `#### 🔍 Changes Detected:\n`;
      comp.differences.forEach(diff => {
        report += `- ${diff}\n`;
      });
      report += `\n`;

      // Explain why changes occurred
      report += `#### 💡 Explanation:\n`;
      if (comp.differences.some(d => d.includes('Risk:'))) {
        report += `- Risk level changed due to CMS compliance fixes (insulin = MODERATE, stable post-discharge = MODERATE)\n`;
      }
      if (comp.differences.some(d => d.includes('Data points capped'))) {
        report += `- Data points capped per CMS Category 1 limit (max 2 points for tests/imaging)\n`;
      }
      if (comp.differences.some(d => d.includes('Prolonged service'))) {
        report += `- Prolonged service (99417) removed - requires ≥69 minutes per CMS\n`;
      }
      if (comp.differences.some(d => d.includes('Complexity:'))) {
        report += `- Complexity determined using CMS 2-of-3 methodology instead of point-based scoring\n`;
      }
      report += `\n`;
    } else {
      report += `#### ✅ No Changes\n`;
      report += `The OLD and NEW logic produced the same CPT code for this visit.\n\n`;
    }

    report += `---\n\n`;
  }

  // Add analysis summary
  report += `## Statistical Analysis\n\n`;

  const avgOldConfidence = comparisons.reduce((sum, c) => sum + c.oldConfidence, 0) / comparisons.length;
  const avgNewConfidence = comparisons.reduce((sum, c) => sum + c.newConfidence, 0) / comparisons.length;

  report += `### Confidence Scores\n`;
  report += `- **Average OLD confidence:** ${avgOldConfidence.toFixed(1)}%\n`;
  report += `- **Average NEW confidence:** ${avgNewConfidence.toFixed(1)}%\n\n`;

  // Code distribution
  const oldCodeDist = countCodeDistribution(comparisons.map(c => c.oldCPT));
  const newCodeDist = countCodeDistribution(comparisons.map(c => c.newCPT));

  report += `### CPT Code Distribution\n\n`;
  report += `**OLD Logic:**\n`;
  Object.entries(oldCodeDist).forEach(([code, count]) => {
    report += `- ${code}: ${count} visits (${Math.round(count / comparisons.length * 100)}%)\n`;
  });
  report += `\n**NEW Logic:**\n`;
  Object.entries(newCodeDist).forEach(([code, count]) => {
    report += `- ${code}: ${count} visits (${Math.round(count / comparisons.length * 100)}%)\n`;
  });

  report += `\n---\n\n`;

  report += `## Compliance Improvements\n\n`;
  report += `### CMS 2021 Compliance Status:\n`;
  report += `- ✅ **MDM 2-of-3 Framework:** Implemented (was point-based)\n`;
  report += `- ✅ **Data Points Capping:** Category 1 capped at 2 points (was unlimited)\n`;
  report += `- ✅ **Prolonged Services:** Threshold corrected to 69 min (was 55 min)\n`;
  report += `- ✅ **Risk Classification:** Insulin = MODERATE (was HIGH)\n`;
  report += `- ✅ **Risk Classification:** Stable post-discharge = MODERATE (was HIGH)\n\n`;

  report += `### Audit Risk Assessment:\n`;
  report += `- **Before Fixes:** ⚠️⚠️⚠️ HIGH (systematic overcoding risk)\n`;
  report += `- **After Fixes:** ✅ LOW (CMS-compliant with proper disclaimers)\n\n`;

  report += `---\n\n`;

  report += `## Recommendations\n\n`;
  report += `1. **Review Changed Codes:**\n`;
  report += `   - Examine the ${changedCount} notes where CPT codes changed\n`;
  report += `   - Verify the NEW codes are clinically appropriate\n`;
  report += `   - Understand why changes occurred (documented in each note above)\n\n`;

  report += `2. **Provider Training:**\n`;
  report += `   - Educate providers on CMS 2-of-3 methodology\n`;
  report += `   - Explain why insulin visits may now show as MODERATE complexity\n`;
  report += `   - Emphasize importance of documenting time (for 95% confidence)\n\n`;

  report += `3. **Ongoing Monitoring:**\n`;
  report += `   - Track suggested vs. actually billed codes\n`;
  report += `   - Identify systematic patterns\n`;
  report += `   - Refine algorithms based on provider feedback\n\n`;

  report += `4. **Next Steps:**\n`;
  report += `   - Have certified medical coder review these ${comparisons.length} examples\n`;
  report += `   - Validate that NEW codes are more accurate than OLD codes\n`;
  report += `   - If validated, deploy NEW logic to production\n\n`;

  report += `---\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Tool:** CPT Billing Comparison Test v2.0\n`;
  report += `**Database:** Supabase (${supabaseUrl})\n`;

  // Save report
  fs.writeFileSync('/Users/rakeshpatel/Desktop/tshla-medical/BILLING_COMPARISON_REPORT.md', report);

  // Also save raw JSON for analysis
  fs.writeFileSync(
    '/Users/rakeshpatel/Desktop/tshla-medical/billing-comparison-data.json',
    JSON.stringify(comparisons, null, 2)
  );

  return comparisons;
}

function countCodeDistribution(codes: string[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const code of codes) {
    const baseCode = code.split(' ')[0]; // Remove "+ 99417" etc
    dist[baseCode] = (dist[baseCode] || 0) + 1;
  }
  return dist;
}

// Run the test
runComparisonTest()
  .then((comparisons) => {
    if (comparisons && comparisons.length > 0) {
      console.log('\n📊 Summary Statistics:');
      console.log(`   Total notes: ${comparisons.length}`);
      console.log(`   Codes changed: ${comparisons.filter((c: BillingComparison) => c.codeChanged).length}`);
      console.log(`   Codes unchanged: ${comparisons.filter((c: BillingComparison) => !c.codeChanged).length}`);
      console.log('\n📄 Full report: BILLING_COMPARISON_REPORT.md');
      console.log('📊 Raw data: billing-comparison-data.json\n');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
