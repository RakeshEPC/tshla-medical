import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PUMP_DATABASE as INSULIN_PUMPS_COMPLETE } from '../data/pumpDataSimple';

// Define PUMP_DIMENSIONS locally for now
const PUMP_DIMENSIONS = [
  { id: 'battery', label: 'Battery Life & Power', icon: '🔋' },
  { id: 'phoneControl', label: 'Phone Control & App', icon: '📱' },
  { id: 'tubingStyle', label: 'Tubing & Wear Style', icon: '💉' },
  { id: 'algorithm', label: 'Automation Algorithm', icon: '🤖' },
  { id: 'cgmCompatibility', label: 'CGM Compatibility', icon: '📊' },
  { id: 'targetAdjustability', label: 'Target Adjustability', icon: '🎯' },
  { id: 'exerciseMode', label: 'Exercise Modes', icon: '🏃' },
  { id: 'bolusWorkflow', label: 'Manual Bolus Workflow', icon: '🍽️' },
  { id: 'reservoirCapacity', label: 'Reservoir/Pod Capacity', icon: '💧' },
  { id: 'adhesiveTolerance', label: 'Adhesive & Site Tolerance', icon: '🩹' },
  { id: 'waterResistance', label: 'Water Resistance', icon: '💦' },
  { id: 'alertsCustomization', label: 'Alerts & Alarms', icon: '🔔' },
  { id: 'userInterface', label: 'User Interface & Screen', icon: '🖥️' },
  { id: 'dataSharing', label: 'Data Sharing & Reports', icon: '📈' },
  { id: 'clinicSupport', label: 'Clinic Support & Training', icon: '🏥' },
  { id: 'travelLogistics', label: 'Travel & Airport', icon: '✈️' },
  { id: 'caregiverFeatures', label: 'Pediatric & Caregiver', icon: '👨‍👩‍👧' },
  { id: 'wearability', label: 'Visual Discretion', icon: '👔' },
  { id: 'ecosystem', label: 'Ecosystem & Accessories', icon: '⌚' },
  { id: 'occlusionHandling', label: 'Reliability & Occlusion', icon: '⚠️' },
  { id: 'costInsurance', label: 'Cost & Insurance', icon: '💰' },
  { id: 'updates', label: 'Support & Updates', icon: '🔄' },
];

