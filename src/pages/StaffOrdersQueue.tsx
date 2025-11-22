/**
 * Staff Orders Queue Dashboard
 * Centralized view for staff to see all pending orders from all patients
 * Created: 2025-01-22
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pill,
  FlaskConical,
  Scan,
  FileCheck,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  User,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ExtractedOrder {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  keywords: string[];
}

interface OrderExtractionResult {
  medications: ExtractedOrder[];
  labs: ExtractedOrder[];
  imaging: ExtractedOrder[];
  priorAuths: ExtractedOrder[];
  referrals: ExtractedOrder[];
}

interface PatientOrder {
  id: string;
  patientName: string;
  patientMRN: string;
  providerName: string;
  orderDate: string;
  orderType: 'medication' | 'lab' | 'imaging' | 'priorAuth' | 'referral';
  orderText: string;
  confidence: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
  noteId?: string;
  appointmentId?: string;
}

export default function StaffOrdersQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState<PatientOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PatientOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedOrder, setSelectedOrder] = useState<PatientOrder | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterType, filterStatus, orders]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call to fetch orders from database
      // For now, using mock data
      const mockOrders: PatientOrder[] = [
        {
          id: '1',
          patientName: 'John Smith',
          patientMRN: 'MRN001',
          providerName: 'Dr. Johnson',
          orderDate: new Date().toISOString(),
          orderType: 'medication',
          orderText: 'START Mounjaro 2.5 mg once weekly',
          confidence: 'high',
          status: 'pending'
        },
        {
          id: '2',
          patientName: 'John Smith',
          patientMRN: 'MRN001',
          providerName: 'Dr. Johnson',
          orderDate: new Date().toISOString(),
          orderType: 'lab',
          orderText: 'ORDER Hemoglobin A1c, Lipid panel',
          confidence: 'high',
          status: 'pending'
        },
        {
          id: '3',
          patientName: 'Jane Doe',
          patientMRN: 'MRN002',
          providerName: 'Dr. Smith',
          orderDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          orderType: 'priorAuth',
          orderText: 'Prior authorization required for Ozempic',
          confidence: 'high',
          status: 'in-progress'
        }
      ];

      setOrders(mockOrders);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...orders];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.patientName.toLowerCase().includes(term) ||
        order.patientMRN.toLowerCase().includes(term) ||
        order.orderText.toLowerCase().includes(term) ||
        order.providerName.toLowerCase().includes(term)
      );
    }

    // Filter by order type
    if (filterType !== 'all') {
      filtered = filtered.filter(order => order.orderType === filterType);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(order => order.status === filterStatus);
    }

    setFilteredOrders(filtered);
  };

  const updateOrderStatus = (orderId: string, newStatus: PatientOrder['status']) => {
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );
  };

  const getOrderIcon = (type: PatientOrder['orderType']) => {
    switch (type) {
      case 'medication': return <Pill className="w-5 h-5" />;
      case 'lab': return <FlaskConical className="w-5 h-5" />;
      case 'imaging': return <Scan className="w-5 h-5" />;
      case 'priorAuth': return <FileCheck className="w-5 h-5" />;
      case 'referral': return <UserPlus className="w-5 h-5" />;
    }
  };

  const getOrderColor = (type: PatientOrder['orderType']) => {
    switch (type) {
      case 'medication': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'lab': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'imaging': return 'bg-green-100 text-green-800 border-green-300';
      case 'priorAuth': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'referral': return 'bg-pink-100 text-pink-800 border-pink-300';
    }
  };

  const getStatusBadge = (status: PatientOrder['status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium flex items-center gap-1">
          <Clock className="w-3 h-3" /> Pending
        </span>;
      case 'in-progress':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> In Progress
        </span>;
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </span>;
    }
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const inProgressCount = orders.filter(o => o.status === 'in-progress').length;
  const completedTodayCount = orders.filter(o =>
    o.status === 'completed' &&
    new Date(o.orderDate).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Orders Queue</h1>
                <p className="text-sm text-gray-600">Manage and track all patient orders</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Logged in as:</span>
              <span className="font-semibold text-gray-900">{user?.name || 'Staff Member'}</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{user?.role || 'nurse'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Orders</p>
                <p className="text-3xl font-bold text-gray-900">{pendingCount}</p>
              </div>
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-3xl font-bold text-gray-900">{inProgressCount}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed Today</p>
                <p className="text-3xl font-bold text-gray-900">{completedTodayCount}</p>
              </div>
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patient name, MRN, or order..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Order Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Order Types</option>
              <option value="medication">Medications</option>
              <option value="lab">Labs</option>
              <option value="imaging">Imaging</option>
              <option value="priorAuth">Prior Authorizations</option>
              <option value="referral">Referrals</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center">
              <Filter className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No orders found matching your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Order Type Icon */}
                      <div className={`p-2 rounded-lg ${getOrderColor(order.orderType)}`}>
                        {getOrderIcon(order.orderType)}
                      </div>

                      {/* Order Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{order.patientName}</h3>
                          <span className="text-xs text-gray-500">MRN: {order.patientMRN}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{order.orderText}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {order.providerName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(order.orderDate).toLocaleDateString()}
                          </span>
                          <span className={`px-2 py-0.5 rounded ${
                            order.confidence === 'high' ? 'bg-green-100 text-green-800' :
                            order.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.confidence} confidence
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status and Actions */}
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(order.status)}
                      <div className="flex gap-1">
                        {order.status === 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'in-progress');
                            }}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >
                            Start
                          </button>
                        )}
                        {order.status === 'in-progress' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'completed');
                            }}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Detail Modal */}
        {selectedOrder && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Patient</label>
                  <p className="text-lg font-semibold">{selectedOrder.patientName}</p>
                  <p className="text-sm text-gray-500">MRN: {selectedOrder.patientMRN}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Order Type</label>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg mt-1 ${getOrderColor(selectedOrder.orderType)}`}>
                    {getOrderIcon(selectedOrder.orderType)}
                    <span className="font-medium capitalize">{selectedOrder.orderType}</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Order Details</label>
                  <p className="text-gray-900 mt-1">{selectedOrder.orderText}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Provider</label>
                    <p className="text-gray-900">{selectedOrder.providerName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Order Date</label>
                    <p className="text-gray-900">{new Date(selectedOrder.orderDate).toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Confidence Level</label>
                  <p className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                    selectedOrder.confidence === 'high' ? 'bg-green-100 text-green-800' :
                    selectedOrder.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {selectedOrder.confidence.toUpperCase()}
                  </p>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  {selectedOrder.status === 'pending' && (
                    <button
                      onClick={() => {
                        updateOrderStatus(selectedOrder.id, 'in-progress');
                        setSelectedOrder(null);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Start Working on This
                    </button>
                  )}
                  {selectedOrder.status === 'in-progress' && (
                    <button
                      onClick={() => {
                        updateOrderStatus(selectedOrder.id, 'completed');
                        setSelectedOrder(null);
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Mark as Completed
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
