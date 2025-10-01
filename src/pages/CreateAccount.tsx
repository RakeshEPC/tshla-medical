import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Phone,
  Building,
  Award,
  Calendar,
  MapPin,
  Shield,
  Check,
  AlertCircle,
  Stethoscope,
  GraduationCap,
  Briefcase,
  Users,
  FileText,
} from 'lucide-react';

interface RegistrationData {
  // Basic Information
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;

  // Professional Information
  role: 'doctor' | 'dietician' | 'psychiatrist' | 'nurse' | 'admin';
  specialty: string;
  subSpecialty?: string;
  licenseNumber: string;
  licenseState: string;
  npiNumber?: string; // National Provider Identifier
  deaNumber?: string; // DEA for prescribing

  // Education & Experience
  medicalSchool?: string;
  graduationYear?: string;
  residencyProgram?: string;
  fellowshipProgram?: string;
  yearsOfExperience: string;
  boardCertifications?: string[];

  // Practice Information
  practiceName: string;
  practiceAddress: string;
  practiceCity: string;
  practiceState: string;
  practiceZip: string;
  practicePhone?: string;
  practiceType: 'solo' | 'group' | 'hospital' | 'clinic' | 'other';

  // System Preferences
  emrExperience?: string[];
  preferredLanguage: string;
  timezone: string;

  // Compliance
  hipaaTrainingCompleted: boolean;
  backgroundCheckConsent: boolean;
  termsAccepted: boolean;
}

const SPECIALTIES = {
  doctor: [
    'Endocrinology',
    'Internal Medicine',
    'Family Medicine',
    'Cardiology',
    'Pulmonology',
    'Gastroenterology',
    'Nephrology',
    'Rheumatology',
    'Infectious Disease',
    'Hematology/Oncology',
    'Neurology',
    'Pediatrics',
    'Obstetrics/Gynecology',
    'Psychiatry',
    'Surgery',
    'Emergency Medicine',
    'Anesthesiology',
    'Radiology',
    'Pathology',
    'Other',
  ],
  dietician: [
    'Clinical Nutrition',
    'Diabetes Education',
    'Pediatric Nutrition',
    'Sports Nutrition',
    'Eating Disorders',
    'Weight Management',
    'Renal Nutrition',
    'Oncology Nutrition',
    'Critical Care Nutrition',
    'Community Nutrition',
    'Other',
  ],
  psychiatrist: [
    'Adult Psychiatry',
    'Child & Adolescent Psychiatry',
    'Geriatric Psychiatry',
    'Addiction Psychiatry',
    'Forensic Psychiatry',
    'Consultation-Liaison',
    'Neuropsychiatry',
    'Psychosomatic Medicine',
    'Sleep Medicine',
    'Other',
  ],
  nurse: [
    'Medical-Surgical',
    'Critical Care',
    'Emergency',
    'Pediatrics',
    'Obstetrics',
    'Oncology',
    'Psychiatric',
    'Community Health',
    'Case Management',
    'Other',
  ],
  admin: ['Healthcare Administration', 'Clinical Operations', 'IT', 'Other'],
  nutritionist: [
    'General Nutrition',
    'Sports Nutrition',
    'Weight Management',
    'Wellness Coaching',
    'Community Nutrition',
    'Corporate Wellness',
    'Other',
  ],
  medical_assistant: [
    'Clinical Support',
    'Administrative Support',
    'Phlebotomy',
    'EKG/ECG',
    'Injections',
    'Other',
  ],
  front_office: [
    'Reception',
    'Scheduling',
    'Patient Registration',
    'Insurance Verification',
    'Medical Records',
    'Other',
  ],
  billing: [
    'Medical Coding',
    'Claims Processing',
    'Insurance Appeals',
    'Payment Posting',
    'Patient Billing',
    'Other',
  ],
  prior_auth: [
    'Medication Authorization',
    'Procedure Authorization',
    'DME Authorization',
    'Appeals Management',
    'Other',
  ],
};

const EMR_SYSTEMS = [
  'Epic',
  'Cerner',
  'Athenahealth',
  'Allscripts',
  'NextGen',
  'eClinicalWorks',
  'Practice Fusion',
  'DrChrono',
  'Kareo',
  'Other',
];

