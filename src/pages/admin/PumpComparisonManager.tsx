import { useState, useEffect } from 'react';
import { Database, Users, Phone, Globe, Mail, Save, Plus, Trash2, Edit3, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PumpDetails {
  [pumpName: string]: {
    title: string;
    details: string;
    pros?: string[];
    cons?: string[];
  };
}

interface Dimension {
  id: number;
  dimension_number: number;
  dimension_name: string;
  dimension_description: string;
  importance_scale: string;
  pump_details: PumpDetails;
  category: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Manufacturer {
  id: number;
  pump_name: string;
  manufacturer: string;
  website: string | null;
  rep_name: string | null;
  rep_contact: string | null;
  rep_email: string | null;
  support_phone: string | null;
  support_email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Use environment variable with fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_PUMP_API_URL || 'http://localhost:3002';

export default function PumpComparisonManager() {
  const [activeTab, setActiveTab] = useState<'dimensions' | 'manufacturers' | 'settings'>('dimensions');
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDimension, setEditingDimension] = useState<number | null>(null);
  const [editingManufacturer, setEditingManufacturer] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [expandedDimension, setExpandedDimension] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Get token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token found');
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const [dimensionsRes, manufacturersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/pump-comparison-data`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/pump-manufacturers`, { headers })
      ]);

      if (!dimensionsRes.ok || !manufacturersRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const dimensionsData = await dimensionsRes.json();
      const manufacturersData = await manufacturersRes.json();

      if (dimensionsData.success) {
        setDimensions(dimensionsData.dimensions);
      }
      if (manufacturersData.success) {
        setManufacturers(manufacturersData.manufacturers);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const updateDimension = async (id: number, updates: Partial<Dimension>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/pump-comparison-data/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update dimension');

      const data = await response.json();
      if (data.success) {
        setSaveSuccess(`Dimension #${updates.dimension_number} updated successfully!`);
        setTimeout(() => setSaveSuccess(null), 3000);
        await loadData();
        setEditingDimension(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update dimension');
    }
  };

  const updateManufacturer = async (id: number, updates: Partial<Manufacturer>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/pump-manufacturers/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update manufacturer');

      const data = await response.json();
      if (data.success) {
        setSaveSuccess(`${updates.pump_name} updated successfully!`);
        setTimeout(() => setSaveSuccess(null), 3000);
        await loadData();
        setEditingManufacturer(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update manufacturer');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSaveSuccess('Copied to clipboard!');
    setTimeout(() => setSaveSuccess(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
          <div className="text-xl font-semibold text-gray-700">Loading pump comparison data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pump Comparison Database</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage 23-dimension pump comparison data and manufacturer contacts
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/admin/pumpdrive-dashboard'}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {saveSuccess && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <Check className="w-5 h-5 text-green-600 mr-3" />
            <span className="text-green-800">{saveSuccess}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
              <X className="w-5 h-5 text-red-600 mr-3" />
              <span className="text-red-800">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('dimensions')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'dimensions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                <Database className="w-4 h-4 inline mr-2" />
                23 Dimensions ({dimensions.length})
              </button>
              <button
                onClick={() => setActiveTab('manufacturers')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'manufacturers'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Pump Details & Reps ({manufacturers.length})
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'settings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                AI Prompt Settings
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'dimensions' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Click on any dimension to expand and edit pump details
                  </p>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add New Dimension
                  </button>
                </div>

                {/* Dimensions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dimension Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Importance</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Updated</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dimensions.map((dim) => (
                        <>
                          <tr
                            key={dim.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => setExpandedDimension(expandedDimension === dim.id ? null : dim.id)}
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm">
                                {dim.dimension_number}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm font-medium text-gray-900">{dim.dimension_name}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{dim.dimension_description}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                                {dim.category}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                              {dim.importance_scale}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(dim.updated_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingDimension(dim.id);
                                }}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                          {expandedDimension === dim.id && (
                            <tr>
                              <td colSpan={6} className="px-4 py-4 bg-gray-50">
                                <div className="space-y-4">
                                  <h4 className="font-semibold text-gray-900">Pump Details for this Dimension:</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {Object.entries(dim.pump_details || {}).map(([pumpName, details]) => (
                                      <div key={pumpName} className="bg-white rounded-lg border border-gray-200 p-4">
                                        <h5 className="font-semibold text-blue-900 mb-2">{pumpName}</h5>
                                        <div className="text-sm space-y-2">
                                          <div>
                                            <span className="font-medium text-gray-700">Title:</span>
                                            <p className="text-gray-600">{details.title}</p>
                                          </div>
                                          <div>
                                            <span className="font-medium text-gray-700">Details:</span>
                                            <p className="text-gray-600">{details.details}</p>
                                          </div>
                                          {details.pros && details.pros.length > 0 && (
                                            <div>
                                              <span className="font-medium text-green-700">Pros:</span>
                                              <ul className="list-disc list-inside text-gray-600">
                                                {details.pros.map((pro, idx) => (
                                                  <li key={idx}>{pro}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                          {details.cons && details.cons.length > 0 && (
                                            <div>
                                              <span className="font-medium text-red-700">Cons:</span>
                                              <ul className="list-disc list-inside text-gray-600">
                                                {details.cons.map((con, idx) => (
                                                  <li key={idx}>{con}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'manufacturers' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Manage pump manufacturer details and representative contacts
                  </p>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add New Pump
                  </button>
                </div>

                {/* Manufacturers Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pump Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manufacturer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Website</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rep Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rep Contact</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Support</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {manufacturers.map((mfr) => (
                        <tr key={mfr.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">{mfr.pump_name}</div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">{mfr.manufacturer}</td>
                          <td className="px-4 py-4">
                            {mfr.website ? (
                              <div className="flex items-center gap-2">
                                <a
                                  href={mfr.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                >
                                  <Globe className="w-3 h-3" />
                                  Visit
                                </a>
                                <button
                                  onClick={() => copyToClipboard(mfr.website!)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  📋
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900">{mfr.rep_name || 'N/A'}</div>
                            {mfr.rep_email && (
                              <a href={`mailto:${mfr.rep_email}`} className="text-xs text-blue-600 hover:text-blue-800">
                                <Mail className="w-3 h-3 inline mr-1" />
                                {mfr.rep_email}
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {mfr.rep_contact ? (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-900">{mfr.rep_contact}</span>
                                <button
                                  onClick={() => copyToClipboard(mfr.rep_contact!)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  📋
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {mfr.support_phone ? (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-900">{mfr.support_phone}</span>
                                <button
                                  onClick={() => copyToClipboard(mfr.support_phone!)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  📋
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => setEditingManufacturer(mfr.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="font-semibold text-blue-900 mb-3">AI Integration Settings</h3>
                  <p className="text-sm text-blue-800 mb-4">
                    This pump comparison data is automatically included in AI recommendation prompts.
                    The AI analyzes user preferences against all 23 dimensions to make informed recommendations.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white rounded-lg p-3">
                      <span className="text-sm font-medium text-gray-700">Include pump details in AI prompt</span>
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">Enabled</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-lg p-3">
                      <span className="text-sm font-medium text-gray-700">Include manufacturer contacts</span>
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">Enabled</span>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-lg p-3">
                      <span className="text-sm font-medium text-gray-700">Use dimension weights in scoring</span>
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Coming Soon</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Data Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4">
                      <div className="text-3xl font-bold text-blue-600">{dimensions.length}</div>
                      <div className="text-sm text-gray-600">Total Dimensions</div>
                    </div>
                    <div className="bg-white rounded-lg p-4">
                      <div className="text-3xl font-bold text-green-600">{manufacturers.length}</div>
                      <div className="text-sm text-gray-600">Pump Manufacturers</div>
                    </div>
                    <div className="bg-white rounded-lg p-4">
                      <div className="text-3xl font-bold text-purple-600">
                        {dimensions.reduce((sum, d) => sum + Object.keys(d.pump_details || {}).length, 0)}
                      </div>
                      <div className="text-sm text-gray-600">Total Pump Entries</div>
                    </div>
                    <div className="bg-white rounded-lg p-4">
                      <div className="text-3xl font-bold text-orange-600">
                        {new Set(dimensions.map(d => d.category)).size}
                      </div>
                      <div className="text-sm text-gray-600">Categories</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
