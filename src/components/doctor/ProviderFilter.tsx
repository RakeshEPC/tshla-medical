/**
 * ProviderFilter Component
 * Professional multi-select dropdown for filtering schedule by providers
 * Created: 2025-01-08
 */

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Check, X, Users } from 'lucide-react';

export interface Provider {
  id: string;
  name: string;
  specialty?: string;
  color?: string;
}

interface ProviderFilterProps {
  selectedProviders: string[];
  onSelectionChange: (providers: string[]) => void;
  availableProviders: Provider[];
  appointmentCounts?: Record<string, number>;
  className?: string;
}

export default function ProviderFilter({
  selectedProviders,
  onSelectionChange,
  availableProviders,
  appointmentCounts = {},
  className = '',
}: ProviderFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debug logging to verify component loads
  useEffect(() => {
    console.log('🎯 [ProviderFilter] Component loaded!', {
      selectedProviders,
      availableProvidersCount: availableProviders.length,
      appointmentCounts,
      timestamp: new Date().toISOString()
    });
  }, [selectedProviders, availableProviders, appointmentCounts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter providers based on search term
  const filteredProviders = availableProviders.filter(provider =>
    provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if all providers are selected
  const isAllSelected = selectedProviders.includes('ALL') ||
    selectedProviders.length === availableProviders.length;

  // Toggle all providers
  const handleToggleAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(['ALL']);
    }
  };

  // Toggle individual provider
  const handleToggleProvider = (providerId: string) => {
    if (selectedProviders.includes('ALL')) {
      // If "ALL" was selected, switch to selecting just this provider
      onSelectionChange([providerId]);
    } else if (selectedProviders.includes(providerId)) {
      // Deselect this provider
      const newSelection = selectedProviders.filter(id => id !== providerId);
      onSelectionChange(newSelection.length === 0 ? ['ALL'] : newSelection);
    } else {
      // Add this provider to selection
      const newSelection = [...selectedProviders, providerId];
      // If all providers are now selected, switch to "ALL"
      if (newSelection.length === availableProviders.length) {
        onSelectionChange(['ALL']);
      } else {
        onSelectionChange(newSelection);
      }
    }
  };

  // Clear all selections
  const handleClear = () => {
    onSelectionChange([]);
  };

  // Get display text for button
  const getButtonText = () => {
    if (isAllSelected) {
      return 'All Providers';
    }
    if (selectedProviders.length === 0) {
      return 'No Providers Selected';
    }
    if (selectedProviders.length === 1) {
      const provider = availableProviders.find(p => p.id === selectedProviders[0]);
      return provider ? provider.name : '1 Provider';
    }
    return `${selectedProviders.length} Providers`;
  };

  // Get provider initials for avatar
  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get color for provider avatar
  const getProviderColor = (index: number): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-red-500',
    ];
    return colors[index % colors.length];
  };

  // Total appointments across selected providers
  const getTotalAppointments = (): number => {
    if (isAllSelected) {
      return Object.values(appointmentCounts).reduce((sum, count) => sum + count, 0);
    }
    return selectedProviders.reduce((sum, id) => sum + (appointmentCounts[id] || 0), 0);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <div className="flex items-center space-x-3">
          <Users className="w-5 h-5 text-gray-500" />
          <div className="text-left">
            <div className="font-medium text-gray-900">{getButtonText()}</div>
            <div className="text-xs text-gray-500">
              {getTotalAppointments()} appointment{getTotalAppointments() !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Active Filter Chips (below button) */}
      {!isAllSelected && selectedProviders.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedProviders.map(providerId => {
            const provider = availableProviders.find(p => p.id === providerId);
            if (!provider) return null;
            return (
              <div
                key={providerId}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm"
              >
                <span className="text-blue-700 font-medium">{provider.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleProvider(providerId);
                  }}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Search Box */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search providers..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* All Providers Option */}
          <div className="border-b border-gray-200">
            <button
              onClick={handleToggleAll}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-gray-300 rounded flex items-center justify-center">
                  {isAllSelected && <Check className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">All Providers</div>
                    <div className="text-xs text-gray-500">{availableProviders.length} total</div>
                  </div>
                </div>
              </div>
              <div className="text-sm font-medium text-blue-600">
                {getTotalAppointments()}
              </div>
            </button>
          </div>

          {/* Provider List */}
          <div className="overflow-y-auto max-h-64">
            {filteredProviders.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No providers found
              </div>
            ) : (
              filteredProviders.map((provider, index) => {
                const isSelected = isAllSelected || selectedProviders.includes(provider.id);
                const count = appointmentCounts[provider.id] || 0;

                return (
                  <button
                    key={provider.id}
                    onClick={() => handleToggleProvider(provider.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 border-2 border-gray-300 rounded flex items-center justify-center">
                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-8 h-8 ${getProviderColor(index)} rounded-full flex items-center justify-center text-white text-xs font-semibold`}
                        >
                          {getInitials(provider.name)}
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-gray-900">{provider.name}</div>
                          {provider.specialty && (
                            <div className="text-xs text-gray-500">{provider.specialty}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium text-gray-600">{count}</div>
                      {count > 0 && (
                        <div className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                          appt{count !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
