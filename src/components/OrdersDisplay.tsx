/**
 * Orders Display Component
 * Shows extracted lab and medication orders in a clean, staff-friendly format
 */

import { useState } from 'react';
import { Pill, TestTube, Camera, FileText, UserPlus, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { OrderExtractionResult, ExtractedOrder } from '../services/orderExtraction.service';

interface OrdersDisplayProps {
  orders: OrderExtractionResult | null;
  patientName?: string;
  onCopyOrders?: (ordersText: string) => void;
}

export function OrdersDisplay({ orders, patientName, onCopyOrders }: OrdersDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!orders) {
    return null;
  }

  // Check if we have any orders
  const totalOrders =
    orders.medications.length +
    orders.labs.length +
    orders.imaging.length +
    orders.priorAuths.length +
    orders.referrals.length;

  if (totalOrders === 0) {
    return null;
  }

  const getUrgencyBadge = (urgency?: 'routine' | 'urgent' | 'stat') => {
    if (!urgency || urgency === 'routine') return null;

    const styles = {
      stat: 'bg-red-600 text-white',
      urgent: 'bg-orange-500 text-white',
    };

    return (
      <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded ${styles[urgency]}`}>
        {urgency.toUpperCase()}
      </span>
    );
  };

  const getActionBadge = (action?: string) => {
    if (!action) return null;

    const actionColors: Record<string, string> = {
      start: 'bg-green-100 text-green-800',
      stop: 'bg-red-100 text-red-800',
      continue: 'bg-blue-100 text-blue-800',
      increase: 'bg-purple-100 text-purple-800',
      decrease: 'bg-yellow-100 text-yellow-800',
      order: 'bg-gray-100 text-gray-800',
      check: 'bg-teal-100 text-teal-800',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${actionColors[action] || 'bg-gray-100 text-gray-800'}`}>
        {action.toUpperCase()}
      </span>
    );
  };

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
      if (onCopyOrders) {
        onCopyOrders(text);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatOrdersForCopy = (orderList: ExtractedOrder[], title: string): string => {
    if (orderList.length === 0) return '';

    let text = `${title}:\n`;
    orderList.forEach((order, idx) => {
      const action = order.action ? `[${order.action.toUpperCase()}] ` : '';
      const urgency = order.urgency && order.urgency !== 'routine' ? ` (${order.urgency.toUpperCase()})` : '';
      text += `${idx + 1}. ${action}${order.text}${urgency}\n`;
    });
    return text + '\n';
  };

  const formatAllOrders = (): string => {
    let text = `=== ORDERS FOR ${patientName?.toUpperCase() || 'PATIENT'} ===\n\n`;

    if (orders.medications.length > 0) {
      text += formatOrdersForCopy(orders.medications, 'MEDICATION ORDERS');
    }
    if (orders.labs.length > 0) {
      text += formatOrdersForCopy(orders.labs, 'LAB ORDERS');
    }
    if (orders.imaging.length > 0) {
      text += formatOrdersForCopy(orders.imaging, 'IMAGING ORDERS');
    }
    if (orders.priorAuths.length > 0) {
      text += formatOrdersForCopy(orders.priorAuths, 'PRIOR AUTHORIZATION REQUIRED');
    }
    if (orders.referrals.length > 0) {
      text += formatOrdersForCopy(orders.referrals, 'REFERRALS');
    }

    text += `\nExtracted: ${new Date().toLocaleString()}`;
    return text;
  };

  const renderOrderSection = (
    title: string,
    icon: React.ReactNode,
    orderList: ExtractedOrder[],
    bgColor: string,
    textColor: string,
    sectionKey: string
  ) => {
    if (orderList.length === 0) return null;

    return (
      <div className={`mb-4 border-2 ${bgColor} rounded-lg overflow-hidden`}>
        <div className={`${textColor} px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-bold text-sm">{title}</h3>
            <span className="bg-white text-gray-900 px-2 py-0.5 rounded-full text-xs font-bold">
              {orderList.length}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(formatOrdersForCopy(orderList, title), sectionKey)}
            className="flex items-center gap-1 px-3 py-1 bg-white bg-opacity-30 hover:bg-opacity-50 rounded text-xs font-semibold transition"
          >
            {copiedSection === sectionKey ? (
              <>
                <Check className="w-3 h-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy Section
              </>
            )}
          </button>
        </div>
        <div className="bg-white p-3 space-y-2">
          {orderList.map((order, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
              <span className="text-xs font-bold text-gray-500 min-w-[24px]">{idx + 1}.</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {order.action && getActionBadge(order.action)}
                  <span className="text-sm text-gray-900">{order.text}</span>
                  {getUrgencyBadge(order.urgency)}
                </div>
                {order.confidence && order.confidence < 0.8 && (
                  <div className="mt-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded inline-block">
                    ⚠️ Low confidence ({Math.round(order.confidence * 100)}%) - please verify
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md border-2 border-blue-200">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h2 className="text-lg font-bold">Orders for Staff</h2>
            <span className="bg-white text-blue-900 px-3 py-1 rounded-full text-sm font-bold">
              {totalOrders} {totalOrders === 1 ? 'Order' : 'Orders'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(formatAllOrders(), 'all')}
              className="flex items-center gap-1 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-sm font-semibold transition"
            >
              {copiedSection === 'all' ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied All
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy All Orders
                </>
              )}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition"
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {patientName && (
          <div className="mt-2 text-sm text-blue-100">
            Patient: <span className="font-semibold">{patientName}</span>
          </div>
        )}
      </div>

      {/* Orders Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {orders.medications.length > 0 && (
              <div className="bg-green-100 border border-green-300 rounded px-3 py-2 text-center">
                <div className="text-2xl font-bold text-green-800">{orders.medications.length}</div>
                <div className="text-xs text-green-700 font-semibold">Medications</div>
              </div>
            )}
            {orders.labs.length > 0 && (
              <div className="bg-blue-100 border border-blue-300 rounded px-3 py-2 text-center">
                <div className="text-2xl font-bold text-blue-800">{orders.labs.length}</div>
                <div className="text-xs text-blue-700 font-semibold">Labs</div>
              </div>
            )}
            {orders.imaging.length > 0 && (
              <div className="bg-purple-100 border border-purple-300 rounded px-3 py-2 text-center">
                <div className="text-2xl font-bold text-purple-800">{orders.imaging.length}</div>
                <div className="text-xs text-purple-700 font-semibold">Imaging</div>
              </div>
            )}
            {orders.priorAuths.length > 0 && (
              <div className="bg-orange-100 border border-orange-300 rounded px-3 py-2 text-center">
                <div className="text-2xl font-bold text-orange-800">{orders.priorAuths.length}</div>
                <div className="text-xs text-orange-700 font-semibold">Prior Auths</div>
              </div>
            )}
            {orders.referrals.length > 0 && (
              <div className="bg-teal-100 border border-teal-300 rounded px-3 py-2 text-center">
                <div className="text-2xl font-bold text-teal-800">{orders.referrals.length}</div>
                <div className="text-xs text-teal-700 font-semibold">Referrals</div>
              </div>
            )}
          </div>

          {/* Order Sections */}
          {renderOrderSection(
            'MEDICATION ORDERS',
            <Pill className="w-5 h-5" />,
            orders.medications,
            'border-green-300 bg-green-50',
            'bg-green-600 text-white',
            'medications'
          )}

          {renderOrderSection(
            'LAB ORDERS',
            <TestTube className="w-5 h-5" />,
            orders.labs,
            'border-blue-300 bg-blue-50',
            'bg-blue-600 text-white',
            'labs'
          )}

          {renderOrderSection(
            'IMAGING ORDERS',
            <Camera className="w-5 h-5" />,
            orders.imaging,
            'border-purple-300 bg-purple-50',
            'bg-purple-600 text-white',
            'imaging'
          )}

          {renderOrderSection(
            'PRIOR AUTHORIZATION REQUIRED',
            <FileText className="w-5 h-5" />,
            orders.priorAuths,
            'border-orange-300 bg-orange-50',
            'bg-orange-600 text-white',
            'priorAuths'
          )}

          {renderOrderSection(
            'REFERRALS',
            <UserPlus className="w-5 h-5" />,
            orders.referrals,
            'border-teal-300 bg-teal-50',
            'bg-teal-600 text-white',
            'referrals'
          )}

          {/* Footer Note */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>📋 For Staff:</strong> These orders have been automatically extracted from the provider's dictation.
              Please verify all orders before processing. Items marked with low confidence should be double-checked against the full note.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
