/**
 * DoctorNavBar Component
 * Top navigation bar for doctor dashboard with quick actions
 * Created: September 16, 2025
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  File,
  Calendar,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Plus,
  Search,
  Bell,
  Home,
  Shield,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseAuthService as unifiedAuthService } from '../../services/supabaseAuth.service';
import { doctorProfileService, type DoctorTemplate } from '../../services/doctorProfile.service';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface DoctorNavBarProps {
  currentView?: 'calendar' | 'templates' | 'notes';
  onViewChange?: (view: 'calendar' | 'templates' | 'notes') => void;
  practiceInfo?: {
    name: string;
    logo?: string;
  };
  showNotifications?: boolean;
}

export default function DoctorNavBar({
  currentView = 'calendar',
  onViewChange,
  practiceInfo = { name: 'TSHLA Medical' },
  showNotifications = true,
}: DoctorNavBarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [recentTemplates, setRecentTemplates] = useState<DoctorTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      const result = await unifiedAuthService.getCurrentUser();
      console.log('🔍 [DoctorNavBar] getCurrentUser result:', result);
      if (result.success && result.user) {
        console.log('✅ [DoctorNavBar] Setting currentUser:', {
          authUserId: result.user.authUserId,
          id: result.user.id,
          email: result.user.email
        });
        setCurrentUser(result.user);
      } else {
        console.error('❌ [DoctorNavBar] Failed to get current user:', result);
      }
    };
    loadUser();
  }, []);

  // Load recent templates on mount
  useEffect(() => {
    const loadRecentTemplates = async () => {
      if (!currentUser) {
        console.log('⏳ [DoctorNavBar] Waiting for currentUser...');
        return;
      }

      try {
        setLoadingTemplates(true);
        const doctorId = currentUser.authUserId || currentUser.id || currentUser.email || 'doctor-default-001';
        console.log('🔍 [DoctorNavBar] Loading templates with doctorId:', doctorId);
        console.log('🔍 [DoctorNavBar] currentUser values:', {
          authUserId: currentUser.authUserId,
          id: currentUser.id,
          email: currentUser.email
        });
        doctorProfileService.initialize(doctorId);
        const allTemplates = await doctorProfileService.getTemplates(doctorId);
        console.log(`✅ [DoctorNavBar] Loaded ${allTemplates.length} templates from Supabase`);
        // Sort by most recently updated and take top 10
        const sorted = allTemplates.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setRecentTemplates(sorted.slice(0, 10));
      } catch (error) {
        logError('DoctorNavBar', 'Error loading templates', { error });
        setRecentTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadRecentTemplates();
  }, [currentUser]);

  const handleQuickNote = () => {
    navigate('/quick-note');
  };

  const handleTemplates = () => {
    navigate('/templates');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      logError('DoctorNavBar', 'Error message', {});
    }
  };

  const formatLastUsed = (template: DoctorTemplate): string => {
    const updated = new Date(template.updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - updated.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return updated.toLocaleDateString();
  };

  const getViewButtonClass = (view: string) => {
    const baseClass =
      'px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2';
    return currentView === view
      ? `${baseClass} bg-blue-500 text-white shadow-sm`
      : `${baseClass} text-gray-600 hover:bg-gray-100`;
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Logo and main navigation */}
          <div className="flex items-center space-x-6">
            {/* Practice Logo/Name */}
            <div className="flex items-center space-x-3">
              {practiceInfo.logo ? (
                <img src={practiceInfo.logo} alt={practiceInfo.name} className="h-8 w-8 rounded" />
              ) : (
                <div className="h-8 w-8 bg-blue-500 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">T</span>
                </div>
              )}
              <span className="text-xl font-semibold text-gray-900">{practiceInfo.name}</span>
            </div>

            {/* Main Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onViewChange?.('calendar')}
                className={getViewButtonClass('calendar')}
              >
                <Calendar className="w-4 h-4" />
                <span>Calendar</span>
              </button>

              {/* Templates Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                  className={`${getViewButtonClass('templates')} ${showTemplateMenu ? 'bg-gray-100' : ''}`}
                >
                  <File className="w-4 h-4" />
                  <span>Templates</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showTemplateMenu ? 'rotate-180' : ''}`}
                  />
                </button>

                {showTemplateMenu && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">Templates</h3>
                        <button
                          onClick={() => {
                            handleTemplates();
                            setShowTemplateMenu(false);
                          }}
                          className="text-blue-500 hover:text-blue-600 text-sm"
                        >
                          View All
                        </button>
                      </div>

                      {/* Quick Actions */}
                      <div className="space-y-1 mb-3">
                        <button
                          onClick={() => {
                            navigate('/templates');
                            setShowTemplateMenu(false);
                          }}
                          className="w-full flex items-center space-x-2 p-2 rounded hover:bg-gray-50 text-left"
                        >
                          <Plus className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">Create New Template</span>
                        </button>
                      </div>

                      {/* My Templates */}
                      <div className="border-t border-gray-100 pt-3">
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          My Templates
                        </h4>
                        <div className="space-y-1">
                          {loadingTemplates ? (
                            <div className="p-4 text-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                              <p className="text-xs text-gray-500 mt-2">Loading templates...</p>
                            </div>
                          ) : recentTemplates.length > 0 ? (
                            recentTemplates.map(template => (
                              <button
                                key={template.id}
                                onClick={() => {
                                  navigate(`/templates?edit=${template.id}`);
                                  setShowTemplateMenu(false);
                                }}
                                className="w-full text-left p-2 rounded hover:bg-gray-50"
                              >
                                <div className="text-sm font-medium text-gray-900">
                                  {template.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {template.visitType && (
                                    <span className="text-blue-600 font-medium">
                                      {template.visitType}
                                    </span>
                                  )}
                                  {template.visitType && ' • '}
                                  Used {formatLastUsed(template)}
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center">
                              <p className="text-xs text-gray-500 mb-2">No recent templates</p>
                              <button
                                onClick={() => {
                                  navigate('/templates');
                                  setShowTemplateMenu(false);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700"
                              >
                                Create your first template →
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => onViewChange?.('notes')}
                className={getViewButtonClass('notes')}
              >
                <FileText className="w-4 h-4" />
                <span>Notes</span>
              </button>
            </div>
          </div>

          {/* Center - Quick Actions */}
          <div className="flex items-center space-x-4">
            {/* View Schedule Button - Primary CTA */}
            <button
              onClick={() => navigate('/schedule')}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              <span>View Schedule</span>
            </button>

            {/* Quick Note Button - Primary CTA */}
            <button
              onClick={handleQuickNote}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Quick Note</span>
            </button>

            {/* Upload Schedule Button - Admin Only */}
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin/account-creation')}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Schedule</span>
              </button>
            )}

            {/* Search */}
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Search className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Right side - Notifications and user menu */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            {showNotifications && (
              <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <Bell className="w-5 h-5 text-gray-500" />
                {/* Notification badge */}
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
              </button>
            )}

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-medium text-gray-900">
                      {currentUser?.name || user?.email || 'Doctor'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {currentUser?.specialty || 'Physician'}
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showUserMenu && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        navigate('/doctor/profile');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 p-2 rounded hover:bg-gray-50 text-left"
                    >
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        // TODO: Settings page
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 p-2 rounded hover:bg-gray-50 text-left"
                    >
                      <Settings className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">Settings</span>
                    </button>

                    {/* Admin Dashboard - Only show for admin users */}
                    {currentUser?.role === 'admin' && (
                      <button
                        onClick={() => {
                          navigate('/admin/account-creation');
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center space-x-2 p-2 rounded hover:bg-blue-50 text-left text-blue-600"
                      >
                        <Shield className="w-4 h-4" />
                        <span className="text-sm">Admin Dashboard</span>
                      </button>
                    )}

                    <hr className="my-2" />

                    <button
                      onClick={() => {
                        handleLogout();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 p-2 rounded hover:bg-red-50 text-left text-red-600"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Close dropdowns when clicking outside */}
      {(showUserMenu || showTemplateMenu) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowUserMenu(false);
            setShowTemplateMenu(false);
          }}
        />
      )}
    </nav>
  );
}
