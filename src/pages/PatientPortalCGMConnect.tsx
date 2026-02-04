/**
 * Patient Portal CGM Connect
 * Self-service wizard for patients to connect their CGM device.
 * 3-step flow: Select Device → Enter Credentials → Confirm Connection
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { CGM_DEVICES, DEXCOM_DEVICES, NIGHTSCOUT_DEVICES, type CGMDevice } from '../config/cgmDevices';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PatientSession {
  patientPhone: string;
  tshlaId: string;
  patientName: string;
  sessionId: string;
  sessionStart: string;
}

interface ExistingConfig {
  data_source: string;
  cgm_device_brand: string | null;
  connection_status: string;
  last_sync: string | null;
  dexcom_username: string | null;
  nightscout_url: string | null;
}

const PatientPortalCGMConnect: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [session, setSession] = useState<PatientSession | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDevice, setSelectedDevice] = useState<CGMDevice | null>(null);
  const [existingConfig, setExistingConfig] = useState<ExistingConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Credential fields
  const [dexcomUsername, setDexcomUsername] = useState('');
  const [dexcomPassword, setDexcomPassword] = useState('');
  const [nightscoutUrl, setNightscoutUrl] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  // Connection test
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Load session
  useEffect(() => {
    const stateSession = location.state?.session;
    if (stateSession) {
      setSession(stateSession);
      return;
    }

    const savedSession = sessionStorage.getItem('patient_portal_session');
    if (!savedSession) {
      navigate('/patient-portal-unified');
      return;
    }

    try {
      const parsed = JSON.parse(savedSession);
      const age = Date.now() - new Date(parsed.sessionStart).getTime();
      if (age < 2 * 60 * 60 * 1000 && age > 0) {
        setSession(parsed);
      } else {
        sessionStorage.removeItem('patient_portal_session');
        navigate('/patient-portal-unified');
      }
    } catch {
      navigate('/patient-portal-unified');
    }
  }, [navigate, location.state]);

  // Check existing CGM config
  useEffect(() => {
    if (!session) return;

    const checkExisting = async () => {
      try {
        const phone10 = session.patientPhone.replace(/\D/g, '').slice(-10);
        const res = await fetch(`${API_BASE_URL}/api/cgm/summary/${phone10}`);
        const data = await res.json();
        if (data.success && data.summary?.configured) {
          setExistingConfig({
            data_source: data.summary.dataSource,
            cgm_device_brand: null,
            connection_status: data.summary.connectionStatus,
            last_sync: data.summary.lastSync,
            dexcom_username: null,
            nightscout_url: null,
          });
        }
      } catch {
        // No existing config — that's fine
      } finally {
        setLoadingConfig(false);
      }
    };

    checkExisting();
  }, [session]);

  const handleSelectDevice = (device: CGMDevice) => {
    setSelectedDevice(device);
    setTestStatus('idle');
    setTestMessage('');
    setDexcomUsername('');
    setDexcomPassword('');
    setNightscoutUrl('');
    setApiSecret('');
    setStep(2);
  };

  const handleTestConnection = async () => {
    if (!selectedDevice || !session) return;

    setTestStatus('testing');
    setTestMessage('');

    try {
      const body: Record<string, string> = {
        dataSource: selectedDevice.connectionMethod,
      };

      if (selectedDevice.connectionMethod === 'dexcom_share') {
        if (!dexcomUsername || !dexcomPassword) {
          setTestStatus('error');
          setTestMessage('Please enter your username and password.');
          return;
        }
        body.dexcomUsername = dexcomUsername;
        body.dexcomPassword = dexcomPassword;
      } else {
        if (!nightscoutUrl || !apiSecret) {
          setTestStatus('error');
          setTestMessage('Please enter your Nightscout URL and API secret.');
          return;
        }
        body.nightscoutUrl = nightscoutUrl;
        body.apiSecret = apiSecret;
      }

      const res = await fetch(`${API_BASE_URL}/api/cgm/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setTestStatus('success');
        setTestMessage('Connection successful! Your credentials are valid.');
      } else {
        setTestStatus('error');
        setTestMessage(data.error || 'Connection failed. Please check your credentials and try again.');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Network error. Please check your internet connection and try again.');
    }
  };

  const handleSaveConnection = async () => {
    if (!selectedDevice || !session) return;

    setSaving(true);
    setSaveError('');

    try {
      const phone10 = session.patientPhone.replace(/\D/g, '').slice(-10);

      const body: Record<string, unknown> = {
        patientPhone: phone10,
        patientName: session.patientName,
        dataSource: selectedDevice.connectionMethod,
        cgmDeviceBrand: selectedDevice.id,
        configuredBy: 'patient',
        syncEnabled: true,
        syncIntervalMinutes: 15,
      };

      if (selectedDevice.connectionMethod === 'dexcom_share') {
        body.dexcomUsername = dexcomUsername;
        body.dexcomPassword = dexcomPassword;
      } else {
        body.nightscoutUrl = nightscoutUrl;
        body.apiSecret = apiSecret;
      }

      const res = await fetch(`${API_BASE_URL}/api/cgm/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': session.sessionId,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setStep(3);
      } else {
        setSaveError(data.error || 'Failed to save connection. Please try again.');
      }
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!session || loadingConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/patient-portal-unified', { state: { session } })}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Portal</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Connect Your CGM</h1>
              <p className="text-sm text-gray-600">
                Share your glucose data with your care team at TSHLA Medical
              </p>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  s < step
                    ? 'bg-green-500 text-white'
                    : s === step
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s < step ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              <span
                className={`text-xs hidden sm:block ${
                  s === step ? 'text-cyan-700 font-semibold' : 'text-gray-500'
                }`}
              >
                {s === 1 ? 'Select Device' : s === 2 ? 'Enter Credentials' : 'Connected'}
              </span>
              {s < 3 && <div className="flex-1 h-0.5 bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>

        {/* Already Connected Banner */}
        {existingConfig && step === 1 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Wifi className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800">CGM Already Connected</p>
                <p className="text-sm text-green-700 mt-1">
                  Your {existingConfig.data_source === 'dexcom_share' ? 'Dexcom' : 'Nightscout'} is currently connected
                  {existingConfig.connection_status === 'active' ? ' and syncing' : ''}.
                  {existingConfig.last_sync && (
                    <> Last sync: {new Date(existingConfig.last_sync).toLocaleString()}</>
                  )}
                </p>
                <p className="text-xs text-green-600 mt-2">
                  You can reconfigure below if you'd like to switch devices or update your credentials.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Select Device */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Direct Connection Group */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="w-4 h-4 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Direct Connection</h2>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Easiest</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DEXCOM_DEVICES.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => handleSelectDevice(device)}
                    className="bg-white border-2 border-gray-200 rounded-xl p-4 text-left hover:border-cyan-500 hover:shadow-md transition-all group"
                  >
                    <div className="text-2xl mb-2">{'\u{1F4E1}'}</div>
                    <div className="font-semibold text-gray-900 group-hover:text-cyan-700">{device.displayName}</div>
                    <div className="text-xs text-gray-500">{device.brand}</div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-cyan-500 mt-2 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            </div>

            {/* Nightscout Bridge Group */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Via Nightscout</h2>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Requires setup</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                These devices connect through a Nightscout server. You'll need to have Nightscout set up first.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {NIGHTSCOUT_DEVICES.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => handleSelectDevice(device)}
                    className="bg-white border-2 border-gray-200 rounded-xl p-4 text-left hover:border-blue-500 hover:shadow-md transition-all group"
                  >
                    <div className="font-semibold text-gray-900 group-hover:text-blue-700">{device.displayName}</div>
                    <div className="text-xs text-gray-500">{device.brand}</div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 mt-2 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Enter Credentials */}
        {step === 2 && selectedDevice && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
            <div>
              <button
                onClick={() => { setStep(1); setTestStatus('idle'); }}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
              >
                <ArrowLeft className="w-3 h-3" />
                Change device
              </button>
              <h2 className="text-xl font-bold text-gray-900">{selectedDevice.displayName}</h2>
              <p className="text-sm text-gray-600 mt-1">{selectedDevice.setupInstructions}</p>
              {selectedDevice.helpUrl && (
                <a
                  href={selectedDevice.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2"
                >
                  Setup Guide <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Dexcom Fields */}
            {selectedDevice.connectionMethod === 'dexcom_share' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dexcom Username
                  </label>
                  <input
                    type="text"
                    value={dexcomUsername}
                    onChange={(e) => setDexcomUsername(e.target.value)}
                    placeholder="Email or phone number"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dexcom Password
                  </label>
                  <input
                    type="password"
                    value={dexcomPassword}
                    onChange={(e) => setDexcomPassword(e.target.value)}
                    placeholder="Your Dexcom Share password"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    autoComplete="current-password"
                  />
                </div>
              </div>
            )}

            {/* Nightscout Fields */}
            {selectedDevice.connectionMethod === 'nightscout' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nightscout URL
                  </label>
                  <input
                    type="url"
                    value={nightscoutUrl}
                    onChange={(e) => setNightscoutUrl(e.target.value)}
                    placeholder="https://your-site.herokuapp.com"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Secret
                  </label>
                  <input
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Your Nightscout API secret"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Security Note */}
            <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-3">
              <Shield className="w-4 h-4 text-gray-500 mt-0.5" />
              <p className="text-xs text-gray-600">
                Your credentials are encrypted and stored securely. They are only used to sync glucose data with your care team.
              </p>
            </div>

            {/* Test Result */}
            {testStatus === 'success' && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-800">{testMessage}</span>
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <span className="text-sm text-red-800">{testMessage}</span>
              </div>
            )}

            {/* Save Error */}
            {saveError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <span className="text-sm text-red-800">{saveError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {testStatus !== 'success' ? (
                <button
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {testStatus === 'testing' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4" />
                      Test Connection
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSaveConnection}
                  disabled={saving}
                  className="flex-1 bg-cyan-600 text-white py-3 rounded-xl font-medium hover:bg-cyan-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Save & Connect
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && selectedDevice && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">You're Connected!</h2>
              <p className="text-gray-600">
                Your <strong>{selectedDevice.displayName}</strong> is now linked to your account at TSHLA Medical.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">Syncing every 15 minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-600" />
                <span className="text-sm text-gray-700">Your care team can now monitor your glucose readings</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">Your credentials are encrypted and secure</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/patient-portal-unified', { state: { session } })}
              className="w-full bg-cyan-600 text-white py-3 rounded-xl font-medium hover:bg-cyan-700 transition-colors"
            >
              Back to Portal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientPortalCGMConnect;
