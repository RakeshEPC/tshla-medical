import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Save,
  Copy,
  Star,
  StarOff,
  ChevronUp,
  ChevronDown,
  FileText,
  Settings,
  Download,
  Upload,
  MoreVertical,
  Check,
} from 'lucide-react';
import { doctorProfileService, type DoctorTemplate } from '../services/doctorProfile.service';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface EditingTemplate {
  id?: string;
  name: string;
  description: string;
  visitType: DoctorTemplate['visitType'];
  sections: {
    [key: string]: {
      title: string;
      aiInstructions: string;
      required: boolean;
      order: number;
      keywords: string[];
      format: 'paragraph' | 'bullets' | 'numbered';
      exampleText: string;
    };
  };
  generalInstructions: string;
}

const DEFAULT_SECTIONS = [
  { key: 'chiefComplaint', title: 'Chief Complaint', order: 1 },
  { key: 'historyOfPresentIllness', title: 'History of Present Illness', order: 2 },
  { key: 'reviewOfSystems', title: 'Review of Systems', order: 3 },
  { key: 'pastMedicalHistory', title: 'Past Medical History', order: 4 },
  { key: 'medications', title: 'Medications', order: 5 },
  { key: 'allergies', title: 'Allergies', order: 6 },
  { key: 'socialHistory', title: 'Social History', order: 7 },
  { key: 'familyHistory', title: 'Family History', order: 8 },
  { key: 'physicalExam', title: 'Physical Examination', order: 9 },
  { key: 'assessment', title: 'Assessment', order: 10 },
  { key: 'plan', title: 'Plan', order: 11 },
];

