import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatientData } from '../services/patientData.service';

const ELEVENLABS_VOICES = [
  { id: 'f6qhiUOSRVGsfwvD4oSU', name: 'Rakesh Patel', description: 'Custom voice' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Adam', description: 'Professional male' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Friendly female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Warm female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Mature male' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young female' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Casual male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Authoritative male' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'Documentary narrator' },
  { id: 'Yko7PKHZNXotIFUBG7I9', name: 'Callum', description: 'British male' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'British narrator' },
];

export default function PatientPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    | 'records'
    | 'appointments'
    | 'prescriptions'
    | 'messages'
    | 'avatar'
    | 'questionnaires'
    | 'talk-doctor'
  >('avatar');

  // Get patient ID from session
  const patientId = sessionStorage.getItem('patient_id')?.replace('pt-', '') || '444-444';
  const patientData = getPatientData(patientId);

  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isDoctorCallActive, setIsDoctorCallActive] = useState(false);
  const [phq9Answers, setPhq9Answers] = useState<number[]>(new Array(9).fill(0));
  const [gad7Answers, setGad7Answers] = useState<number[]>(new Array(7).fill(0));
  const [avatarMessage, setAvatarMessage] = useState('');
  const [doctorMessage, setDoctorMessage] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('f6qhiUOSRVGsfwvD4oSU'); // Rakesh Patel custom voice as default

  const phq9Questions = [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling/staying asleep or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself or that you are a failure',
    'Trouble concentrating on things',
    'Moving or speaking slowly/being fidgety or restless',
    'Thoughts that you would be better off dead or hurting yourself',
  ];

  const gad7Questions = [
    'Feeling nervous, anxious, or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    "Being so restless that it's hard to sit still",
    'Becoming easily annoyed or irritable',
    'Feeling afraid as if something awful might happen',
  ];

  useEffect(() => {
    // Welcome message with premium voice
    const welcomeMessage = `Welcome back, ${patientData?.name || 'valued patient'}. How can I assist you today?`;
    const voiceId = localStorage.getItem('azure_voice_id') || 'en-US-JennyNeural';

    return () => {
    };
  }, []);

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
  };

  const startAvatarConversation = async (topic: string) => {
    setIsAvatarSpeaking(true);
    let message = '';

    switch (topic) {
      case 'medications':
        message = `Hello ${patientData?.name}. I'm your medical record AVATAR. Let me explain your current medications. ${patientData?.medications
          .map(
            med => `You take ${med.name}, ${med.dosage}, ${med.frequency} for ${med.indication}.`
          )
          .join(
            ' '
          )} It's important to take all medications as prescribed. Do you have any questions about your medications?`;
        break;

      case 'diagnosis':
        message = `Your current diagnoses include: ${patientData?.diagnosis.join(', ')}. ${
          patientData?.diagnosis[0]?.includes('Diabetes')
            ? 'Diabetes requires regular monitoring of blood sugar, a healthy diet, and medication adherence.'
            : patientData?.diagnosis[0]?.includes('Depression')
              ? 'Depression is treatable with therapy and medication. Regular follow-ups are important.'
              : 'Your conditions are being actively managed by your healthcare team.'
        }`;
        break;

      case 'labs':
        message = `Your recent lab results show: ${patientData?.labResults
          .slice(0, 3)
          .map(
            lab =>
              `${lab.test} is ${lab.value}, which is ${lab.value.includes(lab.normal) ? 'normal' : 'slightly outside the normal range of ' + lab.normal}.`
          )
          .join(' ')} Your doctor will discuss these results at your next visit.`;
        break;

      case 'vitals':
        message = `Your last vital signs were: Blood pressure ${patientData?.vitalSigns.bp}, heart rate ${patientData?.vitalSigns.hr}, weight ${patientData?.vitalSigns.weight}. ${
          patientData?.vitalSigns.glucose
            ? `Blood glucose was ${patientData.vitalSigns.glucose}.`
            : ''
        } These measurements help track your health over time.`;
        break;

      default:
        message = `Hello ${patientData?.name}. I'm your medical record AVATAR. I can explain your medications, diagnoses, lab results, and answer questions about your health. What would you like to know?`;
    }

    setAvatarMessage(message);
    const voiceId = localStorage.getItem('azure_voice_id') || 'en-US-JennyNeural';

    setTimeout(() => setIsAvatarSpeaking(false), 5000);
  };

  const callDoctor = async () => {
    setIsDoctorCallActive(true);
    const greeting = `Hello ${patientData?.name}, this is Dr. Smith's virtual assistant. How can I help you today? You can ask about appointments, prescription refills, or leave a message for your doctor.`;
    setDoctorMessage(greeting);
    const voiceId = localStorage.getItem('azure_voice_id') || 'en-US-JennyNeural';

    setTimeout(() => setIsDoctorCallActive(false), 5000);
  };

  const calculatePHQ9Score = () => phq9Answers.reduce((a, b) => a + b, 0);
  const calculateGAD7Score = () => gad7Answers.reduce((a, b) => a + b, 0);

  const appointments = [
    {
      id: '1',
      date: '2025-02-15',
      time: '10:00 AM',
      doctor: 'Dr. Smith',
      type: 'Follow-up',
      status: 'Confirmed',
    },
    {
      id: '2',
      date: '2025-03-20',
      time: '2:00 PM',
      doctor: 'Dr. Johnson',
      type: 'Lab Review',
      status: 'Scheduled',
    },
    {
      id: '3',
      date: '2025-04-10',
      time: '9:00 AM',
      doctor: 'Dr. Smith',
      type: 'Annual Physical',
      status: 'Scheduled',
    },
  ];

  if (!patientData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Patient not found</h2>
          <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:text-blue-700">
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900">
                ← Back
              </button>
              <h1 className="text-lg font-semibold">Patient Portal</h1>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Patient Info Bar */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">{patientData.name}</h2>
              <p className="text-green-100 text-sm">
                MRN: {patientData.mrn} • DOB: {patientData.dob} • ID: {patientId}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-green-100">Diagnoses</p>
              <p className="text-sm font-semibold">{patientData.diagnosis[0]}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="px-4">
          <div className="flex space-x-6 overflow-x-auto">
            {(
              [
                'avatar',
                'records',
                'appointments',
                'prescriptions',
                'questionnaires',
                'talk-doctor',
                'messages',
              ] as const
            ).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-2 border-b-2 font-medium text-xs capitalize whitespace-nowrap transition ${
                  activeTab === tab
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'avatar'
                  ? '🤖 AVATAR Assistant'
                  : tab === 'records'
                    ? '📋 Medical Records'
                    : tab === 'appointments'
                      ? '📅 Appointments'
                      : tab === 'prescriptions'
                        ? '💊 Prescriptions'
                        : tab === 'questionnaires'
                          ? '📝 Mental Health'
                          : tab === 'talk-doctor'
                            ? '👨‍⚕️ Talk to Doctor'
                            : '✉️ Messages'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-4 py-6">
        {/* AVATAR - Talk to Your Chart */}
        {activeTab === 'avatar' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">🤖 Your Medical Record AVATAR</h3>
              <p className="text-sm text-gray-600 mb-4">
                I'm your personal medical assistant. I can explain your medications, diagnoses, and
                lab results in simple terms.
              </p>

              {/* Voice Selection */}
              <div className="mb-6 p-4 bg-gray-50 rounded">
                <label className="text-sm font-medium text-gray-700">Choose Avatar Voice:</label>
                <select
                  value={selectedVoice}
                  onChange={e => handleVoiceChange(e.target.value)}
                  className="ml-3 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                >
                  {ELEVENLABS_VOICES.map(voice => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} - {voice.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Avatar Topics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => startAvatarConversation('medications')}
                  disabled={isAvatarSpeaking}
                  className="p-4 bg-blue-100 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                >
                  <div className="text-2xl mb-2">💊</div>
                  <div className="text-sm font-medium">My Medications</div>
                </button>

                <button
                  onClick={() => startAvatarConversation('diagnosis')}
                  disabled={isAvatarSpeaking}
                  className="p-4 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50"
                >
                  <div className="text-2xl mb-2">🏥</div>
                  <div className="text-sm font-medium">My Conditions</div>
                </button>

                <button
                  onClick={() => startAvatarConversation('labs')}
                  disabled={isAvatarSpeaking}
                  className="p-4 bg-purple-100 rounded-lg hover:bg-purple-200 disabled:opacity-50"
                >
                  <div className="text-2xl mb-2">🔬</div>
                  <div className="text-sm font-medium">Lab Results</div>
                </button>

                <button
                  onClick={() => startAvatarConversation('vitals')}
                  disabled={isAvatarSpeaking}
                  className="p-4 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50"
                >
                  <div className="text-2xl mb-2">❤️</div>
                  <div className="text-sm font-medium">Vital Signs</div>
                </button>
              </div>

              {/* Avatar Message Display */}
              {avatarMessage && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">🤖</div>
                    <div className="flex-1">
                      <p className="text-sm text-blue-900">{avatarMessage}</p>
                      {isAvatarSpeaking && (
                        <p className="text-xs text-blue-600 mt-2 animate-pulse">Speaking...</p>
                      )}
                    </div>
                    {isAvatarSpeaking && (
                      <button
                        className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Voice Settings */}
              <div className="mt-6">
              </div>
            </div>
          </div>
        )}

        {/* Medical Records */}
        {activeTab === 'records' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <h3 className="text-lg font-semibold mb-4">Medical Records</h3>

            {/* Diagnoses */}
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-medium mb-3">Current Diagnoses</h4>
              <ul className="space-y-2">
                {patientData.diagnosis.map((dx, idx) => (
                  <li key={idx} className="flex items-center space-x-2">
                    <span className="text-green-600">✓</span>
                    <span className="text-sm">{dx}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Lab Results */}
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-medium mb-3">Recent Lab Results</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Test</th>
                      <th className="text-left py-2">Result</th>
                      <th className="text-left py-2">Normal</th>
                      <th className="text-left py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientData.labResults.map((lab, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-2">{lab.test}</td>
                        <td className="py-2 font-medium">{lab.value}</td>
                        <td className="py-2 text-gray-500">{lab.normal}</td>
                        <td className="py-2 text-gray-500">{lab.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vital Signs */}
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-medium mb-3">Current Vital Signs</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Blood Pressure</p>
                  <p className="font-semibold">{patientData.vitalSigns.bp}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Heart Rate</p>
                  <p className="font-semibold">{patientData.vitalSigns.hr} bpm</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Weight</p>
                  <p className="font-semibold">{patientData.vitalSigns.weight}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">BMI</p>
                  <p className="font-semibold">{patientData.vitalSigns.bmi}</p>
                </div>
                {patientData.vitalSigns.glucose && (
                  <div>
                    <p className="text-xs text-gray-500">Glucose</p>
                    <p className="font-semibold">{patientData.vitalSigns.glucose}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Appointments */}
        {activeTab === 'appointments' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Upcoming Appointments</h3>
              <button className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                Schedule New
              </button>
            </div>
            <div className="bg-white rounded-lg shadow">
              <div className="divide-y">
                {appointments.map(apt => (
                  <div key={apt.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {apt.type} with {apt.doctor}
                        </p>
                        <p className="text-sm text-gray-500">
                          {apt.date} at {apt.time}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          {apt.status}
                        </span>
                        <button className="text-blue-600 hover:text-blue-700 text-sm">
                          Reschedule
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Prescriptions */}
        {activeTab === 'prescriptions' && (
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold mb-4">Active Prescriptions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patientData.medications.map((rx, idx) => (
                <div key={idx} className="bg-white rounded-lg shadow p-4">
                  <h4 className="font-semibold mb-2">{rx.name}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Dosage:</span>
                      <span className="font-medium">{rx.dosage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Frequency:</span>
                      <span className="font-medium">{rx.frequency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">For:</span>
                      <span className="font-medium">{rx.indication}</span>
                    </div>
                  </div>
                  <button className="mt-3 w-full px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                    Request Refill
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mental Health Questionnaires */}
        {activeTab === 'questionnaires' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* PHQ-9 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">PHQ-9 Depression Screening</h3>
              <p className="text-sm text-gray-600 mb-4">
                Over the last 2 weeks, how often have you been bothered by:
              </p>
              {phq9Questions.map((question, idx) => (
                <div key={idx} className="mb-4">
                  <p className="text-sm mb-2">
                    {idx + 1}. {question}
                  </p>
                  <div className="flex space-x-4">
                    {[0, 1, 2, 3].map(score => (
                      <label key={score} className="flex items-center">
                        <input
                          type="radio"
                          name={`phq9-${idx}`}
                          value={score}
                          checked={phq9Answers[idx] === score}
                          onChange={() => {
                            const newAnswers = [...phq9Answers];
                            newAnswers[idx] = score;
                            setPhq9Answers(newAnswers);
                          }}
                          className="mr-1"
                        />
                        <span className="text-xs">
                          {score === 0
                            ? 'Not at all'
                            : score === 1
                              ? 'Several days'
                              : score === 2
                                ? 'More than half'
                                : 'Nearly every day'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="mt-4 p-4 bg-blue-50 rounded">
                <p className="font-medium">PHQ-9 Score: {calculatePHQ9Score()}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {calculatePHQ9Score() < 5
                    ? 'Minimal depression'
                    : calculatePHQ9Score() < 10
                      ? 'Mild depression'
                      : calculatePHQ9Score() < 15
                        ? 'Moderate depression'
                        : calculatePHQ9Score() < 20
                          ? 'Moderately severe depression'
                          : 'Severe depression'}
                </p>
              </div>
            </div>

            {/* GAD-7 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">GAD-7 Anxiety Screening</h3>
              <p className="text-sm text-gray-600 mb-4">
                Over the last 2 weeks, how often have you been bothered by:
              </p>
              {gad7Questions.map((question, idx) => (
                <div key={idx} className="mb-4">
                  <p className="text-sm mb-2">
                    {idx + 1}. {question}
                  </p>
                  <div className="flex space-x-4">
                    {[0, 1, 2, 3].map(score => (
                      <label key={score} className="flex items-center">
                        <input
                          type="radio"
                          name={`gad7-${idx}`}
                          value={score}
                          checked={gad7Answers[idx] === score}
                          onChange={() => {
                            const newAnswers = [...gad7Answers];
                            newAnswers[idx] = score;
                            setGad7Answers(newAnswers);
                          }}
                          className="mr-1"
                        />
                        <span className="text-xs">
                          {score === 0
                            ? 'Not at all'
                            : score === 1
                              ? 'Several days'
                              : score === 2
                                ? 'More than half'
                                : 'Nearly every day'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="mt-4 p-4 bg-blue-50 rounded">
                <p className="font-medium">GAD-7 Score: {calculateGAD7Score()}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {calculateGAD7Score() < 5
                    ? 'Minimal anxiety'
                    : calculateGAD7Score() < 10
                      ? 'Mild anxiety'
                      : calculateGAD7Score() < 15
                        ? 'Moderate anxiety'
                        : 'Severe anxiety'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Talk to Doctor */}
        {activeTab === 'talk-doctor' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">👨‍⚕️ Talk to Your Doctor</h3>
              <p className="text-sm text-gray-600 mb-4">
                Connect with your doctor's virtual assistant for questions, appointments, or
                prescription refills.
              </p>

              <div className="text-center py-8">
                <button
                  onClick={callDoctor}
                  disabled={isDoctorCallActive}
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isDoctorCallActive ? '📞 Call in Progress...' : "📞 Call Doctor's Office"}
                </button>
              </div>

              {doctorMessage && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">👨‍⚕️</div>
                    <div>
                      <p className="text-sm text-green-900">{doctorMessage}</p>
                      {isDoctorCallActive && (
                        <p className="text-xs text-green-600 mt-2 animate-pulse">Connected...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="p-4 bg-gray-100 rounded-lg hover:bg-gray-200">
                  <div className="text-2xl mb-2">📅</div>
                  <div className="text-sm font-medium">Schedule Appointment</div>
                </button>
                <button className="p-4 bg-gray-100 rounded-lg hover:bg-gray-200">
                  <div className="text-2xl mb-2">💊</div>
                  <div className="text-sm font-medium">Request Refill</div>
                </button>
                <button className="p-4 bg-gray-100 rounded-lg hover:bg-gray-200">
                  <div className="text-2xl mb-2">❓</div>
                  <div className="text-sm font-medium">Ask Question</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {activeTab === 'messages' && (
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold mb-4">Secure Messages</h3>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 text-gray-400 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-gray-500">No new messages</p>
                <button className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Send Message to Doctor
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
