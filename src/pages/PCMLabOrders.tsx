/**
 * PCM Lab Orders - Provider/Staff Lab Management
 * Order labs, track status, view pending/completed orders
 * Created: 2025-01-18
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Beaker,
  TrendingUp,
  Download,
  Eye
} from 'lucide-react';
import { pcmService } from '../services/pcm.service';

interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  orderedBy: string;
  orderDate: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue' | 'cancelled';
  labsRequested: string[];
  priority: 'routine' | 'urgent' | 'stat';
  panelType?: string;
  notes?: string;
}

const LAB_PANELS = [
  {
    id: 'diabetes_quarterly',
    name: 'Diabetes PCM - Quarterly',
    tests: ['Hemoglobin A1C', 'Comprehensive Metabolic Panel', 'Lipid Panel', 'Urine Microalbumin', 'eGFR'],
    frequency: 'Every 3 months'
  },
  {
    id: 'diabetes_annual',
    name: 'Diabetes PCM - Annual',
    tests: ['Hemoglobin A1C', 'Comprehensive Metabolic Panel', 'Lipid Panel', 'Urine Microalbumin', 'eGFR', 'TSH', 'Vitamin B12', 'Liver Function Tests'],
    frequency: 'Once per year'
  },
  {
    id: 'cardiac_panel',
    name: 'Cardiac Risk Assessment',
    tests: ['Lipid Panel', 'hs-CRP', 'Lipoprotein(a)', 'Homocysteine', 'NT-proBNP'],
    frequency: 'Every 6 months'
  },
  {
    id: 'kidney_panel',
    name: 'Kidney Function Panel',
    tests: ['Comprehensive Metabolic Panel', 'eGFR', 'Urine Microalbumin', 'Urine Creatinine'],
    frequency: 'Every 3 months'
  },
  {
    id: 'custom',
    name: 'Custom Selection',
    tests: [],
    frequency: 'As needed'
  }
];

const INDIVIDUAL_TESTS = [
  'Hemoglobin A1C', 'Comprehensive Metabolic Panel', 'Basic Metabolic Panel',
  'Lipid Panel', 'LDL Cholesterol', 'HDL Cholesterol', 'Triglycerides',
  'Liver Function Tests', 'Kidney Function Tests', 'eGFR',
  'Urine Microalbumin', 'Urine Creatinine', 'TSH', 'Vitamin B12', 'Vitamin D',
  'hs-CRP', 'Lipoprotein(a)', 'Homocysteine', 'NT-proBNP'
];

export default function PCMLabOrders() {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'order'>('list');
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<LabOrder[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Order form state
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedPanel, setSelectedPanel] = useState<string>('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, filterStatus, searchQuery]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const ordersData = await pcmService.getLabOrders();

      // Add patient names from demo data
      const enrichedOrders = ordersData.map(order => ({
        ...order,
        patientName: 'Jane Smith' // In production, fetch from patients table
      }));

      setOrders(enrichedOrders);
    } catch (error) {
      console.error('Error loading lab orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(o => o.status === filterStatus);
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(o =>
        o.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.labsRequested.some(test => test.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredOrders(filtered);
  };

  const handlePanelSelect = (panelId: string) => {
    setSelectedPanel(panelId);
    const panel = LAB_PANELS.find(p => p.id === panelId);
    if (panel && panelId !== 'custom') {
      setSelectedTests(panel.tests);
    } else {
      setSelectedTests([]);
    }
  };

  const handleTestToggle = (test: string) => {
    if (selectedTests.includes(test)) {
      setSelectedTests(selectedTests.filter(t => t !== test));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const handleSubmitOrder = async () => {
    if (!selectedPatient || selectedTests.length === 0 || !dueDate) {
      alert('Please select a patient, at least one test, and a due date');
      return;
    }

    setIsSubmitting(true);
    try {
      await pcmService.orderLabs(selectedPatient.id, {
        tests: selectedTests,
        dueDate,
        priority,
        panelType: selectedPanel !== 'custom' ? selectedPanel : undefined,
        notes,
        orderedBy: 'current-user-id' // In production, get from auth context
      });

      // Reset form
      setSelectedPatient(null);
      setSelectedPanel('');
      setSelectedTests([]);
      setDueDate('');
      setPriority('routine');
      setNotes('');
      setView('list');

      // Reload orders
      await loadOrders();
    } catch (error) {
      console.error('Error submitting lab order:', error);
      alert('Failed to submit lab order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      routine: 'bg-gray-100 text-gray-700',
      urgent: 'bg-orange-100 text-orange-700',
      stat: 'bg-red-100 text-red-700'
    };
    return colors[priority as keyof typeof colors] || colors.routine;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lab orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => view === 'list' ? navigate('/pcm/provider') : setView('list')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Lab Management</h1>
                <p className="text-sm text-gray-600">Order and track lab tests for PCM patients</p>
              </div>
            </div>
            {view === 'list' && (
              <button
                onClick={() => setView('order')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Order Labs
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {view === 'list' ? (
          <>
            {/* Filters and Search */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by patient name or test..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-600" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="all">All Orders</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Pending Orders</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {orders.filter(o => o.status === 'pending').length}
                    </div>
                  </div>
                  <Clock className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Overdue</div>
                    <div className="text-2xl font-bold text-red-600">
                      {orders.filter(o => o.status === 'overdue').length}
                    </div>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Completed</div>
                    <div className="text-2xl font-bold text-green-600">
                      {orders.filter(o => o.status === 'completed').length}
                    </div>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Total Orders</div>
                    <div className="text-2xl font-bold text-purple-600">{orders.length}</div>
                  </div>
                  <Beaker className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Orders List */}
            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <Beaker className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No lab orders found</h3>
                  <p className="text-gray-600 mb-6">
                    {searchQuery || filterStatus !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Get started by ordering labs for your PCM patients'}
                  </p>
                  <button
                    onClick={() => setView('order')}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Order Labs
                  </button>
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg">
                          {getStatusIcon(order.status)}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{order.patientName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${getStatusColor(order.status)}`}>
                              {order.status.toUpperCase()}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getPriorityBadge(order.priority)}`}>
                              {order.priority.toUpperCase()}
                            </span>
                            {order.panelType && (
                              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                                {order.panelType.replace('_', ' ').toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/pcm/patient/labs?patientId=${order.patientId}`)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                          title="View Results"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          title="Download Order"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Ordered</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {new Date(order.orderDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Due Date</div>
                        <div className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(order.dueDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Tests Ordered</div>
                        <div className="text-sm font-semibold text-gray-900">{order.labsRequested.length} tests</div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs font-semibold text-gray-700 mb-2">Tests Requested:</div>
                      <div className="flex flex-wrap gap-2">
                        {order.labsRequested.map((test, idx) => (
                          <span key={idx} className="text-xs bg-white px-3 py-1 rounded-full border border-gray-200">
                            {test}
                          </span>
                        ))}
                      </div>
                      {order.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Notes:</div>
                          <div className="text-xs text-gray-600">{order.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Order Form */
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Order Lab Tests</h2>

            {/* Step 1: Select Patient */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                1. Select Patient <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patient name..."
                  onClick={() => {
                    // Simulate patient selection - in production, show searchable dropdown
                    setSelectedPatient({
                      id: 'demo-patient-001',
                      name: 'Jane Smith',
                      age: 65
                    });
                  }}
                  value={selectedPatient?.name || ''}
                  readOnly
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
                />
              </div>
              {selectedPatient && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-900 font-semibold">
                    Patient selected: {selectedPatient.name}
                  </span>
                </div>
              )}
            </div>

            {/* Step 2: Select Panel or Custom Tests */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                2. Select Lab Panel <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LAB_PANELS.map((panel) => (
                  <button
                    key={panel.id}
                    onClick={() => handlePanelSelect(panel.id)}
                    className={`text-left p-4 rounded-lg border-2 transition ${
                      selectedPanel === panel.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{panel.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{panel.frequency}</div>
                    {panel.tests.length > 0 && (
                      <div className="text-xs text-gray-500 mt-2">{panel.tests.length} tests included</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Custom Test Selection (if custom selected) */}
            {selectedPanel === 'custom' && (
              <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  3. Select Individual Tests
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {INDIVIDUAL_TESTS.map((test) => (
                    <label
                      key={test}
                      className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTests.includes(test)}
                        onChange={() => handleTestToggle(test)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <span className="text-sm text-gray-700">{test}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Tests Summary */}
            {selectedTests.length > 0 && (
              <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-semibold text-blue-900 mb-2">
                  Selected Tests ({selectedTests.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTests.map((test, idx) => (
                    <span key={idx} className="text-xs bg-white px-3 py-1 rounded-full border border-blue-200">
                      {test}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Order Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Due Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="stat">STAT</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Clinical Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any relevant clinical notes or special instructions..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('list')}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitOrder}
                disabled={isSubmitting || !selectedPatient || selectedTests.length === 0 || !dueDate}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Beaker className="w-5 h-5" />
                    Submit Lab Order
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
