import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Star, Clock, Plus, Edit2, Copy, Trash2 } from 'lucide-react';
import { doctorProfileService, type DoctorTemplate } from '../services/doctorProfile.service';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { getDefaultTemplatesForDoctor } from '../data/standardTemplates';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function TemplateList() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<DoctorTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = unifiedAuthService.getCurrentUser();
  const currentDoctor = currentUser?.name || 'Dr. Smith';

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    if (!currentDoctor) {
      setLoading(false);
      return;
    }

    try {
      doctorProfileService.initialize(currentDoctor.id);
      const allTemplates = await doctorProfileService.getTemplates();

      // If no templates exist, create default ones
      if (allTemplates.length === 0) {
        logDebug('TemplateList', 'Debug message', {});
        const defaults = getDefaultTemplatesForDoctor(currentDoctor.id);

        // Save each default template
        for (const template of defaults) {
          await doctorProfileService.createTemplate(template, currentDoctor.id);
        }

        // Reload templates
        const updatedTemplates = await doctorProfileService.getTemplates();
        setTemplates(updatedTemplates);
      } else {
        setTemplates(allTemplates);
      }
    } catch (error) {
      logError('TemplateList', 'Error message', {});
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await doctorProfileService.deleteTemplate(templateId, currentDoctor?.id);
      await loadTemplates();
    } catch (error) {
      logError('TemplateList', 'Error message', {});
    }
  };

  const duplicateTemplate = async (template: DoctorTemplate) => {
    const newName = prompt('Enter name for the duplicate:', `${template.name} (Copy)`);
    if (!newName) return;

    try {
      await doctorProfileService.duplicateTemplate(template.id, newName, currentDoctor?.id);
      await loadTemplates();
    } catch (error) {
      logError('TemplateList', 'Error message', {});
    }
  };

  if (!currentDoctor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to view templates</p>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Template Library</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/doctor-templates')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Template
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Template Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Templates</p>
                <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Standard Templates</p>
                <p className="text-2xl font-bold text-gray-900">
                  {
                    templates.filter(
                      t =>
                        t.name.includes('SOAP') ||
                        t.name.includes('Diabetes') ||
                        t.name.includes('Progress') ||
                        t.name.includes('Telehealth') ||
                        t.name.includes('New Patient')
                    ).length
                  }
                </p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Custom Templates</p>
                <p className="text-2xl font-bold text-gray-900">
                  {
                    templates.filter(
                      t =>
                        !t.name.includes('SOAP') &&
                        !t.name.includes('Diabetes') &&
                        !t.name.includes('Progress') &&
                        !t.name.includes('Telehealth') &&
                        !t.name.includes('New Patient')
                    ).length
                  }
                </p>
              </div>
              <Edit2 className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Template List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Templates</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {templates.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No templates found</p>
                <button
                  onClick={async () => {
                    if (currentDoctor) {
                      const defaults = getDefaultTemplatesForDoctor(currentDoctor.id);
                      for (const template of defaults) {
                        await doctorProfileService.createTemplate(template, currentDoctor.id);
                      }
                      await loadTemplates();
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Load Standard Templates
                </button>
              </div>
            ) : (
              templates.map(template => (
                <div key={template.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
                        {template.isDefault && (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="mt-1 text-sm text-gray-600">{template.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {template.visitType || 'General'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {template.usageCount || 0} uses
                        </span>
                        <span>{Object.keys(template.sections || {}).length} sections</span>
                      </div>

                      {/* Section Preview */}
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-700 mb-2">Sections:</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(template.sections || {})
                            .slice(0, 5)
                            .map(([key, section]) => (
                              <span
                                key={key}
                                className="px-2 py-1 text-xs bg-white rounded border border-gray-200"
                              >
                                {section.title}
                              </span>
                            ))}
                          {Object.keys(template.sections || {}).length > 5 && (
                            <span className="px-2 py-1 text-xs text-gray-500">
                              +{Object.keys(template.sections).length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => navigate(`/doctor-templates?edit=${template.id}`)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Edit template"
                      >
                        <Edit2 className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => duplicateTemplate(template)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Duplicate template"
                      >
                        <Copy className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Delete template"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