export default function PumpComparison() {
  const navigate = useNavigate();
  const [selectedPumps, setSelectedPumps] = useState<string[]>([]);
  const [selectedDimension, setSelectedDimension] = useState<string>('all');
  const [comparisonMode, setComparisonMode] = useState<'table' | 'cards'>('table');
  const [searchTerm, setSearchTerm] = useState('');

  // Toggle pump selection
  const togglePump = (pumpId: string) => {
    setSelectedPumps(prev => {
      if (prev.includes(pumpId)) {
        return prev.filter(id => id !== pumpId);
      }
      if (prev.length < 4) {
        return [...prev, pumpId];
      }
      return prev;
    });
  };

  // Filter pumps for comparison
  const pumpsToShow = useMemo(() => {
    if (selectedPumps.length > 0) {
      return INSULIN_PUMPS_COMPLETE.filter(pump => selectedPumps.includes(pump.id));
    }
    return INSULIN_PUMPS_COMPLETE;
  }, [selectedPumps]);

  // Highlight differences between pumps
  const isDifferent = (dimension: string, field: string): boolean => {
    if (selectedPumps.length < 2) return false;
    const values = pumpsToShow.map(
      pump => pump.dimensions[dimension as keyof typeof pump.dimensions][field]
    );
    return new Set(values).size > 1;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/pumpdrive')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-xl font-bold text-slate-800">Insulin Pump Comparison Tool</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setComparisonMode('table')}
                className={`px-3 py-1.5 rounded-lg ${
                  comparisonMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                📊 Table View
              </button>
              <button
                onClick={() => setComparisonMode('cards')}
                className={`px-3 py-1.5 rounded-lg ${
                  comparisonMode === 'cards'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                🎴 Card View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selection Bar */}
      <div className="bg-blue-50 border-b border-blue-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900">
                Select pumps to compare (max 4):
              </span>
              <div className="flex space-x-2">
                {INSULIN_PUMPS_COMPLETE.map(pump => (
                  <button
                    key={pump.id}
                    onClick={() => togglePump(pump.id)}
                    disabled={!selectedPumps.includes(pump.id) && selectedPumps.length >= 4}
                    className={`px-3 py-1 rounded-lg text-sm transition ${
                      selectedPumps.includes(pump.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {pump.name}
                  </button>
                ))}
              </div>
            </div>
            {selectedPumps.length > 0 && (
              <button
                onClick={() => setSelectedPumps([])}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dimension Filter */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Filter by dimension:</span>
          <select
            value={selectedDimension}
            onChange={e => setSelectedDimension(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Dimensions</option>
            {PUMP_DIMENSIONS.map(dim => (
              <option key={dim.id} value={dim.id}>
                {dim.icon} {dim.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {comparisonMode === 'table' ? (
          // Table View
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 font-medium text-gray-700 sticky left-0 bg-gray-50 z-10">
                      Feature
                    </th>
                    {pumpsToShow.map(pump => (
                      <th
                        key={pump.id}
                        className="text-left px-4 py-3 font-medium text-gray-900 min-w-[200px]"
                      >
                        <div>
                          <div className="font-bold">{pump.name}</div>
                          <div className="text-xs text-gray-500 font-normal">
                            {pump.manufacturer}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(selectedDimension === 'all'
                    ? PUMP_DIMENSIONS
                    : PUMP_DIMENSIONS.filter(d => d.id === selectedDimension)
                  ).map(dimension => (
                    <React.Fragment key={dimension.id}>
                      <tr className="bg-blue-50">
                        <td
                          colSpan={pumpsToShow.length + 1}
                          className="px-4 py-2 font-semibold text-blue-900"
                        >
                          {dimension.icon} {dimension.label}
                        </td>
                      </tr>

                      {/* #1 Battery/Power */}
                      {dimension.id === 'battery' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Battery Type
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('battery', 'battery') ? 'bg-yellow-50' : ''
                                }`}
                              >
                                <span className="font-medium">{pump.dimensions.battery}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.batteryDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* Phone Control */}
                      {dimension.id === 'phoneControl' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Phone Control
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('phoneControl', 'phoneControl') ? 'bg-yellow-50' : ''
                                }`}
                              >
                                <span className="font-medium">{pump.dimensions.phoneControl}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.phoneControlDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* Tubing Style */}
                      {dimension.id === 'tubingStyle' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Tubing Style
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('tubingStyle', 'tubingStyle') ? 'bg-yellow-50' : ''
                                }`}
                              >
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    pump.dimensions.tubingStyle === 'Tubeless pod'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {pump.dimensions.tubingStyle}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.tubingDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* Algorithm */}
                      {dimension.id === 'algorithm' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Algorithm
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('algorithm', 'algorithm') ? 'bg-yellow-50' : ''
                                }`}
                              >
                                <span className="font-medium">{pump.dimensions.algorithm}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.algorithmDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* CGM Compatibility */}
                      {dimension.id === 'cgmCompatibility' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              CGM Support
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('cgmCompatibility', 'cgmCompatibility')
                                    ? 'bg-yellow-50'
                                    : ''
                                }`}
                              >
                                <span className="font-medium">
                                  {pump.dimensions.cgmCompatibility}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.cgmDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* Target Adjustability */}
                      {dimension.id === 'targetAdjustability' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Target Options
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('targetAdjustability', 'targetAdjustability')
                                    ? 'bg-yellow-50'
                                    : ''
                                }`}
                              >
                                <span className="font-medium">
                                  {pump.dimensions.targetAdjustability}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.targetDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* Exercise Mode */}
                      {dimension.id === 'exerciseMode' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Exercise Mode
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('exerciseMode', 'exerciseMode') ? 'bg-yellow-50' : ''
                                }`}
                              >
                                <span className="font-medium">{pump.dimensions.exerciseMode}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.exerciseDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* Bolus Workflow */}
                      {dimension.id === 'bolusWorkflow' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Bolus Method
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('bolusWorkflow', 'bolusWorkflow')
                                    ? 'bg-yellow-50'
                                    : ''
                                }`}
                              >
                                <span className="font-medium">{pump.dimensions.bolusWorkflow}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.bolusDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* Reservoir Capacity */}
                      {dimension.id === 'reservoirCapacity' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Capacity
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('reservoirCapacity', 'reservoirCapacity')
                                    ? 'bg-yellow-50'
                                    : ''
                                }`}
                              >
                                <span className="font-medium">
                                  {pump.dimensions.reservoirCapacity}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.reservoirDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* Water Resistance */}
                      {dimension.id === 'waterResistance' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Water Rating
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('waterResistance', 'waterResistance')
                                    ? 'bg-yellow-50'
                                    : ''
                                }`}
                              >
                                <span className="font-medium">
                                  {pump.dimensions.waterResistance}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.waterDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* Cost & Insurance */}
                      {dimension.id === 'costInsurance' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Coverage
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('costInsurance', 'costInsurance')
                                    ? 'bg-yellow-50'
                                    : ''
                                }`}
                              >
                                <span className="font-medium">{pump.dimensions.costInsurance}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.costDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #10 Adhesive & Site Tolerance */}
                      {dimension.id === 'adhesiveTolerance' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Adhesive Type
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm">
                                <span className="font-medium">
                                  {pump.dimensions.adhesiveTolerance || 'Set + separate CGM'}
                                </span>
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #11 is Water Resistance - already included */}

                      {/* #12 Alerts & Alarms */}
                      {dimension.id === 'alertsCustomization' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Alerts & Alarms
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('alertsCustomization', 'alertsCustomization')
                                    ? 'bg-yellow-50'
                                    : ''
                                }`}
                              >
                                <span className="font-medium">
                                  {pump.dimensions.alertsCustomization}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.alertsDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #13 User Interface & Screen */}
                      {dimension.id === 'userInterface' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Interface Type
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('userInterface', 'userInterface')
                                    ? 'bg-yellow-50'
                                    : ''
                                }`}
                              >
                                <span className="font-medium">{pump.dimensions.userInterface}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.uiDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #14 Data Sharing & Reports */}
                      {dimension.id === 'dataSharing' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Data Platform
                            </td>
                            {pumpsToShow.map(pump => (
                              <td
                                key={pump.id}
                                className={`px-4 py-3 text-sm ${
                                  isDifferent('dataSharing', 'dataSharing') ? 'bg-yellow-50' : ''
                                }`}
                              >
                                <span className="font-medium">{pump.dimensions.dataSharing}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.dataSharingDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #15 Clinic Support & Training */}
                      {dimension.id === 'clinicSupport' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Support Level
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm">
                                <span className="font-medium">{pump.dimensions.clinicSupport}</span>
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #16 Travel & Airport Logistics */}
                      {dimension.id === 'travelLogistics' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Travel Requirements
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm">
                                <span className="font-medium">
                                  {pump.dimensions.travelLogistics}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.travelDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #17 Pediatric & Caregiver Features */}
                      {dimension.id === 'caregiverFeatures' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Caregiver Features
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm">
                                <span className="font-medium">
                                  {pump.dimensions.caregiverFeatures}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.caregiverDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #18 Visual Discretion & Wearability */}
                      {dimension.id === 'wearability' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Wearability
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm">
                                <span className="font-medium">{pump.dimensions.wearability}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.wearabilityDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #19 Ecosystem & Accessories */}
                      {dimension.id === 'ecosystem' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Ecosystem
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm">
                                <span className="font-medium">{pump.dimensions.ecosystem}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.ecosystemDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #20 Reliability & Occlusion Handling */}
                      {dimension.id === 'occlusionHandling' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Occlusion Handling
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm">
                                <span className="font-medium">
                                  {pump.dimensions.occlusionHandling}
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.occlusionDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}

                      {/* #21 Cost & Insurance - already included */}

                      {/* #22 On-body visibility (merged with #18) */}

                      {/* #23 Support Apps & Updates */}
                      {dimension.id === 'updates' && (
                        <>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Update Method
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm">
                                <span className="font-medium">{pump.dimensions.updates}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 sticky left-0 bg-white z-10">
                              Details
                            </td>
                            {pumpsToShow.map(pump => (
                              <td key={pump.id} className="px-4 py-3 text-sm text-gray-600">
                                {pump.dimensions.updatesDetails}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Pros Section */}
                  <tr className="bg-green-50">
                    <td className="px-4 py-3 font-semibold text-green-900 sticky left-0 bg-green-50 z-10">
                      ✅ Advantages
                    </td>
                    {pumpsToShow.map(pump => (
                      <td key={pump.id} className="px-4 py-3">
                        <ul className="space-y-1">
                          {pump.pros?.map((pro, idx) => (
                            <li key={idx} className="text-sm text-green-700 flex items-start">
                              <span className="text-green-500 mr-1">•</span>
                              {pro}
                            </li>
                          ))}
                        </ul>
                      </td>
                    ))}
                  </tr>

                  {/* Cons Section */}
                  <tr className="bg-red-50">
                    <td className="px-4 py-3 font-semibold text-red-900 sticky left-0 bg-red-50 z-10">
                      ⚠️ Considerations
                    </td>
                    {pumpsToShow.map(pump => (
                      <td key={pump.id} className="px-4 py-3">
                        <ul className="space-y-1">
                          {pump.cons?.map((con, idx) => (
                            <li key={idx} className="text-sm text-red-700 flex items-start">
                              <span className="text-red-500 mr-1">•</span>
                              {con}
                            </li>
                          ))}
                        </ul>
                      </td>
                    ))}
                  </tr>

                  {/* Ideal For Section */}
                  <tr className="bg-purple-50">
                    <td className="px-4 py-3 font-semibold text-purple-900 sticky left-0 bg-purple-50 z-10">
                      🎯 Ideal For
                    </td>
                    {pumpsToShow.map(pump => (
                      <td key={pump.id} className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {pump.idealFor?.map((ideal, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                            >
                              {ideal}
                            </span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // Card View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pumpsToShow.map(pump => (
              <div key={pump.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
                  <h3 className="text-xl font-bold text-white">{pump.name}</h3>
                  <p className="text-blue-100">{pump.manufacturer}</p>
                </div>

                <div className="p-4 space-y-4">
                  {/* Key Features */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Key Features</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Battery:</span>
                        <span className="font-medium">{pump.dimensions.battery}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Tubing:</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            pump.dimensions.tubingStyle === 'Tubeless pod'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {pump.dimensions.tubingStyle}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Phone Control:</span>
                        <span className="font-medium">{pump.dimensions.phoneControl}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Algorithm:</span>
                        <span className="font-medium truncate ml-2">
                          {pump.dimensions.algorithm}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Capacity:</span>
                        <span className="font-medium">{pump.dimensions.reservoirCapacity}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Water:</span>
                        <span className="font-medium">{pump.dimensions.waterResistance}</span>
                      </div>
                    </div>
                  </div>

                  {/* CGM Compatibility */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">CGM Support</h4>
                    <p className="text-sm text-gray-600">{pump.dimensions.cgmCompatibility}</p>
                  </div>

                  {/* Pros */}
                  {pump.pros && pump.pros.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-green-700 mb-2">✅ Advantages</h4>
                      <ul className="space-y-1">
                        {pump.pros.slice(0, 3).map((pro, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start">
                            <span className="text-green-500 mr-1">•</span>
                            {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Cons */}
                  {pump.cons && pump.cons.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-red-700 mb-2">⚠️ Considerations</h4>
                      <ul className="space-y-1">
                        {pump.cons.slice(0, 3).map((con, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start">
                            <span className="text-red-500 mr-1">•</span>
                            {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Ideal For */}
                  {pump.idealFor && pump.idealFor.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-purple-700 mb-2">🎯 Ideal For</h4>
                      <div className="flex flex-wrap gap-1">
                        {pump.idealFor.map((ideal, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                          >
                            {ideal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="p-4 bg-gray-50 border-t flex space-x-2">
                  <button
                    onClick={() => navigate(`/pumpdrive/details/${pump.id}`)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => navigate(`/pumpdrive/test-drive/${pump.id}`)}
                    className="flex-1 px-3 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 text-sm"
                  >
                    Test Drive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Comparison Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {
                  INSULIN_PUMPS_COMPLETE.filter(p => p.dimensions.tubingStyle === 'Tubeless pod')
                    .length
                }
              </div>
              <div className="text-sm text-gray-600">Tubeless Options</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {
                  INSULIN_PUMPS_COMPLETE.filter(
                    p =>
                      p.dimensions.phoneControl.includes('Phone') ||
                      p.dimensions.phoneControl.includes('phone')
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600">Phone Control</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {
                  INSULIN_PUMPS_COMPLETE.filter(
                    p =>
                      p.dimensions.waterResistance.includes('submersible') ||
                      p.dimensions.waterResistance.includes('Submersible')
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600">Waterproof</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {
                  INSULIN_PUMPS_COMPLETE.filter(p =>
                    p.dimensions.cgmCompatibility.includes('Dexcom')
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600">Dexcom Compatible</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
