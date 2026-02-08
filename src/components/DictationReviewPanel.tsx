/**
 * Dictation Review Panel
 *
 * Displays extracted clinical data for review during micro-dictation.
 * Allows toggling approval for individual items and inline editing.
 */

import { useState } from 'react';
import {
  Pill, TestTube, Thermometer, Stethoscope, AlertTriangle,
  Check, X, ChevronDown, ChevronUp, Edit2, CheckCircle2
} from 'lucide-react';
import type { ExtractionResult } from './MicroDictation';

interface DictationReviewPanelProps {
  extraction: ExtractionResult;
  onItemApprovalChange: (
    type: 'medications' | 'labs' | 'vitals' | 'conditions' | 'allergies',
    id: string,
    approved: boolean
  ) => void;
  onApproveAll?: () => void;
  readOnly?: boolean;
}

export default function DictationReviewPanel({
  extraction,
  onItemApprovalChange,
  onApproveAll,
  readOnly = false
}: DictationReviewPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    medications: true,
    labs: true,
    vitals: true,
    conditions: true,
    allergies: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Get completeness badge color
  const getCompletenessBadgeColor = (completeness: number) => {
    if (completeness >= 100) return 'bg-green-100 text-green-700';
    if (completeness >= 67) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  // Count approved items
  const countApproved = () => {
    return (
      extraction.medications.filter(m => m.approved).length +
      extraction.labs.filter(l => l.approved).length +
      extraction.vitals.filter(v => v.approved).length +
      extraction.conditions.filter(c => c.approved).length +
      extraction.allergies.filter(a => a.approved).length
    );
  };

  const totalItems =
    extraction.medications.length +
    extraction.labs.length +
    extraction.vitals.length +
    extraction.conditions.length +
    extraction.allergies.length;

  const approvedCount = countApproved();

  if (totalItems === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No clinical data extracted from this segment.</p>
        <p className="text-sm mt-1">Try speaking more clearly or including specific values.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            {approvedCount} of {totalItems} items selected
          </span>
          <span className={`px-2 py-0.5 rounded ${getCompletenessBadgeColor(extraction.overallCompleteness)}`}>
            {extraction.overallCompleteness}% complete
          </span>
        </div>
        {!readOnly && onApproveAll && (
          <button
            onClick={onApproveAll}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
          >
            <CheckCircle2 className="w-4 h-4" />
            Select All
          </button>
        )}
      </div>

      {/* Medications Section */}
      {extraction.medications.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('medications')}
            className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-900">
                Medications ({extraction.medications.length})
              </span>
              <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                {extraction.medications.filter(m => m.approved).length} selected
              </span>
            </div>
            {expandedSections.medications ? (
              <ChevronUp className="w-5 h-5 text-purple-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-purple-600" />
            )}
          </button>

          {expandedSections.medications && (
            <div className="divide-y">
              {extraction.medications.map(med => (
                <div
                  key={med.id}
                  className={`p-3 flex items-start gap-3 transition-colors ${
                    med.approved ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  {/* Approval Toggle */}
                  {!readOnly && (
                    <button
                      onClick={() => onItemApprovalChange('medications', med.id, !med.approved)}
                      className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        med.approved
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {med.approved && <Check className="w-3 h-3" />}
                    </button>
                  )}

                  {/* Medication Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{med.name}</span>
                      {med.status === 'discontinued' && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                          Discontinued
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-2">
                      {med.dosage && <span className="bg-gray-100 px-2 py-0.5 rounded">{med.dosage}</span>}
                      {med.frequency && <span className="bg-gray-100 px-2 py-0.5 rounded">{med.frequency}</span>}
                      {med.route && <span className="bg-gray-100 px-2 py-0.5 rounded">{med.route}</span>}
                    </div>
                    {med.indication && (
                      <p className="text-xs text-gray-500 mt-1">for {med.indication}</p>
                    )}
                    {med.missingFields && med.missingFields.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="text-xs">Missing: {med.missingFields.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Completeness Badge */}
                  <div className={`text-xs px-2 py-1 rounded ${getCompletenessBadgeColor(med.completeness)}`}>
                    {med.completeness}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Labs Section */}
      {extraction.labs.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('labs')}
            className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TestTube className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                Labs ({extraction.labs.length})
              </span>
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                {extraction.labs.filter(l => l.approved).length} selected
              </span>
            </div>
            {expandedSections.labs ? (
              <ChevronUp className="w-5 h-5 text-blue-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-blue-600" />
            )}
          </button>

          {expandedSections.labs && (
            <div className="divide-y">
              {extraction.labs.map(lab => (
                <div
                  key={lab.id}
                  className={`p-3 flex items-start gap-3 transition-colors ${
                    lab.approved ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  {/* Approval Toggle */}
                  {!readOnly && (
                    <button
                      onClick={() => onItemApprovalChange('labs', lab.id, !lab.approved)}
                      className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        lab.approved
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {lab.approved && <Check className="w-3 h-3" />}
                    </button>
                  )}

                  {/* Lab Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{lab.test_name}</span>
                      <span className="text-lg font-semibold text-blue-700">{lab.value}</span>
                      {lab.unit && <span className="text-sm text-gray-500">{lab.unit}</span>}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {lab.date && (
                        <span className="flex items-center gap-1">
                          Date: {lab.date}
                          {lab.date_inferred && (
                            <span className="text-xs text-amber-600">(inferred)</span>
                          )}
                        </span>
                      )}
                    </div>
                    {lab.loinc_code && (
                      <p className="text-xs text-gray-400 mt-1">LOINC: {lab.loinc_code}</p>
                    )}
                    {lab.missingFields && lab.missingFields.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="text-xs">Missing: {lab.missingFields.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Completeness Badge */}
                  <div className={`text-xs px-2 py-1 rounded ${getCompletenessBadgeColor(lab.completeness)}`}>
                    {lab.completeness}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vitals Section */}
      {extraction.vitals.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('vitals')}
            className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-900">
                Vitals ({extraction.vitals.length})
              </span>
              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                {extraction.vitals.filter(v => v.approved).length} selected
              </span>
            </div>
            {expandedSections.vitals ? (
              <ChevronUp className="w-5 h-5 text-green-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-green-600" />
            )}
          </button>

          {expandedSections.vitals && (
            <div className="divide-y">
              {extraction.vitals.map(vital => (
                <div
                  key={vital.id}
                  className={`p-3 flex items-start gap-3 transition-colors ${
                    vital.approved ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  {/* Approval Toggle */}
                  {!readOnly && (
                    <button
                      onClick={() => onItemApprovalChange('vitals', vital.id, !vital.approved)}
                      className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        vital.approved
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {vital.approved && <Check className="w-3 h-3" />}
                    </button>
                  )}

                  {/* Vital Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{vital.type}</span>
                      <span className="text-lg font-semibold text-green-700">
                        {vital.systolic !== undefined
                          ? `${vital.systolic}/${vital.diastolic}`
                          : vital.value}
                      </span>
                      {vital.unit && <span className="text-sm text-gray-500">{vital.unit}</span>}
                    </div>
                    {vital.date && (
                      <p className="text-sm text-gray-500 mt-1">Recorded: {vital.date}</p>
                    )}
                  </div>

                  {/* Completeness Badge */}
                  <div className={`text-xs px-2 py-1 rounded ${getCompletenessBadgeColor(vital.completeness)}`}>
                    {vital.completeness}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conditions Section */}
      {extraction.conditions.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('conditions')}
            className="w-full flex items-center justify-between p-3 bg-rose-50 hover:bg-rose-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-rose-600" />
              <span className="font-medium text-rose-900">
                Conditions ({extraction.conditions.length})
              </span>
              <span className="text-xs text-rose-600 bg-rose-100 px-2 py-0.5 rounded">
                {extraction.conditions.filter(c => c.approved).length} selected
              </span>
            </div>
            {expandedSections.conditions ? (
              <ChevronUp className="w-5 h-5 text-rose-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-rose-600" />
            )}
          </button>

          {expandedSections.conditions && (
            <div className="divide-y">
              {extraction.conditions.map(condition => (
                <div
                  key={condition.id}
                  className={`p-3 flex items-start gap-3 transition-colors ${
                    condition.approved ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  {/* Approval Toggle */}
                  {!readOnly && (
                    <button
                      onClick={() => onItemApprovalChange('conditions', condition.id, !condition.approved)}
                      className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        condition.approved
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {condition.approved && <Check className="w-3 h-3" />}
                    </button>
                  )}

                  {/* Condition Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{condition.condition}</span>
                      {condition.status && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          condition.status === 'active' ? 'bg-red-100 text-red-700' :
                          condition.status === 'resolved' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {condition.status}
                        </span>
                      )}
                    </div>
                    {condition.icd10 && (
                      <p className="text-xs text-gray-400 mt-1">ICD-10: {condition.icd10}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Allergies Section */}
      {extraction.allergies.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('allergies')}
            className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-orange-900">
                Allergies ({extraction.allergies.length})
              </span>
              <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                {extraction.allergies.filter(a => a.approved).length} selected
              </span>
            </div>
            {expandedSections.allergies ? (
              <ChevronUp className="w-5 h-5 text-orange-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-orange-600" />
            )}
          </button>

          {expandedSections.allergies && (
            <div className="divide-y">
              {extraction.allergies.map(allergy => (
                <div
                  key={allergy.id}
                  className={`p-3 flex items-start gap-3 transition-colors ${
                    allergy.approved ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  {/* Approval Toggle */}
                  {!readOnly && (
                    <button
                      onClick={() => onItemApprovalChange('allergies', allergy.id, !allergy.approved)}
                      className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        allergy.approved
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {allergy.approved && <Check className="w-3 h-3" />}
                    </button>
                  )}

                  {/* Allergy Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{allergy.allergen}</span>
                      {allergy.severity && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          allergy.severity === 'severe' ? 'bg-red-100 text-red-700' :
                          allergy.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {allergy.severity}
                        </span>
                      )}
                    </div>
                    {allergy.reaction && (
                      <p className="text-sm text-gray-600 mt-1">Reaction: {allergy.reaction}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
