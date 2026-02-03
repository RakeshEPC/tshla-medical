import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentRequestService } from '../services/paymentRequest.service';
import type { DailySummaryReport, UnpostedPaymentsReport, OutstandingPaymentsReport } from '../types/payment.types';

type ReportType = 'daily' | 'unposted' | 'outstanding';

export default function PatientPaymentReports() {
  const navigate = useNavigate();

  const [activeReport, setActiveReport] = useState<ReportType>('daily');
  const [loading, setLoading] = useState(false);

  // Daily Summary - Date Range Support
  const [dateRangeMode, setDateRangeMode] = useState<'single' | 'range'>('single');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterBy, setFilterBy] = useState<'paid_at' | 'visit_date'>('paid_at');
  const [dailyReport, setDailyReport] = useState<DailySummaryReport | null>(null);

  // Unposted Payments
  const [unpostedReport, setUnpostedReport] = useState<UnpostedPaymentsReport | null>(null);

  // Outstanding Payments
  const [outstandingReport, setOutstandingReport] = useState<OutstandingPaymentsReport | null>(null);

  useEffect(() => {
    loadReport();
  }, [activeReport, selectedDate, startDate, endDate, dateRangeMode, filterBy]);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (activeReport === 'daily') {
        const params = dateRangeMode === 'range'
          ? { startDate, endDate, filterBy }
          : { date: selectedDate, filterBy };
        const data = await paymentRequestService.getDailySummary(params);
        setDailyReport(data);
      } else if (activeReport === 'unposted') {
        const data = await paymentRequestService.getUnpostedReport();
        setUnpostedReport(data);
      } else if (activeReport === 'outstanding') {
        const data = await paymentRequestService.getOutstandingReport();
        setOutstandingReport(data);
      }
    } catch (error) {
      console.error('Error loading report:', error);
      alert('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  // Date range preset handlers
  const setDateRangePreset = (preset: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (preset) {
      case 'today':
        setDateRangeMode('single');
        setSelectedDate(todayStr);
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setDateRangeMode('single');
        setSelectedDate(yesterday.toISOString().split('T')[0]);
        break;
      case 'last7':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 6);
        setDateRangeMode('range');
        setStartDate(last7.toISOString().split('T')[0]);
        setEndDate(todayStr);
        break;
      case 'last30':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 29);
        setDateRangeMode('range');
        setStartDate(last30.toISOString().split('T')[0]);
        setEndDate(todayStr);
        break;
      case 'thisMonth':
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        setDateRangeMode('range');
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(todayStr);
        break;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    // Simple CSV export logic
    let csvContent = '';
    let filename = '';

    if (activeReport === 'daily' && dailyReport) {
      const dateStr = dateRangeMode === 'range' ? `${startDate}_to_${endDate}` : selectedDate;
      filename = `daily-summary-${dateStr}.csv`;

      // Header with summary
      csvContent = `Daily Payment Report - ${filterBy === 'paid_at' ? 'Payment Date' : 'Visit Date'}\n`;
      csvContent += `Period: ${dateRangeMode === 'range' ? `${startDate} to ${endDate}` : selectedDate}\n`;
      csvContent += `Total Collected: $${(dailyReport.total_collected / 100).toFixed(2)}\n`;
      csvContent += `Total Count: ${dailyReport.total_count}\n\n`;

      // Individual transactions
      csvContent += 'Date Paid,Time,Patient Name,MRN,Provider,Visit Date,Payment Type,Amount,Card Last 4\n';
      dailyReport.transactions.forEach(t => {
        const paidDate = t.paid_at ? new Date(t.paid_at) : null;
        const datePaid = paidDate ? paidDate.toLocaleDateString() : 'N/A';
        const timePaid = paidDate ? paidDate.toLocaleTimeString() : 'N/A';
        csvContent += `${datePaid},${timePaid},"${t.patient_name}",${t.athena_mrn || 'N/A'},${t.provider_name},${new Date(t.visit_date).toLocaleDateString()},${t.payment_type},$${(t.amount_cents / 100).toFixed(2)},${t.card_last_4 || 'N/A'}\n`;
      });

      csvContent += `\n\nSummary by Provider\n`;
      csvContent += 'Provider,Amount,Count\n';
      dailyReport.by_provider.forEach(p => {
        csvContent += `${p.provider_name},$${(p.total / 100).toFixed(2)},${p.count}\n`;
      });
    } else if (activeReport === 'unposted' && unpostedReport) {
      filename = `unposted-payments-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Patient,MRN,Amount,Type,Paid Date\n';
      unpostedReport.payments.forEach(p => {
        csvContent += `${p.patient_name},${p.athena_mrn || 'N/A'},$${(p.amount_cents / 100).toFixed(2)},${p.payment_type},${new Date(p.paid_at!).toLocaleDateString()}\n`;
      });
    } else if (activeReport === 'outstanding' && outstandingReport) {
      filename = `outstanding-payments-${new Date().toISOString().split('T')[0]}.csv`;
      csvContent = 'Patient,MRN,Amount,Type,Days Outstanding\n';
      outstandingReport.payments.forEach(p => {
        const daysOld = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
        csvContent += `${p.patient_name},${p.athena_mrn || 'N/A'},$${(p.amount_cents / 100).toFixed(2)},${p.payment_type},${daysOld}\n`;
      });
    }

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate('/patient-payments')}
              className="text-indigo-100 hover:text-white"
            >
              ← Back to Payment Dashboard
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-white text-indigo-700 rounded-lg hover:bg-indigo-50 font-medium transition-colors"
              >
                📥 Export CSV
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-white text-indigo-700 rounded-lg hover:bg-indigo-50 font-medium transition-colors"
              >
                🖨 Print
              </button>
            </div>
          </div>
          <h1 className="text-3xl font-bold">Payment Reports</h1>
          <p className="text-indigo-100 mt-1">Financial reporting and analytics</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Report Type Selector */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 print:hidden">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveReport('daily')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeReport === 'daily'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Daily Summary
            </button>
            <button
              onClick={() => setActiveReport('unposted')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeReport === 'unposted'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 Unposted Payments
            </button>
            <button
              onClick={() => setActiveReport('outstanding')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeReport === 'outstanding'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ⏰ Outstanding Requests
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading report...</p>
          </div>
        ) : (
          <>
            {/* Daily Summary Report */}
            {activeReport === 'daily' && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-200 print:bg-white">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Collection Report</h2>

                  {/* Date Controls */}
                  <div className="space-y-4 print:hidden">
                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setDateRangePreset('today')}
                        className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setDateRangePreset('yesterday')}
                        className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                      >
                        Yesterday
                      </button>
                      <button
                        onClick={() => setDateRangePreset('last7')}
                        className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                      >
                        Last 7 Days
                      </button>
                      <button
                        onClick={() => setDateRangePreset('last30')}
                        className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                      >
                        Last 30 Days
                      </button>
                      <button
                        onClick={() => setDateRangePreset('thisMonth')}
                        className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                      >
                        This Month
                      </button>
                    </div>

                    {/* Date Range Toggle */}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={dateRangeMode === 'single'}
                          onChange={() => setDateRangeMode('single')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">Single Date</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={dateRangeMode === 'range'}
                          onChange={() => setDateRangeMode('range')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">Date Range</span>
                      </label>
                    </div>

                    {/* Date Pickers */}
                    <div className="flex items-center gap-4">
                      {dateRangeMode === 'single' ? (
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <>
                          <div>
                            <label className="text-xs text-gray-600 block mb-1">Start Date</label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 block mb-1">End Date</label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Filter By Toggle */}
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-700">Filter by:</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={filterBy === 'paid_at'}
                          onChange={() => setFilterBy('paid_at')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Payment Date</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={filterBy === 'visit_date'}
                          onChange={() => setFilterBy('visit_date')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Visit Date</span>
                      </label>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mt-4">
                    {dateRangeMode === 'range'
                      ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
                      : new Date(selectedDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                    }
                    {' '}(by {filterBy === 'paid_at' ? 'Payment' : 'Visit'} Date)
                  </p>
                </div>

                {dailyReport ? (
                  <div className="p-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-300">
                        <p className="text-sm text-green-700 font-medium mb-1">Total Collected</p>
                        <p className="text-4xl font-bold text-green-900">
                          ${(dailyReport.total_collected / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-300">
                        <p className="text-sm text-blue-700 font-medium mb-1">Number of Payments</p>
                        <p className="text-4xl font-bold text-blue-900">{dailyReport.total_count}</p>
                      </div>
                    </div>

                    {/* By Payment Type */}
                    <div className="mb-8">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">By Payment Type</h3>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                          <p className="text-xs text-purple-700 font-medium mb-1">Copay</p>
                          <p className="text-2xl font-bold text-purple-900">
                            ${(dailyReport.by_payment_type.copay / 100).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                          <p className="text-xs text-orange-700 font-medium mb-1">Deductible</p>
                          <p className="text-2xl font-bold text-orange-900">
                            ${(dailyReport.by_payment_type.deductible / 100).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                          <p className="text-xs text-yellow-700 font-medium mb-1">Balance</p>
                          <p className="text-2xl font-bold text-yellow-900">
                            ${(dailyReport.by_payment_type.balance / 100).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <p className="text-xs text-gray-700 font-medium mb-1">Other</p>
                          <p className="text-2xl font-bold text-gray-900">
                            ${(dailyReport.by_payment_type.other / 100).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* By Provider */}
                    <div className="mb-8">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">By Provider</h3>
                      {dailyReport.by_provider.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No payments on this date</p>
                      ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {dailyReport.by_provider.map((provider, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{provider.provider_name}</td>
                                <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                                  ${(provider.total / 100).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-sm text-right text-gray-700">{provider.count}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-100 font-bold">
                            <tr>
                              <td className="px-6 py-4 text-sm text-gray-900">TOTAL</td>
                              <td className="px-6 py-4 text-sm text-right text-green-700">
                                ${(dailyReport.total_collected / 100).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">{dailyReport.total_count}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>

                    {/* Individual Transactions */}
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Transaction History</h3>
                      {dailyReport.transactions.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No transactions found</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRN</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visit Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {dailyReport.transactions.map((transaction) => {
                                const paidDate = transaction.paid_at ? new Date(transaction.paid_at) : null;
                                return (
                                  <tr key={transaction.id} className="hover:bg-gray-50 text-sm">
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                                      {paidDate ? paidDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-gray-900">{transaction.patient_name}</td>
                                    <td className="px-4 py-3 font-mono text-orange-600 text-xs">{transaction.athena_mrn || 'N/A'}</td>
                                    <td className="px-4 py-3 text-gray-700">{transaction.provider_name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                                      {new Date(transaction.visit_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 capitalize text-gray-700">{transaction.payment_type}</td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                      ${(transaction.amount_cents / 100).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                                      {transaction.card_last_4 ? `****${transaction.card_last_4}` : 'N/A'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-gray-100">
                              <tr>
                                <td colSpan={6} className="px-4 py-3 text-sm font-bold text-gray-900">
                                  Total: {dailyReport.transactions.length} transactions
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-bold text-green-700">
                                  ${(dailyReport.total_collected / 100).toFixed(2)}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-500">
                    Select a date to view daily summary
                  </div>
                )}
              </div>
            )}

            {/* Unposted Payments Report */}
            {activeReport === 'unposted' && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-blue-50 border-b border-blue-200 print:bg-white">
                  <h2 className="text-xl font-bold text-gray-900">Unposted Payments (Need EMR Entry)</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Payments that have been collected but not yet posted in EMR
                  </p>
                </div>

                {unpostedReport ? (
                  <div className="p-6">
                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-yellow-800 font-semibold">Total Unposted</p>
                          <p className="text-3xl font-bold text-yellow-900">
                            ${(unpostedReport.total_unposted / 100).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-yellow-800 font-semibold">Count</p>
                          <p className="text-3xl font-bold text-yellow-900">{unpostedReport.total_count}</p>
                        </div>
                      </div>
                    </div>

                    {unpostedReport.payments.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">✓</div>
                        <p className="text-gray-500 text-lg font-semibold">All payments are posted!</p>
                        <p className="text-gray-400 text-sm mt-2">No action required</p>
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRN</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {unpostedReport.payments.map((payment) => (
                            <tr key={payment.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-semibold text-gray-900">{payment.patient_name}</td>
                              <td className="px-6 py-4 text-sm font-mono text-orange-600">{payment.athena_mrn || 'N/A'}</td>
                              <td className="px-6 py-4 text-sm font-bold text-gray-900">
                                ${(payment.amount_cents / 100).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-sm capitalize">{payment.payment_type}</td>
                              <td className="px-6 py-4 text-sm text-gray-700">
                                {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700">{payment.provider_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-500">Loading...</div>
                )}
              </div>
            )}

            {/* Outstanding Requests Report */}
            {activeReport === 'outstanding' && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-red-50 border-b border-red-200 print:bg-white">
                  <h2 className="text-xl font-bold text-gray-900">Outstanding Payment Requests</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Pending payment requests by age
                  </p>
                </div>

                {outstandingReport ? (
                  <div className="p-6">
                    {/* Aging Summary */}
                    <div className="grid grid-cols-3 gap-6 mb-8">
                      <div className="bg-yellow-50 rounded-lg p-6 border-2 border-yellow-300">
                        <p className="text-sm text-yellow-700 font-medium mb-1">0-30 Days</p>
                        <p className="text-3xl font-bold text-yellow-900">
                          ${(outstandingReport.aging['0-30'].total / 100).toFixed(2)}
                        </p>
                        <p className="text-sm text-yellow-700 mt-1">{outstandingReport.aging['0-30'].count} requests</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-6 border-2 border-orange-300">
                        <p className="text-sm text-orange-700 font-medium mb-1">31-60 Days</p>
                        <p className="text-3xl font-bold text-orange-900">
                          ${(outstandingReport.aging['31-60'].total / 100).toFixed(2)}
                        </p>
                        <p className="text-sm text-orange-700 mt-1">{outstandingReport.aging['31-60'].count} requests</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-6 border-2 border-red-300">
                        <p className="text-sm text-red-700 font-medium mb-1">60+ Days</p>
                        <p className="text-3xl font-bold text-red-900">
                          ${(outstandingReport.aging['60+'].total / 100).toFixed(2)}
                        </p>
                        <p className="text-sm text-red-700 mt-1">{outstandingReport.aging['60+'].count} requests</p>
                      </div>
                    </div>

                    {outstandingReport.payments.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">✓</div>
                        <p className="text-gray-500 text-lg font-semibold">No outstanding requests!</p>
                        <p className="text-gray-400 text-sm mt-2">All requests have been paid or canceled</p>
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRN</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Old</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {outstandingReport.payments.map((payment) => {
                            const daysOld = Math.floor((Date.now() - new Date(payment.created_at).getTime()) / (1000 * 60 * 60 * 24));
                            const ageColor = daysOld > 60 ? 'text-red-700' : daysOld > 30 ? 'text-orange-700' : 'text-yellow-700';

                            return (
                              <tr key={payment.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{payment.patient_name}</td>
                                <td className="px-6 py-4 text-sm font-mono text-orange-600">{payment.athena_mrn || 'N/A'}</td>
                                <td className="px-6 py-4 text-sm font-bold text-gray-900">
                                  ${(payment.amount_cents / 100).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-sm capitalize">{payment.payment_type}</td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                  {new Date(payment.created_at).toLocaleDateString()}
                                </td>
                                <td className={`px-6 py-4 text-sm font-bold ${ageColor}`}>
                                  {daysOld} days
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-500">Loading...</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
