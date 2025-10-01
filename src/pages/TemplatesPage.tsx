import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Copy, Trash2, Search, Filter } from 'lucide-react';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface Template {
  id: string;
  name: string;
  category: string;
  specialty: string;
  content: string;
  variables: string[];
  isGlobal: boolean;
  usageCount: number;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('doctor_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';

      const response = await fetch(`${apiUrl}/api/templates`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      logError('TemplatesPage', 'Error message', {});
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...Array.from(new Set(templates.map(t => t.category)))];
  const specialties = ['All', ...Array.from(new Set(templates.map(t => t.specialty)))];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    const matchesSpecialty =
      selectedSpecialty === 'All' || template.specialty === selectedSpecialty;
    return matchesSearch && matchesCategory && matchesSpecialty;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Medical Templates</h1>
              <p className="text-gray-600 mt-1">50+ SOAP note templates for various specialties</p>
            </div>
            <button
              onClick={() => setShowNewTemplateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              New Template
            </button>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={selectedSpecialty}
                onChange={e => setSelectedSpecialty(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {specialties.map(spec => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{templates.length}</div>
              <div className="text-sm text-gray-600">Total Templates</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{categories.length - 1}</div>
              <div className="text-sm text-gray-600">Categories</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{specialties.length - 1}</div>
              <div className="text-sm text-gray-600">Specialties</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {templates.reduce((sum, t) => sum + t.usageCount, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Uses</div>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading templates...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedTemplate(template)}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    {template.isGlobal && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Global
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>

                  <div className="flex gap-2 mb-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {template.category}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                      {template.specialty}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                    {template.content.split('\n')[0]}...
                  </p>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">{template.variables.length} variables</span>
                    <span className="text-gray-500">Used {template.usageCount} times</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                    <button className="flex-1 text-blue-600 hover:bg-blue-50 py-1 rounded text-sm">
                      Use
                    </button>
                    <button className="flex-1 text-gray-600 hover:bg-gray-50 py-1 rounded text-sm">
                      Copy
                    </button>
                    {!template.isGlobal && (
                      <button className="flex-1 text-gray-600 hover:bg-gray-50 py-1 rounded text-sm">
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <TemplatePreviewModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {/* New Template Modal */}
      {showNewTemplateModal && (
        <NewTemplateModal
          onClose={() => setShowNewTemplateModal(false)}
          onSuccess={() => {
            setShowNewTemplateModal(false);
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
}

function TemplatePreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{template.name}</h2>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                  {template.category}
                </span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                  {template.specialty}
                </span>
                {template.isGlobal && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                    Global Template
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Variables</h3>
            <div className="flex flex-wrap gap-2">
              {template.variables.map((variable, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {`{${variable}}`}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Template Content</h3>
            <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg">
              {template.content}
            </pre>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Close
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}

function NewTemplateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    category: 'SOAP',
    content: '',
    variables: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('doctor_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';

      // Extract variables from content
      const variableMatches = formData.content.match(/\{([^}]+)\}/g) || [];
      const variables = variableMatches.map(v => v.slice(1, -1));

      const response = await fetch(`${apiUrl}/api/templates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          variables,
        }),
      });

      if (response.ok) {
        onSuccess();
      }
    } catch (error) {
      logError('TemplatesPage', 'Error message', {});
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Create New Template</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              required
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="SOAP">SOAP</option>
              <option value="H&P">H&P</option>
              <option value="Discharge">Discharge</option>
              <option value="Progress">Progress Note</option>
              <option value="Consultation">Consultation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Content *
            </label>
            <div className="text-xs text-gray-500 mb-2">
              Use {`{variable_name}`} for dynamic fields
            </div>
            <textarea
              required
              rows={15}
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder={`SUBJECTIVE:
Chief Complaint: {chief_complaint}
History of Present Illness: {hpi}

OBJECTIVE:
Vital Signs: {vitals}
Physical Examination: {physical_exam}

ASSESSMENT:
{assessment}

PLAN:
{plan}`}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
