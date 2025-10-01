import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Download,
  Share2,
  FileText,
  Mail,
  Calendar,
  User,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface VisitNote {
  id: string;
  patientName: string;
  patientDOB: string;
  patientMRN: string;
  visitDate: string;
  visitType: string;
  provider: string;
  processedNote: string;
  rawTranscript?: string;
  template?: string;
  vitals?: {
    bp: string;
    pulse: string;
    temp: string;
    resp: string;
    o2sat: string;
    weight: string;
    height: string;
  };
  medications?: string[];
  allergies?: string[];
  diagnoses?: string[];
  followUp?: string;
}

export default function PrintNotePage() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<VisitNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [printFormat, setPrintFormat] = useState('full');
  const [includeLetterhead, setIncludeLetterhead] = useState(true);
  const [fontSize, setFontSize] = useState('normal');

  useEffect(() => {
    fetchVisitNote();
  }, [visitId]);

  const fetchVisitNote = async () => {
    // Try to get the saved visit data from localStorage
    const savedVisit = localStorage.getItem('last-visit-data');
    const patientData = localStorage.getItem('last-patient-data');

    if (savedVisit) {
      try {
        const visitData = JSON.parse(savedVisit);
        const patient = patientData ? JSON.parse(patientData) : null;

        // Create note object from saved data
        const realNote: VisitNote = {
          id: visitId || '1',
          patientName: patient?.name || visitData.patientName || 'Patient Name',
          patientDOB: patient?.dob || '1980-01-01',
          patientMRN: patient?.mrn || visitData.patientMRN || 'MRN001',
          visitDate: visitData.visitDate || new Date().toISOString(),
          visitType: visitData.visitType || 'Clinical Visit',
          provider: localStorage.getItem('doctor_name') || 'Dr. Provider',
          processedNote: visitData.processedNote || visitData.note || '',
          rawTranscript: visitData.transcript || '',
          template: visitData.template || '',
          medications:
            patient?.medications?.map((m: any) => `${m.name} ${m.dosage} - ${m.frequency}`) || [],
          allergies: patient?.allergies || [],
          diagnoses: patient?.diagnosis || [],
          vitals: patient?.vitalSigns || {
            bp: '120/80',
            pulse: '72',
            temp: '98.6°F',
            resp: '16',
            o2sat: '98%',
            weight: '150 lbs',
            height: '5\'8"',
          },
          followUp: visitData.followUp || 'As needed',
        };

        setNote(realNote);
        setLoading(false);
      } catch (error) {
        logError('PrintNotePage', 'Error message', {});
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // In production, generate actual PDF
    alert('PDF download functionality would be implemented here');
  };

  const handleEmail = () => {
    // In production, open email dialog
    alert('Email functionality would be implemented here');
  };

  const handleFax = () => {
    // In production, open fax dialog
    alert('Fax functionality would be implemented here');
  };

  // Parse sections from processed note
  const parseSections = (noteText: string) => {
    const sections: { [key: string]: string } = {};
    const sectionRegex = /^([A-Z\s]+):$/gm;
    const lines = noteText.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    lines.forEach(line => {
      const sectionMatch = line.match(/^([A-Z\s]+):$/);
      if (sectionMatch) {
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        currentSection = sectionMatch[1];
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    });

    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">No note data found</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          Go Back
        </button>
      </div>
    );
  }

  const sections = parseSections(note.processedNote);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Add print styles */}
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 0.75in;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
          
          .print\\:break-after-page {
            page-break-after: always;
          }
          
          .print\\:font-serif {
            font-family: 'Times New Roman', Times, serif !important;
          }
          
          .text-${fontSize} {
            ${
              fontSize === 'small'
                ? 'font-size: 11pt !important;'
                : fontSize === 'large'
                  ? 'font-size: 14pt !important;'
                  : 'font-size: 12pt !important;'
            }
          }
        }
      `}</style>

      {/* Control Panel - Hidden in print */}
      <div className="print:hidden bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Print Clinical Note</h1>
            </div>
            <div className="flex gap-3 items-center">
              <select
                value={fontSize}
                onChange={e => setFontSize(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="small">Small Text</option>
                <option value="normal">Normal Text</option>
                <option value="large">Large Text</option>
              </select>

              <select
                value={printFormat}
                onChange={e => setPrintFormat(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="full">Full Note</option>
                <option value="summary">Summary Only</option>
                <option value="patient">Patient Copy</option>
              </select>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeLetterhead}
                  onChange={e => setIncludeLetterhead(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Letterhead</span>
              </label>

              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Printer className="h-5 w-5" />
                Print
              </button>

              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download className="h-5 w-5" />
                PDF
              </button>

              <button
                onClick={handleEmail}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Mail className="h-5 w-5" />
                Email
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Content */}
      <div
        className={`max-w-4xl mx-auto p-8 bg-white print:p-0 print:max-w-full text-${fontSize}`}
        ref={printRef}
      >
        <div className="print:font-serif">
          {/* Letterhead */}
          {includeLetterhead && (
            <div className="mb-8 pb-6 border-b-2 border-blue-600 print:mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-blue-700 mb-2">TSHLA Medical Center</h1>
                  <p className="text-gray-700 font-medium">Excellence in Healthcare</p>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>123 Medical Plaza, Suite 100</p>
                    <p>San Francisco, CA 94105</p>
                    <p>Phone: (415) 555-0100 | Fax: (415) 555-0101</p>
                  </div>
                </div>
                <div className="text-right">
                  <img src="/logo.png" alt="TSHLA" className="h-16 w-auto mb-2" />
                  <p className="text-xs text-gray-500">NPI: 1234567890</p>
                  <p className="text-xs text-gray-500">Tax ID: 12-3456789</p>
                </div>
              </div>
            </div>
          )}

          {/* Patient Header */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg print:bg-gray-50 print:border print:border-gray-300">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="font-bold text-lg mb-2 text-blue-900">Patient Information</h2>
                <p className="font-semibold text-gray-800">Name: {note.patientName}</p>
                <p className="text-gray-700">
                  DOB: {new Date(note.patientDOB).toLocaleDateString()}
                </p>
                <p className="text-gray-700">MRN: {note.patientMRN}</p>
              </div>
              <div className="text-right">
                <h2 className="font-bold text-lg mb-2 text-blue-900">Visit Details</h2>
                <p className="font-semibold text-gray-800">
                  Date: {new Date(note.visitDate).toLocaleDateString()}
                </p>
                <p className="text-gray-700">Type: {note.visitType}</p>
                <p className="text-gray-700">Provider: {note.provider}</p>
              </div>
            </div>
          </div>

          {/* Allergies Alert */}
          {note.allergies && note.allergies.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg print:border-red-500">
              <p className="font-bold text-red-800 text-lg">
                ⚠️ ALLERGIES: {note.allergies.join(', ')}
              </p>
            </div>
          )}

          {/* Vital Signs */}
          {note.vitals && printFormat === 'full' && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg print:border print:border-gray-300">
              <h2 className="text-lg font-bold mb-3 text-gray-900 border-b pb-2">VITAL SIGNS</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="font-semibold">BP:</span> {note.vitals.bp}
                </div>
                <div>
                  <span className="font-semibold">Pulse:</span> {note.vitals.pulse}
                </div>
                <div>
                  <span className="font-semibold">Temp:</span> {note.vitals.temp}
                </div>
                <div>
                  <span className="font-semibold">Resp:</span> {note.vitals.resp}
                </div>
                <div>
                  <span className="font-semibold">O2 Sat:</span> {note.vitals.o2sat}
                </div>
                <div>
                  <span className="font-semibold">Weight:</span> {note.vitals.weight}
                </div>
              </div>
            </div>
          )}

          {/* Processed Note Content */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 border-b-2 border-blue-600 pb-2">
              CLINICAL NOTE
            </h2>

            {/* If we have parsed sections, display them formatted */}
            {Object.keys(sections).length > 0 ? (
              Object.entries(sections).map(([sectionTitle, content]) => (
                <div key={sectionTitle} className="mb-6">
                  <h3 className="text-lg font-bold mb-2 text-blue-800">{sectionTitle}</h3>
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap pl-4">
                    {content}
                  </div>
                </div>
              ))
            ) : (
              /* Otherwise display the full processed note */
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {note.processedNote}
              </div>
            )}
          </div>

          {/* Current Medications */}
          {note.medications && note.medications.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg print:border print:border-gray-300">
              <h2 className="text-lg font-bold mb-3 text-gray-900 border-b pb-2">
                CURRENT MEDICATIONS
              </h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {note.medications.map((med, index) => (
                  <li key={index} className="ml-2">
                    {med}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Diagnoses */}
          {note.diagnoses && note.diagnoses.length > 0 && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg print:border print:border-gray-300">
              <h2 className="text-lg font-bold mb-3 text-gray-900 border-b pb-2">DIAGNOSES</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {note.diagnoses.map((dx, index) => (
                  <li key={index} className="ml-2">
                    {dx}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Follow-up */}
          {note.followUp && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg print:border print:border-gray-300">
              <h2 className="text-lg font-bold mb-2 text-gray-900">FOLLOW-UP</h2>
              <p className="text-gray-700">{note.followUp}</p>
            </div>
          )}

          {/* Raw Transcript (if requested) */}
          {printFormat === 'full' && note.rawTranscript && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg print:border print:border-gray-300 print:break-after-page">
              <h2 className="text-lg font-bold mb-3 text-gray-900 border-b pb-2">
                ORIGINAL TRANSCRIPT
              </h2>
              <p className="text-gray-600 text-sm italic whitespace-pre-wrap">
                {note.rawTranscript}
              </p>
            </div>
          )}

          {/* Signature Section */}
          <div className="mt-12 pt-6 border-t-2 border-gray-400">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="mb-8">
                  <p className="text-sm text-gray-600 mb-1">Provider Signature</p>
                  <div className="border-b-2 border-gray-400 h-16 mb-2"></div>
                  <p className="font-semibold">{note.provider}</p>
                  <p className="text-sm text-gray-600">License #: CA123456</p>
                  <p className="text-sm text-gray-600">Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <div className="mb-8">
                  <p className="text-sm text-gray-600 mb-1">Patient Acknowledgment</p>
                  <div className="border-b-2 border-gray-400 h-16 mb-2"></div>
                  <p className="text-sm text-gray-600">Patient/Guardian Signature</p>
                  <p className="text-sm text-gray-600">Date: _______________</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-center print:mt-4">
            <p className="text-xs text-gray-500 mb-1">
              This document contains confidential medical information protected under HIPAA.
            </p>
            <p className="text-xs text-gray-500 mb-1">
              Unauthorized disclosure is prohibited by law.
            </p>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>Generated: {new Date().toLocaleString()}</span>
              <span>
                Document ID: {note.id}-{Date.now()}
              </span>
              <span>Page 1 of 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
