/**
 * Patient Risk Card Component
 * Visual card showing patient risk level and key metrics
 * Used in Provider PCM Dashboard
 * Created: 2025-01-18
 */

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  Activity,
  TrendingUp,
  TrendingDown,
  ChevronRight
} from 'lucide-react';

export interface PCMPatient {
  id: string;
  name: string;
  age: number;
  lastContact: string;
  nextContactDue: string;
  riskLevel: 'high' | 'medium' | 'low';

  // Vital metrics
  currentA1C?: number;
  targetA1C?: number;
  currentBP?: string;
  targetBP?: string;
  currentWeight?: number;
  targetWeight?: number;

  // Compliance
  medicationAdherence: number; // percentage
  missedAppointments: number;

  // Contact info
  phone: string;
  email?: string;

  // PCM specific
  monthlyMinutesLogged: number; // out of 30
  lastCallNotes?: string;
}

interface PatientRiskCardProps {
  patient: PCMPatient;
  onClick: (patient: PCMPatient) => void;
  onQuickCall?: (patient: PCMPatient) => void;
  onQuickMessage?: (patient: PCMPatient) => void;
}

export default function PatientRiskCard({ patient, onClick, onQuickCall, onQuickMessage }: PatientRiskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'red';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getRiskBg = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-50 border-red-300';
      case 'medium': return 'bg-yellow-50 border-yellow-300';
      case 'low': return 'bg-green-50 border-green-300';
      default: return 'bg-gray-50 border-gray-300';
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-600 text-white';
      case 'medium': return 'bg-yellow-600 text-white';
      case 'low': return 'bg-green-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'high': return <AlertCircle className="w-5 h-5" />;
      case 'medium': return <Clock className="w-5 h-5" />;
      case 'low': return <CheckCircle className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const isContactOverdue = () => {
    const dueDate = new Date(patient.nextContactDue);
    return dueDate < new Date();
  };

  const getA1CTrend = () => {
    if (!patient.currentA1C || !patient.targetA1C) return null;
    if (patient.currentA1C <= patient.targetA1C) return 'improving';
    if (patient.currentA1C > patient.targetA1C + 1) return 'concerning';
    return 'stable';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const color = getRiskColor(patient.riskLevel);

  return (
    <div
      className={`border-2 rounded-xl transition-all hover:shadow-lg ${getRiskBg(patient.riskLevel)} cursor-pointer`}
      onClick={() => onClick(patient)}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1">
            {/* Risk Indicator */}
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getRiskBadge(patient.riskLevel)}`}>
              {getRiskIcon(patient.riskLevel)}
            </div>

            {/* Patient Info */}
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-lg">{patient.name}</h3>
              <p className="text-sm text-gray-600">{patient.age} years old</p>

              {/* Contact Status */}
              <div className="flex items-center gap-2 mt-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className={`text-xs font-medium ${isContactOverdue() ? 'text-red-600' : 'text-gray-600'}`}>
                  {isContactOverdue() ? 'OVERDUE: ' : ''}Contact due {formatDate(patient.nextContactDue)}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              {onQuickCall && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickCall(patient);
                  }}
                  className="p-2 hover:bg-blue-100 rounded-lg transition"
                  title="Quick Call"
                >
                  <Phone className="w-5 h-5 text-blue-600" />
                </button>
              )}
              {onQuickMessage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickMessage(patient);
                  }}
                  className="p-2 hover:bg-green-100 rounded-lg transition"
                  title="Send Message"
                >
                  <Mail className="w-5 h-5 text-green-600" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {/* A1C */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 font-medium">A1C</span>
              {getA1CTrend() === 'improving' && <TrendingDown className="w-4 h-4 text-green-600" />}
              {getA1CTrend() === 'concerning' && <TrendingUp className="w-4 h-4 text-red-600" />}
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${
                patient.currentA1C && patient.targetA1C && patient.currentA1C <= patient.targetA1C
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {patient.currentA1C || '--'}
              </span>
              <span className="text-xs text-gray-500">/ {patient.targetA1C || '--'}%</span>
            </div>
          </div>

          {/* Medication Adherence */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <span className="text-xs text-gray-600 font-medium">Med Adherence</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-bold ${
                patient.medicationAdherence >= 80 ? 'text-green-600' :
                patient.medicationAdherence >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {patient.medicationAdherence}
              </span>
              <span className="text-xs text-gray-500">%</span>
            </div>
          </div>

          {/* PCM Time */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <span className="text-xs text-gray-600 font-medium">PCM Time</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-bold ${
                patient.monthlyMinutesLogged >= 30 ? 'text-green-600' :
                patient.monthlyMinutesLogged >= 20 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {patient.monthlyMinutesLogged}
              </span>
              <span className="text-xs text-gray-500">/ 30 min</span>
            </div>
          </div>
        </div>

        {/* Last Contact Notes (if available) */}
        {patient.lastCallNotes && (
          <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-semibold text-gray-700">Last Contact ({formatDate(patient.lastContact)})</span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{patient.lastCallNotes}</p>
          </div>
        )}

        {/* View Details Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick(patient);
          }}
          className="w-full mt-3 py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-white rounded-lg transition flex items-center justify-center gap-2"
        >
          View Full Details
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