export default function CreateAccount() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationData, string>>>({});
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<RegistrationData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'doctor',
    specialty: '',
    licenseNumber: '',
    licenseState: '',
    yearsOfExperience: '',
    practiceName: '',
    practiceAddress: '',
    practiceCity: '',
    practiceState: '',
    practiceZip: '',
    practiceType: 'group',
    preferredLanguage: 'English',
    timezone: 'America/New_York',
    hipaaTrainingCompleted: false,
    backgroundCheckConsent: false,
    termsAccepted: false,
    boardCertifications: [],
    emrExperience: [],
  });

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Partial<Record<keyof RegistrationData, string>> = {};

    // Define which roles require licenses
    const licensedRoles = ['doctor', 'psychiatrist', 'nurse', 'dietician'];
    const requiresLicense = licensedRoles.includes(formData.role);

    switch (stepNumber) {
      case 1: // Basic Information
        if (!formData.firstName) newErrors.firstName = 'First name is required';
        if (!formData.lastName) newErrors.lastName = 'Last name is required';
        if (!formData.email) newErrors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = 'Invalid email format';
        }
        if (!formData.password) newErrors.password = 'Password is required';
        else if (formData.password.length < 12) {
          newErrors.password = 'Password must be at least 12 characters';
        }
        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
        if (!formData.phone) newErrors.phone = 'Phone number is required';
        break;

      case 2: // Professional Information
        if (!formData.specialty) newErrors.specialty = 'Specialty is required';
        // Only require license for licensed roles
        if (requiresLicense) {
          if (!formData.licenseNumber) newErrors.licenseNumber = 'License number is required';
          if (!formData.licenseState) newErrors.licenseState = 'License state is required';
        }
        if (!formData.yearsOfExperience)
          newErrors.yearsOfExperience = 'Years of experience is required';
        break;

      case 3: // Practice Information
        if (!formData.practiceName) newErrors.practiceName = 'Practice name is required';
        if (!formData.practiceAddress) newErrors.practiceAddress = 'Practice address is required';
        if (!formData.practiceCity) newErrors.practiceCity = 'City is required';
        if (!formData.practiceState) newErrors.practiceState = 'State is required';
        if (!formData.practiceZip) newErrors.practiceZip = 'ZIP code is required';
        break;

      case 4: // Compliance & Consent
        if (!formData.hipaaTrainingCompleted) {
          newErrors.hipaaTrainingCompleted = 'HIPAA training confirmation is required';
        }
        if (!formData.backgroundCheckConsent) {
          newErrors.backgroundCheckConsent = 'Background check consent is required';
        }
        if (!formData.termsAccepted) {
          newErrors.termsAccepted = 'You must accept the terms and conditions';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setLoading(true);

    // Simulate account creation
    setTimeout(() => {
      // Store the new account data
      const newUser = {
        id: `user-${Date.now()}`,
        email: formData.email,
        name: `${formData.firstName} ${formData.lastName}`,
        role: formData.role,
        specialty: formData.specialty,
        licenseNumber: formData.licenseNumber,
        practiceName: formData.practiceName,
      };

      localStorage.setItem('pending_verification', JSON.stringify(newUser));

      // Redirect to verification page
      navigate('/account-verification');
    }, 2000);
  };

  const updateField = (field: keyof RegistrationData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Your Account</h1>
          <p className="text-gray-600">Join TSHLA Medical's network of healthcare professionals</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {[1, 2, 3, 4].map(stepNumber => (
              <div key={stepNumber} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step >= stepNumber ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step > stepNumber ? <Check className="w-5 h-5" /> : stepNumber}
                </div>
                {stepNumber < 4 && (
                  <div
                    className={`w-24 h-1 ${step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-8">
            <span className="text-xs text-gray-600">Basic Info</span>
            <span className="text-xs text-gray-600">Professional</span>
            <span className="text-xs text-gray-600">Practice</span>
            <span className="text-xs text-gray-600">Compliance</span>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center">
                <User className="w-6 h-6 mr-2 text-blue-600" />
                Basic Information
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={e => updateField('firstName', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={e => updateField('lastName', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => updateField('email', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Lock className="w-4 h-4 inline mr-1" />
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => updateField('password', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.password && (
                    <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Min 12 characters, include uppercase, lowercase, number, special character
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={e => updateField('confirmPassword', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => updateField('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={e => updateField('role', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="doctor">Doctor (MD/DO)</option>
                  <option value="dietician">Dietician (RD)</option>
                  <option value="psychiatrist">Psychiatrist</option>
                  <option value="nurse">Nurse (RN/NP)</option>
                  <option value="nutritionist">Nutritionist</option>
                  <option value="medical_assistant">Medical Assistant (MA)</option>
                  <option value="front_office">Front Office</option>
                  <option value="billing">Billing Specialist</option>
                  <option value="prior_auth">Prior Authorization</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center">
                <Stethoscope className="w-6 h-6 mr-2 text-blue-600" />
                Professional Information
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Specialty *
                  </label>
                  <select
                    value={formData.specialty}
                    onChange={e => updateField('specialty', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.specialty ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Specialty</option>
                    {(SPECIALTIES[formData.role] || SPECIALTIES.admin).map(spec => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                  {errors.specialty && (
                    <p className="text-red-500 text-xs mt-1">{errors.specialty}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub-Specialty (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.subSpecialty || ''}
                    onChange={e => updateField('subSpecialty', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {['doctor', 'psychiatrist', 'nurse', 'dietician'].includes(formData.role) && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Award className="w-4 h-4 inline mr-1" />
                      License Number *
                    </label>
                    <input
                      type="text"
                      value={formData.licenseNumber}
                      onChange={e => updateField('licenseNumber', e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.licenseNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.licenseNumber && (
                      <p className="text-red-500 text-xs mt-1">{errors.licenseNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      License State *
                    </label>
                    <input
                      type="text"
                      value={formData.licenseState}
                      onChange={e => updateField('licenseState', e.target.value)}
                      placeholder="e.g., CA, NY, TX"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.licenseState ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.licenseState && (
                      <p className="text-red-500 text-xs mt-1">{errors.licenseState}</p>
                    )}
                  </div>
                </div>
              )}

              {['doctor', 'psychiatrist', 'nurse'].includes(formData.role) && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      NPI Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.npiNumber || ''}
                      onChange={e => updateField('npiNumber', e.target.value)}
                      placeholder="10-digit NPI"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      DEA Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.deaNumber || ''}
                      onChange={e => updateField('deaNumber', e.target.value)}
                      placeholder="For prescribing providers"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Briefcase className="w-4 h-4 inline mr-1" />
                  Years of Experience *
                </label>
                <select
                  value={formData.yearsOfExperience}
                  onChange={e => updateField('yearsOfExperience', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.yearsOfExperience ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select Years</option>
                  <option value="0-2">0-2 years</option>
                  <option value="3-5">3-5 years</option>
                  <option value="6-10">6-10 years</option>
                  <option value="11-15">11-15 years</option>
                  <option value="16-20">16-20 years</option>
                  <option value="20+">20+ years</option>
                </select>
                {errors.yearsOfExperience && (
                  <p className="text-red-500 text-xs mt-1">{errors.yearsOfExperience}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <GraduationCap className="w-4 h-4 inline mr-1" />
                  Medical School / Training Program (Optional)
                </label>
                <input
                  type="text"
                  value={formData.medicalSchool || ''}
                  onChange={e => updateField('medicalSchool', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  EMR Experience (Select all that apply)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {EMR_SYSTEMS.map(emr => (
                    <label key={emr} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.emrExperience?.includes(emr) || false}
                        onChange={e => {
                          const current = formData.emrExperience || [];
                          if (e.target.checked) {
                            updateField('emrExperience', [...current, emr]);
                          } else {
                            updateField(
                              'emrExperience',
                              current.filter(e => e !== emr)
                            );
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{emr}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center">
                <Building className="w-6 h-6 mr-2 text-blue-600" />
                Practice Information
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Practice Name *
                </label>
                <input
                  type="text"
                  value={formData.practiceName}
                  onChange={e => updateField('practiceName', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.practiceName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.practiceName && (
                  <p className="text-red-500 text-xs mt-1">{errors.practiceName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Practice Type *
                </label>
                <select
                  value={formData.practiceType}
                  onChange={e => updateField('practiceType', e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="solo">Solo Practice</option>
                  <option value="group">Group Practice</option>
                  <option value="hospital">Hospital</option>
                  <option value="clinic">Clinic</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Practice Address *
                </label>
                <input
                  type="text"
                  value={formData.practiceAddress}
                  onChange={e => updateField('practiceAddress', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.practiceAddress ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.practiceAddress && (
                  <p className="text-red-500 text-xs mt-1">{errors.practiceAddress}</p>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                  <input
                    type="text"
                    value={formData.practiceCity}
                    onChange={e => updateField('practiceCity', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.practiceCity ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.practiceCity && (
                    <p className="text-red-500 text-xs mt-1">{errors.practiceCity}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                  <input
                    type="text"
                    value={formData.practiceState}
                    onChange={e => updateField('practiceState', e.target.value)}
                    placeholder="e.g., CA"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.practiceState ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.practiceState && (
                    <p className="text-red-500 text-xs mt-1">{errors.practiceState}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code *</label>
                  <input
                    type="text"
                    value={formData.practiceZip}
                    onChange={e => updateField('practiceZip', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.practiceZip ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.practiceZip && (
                    <p className="text-red-500 text-xs mt-1">{errors.practiceZip}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Language
                  </label>
                  <select
                    value={formData.preferredLanguage}
                    onChange={e => updateField('preferredLanguage', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Mandarin">Mandarin</option>
                    <option value="Hindi">Hindi</option>
                    <option value="French">French</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time Zone</label>
                  <select
                    value={formData.timezone}
                    onChange={e => updateField('timezone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="America/Anchorage">Alaska Time</option>
                    <option value="Pacific/Honolulu">Hawaii Time</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center">
                <Shield className="w-6 h-6 mr-2 text-blue-600" />
                Compliance & Consent
              </h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">HIPAA Compliance</h3>
                <p className="text-sm text-blue-700 mb-3">
                  TSHLA Medical is fully HIPAA compliant. All data is encrypted and access is logged
                  for audit purposes.
                </p>
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={formData.hipaaTrainingCompleted}
                    onChange={e => updateField('hipaaTrainingCompleted', e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <span className="text-sm">
                    I confirm that I have completed HIPAA training and understand my
                    responsibilities regarding protected health information (PHI) *
                  </span>
                </label>
                {errors.hipaaTrainingCompleted && (
                  <p className="text-red-500 text-xs mt-1 ml-6">{errors.hipaaTrainingCompleted}</p>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-2">Background Check</h3>
                <p className="text-sm text-yellow-700 mb-3">
                  A background check is required for all healthcare providers to ensure patient
                  safety.
                </p>
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={formData.backgroundCheckConsent}
                    onChange={e => updateField('backgroundCheckConsent', e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <span className="text-sm">
                    I consent to a background check and verification of my professional credentials
                    *
                  </span>
                </label>
                {errors.backgroundCheckConsent && (
                  <p className="text-red-500 text-xs mt-1 ml-6">{errors.backgroundCheckConsent}</p>
                )}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Terms & Conditions</h3>
                <div className="bg-white border border-gray-300 rounded p-3 mb-3 max-h-48 overflow-y-auto text-xs text-gray-600">
                  <p className="mb-2">
                    <strong>1. Acceptance of Terms</strong>
                    <br />
                    By creating an account, you agree to comply with all TSHLA Medical policies and
                    procedures.
                  </p>
                  <p className="mb-2">
                    <strong>2. Professional Conduct</strong>
                    <br />
                    You agree to maintain professional standards and provide accurate medical
                    information.
                  </p>
                  <p className="mb-2">
                    <strong>3. Data Security</strong>
                    <br />
                    You are responsible for maintaining the security of your login credentials.
                  </p>
                  <p className="mb-2">
                    <strong>4. Patient Privacy</strong>
                    <br />
                    You agree to protect patient privacy in accordance with HIPAA regulations.
                  </p>
                  <p>
                    <strong>5. Liability</strong>
                    <br />
                    TSHLA Medical provides tools for documentation but is not responsible for
                    clinical decisions.
                  </p>
                </div>
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={formData.termsAccepted}
                    onChange={e => updateField('termsAccepted', e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <span className="text-sm">
                    I have read and accept the Terms & Conditions and Privacy Policy *
                  </span>
                </label>
                {errors.termsAccepted && (
                  <p className="text-red-500 text-xs mt-1 ml-6">{errors.termsAccepted}</p>
                )}
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Next Steps
                </h3>
                <ol className="text-sm text-green-700 space-y-1 list-decimal list-inside">
                  <li>Your account will be created upon submission</li>
                  <li>We'll verify your credentials (usually within 24-48 hours)</li>
                  <li>You'll receive an email with login instructions</li>
                  <li>Complete the onboarding tutorial (15 minutes)</li>
                  <li>Start using TSHLA Medical!</li>
                </ol>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="ml-auto px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign In
            </a>
          </p>
          <p className="mt-2">
            Need help? Contact{' '}
            <a href="mailto:support@tshla.ai" className="text-blue-600 hover:text-blue-700">
              support@tshla.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
