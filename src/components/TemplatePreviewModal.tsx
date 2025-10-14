import { X, FileText, CheckCircle, Circle, AlertCircle, Sparkles } from 'lucide-react';
import { type DoctorTemplate } from '../services/doctorProfile.service';
import '../styles/modal.css';

interface TemplatePreviewModalProps {
  template: DoctorTemplate;
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate?: () => void;
  currentTemplateId?: string;
}

export default function TemplatePreviewModal({
  template,
  isOpen,
  onClose,
  onUseTemplate,
  currentTemplateId
}: TemplatePreviewModalProps) {
  if (!isOpen) return null;

  const isCurrentlyActive = currentTemplateId === template.id;
  const sections = Object.entries(template.sections);
  const requiredCount = sections.filter(([_, section]) => section.required).length;
  const optionalCount = sections.length - requiredCount;

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="modal-container">
        <div className="modal-content template-preview-modal">
          {/* Header */}
          <div className="modal-header">
            <div className="flex items-start gap-3 flex-1">
              <div className="modal-icon bg-blue-100">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {template.name}
                </h2>
                {template.description && (
                  <p className="text-sm text-gray-600">{template.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {template.specialty && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      📋 {template.specialty}
                    </span>
                  )}
                  {template.noteFormat && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      ✍️ {template.noteFormat}
                    </span>
                  )}
                  {isCurrentlyActive && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      ✓ Currently Active
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="modal-close-button"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{sections.length}</div>
              <div className="text-xs text-gray-600">Total Sections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{requiredCount}</div>
              <div className="text-xs text-gray-600">Required</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{optionalCount}</div>
              <div className="text-xs text-gray-600">Optional</div>
            </div>
          </div>

          {/* General Instructions */}
          {template.generalInstructions && (
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-purple-900">General AI Instructions</h3>
              </div>
              <p className="text-sm text-purple-800 whitespace-pre-wrap">{template.generalInstructions}</p>
            </div>
          )}

          {/* Sections List */}
          <div className="modal-body">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Template Sections
            </h3>

            <div className="space-y-3">
              {sections.map(([key, section]) => (
                <div
                  key={key}
                  className={`section-card ${section.required ? 'section-required' : 'section-optional'}`}
                >
                  {/* Section Header */}
                  <div className="flex items-start gap-3 mb-2">
                    <div className="section-icon">
                      {section.required ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{section.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          section.required
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {section.required ? 'Required' : 'Optional'}
                        </span>
                      </div>

                      {section.description && (
                        <p className="text-sm text-gray-600 mt-1">{section.description}</p>
                      )}

                      {/* AI Instructions for this section */}
                      {section.aiInstructions && (
                        <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                          <div className="flex items-center gap-1 mb-1">
                            <AlertCircle className="w-3 h-3 text-gray-500" />
                            <span className="text-xs font-medium text-gray-700">AI Instructions:</span>
                          </div>
                          <p className="text-xs text-gray-600">{section.aiInstructions}</p>
                        </div>
                      )}

                      {/* Format hint */}
                      {section.format && (
                        <div className="mt-2 text-xs text-gray-500">
                          Format: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{section.format}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              onClick={onClose}
              className="btn-modal btn-modal-secondary"
            >
              Close
            </button>
            {onUseTemplate && !isCurrentlyActive && (
              <button
                onClick={() => {
                  onUseTemplate();
                  onClose();
                }}
                className="btn-modal btn-modal-primary"
              >
                <FileText className="w-4 h-4" />
                Use This Template
              </button>
            )}
            {isCurrentlyActive && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Currently Active
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
