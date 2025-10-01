import { useState } from 'react';
import { accountCreationService } from '../services/accountCreation.service';

interface PasswordChangeModalProps {
  email: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function PasswordChangeModal({
  email,
  onSuccess,
  onCancel,
}: PasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  const checkPasswordStrength = (password: string) => {
    setPasswordStrength({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*]/.test(password),
    });
  };

  const handlePasswordChange = (value: string) => {
    setNewPassword(value);
    checkPasswordStrength(value);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (
      !passwordStrength.length ||
      !passwordStrength.uppercase ||
      !passwordStrength.lowercase ||
      !passwordStrength.number
    ) {
      setError('Password does not meet requirements');
      return;
    }

    setIsChanging(true);

    try {
      const success = await accountCreationService.changePassword(
        email,
        currentPassword,
        newPassword
      );

      if (success) {
        onSuccess();
      } else {
        setError('Current password is incorrect');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Change Required</h2>
          <p className="text-gray-600">
            For security reasons, you must change your temporary password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Password (Temporary)
            </label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter your temporary password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This is the password you received (format: Word####)
            </p>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={e => handlePasswordChange(e.target.value)}
                placeholder="Create a strong password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPasswords ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Password Strength Indicators */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Password Requirements:</p>
            <div className="space-y-1">
              <div
                className={`flex items-center text-xs ${passwordStrength.length ? 'text-green-600' : 'text-gray-400'}`}
              >
                <span className="mr-2">{passwordStrength.length ? '✓' : '○'}</span>
                At least 8 characters
              </div>
              <div
                className={`flex items-center text-xs ${passwordStrength.uppercase ? 'text-green-600' : 'text-gray-400'}`}
              >
                <span className="mr-2">{passwordStrength.uppercase ? '✓' : '○'}</span>
                One uppercase letter
              </div>
              <div
                className={`flex items-center text-xs ${passwordStrength.lowercase ? 'text-green-600' : 'text-gray-400'}`}
              >
                <span className="mr-2">{passwordStrength.lowercase ? '✓' : '○'}</span>
                One lowercase letter
              </div>
              <div
                className={`flex items-center text-xs ${passwordStrength.number ? 'text-green-600' : 'text-gray-400'}`}
              >
                <span className="mr-2">{passwordStrength.number ? '✓' : '○'}</span>
                One number
              </div>
              <div
                className={`flex items-center text-xs ${passwordStrength.special ? 'text-green-600' : 'text-gray-400'}`}
              >
                <span className="mr-2">{passwordStrength.special ? '✓' : '○'}</span>
                One special character (optional but recommended)
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Error Message */}
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={
                isChanging ||
                !passwordStrength.length ||
                !passwordStrength.uppercase ||
                !passwordStrength.lowercase ||
                !passwordStrength.number
              }
              className={`flex-1 py-2 rounded-lg font-semibold text-white ${
                isChanging ||
                !passwordStrength.length ||
                !passwordStrength.uppercase ||
                !passwordStrength.lowercase ||
                !passwordStrength.number
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isChanging ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>

        {/* Security Tips */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Tips:</strong> Use a password manager to generate and store secure passwords.
            Avoid using personal information or common words.
          </p>
        </div>
      </div>
    </div>
  );
}