export default function DoctorTemplates() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = unifiedAuthService.getCurrentUser();
  const currentDoctor = currentUser
    ? {
        id: currentUser.email || currentUser.id || 'default-doctor',
        name: currentUser.name || 'Dr. Smith',
        email: currentUser.email || 'doctor@tshla.ai',
      }
    : null;
  const [templates, setTemplates] = useState<DoctorTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<EditingTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (currentDoctor) {
        // Clear cache to ensure fresh templates including Tess and Nikki
        doctorProfileService.clearCache(currentDoctor.id);

        doctorProfileService.initialize(currentDoctor.id);
        await loadTemplates();
        try {
          const doctorProfile = await doctorProfileService.getProfile(currentDoctor.id);
          setProfile(doctorProfile);
        } catch (error) {
          logError('DoctorTemplates', 'Error message', {});
        }
        setLoading(false);
      }
    };
    loadData();
  }, [currentDoctor]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown && !(event.target as Element).closest('.relative')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  // Handle edit query parameter
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && templates.length > 0) {
      const templateToEdit = templates.find(t => t.id === editId);
      if (templateToEdit) {
        editTemplate(templateToEdit);
        // Clear the query parameter to avoid re-triggering
        navigate('/templates/doctor', { replace: true });
      }
    }
  }, [searchParams, templates]);

  const loadTemplates = async () => {
    if (!currentDoctor) return;

    logDebug('DoctorTemplates', 'Debug message', {});

    try {
      const doctorId =
        currentDoctor.id || currentDoctor.email || currentDoctor.name || 'default-doctor';
      logDebug('DoctorTemplates', 'Debug message', {});

      // Load templates directly from MySQL
      const doctorTemplates = await doctorProfileService.getTemplates(doctorId);
      logInfo('DoctorTemplates', 'Info message', {});

      setTemplates(doctorTemplates);
    } catch (error) {
      logError('DoctorTemplates', 'Error message', {});

      // Show user-friendly error message
      alert(
        `❌ Failed to load templates: ${error instanceof Error ? error.message : 'Database connection failed'}. Please ensure the Template API server is running.`
      );
      setTemplates([]);
    }
  };

  const startNewTemplate = () => {
    const newTemplate: EditingTemplate = {
      name: '',
      description: '',
      visitType: 'general',
      sections: DEFAULT_SECTIONS.reduce(
        (acc, section) => ({
          ...acc,
          [section.key]: {
            title: section.title,
            aiInstructions: '',
            required: true,
            order: section.order,
            keywords: [],
            format: 'paragraph',
            exampleText: '',
          },
        }),
        {}
      ),
      generalInstructions: '',
    };
    setEditingTemplate(newTemplate);
    setShowEditor(true);
  };

  const editTemplate = (template: DoctorTemplate) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      description: template.description || '',
      visitType: template.visitType || 'general',
      sections: template.sections,
      generalInstructions: template.generalInstructions || '',
    });
    setShowEditor(true);
  };

  const saveTemplate = async () => {
    if (!editingTemplate || !currentDoctor) return;

    setSaving(true);
    try {
      if (editingTemplate.id) {
        // Update existing
        await doctorProfileService.updateTemplate(
          editingTemplate.id,
          {
            name: editingTemplate.name,
            description: editingTemplate.description,
            visitType: editingTemplate.visitType,
            sections: editingTemplate.sections,
            generalInstructions: editingTemplate.generalInstructions,
          },
          currentDoctor.id
        );
        alert(`✅ Template "${editingTemplate.name}" updated successfully!`);
      } else {
        // Create new
        await doctorProfileService.createTemplate(
          {
            name: editingTemplate.name,
            description: editingTemplate.description,
            visitType: editingTemplate.visitType,
            sections: editingTemplate.sections,
            generalInstructions: editingTemplate.generalInstructions,
          },
          currentDoctor.id
        );
        alert(`✅ Template "${editingTemplate.name}" created successfully!`);
      }

      await loadTemplates();
      setShowEditor(false);
      setEditingTemplate(null);
    } catch (error) {
      logError('DoctorTemplates', 'Error message', {});
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`❌ Failed to save template: ${errorMessage}`);
    }
    setSaving(false);
  };

  const deleteTemplate = async (templateId: string) => {
    if (!currentDoctor) return;

    const template = templates.find(t => t.id === templateId);
    const templateName = template?.name || 'this template';

    if (
      confirm(`Are you sure you want to delete "${templateName}"? This action cannot be undone.`)
    ) {
      logDebug('DoctorTemplates', 'Debug message', {});

      try {
        setIsUpdating(true);

        await doctorProfileService.deleteTemplate(templateId, currentDoctor.id);
        logInfo('DoctorTemplates', 'Info message', {});

        alert(`✅ "${templateName}" deleted successfully!`);

        // Reload templates from MySQL
        await loadTemplates();
      } catch (error) {
        logError('DoctorTemplates', 'Error message', {});
        alert(
          `❌ Failed to delete template: ${error instanceof Error ? error.message : 'Database connection failed'}`
        );
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const duplicateTemplate = async (template: DoctorTemplate) => {
    if (!currentDoctor) return;

    const newName = prompt('Enter name for the duplicate template:', `${template.name} (Copy)`);
    if (newName && newName.trim()) {
      logDebug('DoctorTemplates', 'Debug message', {});

      try {
        setIsUpdating(true);

        await doctorProfileService.duplicateTemplate(template.id, newName.trim(), currentDoctor.id);
        logInfo('DoctorTemplates', 'Info message', {});

        alert(`✅ Template "${newName}" created successfully!`);

        // Reload templates from MySQL
        await loadTemplates();
      } catch (error) {
        logError('DoctorTemplates', 'Error message', {});
        alert(
          `❌ Failed to duplicate template: ${error instanceof Error ? error.message : 'Database connection failed'}`
        );
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const toggleFavorite = async (templateId: string) => {
    if (isUpdating) {
      logDebug('DoctorTemplates', 'Debug message', {});
      return;
    }

    logDebug('DoctorTemplates', 'Debug message', {});

    try {
      setIsUpdating(true);

      if (!currentDoctor) {
        logError('DoctorTemplates', 'Error message', {});
        alert('❌ Please log in to manage favorites');
        return;
      }

      logDebug('DoctorTemplates', 'Debug message', {});
      const isFavorite = await doctorProfileService.toggleFavorite(templateId, currentDoctor.id);
      logInfo('DoctorTemplates', 'Info message', {});

      logDebug('DoctorTemplates', 'Debug message', {});
      await loadTemplates();
      logInfo('DoctorTemplates', 'Info message', {});

      // Show success message
      const message = isFavorite ? '⭐ Added to favorites!' : '⭐ Removed from favorites!';
      logDebug('DoctorTemplates', 'Template favorited', { message });
    } catch (error) {
      logError('DoctorTemplates', 'Error message', {});
      alert(
        `❌ Failed to update favorites: ${error instanceof Error ? error.message : 'Database connection failed'}`
      );
    } finally {
      setIsUpdating(false);
      logDebug('DoctorTemplates', 'Debug message', {});
    }
  };

  const setAsDefault = async (templateId: string, visitType?: DoctorTemplate['visitType']) => {
    if (!currentDoctor || isUpdating) return;

    logDebug('DoctorTemplates', 'Debug message', {});

    try {
      setIsUpdating(true);

      await doctorProfileService.setDefaultTemplate(templateId, visitType, currentDoctor.id);

      const template = templates.find(t => t.id === templateId);
      const templateName = template?.name || 'Template';
      const successMessage = `✅ "${templateName}" set as default${visitType ? ` for ${visitType} visits` : ''}!`;

      logInfo('DoctorTemplates', 'Info message', {});
      alert(successMessage);

      // Reload templates from MySQL
      await loadTemplates();
    } catch (error) {
      logError('DoctorTemplates', 'Error message', {});
      alert(
        `❌ Failed to set default template: ${error instanceof Error ? error.message : 'Database connection failed'}`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const updateSection = (key: string, field: string, value: any) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      sections: {
        ...editingTemplate.sections,
        [key]: {
          ...editingTemplate.sections[key],
          [field]: value,
        },
      },
    });
  };

  const addSection = () => {
    if (!editingTemplate) return;
    const key = `custom_${Date.now()}`;
    const maxOrder = Math.max(...Object.values(editingTemplate.sections).map(s => s.order));
    setEditingTemplate({
      ...editingTemplate,
      sections: {
        ...editingTemplate.sections,
        [key]: {
          title: 'New Section',
          aiInstructions: '',
          required: false,
          order: maxOrder + 1,
          keywords: [],
          format: 'paragraph',
          exampleText: '',
        },
      },
    });
  };

  const removeSection = (key: string) => {
    if (!editingTemplate) return;
    const { [key]: removed, ...rest } = editingTemplate.sections;
    setEditingTemplate({
      ...editingTemplate,
      sections: rest,
    });
  };

  const favoriteIds = profile?.favoriteTemplates || [];
  const defaultTemplateId = profile?.settings?.defaultTemplateId;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (!currentDoctor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to manage templates</p>
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

  if (showEditor && editingTemplate) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Editor Header */}
        <div className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setShowEditor(false);
                    setEditingTemplate(null);
                  }}
                  className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-semibold">
                  {editingTemplate.id ? 'Edit Template' : 'New Template'}
                </h1>
              </div>
              <button
                onClick={saveTemplate}
                disabled={saving || !editingTemplate.name}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-6">
          {/* Template Info */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Template Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Diabetes Follow-up"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
                <select
                  value={editingTemplate.visitType}
                  onChange={e =>
                    setEditingTemplate({
                      ...editingTemplate,
                      visitType: e.target.value as DoctorTemplate['visitType'],
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general">General</option>
                  <option value="new-patient">New Patient</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="consultation">Consultation</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={editingTemplate.description}
                onChange={e =>
                  setEditingTemplate({ ...editingTemplate, description: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Brief description of when to use this template"
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                General AI Instructions
              </label>
              <textarea
                value={editingTemplate.generalInstructions}
                onChange={e =>
                  setEditingTemplate({ ...editingTemplate, generalInstructions: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Overall instructions for the AI (e.g., 'Focus on medication compliance and glucose control')"
              />
            </div>
          </div>

          {/* Sections */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Note Sections</h2>
              <button
                onClick={addSection}
                className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
              >
                <Plus className="w-4 h-4" />
                Add Section
              </button>
            </div>

            <div className="space-y-4">
              {Object.entries(editingTemplate.sections)
                .sort(([, a], [, b]) => a.order - b.order)
                .map(([key, section], index) => (
                  <div key={key} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={section.title}
                          onChange={e => updateSection(key, 'title', e.target.value)}
                          className="text-lg font-medium border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={section.required}
                            onChange={e => updateSection(key, 'required', e.target.checked)}
                            className="rounded text-blue-600"
                          />
                          Required
                        </label>
                        <button
                          onClick={() => removeSection(key)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          AI Instructions
                        </label>
                        <textarea
                          value={section.aiInstructions}
                          onChange={e => updateSection(key, 'aiInstructions', e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          rows={3}
                          placeholder="Tell the AI what to extract for this section"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Example Text (Optional)
                        </label>
                        <textarea
                          value={section.exampleText}
                          onChange={e => updateSection(key, 'exampleText', e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          rows={3}
                          placeholder="Provide an example of what this section should look like"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Keywords (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={section.keywords.join(', ')}
                          onChange={e =>
                            updateSection(
                              key,
                              'keywords',
                              e.target.value
                                .split(',')
                                .map(k => k.trim())
                                .filter(k => k)
                            )
                          }
                          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="glucose, insulin, blood sugar"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Format
                        </label>
                        <select
                          value={section.format}
                          onChange={e => updateSection(key, 'format', e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="paragraph">Paragraph</option>
                          <option value="bullets">Bullet Points</option>
                          <option value="numbered">Numbered List</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/doctor')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold">My Templates</h1>
            </div>
            <button
              onClick={startNewTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Templates...</h3>
            <p className="text-gray-600">Setting up your medical templates</p>
          </div>
        ) : (
          <>
            {/* Favorites Section */}
            {templates.filter(t => favoriteIds.includes(t.id)).length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-current" />
                  Favorite Templates
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates
                    .filter(t => favoriteIds.includes(t.id))
                    .map(template => {
                      const isFavorite = favoriteIds.includes(template.id);
                      const isDefault = defaultTemplateId === template.id;

                      return (
                        <div
                          key={template.id}
                          className="bg-gradient-to-br from-yellow-50 to-white border border-yellow-200 rounded-lg shadow-sm hover:shadow-md transition p-4 relative"
                        >
                          {/* Template Card Content */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                                {template.name}
                                {isDefault && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                    DEFAULT
                                  </span>
                                )}
                              </h3>
                              {template.visitType && template.visitType !== 'general' && (
                                <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded mt-1">
                                  {template.visitType}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => toggleFavorite(template.id)}
                                disabled={isUpdating}
                                className={`p-1 hover:bg-yellow-100 rounded cursor-pointer ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Remove from favorites"
                              >
                                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              </button>
                              <div className="relative">
                                <button
                                  onClick={() => {
                                    const newState =
                                      openDropdown === template.id ? null : template.id;
                                    setOpenDropdown(newState);
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded cursor-pointer"
                                >
                                  <MoreVertical className="w-4 h-4 text-gray-600" />
                                </button>
                                {openDropdown === template.id && (
                                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-50">
                                    <button
                                      onClick={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setAsDefault(template.id, template.visitType);
                                        setOpenDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      {isDefault ? (
                                        <>
                                          <Check className="w-4 h-4 text-green-600" />
                                          <span className="text-green-600">Default Template</span>
                                        </>
                                      ) : (
                                        <>
                                          <Settings className="w-4 h-4" />
                                          <span>Set as Default</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => {
                                        editTemplate(template);
                                        setOpenDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                      Edit Template
                                    </button>
                                    <button
                                      onClick={() => {
                                        duplicateTemplate(template);
                                        setOpenDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <Copy className="w-4 h-4" />
                                      Duplicate
                                    </button>
                                    <div className="border-t"></div>
                                    <button
                                      onClick={() => {
                                        deleteTemplate(template.id);
                                        setOpenDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete Template
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {template.description && (
                            <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                          )}

                          <div className="text-xs text-gray-500">
                            {Object.keys(template.sections).length} sections • Used{' '}
                            {template.usageCount} times
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* All Templates Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                All Templates
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => {
                  const isFavorite = favoriteIds.includes(template.id);
                  const isDefault = defaultTemplateId === template.id;

                  return (
                    <div
                      key={template.id}
                      className={`bg-white rounded-lg shadow-sm hover:shadow-md transition p-4 relative ${
                        isDefault ? 'ring-2 ring-green-200 bg-green-50' : ''
                      }`}
                      style={{ pointerEvents: 'auto' }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 flex items-center gap-2">
                            {template.name}
                            {isDefault && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                DEFAULT
                              </span>
                            )}
                          </h3>
                          {template.visitType && template.visitType !== 'general' && (
                            <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded mt-1">
                              {template.visitType}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleFavorite(template.id)}
                            disabled={isUpdating}
                            className={`p-1 hover:bg-gray-100 rounded cursor-pointer ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            {isFavorite ? (
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            ) : (
                              <StarOff className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => {
                                const newState = openDropdown === template.id ? null : template.id;
                                setOpenDropdown(newState);
                              }}
                              className="p-1 hover:bg-gray-100 rounded cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4 text-gray-600" />
                            </button>
                            {openDropdown === template.id && (
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-50">
                                <button
                                  onClick={() => {
                                    setAsDefault(template.id, template.visitType);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  {isDefault ? (
                                    <>
                                      <Check className="w-4 h-4 text-green-600" />
                                      <span className="text-green-600">Default Template</span>
                                    </>
                                  ) : (
                                    <>
                                      <Settings className="w-4 h-4" />
                                      <span>Set as Default</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    editTemplate(template);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit Template
                                </button>
                                <button
                                  onClick={() => {
                                    duplicateTemplate(template);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Copy className="w-4 h-4" />
                                  Duplicate
                                </button>
                                <div className="border-t"></div>
                                <button
                                  onClick={() => {
                                    deleteTemplate(template.id);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Template
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {template.description && (
                        <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                      )}

                      <div className="text-xs text-gray-500">
                        {Object.keys(template.sections).length} sections • Used{' '}
                        {template.usageCount} times
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
