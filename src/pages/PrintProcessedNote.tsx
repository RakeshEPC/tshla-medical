import React, { useState, useEffect } from 'react';
import { Printer, Download, Mail, ArrowLeft } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

export default function PrintProcessedNote() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const [noteContent, setNoteContent] = useState('');
  const [visitData, setVisitData] = useState<any>(null);
  const [includeLetterhead, setIncludeLetterhead] = useState(true);

  useEffect(() => {
    // Get the saved visit data
    const lastVisitId = visitId || localStorage.getItem('last-visit');
    if (lastVisitId) {
      const saved = localStorage.getItem(lastVisitId);
      if (saved) {
        const data = JSON.parse(saved);
        setVisitData(data);
        setNoteContent(data.note || '');
      }
    }
  }, [visitId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // Create a blob from the content
    const blob = new Blob([noteContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical-note-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent('Clinical Note');
    const body = encodeURIComponent(noteContent);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  if (!noteContent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No processed note found</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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

            <div className="flex gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeLetterhead}
                  onChange={e => setIncludeLetterhead(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Include Letterhead</span>
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
                Download
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
      <div className="max-w-4xl mx-auto p-8 bg-white print:p-0">
        {/* Letterhead */}
        {includeLetterhead && (
          <div className="mb-8 pb-4 border-b-2 border-gray-300 print:mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-blue-600">TSHLA Medical Center</h1>
                <p className="text-gray-600">123 Medical Plaza, Suite 100</p>
                <p className="text-gray-600">San Francisco, CA 94105</p>
                <p className="text-gray-600">Phone: (415) 555-0100 | Fax: (415) 555-0101</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">NPI: 1234567890</p>
                <p className="text-sm text-gray-500">Tax ID: 12-3456789</p>
              </div>
            </div>
          </div>
        )}

        {/* Note Content */}
        <div className="prose max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
            {noteContent}
          </pre>
        </div>

        {/* Signature Section */}
        <div className="mt-12 pt-6 border-t border-gray-300 print:mt-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="mb-8">
                <p className="text-sm text-gray-600 mb-1">Provider Signature</p>
                <div className="border-b border-gray-400 h-12"></div>
                <p className="text-sm mt-1">Dr. _____________________</p>
                <p className="text-sm text-gray-600">Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <div>
              <div className="mb-8">
                <p className="text-sm text-gray-600 mb-1">Reviewed By</p>
                <div className="border-b border-gray-400 h-12"></div>
                <p className="text-sm mt-1">_____________________</p>
                <p className="text-sm text-gray-600">Date: _____________________</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500 print:mt-4">
          <p>This document contains confidential medical information protected under HIPAA.</p>
          <p>Generated on {new Date().toLocaleString()}</p>
          {visitData && (
            <p>
              Template: {visitData.templateName || 'N/A'} | Specialty:{' '}
              {visitData.specialty || 'N/A'}
            </p>
          )}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
