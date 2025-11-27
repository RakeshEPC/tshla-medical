/**
 * Global Search Component
 * Cmd+K search across patients, appointments, labs
 */

import { useState, useEffect, useRef } from 'react';
import { Search, X, Calendar, Beaker, User, Phone } from 'lucide-react';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

interface SearchResult {
  id: string;
  type: 'patient' | 'appointment' | 'lab' | 'task';
  title: string;
  subtitle: string;
  icon: typeof User;
  url: string;
}

export default function GlobalSearch({ isOpen, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    // Simple demo search - would be actual API calls in production
    const demoResults: SearchResult[] = [
      {
        id: '1',
        type: 'patient',
        title: 'John Williams',
        subtitle: 'PCM Patient - High Risk',
        icon: User,
        url: '/pcm/patient/1'
      },
      {
        id: '2',
        type: 'appointment',
        title: '2:00 PM - Maria Garcia',
        subtitle: 'Follow-up Visit',
        icon: Calendar,
        url: '/dashboard?patient=2'
      },
      {
        id: '3',
        type: 'lab',
        title: 'STAT: Hemoglobin A1C',
        subtitle: 'Due Today - John Williams',
        icon: Beaker,
        url: '/pcm/labs?order=3'
      }
    ].filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
    );

    setResults(demoResults);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onNavigate(results[selectedIndex].url);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-start justify-center min-h-screen pt-24 px-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl">
          {/* Search Input */}
          <div className="flex items-center border-b border-gray-200 px-4">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search patients, appointments, labs..."
              className="flex-1 px-4 py-4 text-lg outline-none"
            />
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {results.length === 0 && query.length >= 2 && (
              <div className="px-4 py-8 text-center text-gray-500">
                No results found for "{query}"
              </div>
            )}

            {results.length === 0 && query.length < 2 && (
              <div className="px-4 py-8 text-center text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Type to search across all patients and tasks</p>
              </div>
            )}

            {results.map((result, index) => {
              const Icon = result.icon;
              return (
                <button
                  key={result.id}
                  onClick={() => onNavigate(result.url)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition ${
                    index === selectedIndex ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{result.title}</div>
                    <div className="text-sm text-gray-500">{result.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">esc</kbd>
                  Close
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
