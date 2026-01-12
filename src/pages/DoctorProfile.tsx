import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, Settings, Mic, Monitor, FileText } from 'lucide-react';
import { doctorProfileService, type DoctorSettings } from '../services/doctorProfile.service';
import { supabaseAuthService as unifiedAuthService } from '../services/supabaseAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function DoctorProfile() {
  const navigate = useNavigate();
  const currentUser = unifiedAuthService.getCurrentUser();
  const currentDoctor = currentUser?.name || 'Dr. Smith';
  const [settings, setSettings] = useState<DoctorSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (currentDoctor) {
        doctorProfileService.initialize(currentDoctor.id);
        try {
          const doctorSettings = await doctorProfileService.getSettings();
          setSettings(doctorSettings);
        } catch (error) {
          logError('DoctorProfile', 'Error message', {});
          // Use default settings as fallback
          setSettings({
            aiStyle: 'formal',
            autoProcessAfterRecording: true,
            displayPreferences: {
              showInterimTranscript: true,
              highlightMedicalTerms: true,
              autoSaveInterval: 30,
            },
            recordingPreferences: {
              mode: 'dictation',
              autoStopAfterSilence: 3,
              showVideoPreview: false,
            },
          });
        }
      }
    };
    loadSettings();
  }, [currentDoctor]);

  const handleSave = async () => {
    if (!settings || !currentDoctor) return;

    setSaving(true);
    try {
      await doctorProfileService.updateSettings(settings, currentDoctor.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      logError('DoctorProfile', 'Error message', {});
      alert('Failed to save settings');
    }
    setSaving(false);
  };

  const updateSetting = (path: string, value: any) => {
    if (!settings) return;

    const newSettings = { ...settings };
    const keys = path.split('.');
    let current: any = newSettings;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    setSettings(newSettings);
  };

  if (!currentDoctor || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to access profile settings</p>
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
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/staff-dashboard')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold">Profile Settings</h1>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Doctor Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Doctor Information</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Name</label>
              <p className="font-medium">{currentDoctor.name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Specialty</label>
              <p className="font-medium">{currentDoctor.specialty || 'General Practice'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Email</label>
              <p className="font-medium">{currentDoctor.email || 'Not set'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Doctor ID</label>
              <p className="font-medium text-gray-500">{currentDoctor.id}</p>
            </div>
          </div>
        </div>

        {/* AI Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">AI Processing Settings</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Writing Style
              </label>
              <select
                value={settings.aiStyle}
                onChange={e => updateSetting('aiStyle', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="formal">Formal - Professional medical documentation</option>
                <option value="conversational">Conversational - Natural, friendly tone</option>
                <option value="concise">Concise - Brief and to the point</option>
                <option value="detailed">Detailed - Comprehensive with all details</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.autoProcessAfterRecording}
                  onChange={e => updateSetting('autoProcessAfterRecording', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Automatically process with AI after recording stops
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Recording Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Mic className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Recording Preferences</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Recording Mode
              </label>
              <select
                value={settings.recordingPreferences?.mode || 'dictation'}
                onChange={e => updateSetting('recordingPreferences.mode', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="dictation">Dictation - Single speaker</option>
                <option value="conversation">Conversation - Doctor-patient dialogue</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto-stop after silence (seconds)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={settings.recordingPreferences?.autoStopAfterSilence || 3}
                onChange={e =>
                  updateSetting(
                    'recordingPreferences.autoStopAfterSilence',
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Set to 0 to disable auto-stop</p>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Monitor className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Display Preferences</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.displayPreferences?.showInterimTranscript !== false}
                  onChange={e =>
                    updateSetting('displayPreferences.showInterimTranscript', e.target.checked)
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Show live transcription while recording
                </span>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.displayPreferences?.highlightMedicalTerms !== false}
                  onChange={e =>
                    updateSetting('displayPreferences.highlightMedicalTerms', e.target.checked)
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Highlight medical terms in transcripts
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto-save interval (seconds)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                step="10"
                value={settings.displayPreferences?.autoSaveInterval || 30}
                onChange={e =>
                  updateSetting('displayPreferences.autoSaveInterval', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">How often to auto-save drafts</p>
            </div>
          </div>
        </div>

        {/* Template Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Template Management</h2>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => navigate('/templates/doctor')}
              className="w-full px-4 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-left"
            >
              <div className="font-medium">Manage My Templates</div>
              <div className="text-sm text-blue-500 mt-1">
                Create, edit, and organize your custom note templates
              </div>
            </button>

            <button
              onClick={() => navigate('/templates/import-export')}
              className="w-full px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition text-left"
            >
              <div className="font-medium">Import/Export Templates</div>
              <div className="text-sm text-gray-500 mt-1">
                Share templates or backup your configurations
              </div>
            </button>
          </div>
        </div>

        {/* Export/Import Profile */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => {
              const json = doctorProfileService.exportProfile(currentDoctor.id);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `doctor-profile-${currentDoctor.id}-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Export Profile
          </button>

          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = e => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = e => {
                    try {
                      doctorProfileService.importProfile(
                        e.target?.result as string,
                        currentDoctor.id
                      );
                      alert('Profile imported successfully!');
                      window.location.reload();
                    } catch (error) {
                      alert(`Failed to import profile: ${error.message}`);
                    }
                  };
                  reader.readAsText(file);
                }
              };
              input.click();
            }}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Import Profile
          </button>
        </div>
      </div>
    </div>
  );
}
