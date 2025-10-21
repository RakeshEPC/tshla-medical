import React, { useState, useEffect } from 'react';
import { doctorProfileService, type DoctorTemplate } from '../services/doctorProfile.service';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import type { Template } from '../types/template.types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function TemplateDebug() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [rawJson, setRawJson] = useState<string>('');
  const [doctorId, setDoctorId] = useState<string>('');

  useEffect(() => {
    initializeAndLoadTemplates();
  }, []);

  const initializeAndLoadTemplates = async () => {
    try {
      const result = await supabaseAuthService.getCurrentUser();
      if (result.success && result.user) {
        const id = result.user.authUserId || result.user.id || result.user.email || 'doctor-default-001';
        setDoctorId(id);
        doctorProfileService.initialize(id);
        await loadTemplates(id);
      }
    } catch (error) {
      logError('TemplateDebug', 'Error initializing', { error });
    }
  };

  const loadTemplates = async (id: string) => {
    try {
      const doctorTemplates = await doctorProfileService.getTemplates(id);
      // Convert DoctorTemplate to Template format
      const allTemplates: Template[] = doctorTemplates.map((dt: DoctorTemplate) => ({
        id: dt.id,
        name: dt.name,
        description: dt.description || '',
        specialty: 'General',
        template_type: 'custom',
        sections: dt.sections || {},
        created_at: dt.createdAt,
        usage_count: dt.usageCount || 0,
      }));
      setTemplates(allTemplates);

      // Log all templates for debugging
      logDebug('TemplateDebug', 'Debug message', {});
      allTemplates.forEach(template => {
        logDebug('TemplateDebug', 'Debug message', {});
        if (template.sections) {
          logDebug('TemplateDebug', 'Debug message', {});
          Object.entries(template.sections).forEach(([key, section]) => {
            if (typeof section === 'object' && section !== null) {
              logDebug('TemplateDebug', 'Debug message', {});
              logDebug('TemplateDebug', 'Debug message', {});
            }
          });
        }
      });

      // Find rakesh 222 or any template with 222 in name
      const rakesh222 = allTemplates.find(
        t =>
          t.name.toLowerCase().includes('222') ||
          t.name.toLowerCase() === 'rakesh 222' ||
          t.name.toLowerCase() === 'rakesh222'
      );

      if (rakesh222) {
        setSelectedTemplate(rakesh222);
        setRawJson(JSON.stringify(rakesh222, null, 2));
        logDebug('TemplateDebug', 'Debug message', {});
      } else {
        // Try to find any rakesh template
        const rakeshTemplate = allTemplates.find(t => t.name.toLowerCase().includes('rakesh'));
        if (rakeshTemplate) {
          setSelectedTemplate(rakeshTemplate);
          setRawJson(JSON.stringify(rakeshTemplate, null, 2));
          logDebug('TemplateDebug', 'Debug message', {});
        }
      }
    } catch (error) {
      logError('TemplateDebug', 'Error loading templates', { error });
      setTemplates([]);
    }
  };

  const analyzeTemplate = (template: Template) => {
    const issues: string[] = [];

    if (template.sections) {
      Object.entries(template.sections).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          if (!value.title && !value.aiInstructions) {
            issues.push(`Section '${key}' is object but missing title/aiInstructions`);
          }
          if (value.title && !value.aiInstructions) {
            issues.push(`Section '${key}' has title but no aiInstructions`);
          }
          if (!value.title && value.aiInstructions) {
            issues.push(`Section '${key}' has aiInstructions but no title`);
          }
        }
      });
    }

    return issues;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Template Debug Tool</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Template List */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">All Templates</h2>
              <button
                onClick={() => {
                  const rakeshTemplates = templates.filter(
                    t =>
                      t.name.toLowerCase().includes('rakesh') ||
                      t.name.toLowerCase().includes('222')
                  );
                  if (rakeshTemplates.length > 0) {
                    alert(
                      `Found ${rakeshTemplates.length} Rakesh template(s):\n${rakeshTemplates.map(t => `- ${t.name} (${t.id})`).join('\n')}`
                    );
                  } else {
                    alert('No Rakesh or 222 templates found');
                  }
                }}
                className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Find Rakesh/222
              </button>
            </div>
            <div className="space-y-2">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setRawJson(JSON.stringify(template, null, 2));
                  }}
                  className={`w-full text-left p-3 rounded-lg border ${
                    selectedTemplate?.id === template.id
                      ? 'bg-blue-50 border-blue-500'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-sm text-gray-500">
                    Type: {template.template_type} | Sections:{' '}
                    {Object.keys(template.sections || {}).length}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Template Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Template Analysis</h2>
            {selectedTemplate ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700">Name:</h3>
                  <p>{selectedTemplate.name}</p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700">Type:</h3>
                  <p>{selectedTemplate.template_type}</p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700">Sections:</h3>
                  <div className="mt-2 space-y-2">
                    {Object.entries(selectedTemplate.sections || {}).map(([key, value]) => (
                      <div key={key} className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium text-sm">Key: {key}</div>
                        <div className="text-sm mt-1">
                          Type: {typeof value}
                          {typeof value === 'object' && value !== null && (
                            <>
                              <br />
                              Has title: {value.title ? '✅' : '❌'}
                              <br />
                              Has aiInstructions: {value.aiInstructions ? '✅' : '❌'}
                              {value.title && (
                                <>
                                  <br />
                                  Title: {value.title}
                                </>
                              )}
                              {value.aiInstructions && (
                                <>
                                  <br />
                                  Instructions: {value.aiInstructions}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700">Issues:</h3>
                  <div className="mt-2">
                    {analyzeTemplate(selectedTemplate).length > 0 ? (
                      <ul className="list-disc list-inside space-y-1">
                        {analyzeTemplate(selectedTemplate).map((issue, i) => (
                          <li key={i} className="text-red-600 text-sm">
                            {issue}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-green-600 text-sm">✅ No issues found</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Select a template to analyze</p>
            )}
          </div>
        </div>

        {/* Raw JSON */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Raw Template JSON</h2>
          <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-xs">
            {rawJson || 'Select a template to view JSON'}
          </pre>
        </div>
      </div>
    </div>
  );
}
