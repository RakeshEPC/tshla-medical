import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentRequestService } from '../services/paymentRequest.service';
import type { PaymentRequest, PaymentDashboardFilters, PaymentStatus } from '../types/payment.types';

export default function StaffPaymentDashboard() {
  const navigate = useNavigate();

  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total_pending: 0,
    total_pending_count: 0,
    total_paid: 0,
    total_paid_count: 0,
    total_unposted: 0,
    total_unposted_count: 0
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [postedFilter, setPostedFilter] = useState<boolean | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadPayments();
  }, [statusFilter, postedFilter, startDate, endDate]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const filters: PaymentDashboardFilters = {
        status: statusFilter,
        posted: postedFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        searchQuery: searchQuery || undefined
      };

      const response = await paymentRequestService.listPayments(filters);
      setPayments(response.payments);
      setSummary(response.summary);
    } catch (error) {
      console.error('Error loading payments:', error);
      alert('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadPayments();
  };

  const handleMarkAsPosted = async (paymentId: string) => {
    if (!confirm('Mark this payment as posted in EMR?')) return;

    try {
      const staffData = sessionStorage.getItem('tshla_medical_user');
      const staffId = staffData ? JSON.parse(staffData).id : undefined;

      await paymentRequestService.markAsPosted(paymentId, staffId);
      alert('Payment marked as posted in EMR');
      await loadPayments(); // Reload to update display
    } catch (error) {
      console.error('Error marking payment as posted:', error);
      alert('Failed to mark payment as posted');
    }
  };

  const handleCancelPayment = async (paymentId: string) => {
    if (!confirm('Cancel this payment request? This cannot be undone.')) return;

    try {
      await paymentRequestService.cancelPayment(paymentId);
      alert('Payment request canceled');
      await loadPayments(); // Reload to update display
    } catch (error) {
      console.error('Error canceling payment:', error);
      alert('Failed to cancel payment request');
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      payment.patient_name.toLowerCase().includes(query) ||
      payment.patient_phone.includes(query) ||
      payment.tshla_id?.toLowerCase().includes(query) ||
      payment.athena_mrn?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-green-100 hover:text-white"
            >
              ← Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/patient-payments/reports')}
              className="px-4 py-2 bg-white text-green-700 rounded-lg hover:bg-green-50 font-medium transition-colors"
            >
              📊 View Reports
            </button>
          </div>
          <h1 className="text-3xl font-bold">Patient Payment Dashboard</h1>
          <p className="text-green-100 mt-1">Track online payments and EMR posting</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Pending Payments */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Payments</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${(summary.total_pending / 100).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 mt-1">{summary.total_pending_count} requests</p>
              </div>
              <div className="text-5xl text-yellow-500">⏳</div>
            </div>
          </div>

          {/* Paid (Not Posted) */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Paid (Not Posted)</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${(summary.total_unposted / 100).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 mt-1">{summary.total_unposted_count} payments</p>
              </div>
              <div className="text-5xl text-blue-500">💳</div>
            </div>
          </div>

          {/* Total Collected */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Collected</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${(summary.total_paid / 100).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 mt-1">{summary.total_paid_count} payments</p>
              </div>
              <div className="text-5xl text-green-500">✓</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Filters & Search</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>

            {/* Posted Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">EMR Posted</label>
              <select
                value={String(postedFilter)}
                onChange={(e) => {
                  const val = e.target.value;
                  setPostedFilter(val === 'all' ? 'all' : val === 'true');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All</option>
                <option value="false">Not Posted</option>
                <option value="true">Posted</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Name, phone, MRN..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  🔍
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Payment List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">
              Payment Requests ({filteredPayments.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading payments...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 text-lg">No payment requests found</p>
              <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      MRN / TSHLA ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visit Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      EMR Posted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{payment.patient_name}</div>
                          <div className="text-sm text-gray-500">{payment.patient_phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="font-mono text-orange-600">{payment.athena_mrn || 'N/A'}</div>
                          <div className="font-mono text-purple-600 text-xs">{payment.tshla_id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-bold text-gray-900">
                          ${(payment.amount_cents / 100).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 capitalize">
                          {payment.payment_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize ${
                          payment.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                          payment.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          payment.payment_status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {payment.payment_status === 'paid' && '✓ '}
                          {payment.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payment.visit_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.posted_in_emr ? (
                          <div className="text-sm">
                            <div className="flex items-center gap-1 text-green-600 font-semibold">
                              <span className="text-lg">✓</span>
                              Posted
                            </div>
                            {payment.posted_in_emr_at && (
                              <div className="text-xs text-gray-500">
                                {new Date(payment.posted_in_emr_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not posted</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          {payment.payment_status === 'paid' && !payment.posted_in_emr && (
                            <button
                              onClick={() => handleMarkAsPosted(payment.id)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-semibold"
                            >
                              Mark Posted
                            </button>
                          )}
                          {payment.payment_status === 'pending' && (
                            <button
                              onClick={() => handleCancelPayment(payment.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-semibold"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-blue-900 mb-2">💡 Quick Guide</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>Pending:</strong> Payment request sent, awaiting patient payment</li>
            <li><strong>Paid:</strong> Patient completed payment via Stripe</li>
            <li><strong>Mark Posted:</strong> Click when payment is posted to EMR (moves to archive)</li>
            <li><strong>Cancel:</strong> Cancel pending payment request (cannot be undone)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
