import React, { useState, useEffect } from 'react';
import {
  Save,
  Plus,
  Trash2,
  FileText,
  ArrowLeft,
  Home,
  ChevronUp,
  ChevronDown,
  Star,
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

export default function SimplifiedTemplateBuilder() {
  const navigate = useNavigate();
  const [templateName, setTemplateName] = useState('');
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [sections, setSections] = useState<TemplateSection[]>([
    {
      id: 'section-1',
      title: 'Chief Complaint',
      aiInstructions: 'Extract the main reason for the visit',
      order: 0,
    },
  ]);
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string>('');

  // Load saved templates and default template
  useEffect(() => {
    loadSavedTemplates();
    const storedDefault = localStorage.getItem('defaultTemplateId');
    if (storedDefault) {
      setDefaultTemplateId(storedDefault);
    }
  }, []);

  const loadSavedTemplates = () => {
    const allTemplates = templateStorage.getTemplates();
    const customTemplates = allTemplates.filter(t => !t.is_system_template);
    setSavedTemplates(customTemplates);
  };

  // Set default template
  const setAsDefault = (templateId: string) => {
    localStorage.setItem('defaultTemplateId', templateId);
    setDefaultTemplateId(templateId);
    alert('Default template set successfully!');
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
    if (sections.length > 1) {
      setSections(sections.filter(s => s.id !== id));
    }
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

    // Validate sections
    const invalidSections = sections.filter(s => !s.title || !s.aiInstructions);
    if (invalidSections.length > 0) {
      alert('Please fill in all section titles and AI instructions');
      return;
    }

    // Convert sections to template format
    const templateSections: any = {};
    sections.forEach(section => {
      const key = section.title.toLowerCase().replace(/\s+/g, '_');
      templateSections[key] = {
        title: section.title,
        aiInstructions: section.aiInstructions,
        order: section.order,
      };
    });

    const template: Omit<Template, 'id' | 'created_at' | 'usage_count'> = {
      name: templateName,
      specialty: 'General',
      template_type: 'custom',
      sections: templateSections,
      generalInstructions: generalInstructions,
      is_shared: false,
      is_system_template: false,
    };

    if (editingTemplateId) {
      // Update existing template
      templateStorage.updateTemplate(editingTemplateId, template);
      alert('Template updated successfully!');
    } else {
      // Create new template
      const savedTemplate = templateStorage.createTemplate(template);
      if (!defaultTemplateId) {
        // If no default template, set this as default
        setAsDefault(savedTemplate.id);
      }
      alert('Template created successfully!');
    }

    loadSavedTemplates();
    clearForm();
  };

  // Clear form
  const clearForm = () => {
    setTemplateName('');
    setGeneralInstructions('');
    setSections([
      {
        id: 'section-1',
        title: 'Chief Complaint',
        aiInstructions: 'Extract the main reason for the visit',
        order: 0,
      },
    ]);
    setEditingTemplateId(null);
  };

  // Load template for editing
  const loadTemplate = (template: Template) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setGeneralInstructions((template as any).generalInstructions || '');

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
      if (defaultTemplateId === id) {
        localStorage.removeItem('defaultTemplateId');
        setDefaultTemplateId('');
      }
      loadSavedTemplates();
    }
  };

  // Common templates for quick start
  const quickStartTemplates = [
    {
      name: 'SOAP Note',
      sections: [
        { title: 'Subjective', ai: 'Extract patient complaints, symptoms, and history' },
        { title: 'Objective', ai: 'Extract vital signs, physical exam findings, and lab results' },
        { title: 'Assessment', ai: 'Extract diagnoses and clinical impressions' },
        { title: 'Plan', ai: 'Extract treatment plan, medications, and follow-up' },
      ],
    },
    {
      name: 'Follow-up Visit',
      sections: [
        { title: 'Chief Complaint', ai: 'Extract the reason for follow-up' },
        { title: 'Progress Since Last Visit', ai: 'Extract improvements or worsening of symptoms' },
        { title: 'Current Medications', ai: 'List all current medications with doses' },
        { title: 'Assessment & Plan', ai: 'Extract assessment and treatment changes' },
      ],
    },
    {
      name: 'Medication Management',
      sections: [
        { title: 'Current Medications', ai: 'List all medications with doses and frequencies' },
        { title: 'Medication Efficacy', ai: 'Extract how well medications are working' },
        { title: 'Side Effects', ai: 'Extract any reported side effects' },
        { title: 'Medication Changes', ai: 'Extract all medication changes (start/stop/adjust)' },
      ],
    },
  ];

  const loadQuickTemplate = (quickTemplate: any) => {
    setTemplateName(quickTemplate.name);
    const newSections = quickTemplate.sections.map((s: any, index: number) => ({
      id: `section-${Date.now()}-${index}`,
      title: s.title,
      aiInstructions: s.ai,
      order: index,
    }));
    setSections(newSections);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/schedule')}
                className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition"
              >
                <ArrowLeft className="h-5 w-5 text-blue-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Template Builder</h1>
                <p className="text-gray-600 mt-1">Create custom medical note templates</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/doctor')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 transition"
              >
                <Home className="h-5 w-5" />
                Dashboard
              </button>
              <button
                onClick={clearForm}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
              >
                New Template
              </button>
              <button
                onClick={saveTemplate}
                disabled={!templateName || sections.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Save className="h-5 w-5" />
                {editingTemplateId ? 'Update' : 'Save'} Template
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Editor */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {/* Template Name */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="e.g., Diabetes Follow-up, Cardiology Consult"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
              </div>

              {/* General AI Instructions */}
              <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  General AI Instructions (Applied to Entire Template)
                </label>
                <textarea
                  value={generalInstructions}
                  onChange={e => setGeneralInstructions(e.target.value)}
                  placeholder="General instructions for AI processing that apply to all sections. For example: 'Use third person throughout. Be concise and professional. Include specific numeric values when mentioned. Avoid redundancy between sections.'"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <p className="text-xs text-gray-600 mt-2">
                  These instructions will be applied to the entire note processing, in addition to
                  individual section instructions.
                </p>
              </div>

              {/* Sections */}
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Template Sections</h3>
                  <button
                    onClick={addSection}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition"
                  >
                    <Plus className="h-4 w-4" />
                    Add Section
                  </button>
                </div>

                {sections.map((section, index) => (
                  <div
                    key={section.id}
                    className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 hover:border-blue-300 transition"
                  >
                    <div className="flex items-start gap-3">
                      {/* Move buttons */}
                      <div className="flex flex-col gap-1 mt-8">
                        <button
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => moveDown(index)}
                          disabled={index === sections.length - 1}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Section content */}
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={section.title}
                          onChange={e => updateSection(section.id, 'title', e.target.value)}
                          placeholder="Section title (e.g., Chief Complaint)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                        <textarea
                          value={section.aiInstructions}
                          onChange={e =>
                            updateSection(section.id, 'aiInstructions', e.target.value)
                          }
                          placeholder="AI instructions - What should be extracted for this section?"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => removeSection(section.id)}
                        disabled={sections.length === 1}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Start Templates */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Quick Start Templates</h2>
              <div className="space-y-2">
                {quickStartTemplates.map(template => (
                  <button
                    key={template.name}
                    onClick={() => loadQuickTemplate(template)}
                    className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                  >
                    <div className="font-medium text-blue-700">{template.name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {template.sections.length} sections
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Templates */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">My Templates</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {savedTemplates.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No custom templates yet</p>
                ) : (
                  savedTemplates.map(template => (
                    <div
                      key={template.id}
                      className="group bg-gray-50 hover:bg-gray-100 rounded-lg p-3 transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <button onClick={() => loadTemplate(template)} className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-gray-800">{template.name}</span>
                            {defaultTemplateId === template.id && (
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            )}
                          </div>
                        </button>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setAsDefault(template.id)}
                          className={`px-2 py-1 text-xs rounded ${
                            defaultTemplateId === template.id
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                          }`}
                        >
                          {defaultTemplateId === template.id ? '✓ Default' : 'Set Default'}
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-600 text-xs rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
