/**
 * Order Status Panel Component
 * Shows completed orders with checkmarks and MA attribution
 * Displays on doctor dashboard right panel
 */

import React, { useState, useEffect } from 'react';
import { maOrdersService, type Order } from '../services/maOrders.service';
import { useAuth } from '../contexts/AuthContext';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface OrderStatusPanelProps {
  className?: string;
  patientId?: string; // Optional - filter orders for specific patient
}

export default function OrderStatusPanel({ className = '', patientId }: OrderStatusPanelProps) {
  const { user } = useAuth();
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [inProgressOrders, setInProgressOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    loadOrders();

    // Set up polling for live updates
    const interval = setInterval(loadOrders, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [user, patientId]);

  const loadOrders = async () => {
    if (!user) return;

    try {
      // Get orders for this doctor
      const [completed, inProgress] = await Promise.all([
        maOrdersService.getOrdersByDoctor(user.id, 'completed'),
        maOrdersService.getOrdersByDoctor(user.id, 'in_progress'),
      ]);

      // Filter by patient if specified
      const filterByPatient = (orders: Order[]) =>
        patientId ? orders.filter(order => order.patient_id === patientId) : orders;

      // Sort by most recent completion first
      const sortedCompleted = filterByPatient(completed)
        .sort((a, b) => {
          if (a.completed_at && b.completed_at) {
            return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
          }
          return 0;
        })
        .slice(0, 10); // Show only last 10 completed

      const filteredInProgress = filterByPatient(inProgress);

      setCompletedOrders(sortedCompleted);
      setInProgressOrders(filteredInProgress);
    } catch (error) {
      logError('OrderStatusPanel', 'Error message', {});
    } finally {
      setLoading(false);
    }
  };

  const formatOrderType = (type: string): string => {
    return type.replace('_', ' ').toUpperCase();
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'medication':
        return 'text-blue-600';
      case 'lab':
        return 'text-green-600';
      case 'imaging':
        return 'text-purple-600';
      case 'prior_auth':
        return 'text-red-600';
      case 'referral':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getOrderIcon = (type: string): string => {
    switch (type) {
      case 'medication':
        return '💊';
      case 'lab':
        return '🧪';
      case 'imaging':
        return '📷';
      case 'prior_auth':
        return '📋';
      case 'referral':
        return '👨‍⚕️';
      default:
        return '📝';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const hasOrders = completedOrders.length > 0 || inProgressOrders.length > 0;

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          📋 Order Status
          {hasOrders && (
            <span className="ml-2 text-sm font-normal text-gray-600">
              ({completedOrders.length} completed, {inProgressOrders.length} in progress)
            </span>
          )}
        </h3>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {!hasOrders ? (
          <div className="p-6 text-center">
            <div className="text-gray-400 text-4xl mb-2">📝</div>
            <p className="text-gray-500 text-sm">No orders yet</p>
            <p className="text-gray-400 text-xs mt-1">Orders will appear here when dictated</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* In Progress Orders */}
            {inProgressOrders.map(order => (
              <div key={order.order_id} className="p-3 hover:bg-yellow-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                    <span className="text-sm font-medium text-yellow-700">
                      {getOrderIcon(order.order_type)} {formatOrderType(order.order_type)}
                    </span>
                  </div>
                  <div className="text-xs text-yellow-600">In Progress</div>
                </div>

                <div className="mt-1 text-xs text-gray-600 ml-6">
                  {order.patient_name && <div>Patient: {order.patient_name}</div>}
                  <div className="truncate">{order.order_text}</div>
                  {order.ma_id && <div className="text-yellow-600 mt-1">Being handled by MA</div>}
                </div>
              </div>
            ))}

            {/* Completed Orders */}
            {completedOrders.map(order => (
              <div key={order.order_id} className="p-3 hover:bg-green-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span className={`text-sm font-medium ${getTypeColor(order.order_type)}`}>
                      {getOrderIcon(order.order_type)} {formatOrderType(order.order_type)}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setExpandedOrder(expandedOrder === order.order_id ? null : order.order_id)
                    }
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {expandedOrder === order.order_id ? '▲' : '▼'}
                  </button>
                </div>

                <div className="mt-1 text-xs text-gray-600 ml-6">
                  {order.patient_name && <div>Patient: {order.patient_name}</div>}
                  <div className="truncate">{order.order_text}</div>

                  {/* MA Attribution */}
                  <div className="flex items-center justify-between mt-1 text-green-600">
                    <span>✓ Completed by MA</span>
                    {order.completed_at && (
                      <span className="text-gray-400">
                        {new Date(order.completed_at).toLocaleDateString()} at{' '}
                        {new Date(order.completed_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {expandedOrder === order.order_id && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      {order.action && (
                        <div>
                          <strong>Action:</strong> {order.action.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <strong>Urgency:</strong> {order.urgency.toUpperCase()}
                      </div>
                      <div>
                        <strong>Priority:</strong> {order.priority_score}/10
                      </div>
                      {order.notes && (
                        <div>
                          <strong>MA Notes:</strong> {order.notes}
                        </div>
                      )}
                      {order.estimated_time_minutes && (
                        <div>
                          <strong>Est. Time:</strong> {order.estimated_time_minutes} min
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      {hasOrders && (
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <div className="flex justify-between text-xs text-gray-600">
            <span>📊 {completedOrders.length + inProgressOrders.length} total orders</span>
            <button onClick={loadOrders} className="text-blue-600 hover:text-blue-800">
              🔄 Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
