/**
 * Zone C: Plan + Memory Component
 *
 * Universal bottom section for disease dashboards.
 * Shows: What we did last visit, what we're watching, and next triggers.
 * Provides clinical continuity.
 */

import { Clock, Eye, AlertTriangle, ChevronRight, FileText, History } from 'lucide-react';

export interface LastVisitChange {
  action: string;
  details?: string;
}

export interface WatchItem {
  item: string;
  reason?: string;
  status?: 'normal' | 'watching' | 'concerning';
}

export interface TriggerItem {
  condition: string;
  action: string;
}

export interface ZoneCProps {
  lastVisitDate?: string;
  lastVisitChanges?: LastVisitChange[];
  watching?: WatchItem[];
  nextTriggers?: TriggerItem[];
  lastNoteExcerpt?: string;
  className?: string;
}

export default function ZoneC_PlanMemory({
  lastVisitDate,
  lastVisitChanges = [],
  watching = [],
  nextTriggers = [],
  lastNoteExcerpt,
  className = ''
}: ZoneCProps) {
  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const hasContent = lastVisitChanges.length > 0 || watching.length > 0 || nextTriggers.length > 0 || lastNoteExcerpt;

  if (!hasContent) {
    return (
      <div className={`bg-gray-50 rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="text-center text-gray-500">
          <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No previous visit data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gray-500" />
          <h3 className="font-medium text-gray-900">Plan & Memory</h3>
        </div>
        {lastVisitDate && (
          <span className="text-sm text-gray-500">
            Last visit: {formatDate(lastVisitDate)}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Last Visit Changes */}
        {lastVisitChanges.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <h4 className="text-sm font-medium text-gray-700">Last Visit Actions</h4>
            </div>
            <ul className="space-y-1.5 ml-6">
              {lastVisitChanges.map((change, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm text-gray-800">{change.action}</span>
                    {change.details && (
                      <span className="text-sm text-gray-500 ml-1">({change.details})</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Watching */}
        {watching.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-medium text-gray-700">Watching</h4>
            </div>
            <div className="flex flex-wrap gap-2 ml-6">
              {watching.map((item, idx) => (
                <div
                  key={idx}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                    item.status === 'concerning'
                      ? 'bg-red-100 text-red-700'
                      : item.status === 'watching'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {item.status === 'concerning' && <AlertTriangle className="w-3 h-3" />}
                  {item.item}
                  {item.reason && (
                    <span className="text-xs opacity-75">({item.reason})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Triggers */}
        {nextTriggers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-purple-500" />
              <h4 className="text-sm font-medium text-gray-700">Decision Triggers</h4>
            </div>
            <ul className="space-y-2 ml-6">
              {nextTriggers.map((trigger, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border border-purple-100"
                >
                  <span className="text-sm">
                    <span className="font-medium text-purple-800">If</span>{' '}
                    <span className="text-gray-700">{trigger.condition}</span>{' '}
                    <span className="font-medium text-purple-800">→</span>{' '}
                    <span className="text-gray-800">{trigger.action}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Last Note Excerpt */}
        {lastNoteExcerpt && (
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <h4 className="text-sm font-medium text-gray-500">From last note</h4>
            </div>
            <p className="text-sm text-gray-600 italic ml-6 line-clamp-3">
              "{lastNoteExcerpt}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
