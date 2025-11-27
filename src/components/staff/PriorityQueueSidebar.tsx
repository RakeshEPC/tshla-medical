/**
 * Priority Queue Sidebar
 * Right sidebar showing urgent tasks sorted by priority
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, X, RefreshCw } from 'lucide-react';
import { priorityQueueService, type PriorityQueueItem } from '../../services/priorityQueue.service';
import { useNavigate } from 'react-router-dom';

interface PriorityQueueSidebarProps {
  onTaskClick?: (task: PriorityQueueItem) => void;
  realtimeAlerts?: any[];
  onAlertDismiss?: (index: number) => void;
}

export default function PriorityQueueSidebar({
  onTaskClick,
  realtimeAlerts = [],
  onAlertDismiss
}: PriorityQueueSidebarProps) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<PriorityQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, critical: 0, urgent: 0, moderate: 0, routine: 0 });

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const items = await priorityQueueService.getUrgentTasksQueue();
      setQueue(items);

      const queueStats = await priorityQueueService.getQueueStats();
      setStats(queueStats);
    } catch (error) {
      console.error('Error loading priority queue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();

    // Auto-refresh every 2 minutes
    const interval = setInterval(loadQueue, 120000);
    return () => clearInterval(interval);
  }, []);

  const handleTaskClick = (task: PriorityQueueItem) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
    navigate(task.actionUrl);
  };

  const getUrgencyBadge = (score: number) => {
    if (score >= 80) {
      return <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded-full">CRITICAL</span>;
    }
    if (score >= 60) {
      return <span className="px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-800 rounded-full">URGENT</span>;
    }
    if (score >= 40) {
      return <span className="px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">MODERATE</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">ROUTINE</span>;
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Priority Queue</h2>
          <button
            onClick={loadQueue}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 rounded transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-xs font-semibold text-red-600">{stats.critical}</div>
            <div className="text-xs text-gray-500">Critical</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-orange-600">{stats.urgent}</div>
            <div className="text-xs text-gray-500">Urgent</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-yellow-600">{stats.moderate}</div>
            <div className="text-xs text-gray-500">Moderate</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-blue-600">{stats.routine}</div>
            <div className="text-xs text-gray-500">Routine</div>
          </div>
        </div>
      </div>

      {/* Real-time Alerts */}
      {realtimeAlerts.length > 0 && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="px-4 py-2">
            <div className="text-xs font-semibold text-red-900 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Live Alerts
            </div>
            {realtimeAlerts.map((alert, index) => (
              <div
                key={index}
                className="mb-2 p-2 bg-white border border-red-200 rounded text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-red-900">{alert.message}</div>
                    <div className="text-gray-600 text-xs mt-0.5">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    onClick={() => onAlertDismiss?.(index)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading && queue.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-3 bg-gray-100 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No urgent tasks</p>
            <p className="text-xs mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((task) => (
              <button
                key={task.id}
                onClick={() => handleTaskClick(task)}
                className={`w-full text-left p-3 rounded-lg border-l-4 ${task.color} hover:shadow-md transition`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-sm font-medium text-gray-900 line-clamp-2">
                    {task.description}
                  </div>
                  {getUrgencyBadge(task.urgency_score)}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="font-medium">{task.patient_name}</span>
                  {task.due_date && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-xs text-blue-600 font-medium">
                    {task.actionText} →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>Total tasks:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Auto-refreshes every 2 minutes
          </div>
        </div>
      </div>
    </div>
  );
}
