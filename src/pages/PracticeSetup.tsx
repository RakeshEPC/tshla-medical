import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building, Users, Plus, Mail, Link, Settings, 
  Shield, CreditCard, Check, X, Copy, Send,
  UserPlus, Eye, Calendar, FileText, DollarSign
} from 'lucide-react';
import {
  SAMPLE_PRACTICES,
  SAMPLE_MEMBERS,
  PRACTICE_PLANS,
  generateInvitationCode,
  createInvitationLink,
  getUserPractices,
  getPracticeMembers
} from '../config/practiceManagement';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function PracticeSetup() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'manage'>('create');
  const [invitationCode, setInvitationCode] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Form state for creating practice
  const [practiceData, setPracticeData] = useState({
    name: '',
    type: 'group' as const,
    address: {
      street: '',
      suite: '',
      city: '',
      state: '',
      zip: ''
    },
    phone: '',
    email: '',
    taxId: '',
    plan: 'professional' as const,
    settings: {
      sharePatients: true,
      requireApproval: true,
      allowCrossScheduling: true,
      sharedTemplates: true,
      unifiedBilling: false
    }
  });

  // Invitation form
  const [inviteData, setInviteData] = useState({
    email: '',
    name: '',
    role: 'doctor' as const,
    message: ''
  });

  // For demo, assume user is logged in
  const currentUser = {
    id: 'doc-001',
    name: 'Dr. Sarah Smith',
    email: 'dr.smith@tshla.ai'
  };

  const userPractices = getUserPractices(currentUser.id);
  const currentPractice = userPractices[0]; // For demo
  const practiceMembers = currentPractice ? getPracticeMembers(currentPractice.id) : [];

  const handleCreatePractice = () => {
    // In real app, this would save to database
    logDebug('PracticeSetup', 'Debug message', {});
    alert('Practice created successfully! You can now invite team members.');
    setActiveTab('manage');
  };

  const handleJoinPractice = () => {
    // Validate invitation code
    if (invitationCode.length !== 8) {
      alert('Invalid invitation code');
      return;
    }
    
    // In real app, this would validate with backend
    alert(`Joining practice with code: ${invitationCode}`);
    navigate('/staff-dashboard');
  };

  const handleSendInvitation = () => {
    const code = generateInvitationCode();
    const link = createInvitationLink(currentPractice?.id || 'practice-001', code);
    
    logDebug('PracticeSetup', 'Debug message', {});
    
    alert(`Invitation sent to ${inviteData.email}!`);
    setShowInviteModal(false);
    setInviteData({ email: '', name: '', role: 'doctor', message: '' });
  };

  const copyInvitationLink = () => {
    const code = generateInvitationCode();
    const link = createInvitationLink(currentPractice?.id || 'practice-001', code);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Practice Management</h1>
          <p className="text-gray-600">Create, join, or manage your medical practice</p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-t-xl shadow-sm border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'create'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Create Practice
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'join'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Join Practice
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'manage'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Manage Practice
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-xl shadow-xl p-8">
          {/* Create Practice Tab */}
          {activeTab === 'create' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6">Create New Practice</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Practice Name *
                  </label>
                  <input
                    type="text"
                    value={practiceData.name}
                    onChange={(e) => setPracticeData({...practiceData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Smith Medical Group"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Practice Type *
                  </label>
                  <select
                    value={practiceData.type}
                    onChange={(e) => setPracticeData({...practiceData, type: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="solo">Solo Practice</option>
                    <option value="group">Group Practice</option>
                    <option value="clinic">Clinic</option>
                    <option value="hospital">Hospital</option>
                    <option value="health_system">Health System</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax ID / EIN (Optional)
                </label>
                <input
                  type="text"
                  value={practiceData.taxId}
                  onChange={(e) => setPracticeData({...practiceData, taxId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="XX-XXXXXXX"
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Practice Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={practiceData.settings.sharePatients}
                      onChange={(e) => setPracticeData({
                        ...practiceData,
                        settings: {...practiceData.settings, sharePatients: e.target.checked}
                      })}
                      className="mr-3"
                    />
                    <div>
                      <span className="font-medium">Share Patients</span>
                      <p className="text-xs text-gray-500">All providers can view all practice patients</p>
                    </div>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={practiceData.settings.requireApproval}
                      onChange={(e) => setPracticeData({
                        ...practiceData,
                        settings: {...practiceData.settings, requireApproval: e.target.checked}
                      })}
                      className="mr-3"
                    />
                    <div>
                      <span className="font-medium">Require Approval</span>
                      <p className="text-xs text-gray-500">New members need admin approval to join</p>
                    </div>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={practiceData.settings.allowCrossScheduling}
                      onChange={(e) => setPracticeData({
                        ...practiceData,
                        settings: {...practiceData.settings, allowCrossScheduling: e.target.checked}
                      })}
                      className="mr-3"
                    />
                    <div>
                      <span className="font-medium">Cross-Scheduling</span>
                      <p className="text-xs text-gray-500">Providers can schedule appointments for each other</p>
                    </div>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={practiceData.settings.sharedTemplates}
                      onChange={(e) => setPracticeData({
                        ...practiceData,
                        settings: {...practiceData.settings, sharedTemplates: e.target.checked}
                      })}
                      className="mr-3"
                    />
                    <div>
                      <span className="font-medium">Shared Templates</span>
                      <p className="text-xs text-gray-500">Share note templates across the practice</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Choose Your Plan</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {Object.entries(PRACTICE_PLANS).map(([key, plan]) => (
                    <div
                      key={key}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        practiceData.plan === key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setPracticeData({...practiceData, plan: key as any})}
                    >
                      <h4 className="font-semibold text-lg mb-2">{plan.name}</h4>
                      <p className="text-2xl font-bold text-blue-600 mb-3">{plan.price}</p>
                      <ul className="space-y-1 text-sm">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start">
                            <Check className="w-4 h-4 text-green-500 mr-1 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreatePractice}
                className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 transition-colors"
              >
                Create Practice
              </button>
            </div>
          )}

          {/* Join Practice Tab */}
          {activeTab === 'join' && (
            <div className="max-w-md mx-auto py-8">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Join a Practice</h2>
                <p className="text-gray-600">Enter the invitation code from your practice administrator</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invitation Code
                  </label>
                  <input
                    type="text"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-xl font-mono"
                    placeholder="ABCD1234"
                    maxLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    The 8-character code should be provided by your practice administrator
                  </p>
                </div>

                <button
                  onClick={handleJoinPractice}
                  disabled={invitationCode.length !== 8}
                  className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join Practice
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Don't have a code?</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Ask your practice administrator to send you an invitation
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your own practice →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manage Practice Tab */}
          {activeTab === 'manage' && (
            <div className="space-y-6">
              {currentPractice ? (
                <>
                  {/* Practice Overview */}
                  <div className="bg-blue-50 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-blue-900 mb-2">
                          {currentPractice.name}
                        </h2>
                        <p className="text-blue-700">
                          {currentPractice.address.street}, {currentPractice.address.city}, {currentPractice.address.state}
                        </p>
                        <div className="mt-3 flex items-center space-x-4 text-sm">
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                            {currentPractice.type}
                          </span>
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                            {currentPractice.plan} plan
                          </span>
                          <span className="text-blue-600">
                            {currentPractice.currentProviders}/{currentPractice.maxProviders} providers
                          </span>
                        </div>
                      </div>
                      <button className="text-blue-600 hover:text-blue-700">
                        <Settings className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Team Members */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Team Members</h3>
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <UserPlus className="w-4 h-4 inline mr-2" />
                        Invite Member
                      </button>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Member
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Role
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Specialty
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Permissions
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {practiceMembers.map((member) => (
                            <tr key={member.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {member.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {member.email}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900 capitalize">
                                  {member.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-500">
                                  {member.specialty || '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  {member.permissions.isOwner && (
                                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                      Owner
                                    </span>
                                  )}
                                  {member.permissions.isAdmin && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      Admin
                                    </span>
                                  )}
                                  {member.permissions.canViewAllPatients && (
                                    <Eye className="w-4 h-4 text-gray-400" title="Can view all patients" />
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  Active
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <button
                      onClick={copyInvitationLink}
                      className="p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <Link className="w-5 h-5 text-blue-600 mb-2" />
                      <h4 className="font-medium text-gray-900">Copy Invite Link</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {copiedLink ? 'Copied!' : 'Generate a shareable invitation link'}
                      </p>
                    </button>

                    <button className="p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <Calendar className="w-5 h-5 text-green-600 mb-2" />
                      <h4 className="font-medium text-gray-900">Schedule Settings</h4>
                      <p className="text-xs text-gray-500 mt-1">Configure appointment slots</p>
                    </button>

                    <button className="p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <FileText className="w-5 h-5 text-purple-600 mb-2" />
                      <h4 className="font-medium text-gray-900">Template Library</h4>
                      <p className="text-xs text-gray-500 mt-1">Manage shared templates</p>
                    </button>
                  </div>

                  {/* Practice Stats */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Practice Statistics</h3>
                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-3xl font-bold text-gray-900">152</p>
                        <p className="text-sm text-gray-600">Active Patients</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-gray-900">47</p>
                        <p className="text-sm text-gray-600">This Week</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-gray-900">98%</p>
                        <p className="text-sm text-gray-600">Satisfaction</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-gray-900">24min</p>
                        <p className="text-sm text-gray-600">Avg Visit Time</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Practice Yet</h3>
                  <p className="text-gray-600 mb-6">Create or join a practice to get started</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create Practice
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Invite Team Member</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={inviteData.email}
                    onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={inviteData.name}
                    onChange={(e) => setInviteData({...inviteData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={inviteData.role}
                    onChange={(e) => setInviteData({...inviteData, role: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="doctor">Doctor</option>
                    <option value="dietician">Dietician</option>
                    <option value="psychiatrist">Psychiatrist</option>
                    <option value="nurse">Nurse</option>
                    <option value="nutritionist">Nutritionist</option>
                    <option value="medical_assistant">Medical Assistant</option>
                    <option value="front_office">Front Office</option>
                    <option value="billing">Billing Specialist</option>
                    <option value="prior_auth">Prior Authorization</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Personal Message (Optional)
                  </label>
                  <textarea
                    value={inviteData.message}
                    onChange={(e) => setInviteData({...inviteData, message: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Welcome to our practice..."
                  />
                </div>

                <button
                  onClick={handleSendInvitation}
                  className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 transition-colors"
                >
                  <Send className="w-4 h-4 inline mr-2" />
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}