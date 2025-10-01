'use client';

import React, { useState, useEffect } from 'react';
import { usePHIClearable } from '@/hooks/usePHIClearable';
import SecurePatientAPI from '@/lib/api/securePatientApi';
import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';

interface SecurePatientDisplayProps {
  patientId: string;
}

export default function SecurePatientDisplay({ patientId }: SecurePatientDisplayProps) {
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cleared, setCleared] = useState(false);

  // Clear patient data on PHI clear event
  usePHIClearable(() => {
    setPatient(null);
    setCleared(true);
    // Any other cleanup needed
  }, []);

  useEffect(() => {
    loadPatient();
  }, [patientId]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      setCleared(false);

      // Only request essential fields
      const data = await SecurePatientAPI.getPatient(patientId, [
        'firstName',
        'lastName',
        'dob',
        'conditions',
      ]);

      setPatient(data);
    } catch (error) {
      logError('SecurePatientDisplay', 'Error message', {});
    } finally {
      setLoading(false);
    }
  };

  if (cleared) {
    return (
      <div className="p-4 bg-gray-100 rounded">
        <p className="text-gray-500 text-center">[Patient data cleared for security]</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-gray-600">Loading secure patient data...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-4">
        <p className="text-gray-600">No patient data available</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      {/* Mark PHI elements with data-phi attribute */}
      <h2 className="text-xl font-semibold mb-4">Patient Information</h2>

      <div className="space-y-2">
        <div className="flex">
          <span className="font-medium w-32">Name:</span>
          <span data-phi="true">
            {patient.firstName} {patient.lastName}
          </span>
        </div>

        <div className="flex">
          <span className="font-medium w-32">Date of Birth:</span>
          <span data-phi="true">{patient.dob || '[Protected]'}</span>
        </div>

        <div className="flex">
          <span className="font-medium w-32">Patient ID:</span>
          <span>{patient.id}</span>
        </div>

        {patient.conditions && patient.conditions.length > 0 && (
          <div>
            <span className="font-medium">Active Conditions:</span>
            <ul className="ml-32 mt-1" data-phi="true">
              {patient.conditions.map((condition: any, index: number) => (
                <li key={index} className="text-sm text-gray-600">
                  • {condition.name || condition}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 p-2 bg-blue-50 rounded text-xs text-blue-600">
        🔒 This data is encrypted and will be automatically cleared on logout
      </div>
    </div>
  );
}
