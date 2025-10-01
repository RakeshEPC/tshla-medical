import React, { useState, useEffect } from 'react';
import {
  Save,
  Eye,
  Plus,
  Trash2,
  Copy,
  FileText,
  Wand2,
  Variable,
  ArrowLeft,
  Home,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { templateStorage } from '../lib/templateStorage';
import type { Template } from '../types/template.types';

interface TemplateSection {
  id: string;
  title: string;
  aiInstructions: string;
  order: number;
}

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const [templateName, setTemplateName] = useState('');
  const [specialty, setSpecialty] = useState('General');
  const [sections, setSections] = useState<TemplateSection[]>([
    {
      id: 'section-1',
      title: 'Chief Complaint',
      aiInstructions:
        'Extract the main reason for the visit or primary complaint from the dictation',
      order: 0,
    },
  ]);
  const [showPreview, setShowPreview] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Load saved templates
  useEffect(() => {
    loadSavedTemplates();
  }, []);

  const loadSavedTemplates = () => {
    const allTemplates = templateStorage.getTemplates();
    const customTemplates = allTemplates.filter(t => !t.is_system_template);
    setSavedTemplates(customTemplates);
  };

  // Add new section
  const addSection = () => {
    const newSection: TemplateSection = {
      id: `section-${Date.now()}`,
      title: '',
      aiInstructions: '',
      order: sections.length,
    };
    setSections([...sections, newSection]);
  };

  // Remove section
  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  // Update section
  const updateSection = (id: string, field: 'title' | 'aiInstructions', value: string) => {
    setSections(sections.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // Move section up
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newSections = [...sections];
    [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
    newSections.forEach((s, i) => (s.order = i));
    setSections(newSections);
  };

  // Move section down
  const moveDown = (index: number) => {
    if (index === sections.length - 1) return;
    const newSections = [...sections];
    [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    newSections.forEach((s, i) => (s.order = i));
    setSections(newSections);
  };

  // Save template
  const saveTemplate = async () => {
    if (!templateName || sections.length === 0) {
      alert('Please provide a template name and at least one section');
      return;
    }

    // Convert sections to template format
    const templateSections: any = {};
    sections.forEach(section => {
      if (section.title) {
        const key = section.title.toLowerCase().replace(/\s+/g, '_');
        templateSections[key] = {
          title: section.title,
          aiInstructions: section.aiInstructions,
          order: section.order,
        };
      }
    });

    const template: Omit<Template, 'id' | 'created_at' | 'usage_count'> = {
      name: templateName,
      specialty: specialty,
      template_type: 'custom',
      sections: templateSections,
      is_shared: false,
      is_system_template: false,
    };

    const savedTemplate = templateStorage.createTemplate(template);
    loadSavedTemplates();
    alert('Template saved successfully!');
    clearForm();
  };

  // Clear form
  const clearForm = () => {
    setTemplateName('');
    setSpecialty('General');
    setSections([
      {
        id: 'section-1',
        title: 'Chief Complaint',
        aiInstructions:
          'Extract the main reason for the visit or primary complaint from the dictation',
        order: 0,
      },
    ]);
  };

  // Load template for editing
  const loadTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setTemplateName(template.name);
    setSpecialty(template.specialty || 'General');

    // Convert template sections back to editable format
    const loadedSections: TemplateSection[] = [];
    if (template.sections) {
      Object.entries(template.sections).forEach(([key, value]: [string, any]) => {
        if (typeof value === 'object' && value.title) {
          loadedSections.push({
            id: `section-${Date.now()}-${key}`,
            title: value.title,
            aiInstructions: value.aiInstructions || '',
            order: value.order || loadedSections.length,
          });
        }
      });
    }

    if (loadedSections.length > 0) {
      loadedSections.sort((a, b) => a.order - b.order);
      setSections(loadedSections);
    }
  };

  // Delete template
  const deleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      templateStorage.deleteTemplate(id);
      loadSavedTemplates();
    }
  };

  // Common section suggestions
  const commonSections = [
    { title: 'Chief Complaint', ai: 'Extract the main reason for the visit' },
    {
      title: 'History of Present Illness',
      ai: 'Extract details about current symptoms, duration, severity, and progression',
    },
    {
      title: 'Current Medications',
      ai: 'List all medications mentioned with dosages and frequencies',
    },
    {
      title: 'Vital Signs',
      ai: 'Extract blood pressure, heart rate, temperature, weight, and other vital measurements',
    },
    {
      title: 'Physical Examination',
      ai: 'Extract physical exam findings mentioned in the dictation',
    },
    {
      title: 'Assessment',
      ai: 'Extract diagnoses, clinical impressions, and assessment of condition',
    },
    {
      title: 'Plan',
      ai: 'Extract treatment plan, medication changes, follow-up instructions, and next steps',
    },
    {
      title: 'Laboratory Results',
      ai: 'Extract any lab values mentioned like A1C, glucose levels, cholesterol',
    },
    {
      title: 'Medication Adjustments',
      ai: 'Specifically extract any medication dose changes or new prescriptions',
    },
    {
      title: 'Follow-up',
      ai: 'Extract follow-up timeline and any specific instructions for next visit',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/schedule')}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                title="Back to Schedule"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Template Builder</h1>
                <p className="text-gray-600 mt-1">Create custom sections with AI instructions</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/doctor')}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
              >
                <Home className="h-5 w-5" />
                Dashboard
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
              >
                <Eye className="h-5 w-5" />
                Preview
              </button>
              <button
                onClick={saveTemplate}
                disabled={!templateName || sections.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="h-5 w-5" />
                Save Template
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Common Sections & Saved Templates */}
          <div className="lg:col-span-1 space-y-6">
            {/* Template Info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Template Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g., Diabetes Follow-up"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                  <select
                    value={specialty}
                    onChange={e => setSpecialty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="General">General Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Endocrinology">Endocrinology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Psychiatry">Psychiatry</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Orthopedics">Orthopedics</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Common Sections */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Add Sections</h2>
              <div className="space-y-2">
                {commonSections.map(section => (
                  <button
                    key={section.title}
                    onClick={() => {
                      const newSection: TemplateSection = {
                        id: `section-${Date.now()}`,
                        title: section.title,
                        aiInstructions: section.ai,
                        order: sections.length,
                      };
                      setSections([...sections, newSection]);
                    }}
                    className="w-full text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm transition"
                  >
                    <Plus className="inline h-4 w-4 mr-2" />
                    {section.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Templates */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">My Templates</h2>
              <div className="space-y-2">
                {savedTemplates.length === 0 ? (
                  <p className="text-gray-500 text-sm">No custom templates yet</p>
                ) : (
                  savedTemplates.map(template => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <button
                        onClick={() => loadTemplate(template)}
                        className="flex-1 text-left text-sm"
                      >
                        <FileText className="inline h-4 w-4 mr-2 text-blue-600" />
                        {template.name}
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Main Editor - Sections */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Template Sections</h2>
                <button
                  onClick={addSection}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add Section
                </button>
              </div>

              <div className="space-y-4">
                {sections.map((section, index) => (
                  <div
                    key={section.id}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-1 pt-6">
                        <button
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <button
                          onClick={() => moveDown(index)}
                          disabled={index === sections.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Section content */}
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Section Title (appears in note)
                          </label>
                          <input
                            type="text"
                            value={section.title}
                            onChange={e => updateSection(section.id, 'title', e.target.value)}
                            placeholder="e.g., Chief Complaint"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            AI Instructions (what to extract from dictation)
                          </label>
                          <textarea
                            value={section.aiInstructions}
                            onChange={e =>
                              updateSection(section.id, 'aiInstructions', e.target.value)
                            }
                            placeholder="e.g., Extract the main reason for the visit and primary symptoms mentioned"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => removeSection(section.id)}
                        className="text-red-500 hover:text-red-700 pt-6"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}

                {sections.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No sections yet. Click "Add Section" to start building your template.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Template Preview</h2>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[70vh]">
                <div className="mb-4">
                  <span className="font-semibold">Template Name:</span>{' '}
                  {templateName || 'Untitled Template'}
                </div>
                <div className="mb-4">
                  <span className="font-semibold">Specialty:</span> {specialty}
                </div>
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Sections:</h3>
                  {sections.map((section, index) => (
                    <div key={section.id} className="mb-4 p-3 bg-gray-50 rounded">
                      <div className="font-semibold text-blue-600">
                        {index + 1}. {section.title || 'Untitled Section'}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">AI Instructions:</span>{' '}
                        {section.aiInstructions || 'No instructions provided'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
