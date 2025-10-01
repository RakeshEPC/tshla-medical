/**
 * Medical Assistant Dashboard
 * Two main views: Orders Management and Chart Prep Station
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { maOrdersService, type Order, type OrderStats } from '../services/maOrders.service';
import { patientMasterService, type PatientMaster } from '../services/patientMaster.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

type DashboardView = 'orders' | 'chart-prep';

export default function MADashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentView, setCurrentView] = useState<DashboardView>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [patients, setPatients] = useState<PatientMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // New patient form state
  const [newPatient, setNewPatient] = useState({
    name: '',
    dob: '',
    email: '',
    phone: '',
    emr_number: '',
    address: '',
    insurance_info: '',
    emergency_contact: '',
  });

  useEffect(() => {
    if (!user || user.role !== 'medical_assistant') {
      navigate('/login');
      return;
    }

    loadData();

    // Set up polling for live updates
    const interval = setInterval(loadData, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [user, navigate]);

  const loadData = async () => {
    try {
      const [pendingOrders, stats, allPatients] = await Promise.all([
        maOrdersService.getAllPendingOrders(),
        maOrdersService.getOrderStats(),
        patientMasterService.getAllActivePatients(),
      ]);

      setOrders(pendingOrders);
      setOrderStats(stats);
      setPatients(allPatients);
    } catch (error) {
      logError('MADashboard', 'Error message', {});
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async (order: Order) => {
    try {
      await maOrdersService.completeOrder(
        order.order_id,
        user!.id,
        user!.name,
        `Completed by ${user!.name}`
      );

      // Refresh data
      await loadData();
      setSelectedOrder(null);
    } catch (error) {
      logError('MADashboard', 'Error message', {});
      alert('Failed to complete order');
    }
  };

  const handleAssignOrder = async (order: Order) => {
    try {
      await maOrdersService.assignOrderToMA(order.order_id, user!.id, user!.name);
      await loadData();
    } catch (error) {
      logError('MADashboard', 'Error message', {});
      alert('Failed to assign order');
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPatient.name || !newPatient.dob) {
      alert('Name and Date of Birth are required');
      return;
    }

    try {
      await patientMasterService.createPatient(
        {
          ...newPatient,
          created_by_ma_id: user!.id,
        },
        user!.id
      );

      // Reset form
      setNewPatient({
        name: '',
        dob: '',
        email: '',
        phone: '',
        emr_number: '',
        address: '',
        insurance_info: '',
        emergency_contact: '',
      });

      // Refresh patient list
      await loadData();
      alert('Patient created successfully with AVA and TSH numbers!');
    } catch (error: any) {
      logError('MADashboard', 'Error message', {});
      alert(error.message || 'Failed to create patient');
    }
  };

  const filteredOrders = orders.filter(
    order =>
      order.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.doctor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPatients = patients.filter(
    patient =>
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.ava_number.includes(searchQuery.toLowerCase()) ||
      patient.tsh_number.includes(searchQuery.toLowerCase()) ||
      (patient.emr_number && patient.emr_number.includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading MA Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Medical Assistant Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Welcome back, {user?.name}</p>
            </div>

            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCurrentView('orders')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentView === 'orders'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📋 Orders Management
              </button>
              <button
                onClick={() => setCurrentView('chart-prep')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentView === 'chart-prep'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📊 Chart Prep Station
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {orderStats && (
            <div className="grid grid-cols-5 gap-4 mt-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{orderStats.pending}</div>
                <div className="text-sm text-blue-800">Pending Orders</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{orderStats.inProgress}</div>
                <div className="text-sm text-yellow-800">In Progress</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{orderStats.completed}</div>
                <div className="text-sm text-green-800">Completed</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{orderStats.urgent}</div>
                <div className="text-sm text-red-800">Urgent</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{orderStats.total}</div>
                <div className="text-sm text-gray-800">Total Orders</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder={
              currentView === 'orders'
                ? 'Search orders by patient, doctor, or order text...'
                : 'Search patients by name, AVA#, TSH#, or EMR#...'
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {currentView === 'orders' ? (
          /* Orders Management View */
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Pending Orders</h2>
                <p className="text-sm text-gray-600">Orders from all doctors needing attention</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Doctor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Urgency
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.map(order => (
                      <tr key={order.order_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {order.patient_name || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {order.doctor_name || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              order.order_type === 'medication'
                                ? 'bg-blue-100 text-blue-800'
                                : order.order_type === 'lab'
                                  ? 'bg-green-100 text-green-800'
                                  : order.order_type === 'imaging'
                                    ? 'bg-purple-100 text-purple-800'
                                    : order.order_type === 'prior_auth'
                                      ? 'bg-red-100 text-red-800'
                                      : order.order_type === 'referral'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {order.order_type.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="text-sm text-gray-900 truncate" title={order.order_text}>
                            {order.order_text}
                          </div>
                          {order.action && (
                            <div className="text-xs text-gray-500">
                              Action: {order.action.toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              order.urgency === 'stat'
                                ? 'bg-red-100 text-red-800'
                                : order.urgency === 'urgent'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {order.urgency.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className={`w-3 h-3 rounded-full mr-2 ${
                                order.priority_score >= 8
                                  ? 'bg-red-500'
                                  : order.priority_score >= 6
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                              }`}
                            ></div>
                            <span className="text-sm text-gray-900">{order.priority_score}/10</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          {order.status === 'pending' && (
                            <button
                              onClick={() => handleAssignOrder(order)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Assign to Me
                            </button>
                          )}
                          {order.ma_id === user?.id && (
                            <button
                              onClick={() => handleCompleteOrder(order)}
                              className="text-green-600 hover:text-green-900"
                            >
                              ✓ Complete
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredOrders.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-500">No pending orders found.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Chart Prep Station View */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create New Patient */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Patient</h2>
              <form onSubmit={handleCreatePatient} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newPatient.name}
                      onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      required
                      value={newPatient.dob}
                      onChange={e => setNewPatient({ ...newPatient, dob: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={newPatient.email}
                      onChange={e => setNewPatient({ ...newPatient, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newPatient.phone}
                      onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    EMR Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={newPatient.emr_number}
                    onChange={e => setNewPatient({ ...newPatient, emr_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="From external EMR system"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Insurance Information
                  </label>
                  <textarea
                    value={newPatient.insurance_info}
                    onChange={e => setNewPatient({ ...newPatient, insurance_info: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Create Patient (Auto-generate AVA & TSH Numbers)
                </button>
              </form>
            </div>

            {/* Recent Patients */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Patients</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredPatients.slice(0, 10).map(patient => (
                  <div
                    key={patient.patient_id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">{patient.name}</div>
                        <div className="text-sm text-gray-600">DOB: {patient.dob}</div>
                        <div className="text-sm text-gray-500">
                          AVA: {patient.ava_number} | TSH: {patient.tsh_number}
                        </div>
                        {patient.emr_number && (
                          <div className="text-sm text-gray-500">EMR: {patient.emr_number}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        Created {new Date(patient.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredPatients.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No patients found.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Order Details</h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Patient:</label>
                  <p className="text-gray-900">{selectedOrder.patient_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Doctor:</label>
                  <p className="text-gray-900">{selectedOrder.doctor_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Order Type:</label>
                  <p className="text-gray-900">
                    {selectedOrder.order_type.replace('_', ' ').toUpperCase()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Order Text:</label>
                  <p className="text-gray-900">{selectedOrder.order_text}</p>
                </div>
                {selectedOrder.action && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Action:</label>
                    <p className="text-gray-900">{selectedOrder.action.toUpperCase()}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700">Urgency:</label>
                  <p className="text-gray-900">{selectedOrder.urgency.toUpperCase()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Priority Score:</label>
                  <p className="text-gray-900">{selectedOrder.priority_score}/10</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Estimated Time:</label>
                  <p className="text-gray-900">{selectedOrder.estimated_time_minutes} minutes</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Created:</label>
                  <p className="text-gray-900">
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                {selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => handleAssignOrder(selectedOrder)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Assign to Me
                  </button>
                )}
                {selectedOrder.ma_id === user?.id && selectedOrder.status === 'in_progress' && (
                  <button
                    onClick={() => handleCompleteOrder(selectedOrder)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    Complete Order
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
