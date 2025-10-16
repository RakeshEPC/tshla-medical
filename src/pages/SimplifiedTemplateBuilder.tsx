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
import { doctorProfileService, type DoctorTemplate } from '../services/doctorProfile.service';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import { logError, logInfo, logDebug } from '../services/logger.service';

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
  const [visitType, setVisitType] = useState<'general' | 'new-patient' | 'follow-up' | 'consultation' | 'emergency'>('general');
  const [sections, setSections] = useState<TemplateSection[]>([
    {
      id: 'section-1',
      title: 'Chief Complaint',
      aiInstructions: 'Extract the main reason for the visit',
      order: 0,
    },
  ]);
  const [savedTemplates, setSavedTemplates] = useState<DoctorTemplate[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string>('');
  const [currentDoctor, setCurrentDoctor] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Load current user
  useEffect(() => {
    async function loadUser() {
      const result = await supabaseAuthService.getCurrentUser();
      if (result.success && result.user) {
        setCurrentDoctor({
          id: result.user.authUserId || result.user.id || result.user.email || 'default-doctor',
        });
        logDebug('SimplifiedTemplateBuilder', 'User loaded', { doctorId: result.user.id });
      }
    }
    loadUser();
  }, []);

  // Load saved templates and default template
  useEffect(() => {
    if (currentDoctor) {
      loadSavedTemplates();
    }
  }, [currentDoctor]);

  const loadSavedTemplates = async () => {
    if (!currentDoctor) return;
    try {
      doctorProfileService.initialize(currentDoctor.id);
      const allTemplates = await doctorProfileService.getTemplates(currentDoctor.id);
      setSavedTemplates(allTemplates);

      // Get default template from profile
      const profile = await doctorProfileService.getProfile(currentDoctor.id);
      if (profile.settings.defaultTemplateId) {
        setDefaultTemplateId(profile.settings.defaultTemplateId);
      }
    } catch (error) {
      logError('SimplifiedTemplateBuilder', 'Failed to load templates', { error });
    }
  };

  // Set default template
  const setAsDefault = async (templateId: string) => {
    if (!currentDoctor) return;
    try {
      await doctorProfileService.setDefaultTemplate(templateId, undefined, currentDoctor.id);
      setDefaultTemplateId(templateId);
      alert('Default template set successfully!');
    } catch (error) {
      logError('SimplifiedTemplateBuilder', 'Failed to set default template', { error });
      alert('Failed to set default template');
    }
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
    if (!currentDoctor) {
      alert('Please log in to save templates');
      return;
    }

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

    setSaving(true);
    try {
      // Convert sections to DoctorTemplate format
      const templateSections: any = {};
      sections.forEach(section => {
        const key = section.title.toLowerCase().replace(/\s+/g, '_');
        templateSections[key] = {
          title: section.title,
          aiInstructions: section.aiInstructions,
          required: true,
          order: section.order,
          keywords: [],
          format: 'paragraph' as const,
          exampleText: '',
        };
      });

      if (editingTemplateId) {
        // Update existing template
        await doctorProfileService.updateTemplate(
          editingTemplateId,
          {
            name: templateName,
            description: 'Custom template',
            visitType: visitType,
            sections: templateSections,
            generalInstructions: generalInstructions,
          },
          currentDoctor.id
        );
        alert(`✅ Template "${templateName}" updated successfully!`);
      } else {
        // Create new template
        const savedTemplate = await doctorProfileService.createTemplate(
          {
            name: templateName,
            description: 'Custom template',
            visitType: visitType,
            sections: templateSections,
            generalInstructions: generalInstructions,
          },
          currentDoctor.id
        );

        if (!defaultTemplateId) {
          // If no default template, set this as default
          await setAsDefault(savedTemplate.id);
        }
        alert(`✅ Template "${templateName}" created successfully!`);
        logInfo('SimplifiedTemplateBuilder', 'Template created', { templateId: savedTemplate.id });
      }

      await loadSavedTemplates();
      clearForm();
    } catch (error) {
      logError('SimplifiedTemplateBuilder', 'Failed to save template', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`❌ Failed to save template: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
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
  const loadTemplate = (template: DoctorTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setGeneralInstructions(template.generalInstructions || '');
    if (template.visitType) {
      setVisitType(template.visitType);
    }

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
  const deleteTemplate = async (id: string) => {
    if (!currentDoctor) return;
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await doctorProfileService.deleteTemplate(id, currentDoctor.id);
        if (defaultTemplateId === id) {
          setDefaultTemplateId('');
        }
        await loadSavedTemplates();
        alert('✅ Template deleted successfully!');
      } catch (error) {
        logError('SimplifiedTemplateBuilder', 'Failed to delete template', { error });
        alert('❌ Failed to delete template');
      }
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
                disabled={saving || !templateName || sections.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Save className="h-5 w-5" />
                {saving ? 'Saving...' : editingTemplateId ? 'Update' : 'Save'} Template
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Editor */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {/* Template Name and Visit Type */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g., Diabetes Follow-up"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Visit Type
                  </label>
                  <select
                    value={visitType}
                    onChange={e => setVisitType(e.target.value as any)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  >
                    <option value="general">General</option>
                    <option value="new-patient">New Patient</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="consultation">Consultation</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
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
