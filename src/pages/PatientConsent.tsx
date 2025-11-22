/**
 * Patient Consent Page
 * For patients to review and electronically sign PCM consent form
 * Accessed via email invitation link
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileText, AlertCircle, User } from 'lucide-react';

export default function PatientConsent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);

  const [email, setEmail] = useState('');
  const [patientName, setPatientName] = useState('');
  const [signature, setSignature] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Get email from URL parameter
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, [searchParams]);

  // Signature canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);

    // Save signature as data URL
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  };

  const handleSubmit = async () => {
    if (!patientName.trim()) {
      alert('Please enter your full name');
      return;
    }

    if (!signature) {
      alert('Please provide your signature');
      return;
    }

    if (!hasAgreed) {
      alert('Please confirm that you have read and agree to the consent form');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Save consent to database
      // await supabase.from('pcm_consents').insert({
      //   patient_email: email,
      //   patient_name: patientName,
      //   signature_data: signature,
      //   consented_at: new Date().toISOString(),
      //   ip_address: await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => d.ip),
      //   consent_version: '1.0'
      // });

      console.log('✅ Consent submitted:', {
        email,
        patientName,
        signatureLength: signature.length,
        timestamp: new Date().toISOString()
      });

      setIsComplete(true);

      // Redirect to patient portal after 3 seconds
      setTimeout(() => {
        navigate('/patient-login');
      }, 3000);

    } catch (error) {
      console.error('Error submitting consent:', error);
      alert('Failed to submit consent form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Consent Form Signed!</h2>
          <p className="text-gray-600 mb-4">
            Thank you for completing the consent form. You can now access your patient portal.
          </p>
          <p className="text-sm text-gray-500">Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg">
          {/* Header */}
          <div className="bg-blue-600 text-white p-6 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Principal Care Management (PCM)</h1>
                <p className="text-blue-100">Consent Form</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Patient Info */}
            <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Patient Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Legal Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
                    placeholder="Enter your full name as it appears on your ID"
                  />
                </div>
              </div>
            </div>

            {/* Consent Text */}
            <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50 max-h-96 overflow-y-auto">
              <h2 className="font-semibold text-gray-900 mb-4">Consent for Principal Care Management Services</h2>

              <div className="space-y-4 text-sm text-gray-700">
                <p>
                  I hereby consent to receive Principal Care Management (PCM) services from TSHLA Medical. I understand that PCM services include:
                </p>

                <ul className="list-disc ml-6 space-y-2">
                  <li>Regular communication with my care team regarding my chronic conditions</li>
                  <li>Medication management and coordination</li>
                  <li>Lab result tracking and goal setting</li>
                  <li>Care coordination between different healthcare providers</li>
                  <li>24/7 access to my health records through the patient portal</li>
                  <li>Monthly check-ins and progress monitoring</li>
                </ul>

                <p className="font-semibold mt-4">I understand and agree that:</p>

                <ul className="list-disc ml-6 space-y-2">
                  <li>PCM services are provided in addition to my regular office visits</li>
                  <li>My insurance may be billed for PCM services (typically covered by Medicare and most insurance plans)</li>
                  <li>I can withdraw from PCM services at any time by notifying my provider</li>
                  <li>My protected health information will be used only for care coordination and will be kept confidential according to HIPAA regulations</li>
                  <li>The care team may contact me by phone, email, or text message for care coordination purposes</li>
                </ul>

                <p className="mt-4">
                  <strong>Consent Period:</strong> This consent is effective from the date of signing and will remain in effect until I revoke it in writing or verbally to my healthcare provider.
                </p>

                <p className="mt-4">
                  <strong>Contact Information:</strong> I can reach my care team at (555) 123-4567 or support@tshla.ai with any questions or concerns about my PCM services.
                </p>
              </div>
            </div>

            {/* Agreement Checkbox */}
            <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAgreed}
                  onChange={(e) => setHasAgreed(e.target.checked)}
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="text-sm text-gray-800">
                  I have read and understand the above consent form. I agree to participate in the Principal Care Management program and authorize TSHLA Medical to bill my insurance for these services.
                </div>
              </label>
            </div>

            {/* Signature Canvas */}
            <div className="border-2 border-gray-300 rounded-lg p-6 bg-white">
              <div className="flex items-center justify-between mb-4">
                <label className="font-semibold text-gray-900">
                  Electronic Signature <span className="text-red-600">*</span>
                </label>
                <button
                  onClick={clearSignature}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Clear
                </button>
              </div>

              <div className="border-2 border-dashed border-gray-400 rounded-lg overflow-hidden">
                <canvas
                  ref={signatureCanvasRef}
                  width={600}
                  height={200}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full cursor-crosshair bg-white"
                  style={{ touchAction: 'none' }}
                />
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Sign above using your mouse or touch screen
              </p>

              {signature && (
                <div className="mt-4 p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Signature captured
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t border-gray-200">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !patientName.trim() || !signature || !hasAgreed}
                className={`w-full py-4 font-bold text-lg rounded-lg transition flex items-center justify-center gap-2 ${
                  isSubmitting || !patientName.trim() || !signature || !hasAgreed
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <CheckCircle2 className="w-6 h-6" />
                {isSubmitting ? 'Submitting...' : 'Sign and Submit Consent Form'}
              </button>

              {(!patientName.trim() || !signature || !hasAgreed) && (
                <div className="mt-4 p-3 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Please complete all required fields and provide your signature
                  </p>
                </div>
              )}
            </div>

            {/* Legal Disclaimer */}
            <div className="text-xs text-gray-500 text-center">
              <p>By signing this form electronically, I agree that my electronic signature is the legal equivalent of my manual signature.</p>
              <p className="mt-2">Timestamp: {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
