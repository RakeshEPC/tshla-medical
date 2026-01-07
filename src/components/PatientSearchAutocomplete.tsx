import React, { useState, useEffect, useRef } from 'react';
import { patientSearchService, type PatientSearchResult } from '../services/patientSearch.service';

interface PatientSearchAutocompleteProps {
  onSelect: (patient: PatientSearchResult | null) => void;
  onCreateNew: () => void;
  initialValue?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function PatientSearchAutocomplete({
  onSelect,
  onCreateNew,
  initialValue = '',
  placeholder = 'Search by name, phone, or MRN...',
  disabled = false
}: PatientSearchAutocompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout
    searchTimeoutRef.current = setTimeout(async () => {
      const searchResults = await patientSearchService.searchPatients(query, 10);
      setResults(searchResults);
      setShowDropdown(true);
      setIsLoading(false);
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (patient: PatientSearchResult) => {
    setQuery(patient.full_name);
    setShowDropdown(false);
    onSelect(patient);
  };

  const handleCreateNew = () => {
    setShowDropdown(false);
    onCreateNew();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex === results.length) {
          handleCreateNew();
        } else if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 font-semibold">{part}</mark>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  const formatAge = (age?: number) => {
    return age ? `${age}yo` : '';
  };

  const formatDOB = (dob?: string) => {
    if (!dob) return '';
    try {
      return new Date(dob).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dob;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
        />

        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Search Icon */}
        {!isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            🔍
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {/* No Results */}
          {results.length === 0 && !isLoading && (
            <div className="p-4 text-center">
              <p className="text-gray-500 mb-3">No patients found matching "{query}"</p>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                ➕ Create New Patient
              </button>
            </div>
          )}

          {/* Results List */}
          {results.length > 0 && (
            <>
              {results.map((patient, index) => (
                <div
                  key={patient.id}
                  onClick={() => handleSelect(patient)}
                  className={`px-4 py-3 cursor-pointer border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                    selectedIndex === index ? 'bg-blue-100' : ''
                  }`}
                >
                  {/* Patient Name */}
                  <div className="font-semibold text-gray-900 mb-1">
                    {highlightMatch(patient.full_name, query)}
                    {patient.age && (
                      <span className="ml-2 text-sm text-gray-600">
                        {formatAge(patient.age)}
                      </span>
                    )}
                    {patient.gender && (
                      <span className="ml-1 text-sm text-gray-600">
                        • {patient.gender}
                      </span>
                    )}
                  </div>

                  {/* Patient Details */}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    {/* Phone */}
                    {patient.phone_display && (
                      <span className="flex items-center gap-1">
                        📞 {highlightMatch(patient.phone_display, query)}
                      </span>
                    )}

                    {/* DOB */}
                    {patient.date_of_birth && (
                      <span className="flex items-center gap-1">
                        🎂 {formatDOB(patient.date_of_birth)}
                      </span>
                    )}

                    {/* MRN */}
                    {patient.mrn && (
                      <span className="flex items-center gap-1 font-mono text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        MRN: {highlightMatch(patient.mrn, query)}
                      </span>
                    )}

                    {/* Patient ID */}
                    <span className="flex items-center gap-1 font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      ID: {patient.patient_id}
                    </span>
                  </div>

                  {/* Email */}
                  {patient.email && (
                    <div className="text-xs text-gray-500 mt-1">
                      ✉️ {patient.email}
                    </div>
                  )}

                  {/* Last Visit */}
                  {patient.last_visit_date && (
                    <div className="text-xs text-gray-500 mt-1">
                      Last visit: {formatDOB(patient.last_visit_date)}
                      {patient.total_visits && patient.total_visits > 0 && (
                        <span className="ml-2">({patient.total_visits} total visits)</span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Create New Option */}
              <div
                onClick={handleCreateNew}
                className={`px-4 py-3 cursor-pointer hover:bg-green-50 transition-colors border-t-2 border-gray-300 ${
                  selectedIndex === results.length ? 'bg-green-100' : ''
                }`}
              >
                <div className="flex items-center gap-2 text-green-700 font-semibold">
                  <span className="text-xl">➕</span>
                  <span>Create New Patient</span>
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Patient not found? Add them to the system
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
