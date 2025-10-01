import { useState } from 'react';
import { Shield, Smartphone, Key, Check, X, Copy, AlertCircle } from 'lucide-react';
import { twoFactorAuthService } from '../services/twoFactorAuth.service';

interface TwoFactorSetupProps {
  userId: string;
  userEmail: string;
  onComplete: (secret: string) => void;
  onCancel: () => void;
}

export default function TwoFactorSetup({
  userId,
  userEmail,
  onComplete,
  onCancel,
}: TwoFactorSetupProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleSetup = async () => {
    try {
      const result = await twoFactorAuthService.generateSecret(userId, userEmail);
      setSecret(result.secret);
      setQrCode(result.qrCode);
      setBackupCodes(result.backupCodes);
      setStep('verify');
    } catch (err) {
      setError('Failed to generate 2FA secret');
    }
  };

  const handleVerify = () => {
    if (twoFactorAuthService.verifyToken(verificationCode, secret)) {
      setStep('backup');
      setError('');
    } else {
      setError('Invalid verification code. Please try again.');
    }
  };

  const handleComplete = () => {
    onComplete(secret);
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const downloadBackupCodes = () => {
    const content =
      `TSHLA Medical - 2FA Backup Codes\n${'-'.repeat(40)}\n\n` +
      `Generated: ${new Date().toLocaleString()}\n` +
      `User: ${userEmail}\n\n` +
      `IMPORTANT: Store these codes safely. Each code can only be used once.\n\n` +
      backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tshla-medical-2fa-backup-codes.txt';
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold">Two-Factor Authentication</h2>
            <p className="text-sm text-gray-600">HIPAA-compliant security</p>
          </div>
        </div>

        {/* Setup Step */}
        {step === 'setup' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Enhanced Security</h3>
              <p className="text-sm text-blue-800">
                2FA adds an extra layer of protection to your account, required for HIPAA
                compliance.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium">Install Authenticator App</p>
                  <p className="text-sm text-gray-600">
                    Google Authenticator, Microsoft Authenticator, or Authy
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium">Scan QR Code</p>
                  <p className="text-sm text-gray-600">Use your authenticator app to scan</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium">Enter Verification Code</p>
                  <p className="text-sm text-gray-600">Confirm setup with a 6-digit code</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSetup}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
              >
                Begin Setup
              </button>
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Verify Step */}
        {step === 'verify' && (
          <div className="space-y-4">
            <div className="text-center">
              <img src={qrCode} alt="2FA QR Code" className="mx-auto mb-4" />
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code with your authenticator app
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter 6-digit code from your app
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-mono"
                placeholder="000000"
                maxLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleVerify}
                disabled={verificationCode.length !== 6}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
              >
                Verify Code
              </button>
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Backup Codes Step */}
        {step === 'backup' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">✅ 2FA Enabled Successfully</h3>
              <p className="text-sm text-green-800">
                Save these backup codes in a secure location. Use them if you lose access to your
                authenticator.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <button
                    key={index}
                    onClick={() => copyToClipboard(code)}
                    className="relative font-mono text-sm p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-left"
                  >
                    {code}
                    {copiedCode === code && (
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-green-600">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadBackupCodes}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Download Codes
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition"
              >
                Complete Setup
              </button>
            </div>

            <p className="text-xs text-center text-gray-500">
              Each backup code can only be used once
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
