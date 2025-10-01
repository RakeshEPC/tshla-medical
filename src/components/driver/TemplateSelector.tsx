'use client';
import React, { useState, useEffect } from 'react';
import {
  getAllTemplates,
  getSavedTemplate,
  saveTemplatePreference,
  saveCustomTemplate,
  SOAPTemplate,
} from '@/lib/soapTemplates';
import {
  getUserPreference,
  setUserPreference,
  addToTemplateHistory,
  exportPreferences,
  importPreferences,
  resetPreferences,
} from '@/lib/userPreferences';

interface TemplateSelectorProps {
  onTemplateSelect?: (templateId: string) => void;
}

export default function TemplateSelector({ onTemplateSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<SOAPTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SOAPTemplate | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('Guest User');

  useEffect(() => {
    setTemplates(getAllTemplates());
    // First try user-specific preference, then fall back to general saved template
    const userTemplate = getUserPreference('defaultTemplate');
    setSelectedTemplate(userTemplate || getSavedTemplate());

    // Check authentication status
    fetch('/api/auth/session-status')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.email) {
          setCurrentUser(data.email);
        }
      })
      .catch(() => {
        // Fallback to checking cookie
        if (document.cookie.includes('tshla_session')) {
          setCurrentUser('Authenticated User');
        }
      });
  }, []);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    // Save both to general preferences and user-specific preferences
    saveTemplatePreference(templateId);
    setUserPreference('defaultTemplate', templateId);
    addToTemplateHistory(templateId);
    if (onTemplateSelect) {
      onTemplateSelect(templateId);
    }
  };

  const handleCreateCustom = () => {
    const baseTemplate = templates.find(t => t.id === selectedTemplate) || templates[0];
    setEditingTemplate({
      ...baseTemplate,
      id: `custom-${Date.now()}`,
      name: `Custom - ${baseTemplate.name}`,
      description: 'Custom template based on ' + baseTemplate.name,
    });
    setShowEditor(true);
  };

  const handleSaveCustom = () => {
    if (editingTemplate) {
      saveCustomTemplate(editingTemplate);
      setTemplates(getAllTemplates());
      handleTemplateChange(editingTemplate.id);
      setShowEditor(false);
      setEditingTemplate(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">SOAP Note Template Settings</h2>

      {/* Template Selector */}
      <div className="mb-6">
        <label className="block text-lg font-semibold mb-2">Select Your Default Template:</label>
        <select
          value={selectedTemplate}
          onChange={e => handleTemplateChange(e.target.value)}
          className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
        >
          <optgroup label="Standard Templates">
            {templates
              .filter(t => !t.id.startsWith('custom-'))
              .map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} - {template.specialty}
                </option>
              ))}
          </optgroup>
          {templates.some(t => t.id.startsWith('custom-')) && (
            <optgroup label="Custom Templates">
              {templates
                .filter(t => t.id.startsWith('custom-'))
                .map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Current Template Preview */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Current Template Preview:</h3>
        {templates.find(t => t.id === selectedTemplate) && (
          <div className="text-sm space-y-2">
            <p>
              <strong>Name:</strong> {templates.find(t => t.id === selectedTemplate)?.name}
            </p>
            <p>
              <strong>Specialty:</strong>{' '}
              {templates.find(t => t.id === selectedTemplate)?.specialty}
            </p>
            <p>
              <strong>Description:</strong>{' '}
              {templates.find(t => t.id === selectedTemplate)?.description}
            </p>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>Logged in as:</strong> {currentUser}
        </p>
        <p className="text-sm text-blue-600 mt-1">
          {currentUser === 'Guest User'
            ? 'Your template preferences will be saved locally in this browser'
            : 'Your template preferences will be saved for this account'}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 flex-wrap">
        <button
          onClick={handleCreateCustom}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          Create Custom Template
        </button>
        <button
          onClick={() => {
            handleTemplateChange(selectedTemplate);
            alert(
              `Template saved as default for your account!\n\nThis template will automatically load every time you log in.`
            );
          }}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
        >
          💾 Save as My Default
        </button>
        <button
          onClick={() => {
            const data = exportPreferences();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'my-template-preferences.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
        >
          📥 Export Settings
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
        >
          Apply Template
        </button>
      </div>

      {/* Template Editor Modal */}
      {showEditor && editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">Edit Template</h3>

            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">Template Name:</label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Specialty:</label>
                <input
                  type="text"
                  value={editingTemplate.specialty}
                  onChange={e =>
                    setEditingTemplate({ ...editingTemplate, specialty: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Chief Complaint Template:</label>
                <textarea
                  value={editingTemplate.subjective.chiefComplaint}
                  onChange={e =>
                    setEditingTemplate({
                      ...editingTemplate,
                      subjective: { ...editingTemplate.subjective, chiefComplaint: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg h-20"
                  placeholder="Leave blank to use dictation"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">HPI Template:</label>
                <textarea
                  value={editingTemplate.subjective.hpi}
                  onChange={e =>
                    setEditingTemplate({
                      ...editingTemplate,
                      subjective: { ...editingTemplate.subjective, hpi: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg h-20"
                  placeholder="Use [DICTATION] where you want the dictated text"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Review of Systems:</label>
                <textarea
                  value={editingTemplate.subjective.ros}
                  onChange={e =>
                    setEditingTemplate({
                      ...editingTemplate,
                      subjective: { ...editingTemplate.subjective, ros: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg h-32"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Vital Signs Template:</label>
                <textarea
                  value={editingTemplate.objective.vitals}
                  onChange={e =>
                    setEditingTemplate({
                      ...editingTemplate,
                      objective: { ...editingTemplate.objective, vitals: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg h-32"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Physical Exam Template:</label>
                <textarea
                  value={editingTemplate.objective.physicalExam}
                  onChange={e =>
                    setEditingTemplate({
                      ...editingTemplate,
                      objective: { ...editingTemplate.objective, physicalExam: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg h-32"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Assessment Template:</label>
                <textarea
                  value={editingTemplate.assessment.template}
                  onChange={e =>
                    setEditingTemplate({
                      ...editingTemplate,
                      assessment: { ...editingTemplate.assessment, template: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg h-20"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Plan Template:</label>
                <textarea
                  value={editingTemplate.plan.template}
                  onChange={e =>
                    setEditingTemplate({
                      ...editingTemplate,
                      plan: { ...editingTemplate.plan, template: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg h-32"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveCustom}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                Save Template
              </button>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingTemplate(null);
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
