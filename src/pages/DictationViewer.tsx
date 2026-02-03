import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Calendar, User, Clock, FileText, Printer, Download } from 'lucide-react';
import { formatDOB } from '../utils/date';

interface DictationData {
  id: string;
  patient_name: string;
  patient_mrn: string;
  patient_dob: string;
  visit_date: string;
  visit_type: string;
  transcription_text: string;
  final_note: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
  signed_at: string;
  diagnosis_codes: string[];
  procedure_codes: string[];
  medications_prescribed: any;
  orders_placed: any;
}

export default function DictationViewer() {
  const { dictationId } = useParams<{ dictationId: string }>();
  const navigate = useNavigate();
  const [dictation, setDictation] = useState<DictationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (dictationId) {
      loadDictation();
    }
  }, [dictationId]);

  const loadDictation = async () => {
    try {
      console.log('🔍 [DictationViewer] Loading dictation ID:', dictationId);

      const { data, error } = await supabase
        .from('dictated_notes')
        .select('*')
        .eq('id', dictationId)
        .single();

      console.log('📋 [DictationViewer] Query result:', { data, error });

      if (error) throw error;

      // Check if this dictation was soft-deleted
      if (data.deleted_at !== null && data.deleted_at !== undefined) {
        console.error('❌ [DictationViewer] This dictation was deleted at:', data.deleted_at);
        throw new Error('This dictation has been deleted');
      }

      // Map dictated_notes fields to DictationData interface
      const mappedData = {
        id: String(data.id),
        patient_name: data.patient_name,
        patient_mrn: data.patient_mrn || '',
        patient_dob: data.patient_dob || '',
        visit_date: data.visit_date || data.created_at,
        visit_type: data.visit_type || 'General Visit',
        transcription_text: data.raw_transcript || '',
        final_note: data.processed_note || '',
        status: data.status || 'completed',
        created_at: data.created_at,
        updated_at: data.updated_at || data.created_at,
        completed_at: data.completed_at || '',
        signed_at: data.signed_at || '',
        diagnosis_codes: data.diagnosis_codes || [],
        procedure_codes: data.procedure_codes || [],
        medications_prescribed: data.medications_prescribed || null,
        orders_placed: data.orders_placed || null
      };

      console.log('✅ [DictationViewer] Mapped data:', mappedData);
      setDictation(mappedData);
    } catch (error) {
      console.error('❌ [DictationViewer] Error loading dictation:', error);
      alert('Failed to load dictation');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!dictation) return;

    const content = `
PATIENT MEDICAL NOTE
====================

Patient: ${dictation.patient_name}
MRN: ${dictation.patient_mrn}
DOB: ${dictation.patient_dob ? formatDOB(dictation.patient_dob) : 'N/A'}
Visit Date: ${dictation.visit_date ? new Date(dictation.visit_date).toLocaleDateString() : 'N/A'}
Visit Type: ${dictation.visit_type || 'N/A'}
Status: ${dictation.status}

CLINICAL NOTE:
${dictation.final_note || dictation.transcription_text || 'No content'}

${dictation.diagnosis_codes && dictation.diagnosis_codes.length > 0 ? `
DIAGNOSIS CODES:
${dictation.diagnosis_codes.join(', ')}
` : ''}

${dictation.procedure_codes && dictation.procedure_codes.length > 0 ? `
PROCEDURE CODES:
${dictation.procedure_codes.join(', ')}
` : ''}

Created: ${new Date(dictation.created_at).toLocaleString()}
${dictation.completed_at ? `Completed: ${new Date(dictation.completed_at).toLocaleString()}` : ''}
${dictation.signed_at ? `Signed: ${new Date(dictation.signed_at).toLocaleString()}` : ''}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `note-${dictation.patient_name?.replace(/\s+/g, '-')}-${new Date(dictation.visit_date).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dictation...</p>
        </div>
      </div>
    );
  }

  if (!dictation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dictation Not Found</h2>
          <button
            onClick={() => navigate('/dictation-history')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      signed: 'bg-blue-100 text-blue-800'
    };
    return colors[status as keyof typeof colors] || colors.draft;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Hidden on print */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/dictation-history')}
            className="text-blue-100 hover:text-white mb-2 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to History
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Medical Note</h1>
              <p className="text-blue-100 mt-1">{dictation.patient_name}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 print:px-8">
        {/* Patient Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Patient Information</h2>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(dictation.status)}`}>
              {dictation.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600 flex items-center gap-1">
                <User className="w-4 h-4" />
                Patient
              </div>
              <div className="font-semibold text-gray-900">{dictation.patient_name || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">MRN</div>
              <div className="font-mono font-semibold text-gray-900">{dictation.patient_mrn || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">DOB</div>
              <div className="font-semibold text-gray-900">
                {dictation.patient_dob ? formatDOB(dictation.patient_dob) : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Visit Date
              </div>
              <div className="font-semibold text-gray-900">
                {dictation.visit_date ? new Date(dictation.visit_date).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Visit Type</div>
              <div className="font-semibold text-gray-900">{dictation.visit_type || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Created
              </div>
              <div className="font-semibold text-gray-900">
                {new Date(dictation.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Note */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Clinical Note
          </h2>
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
              {dictation.final_note || dictation.transcription_text || 'No content'}
            </div>
          </div>
        </div>

        {/* Codes and Orders */}
        {(dictation.diagnosis_codes?.length > 0 || dictation.procedure_codes?.length > 0) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Billing Codes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dictation.diagnosis_codes && dictation.diagnosis_codes.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Diagnosis Codes</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {dictation.diagnosis_codes.map((code, idx) => (
                      <li key={idx} className="text-gray-700">{code}</li>
                    ))}
                  </ul>
                </div>
              )}
              {dictation.procedure_codes && dictation.procedure_codes.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Procedure Codes</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {dictation.procedure_codes.map((code, idx) => (
                      <li key={idx} className="text-gray-700">{code}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-600">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="font-semibold">Created:</span> {new Date(dictation.created_at).toLocaleString()}
            </div>
            {dictation.completed_at && (
              <div>
                <span className="font-semibold">Completed:</span> {new Date(dictation.completed_at).toLocaleString()}
              </div>
            )}
            {dictation.signed_at && (
              <div>
                <span className="font-semibold">Signed:</span> {new Date(dictation.signed_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
