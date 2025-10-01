import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Upload, FileJson } from 'lucide-react';
import { doctorProfileService } from '../services/doctorProfile.service';
import { unifiedAuthService } from '../services/unifiedAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function TemplateImportExport() {
  const navigate = useNavigate();
  const currentDoctor = unifiedAuthService.getCurrentUser()?.name || 'Dr. Smith';
  const [importResult, setImportResult] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const templates = currentDoctor ? doctorProfileService.getTemplates(currentDoctor.id) : [];

  const handleExportTemplate = () => {
    if (!selectedTemplate || !currentDoctor) return;

    try {
      const json = doctorProfileService.exportTemplate(selectedTemplate, currentDoctor.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template-${selectedTemplate}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setImportResult('Template exported successfully!');
    } catch (error) {
      setImportResult(`Export failed: ${error.message}`);
    }
  };

  const handleExportAllTemplates = () => {
    if (!currentDoctor) return;

    try {
      const allTemplates = {
        templates: templates,
        exportedAt: new Date().toISOString(),
        doctorId: currentDoctor.id,
      };

      const json = JSON.stringify(allTemplates, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all-templates-${currentDoctor.id}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setImportResult(`Exported ${templates.length} templates successfully!`);
    } catch (error) {
      setImportResult(`Export failed: ${error.message}`);
    }
  };

  const handleImportTemplate = () => {
    if (!currentDoctor) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const content = e.target?.result as string;
            const imported = JSON.parse(content);

            // Check if it's a single template or multiple
            if (imported.templates && Array.isArray(imported.templates)) {
              // Multiple templates
              let successCount = 0;
              imported.templates.forEach((template: any) => {
                try {
                  doctorProfileService.importTemplate(JSON.stringify(template), currentDoctor.id);
                  successCount++;
                } catch (err) {
                  logError('TemplateImportExport', 'Error message', {});
                }
              });
              setImportResult(
                `Imported ${successCount} of ${imported.templates.length} templates successfully!`
              );
            } else {
              // Single template
              doctorProfileService.importTemplate(content, currentDoctor.id);
              setImportResult('Template imported successfully!');
            }

            // Refresh the page to show new templates
            setTimeout(() => window.location.reload(), 1500);
          } catch (error) {
            setImportResult(`Import failed: ${error.message}`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  if (!currentDoctor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to access template import/export</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/doctor/templates')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold">Import/Export Templates</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Export Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Export Templates</h2>
          </div>

          <div className="space-y-4">
            {/* Export Single Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Single Template
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a template</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleExportTemplate}
                  disabled={!selectedTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Export
                </button>
              </div>
            </div>

            {/* Export All Templates */}
            <div>
              <button
                onClick={handleExportAllTemplates}
                className="w-full px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition flex items-center justify-center gap-2"
              >
                <FileJson className="w-5 h-5" />
                Export All Templates ({templates.length})
              </button>
            </div>
          </div>
        </div>

        {/* Import Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Import Templates</h2>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Import templates from a JSON file. You can import a single template or multiple
              templates at once.
            </p>

            <button
              onClick={handleImportTemplate}
              className="w-full px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Choose File to Import
            </button>
          </div>
        </div>

        {/* Result Message */}
        {importResult && (
          <div
            className={`p-4 rounded-lg ${
              importResult.includes('failed')
                ? 'bg-red-50 text-red-700'
                : 'bg-green-50 text-green-700'
            }`}
          >
            {importResult}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold mb-2">How to use Import/Export</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>
              • <strong>Export Single:</strong> Select a template and export it as a JSON file
            </li>
            <li>
              • <strong>Export All:</strong> Export all your templates in a single file
            </li>
            <li>
              • <strong>Import:</strong> Upload a JSON file containing one or more templates
            </li>
            <li>
              • <strong>Share:</strong> Share exported templates with colleagues
            </li>
            <li>
              • <strong>Backup:</strong> Keep backups of your templates
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
