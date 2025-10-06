'use client';
import { useMemo, useState, useEffect } from 'react';
import { request } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { pumpContext7Service } from '../services/pumpDriveContext7.service';
import { useAuth } from '../contexts/AuthContext';
import { WelcomeBack } from './WelcomeBack';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { PumpFeedback } from './PumpFeedback';
import { ConflictResolver } from './ConflictResolver';
import { useAutoSave } from '../hooks/useAutoSave';
import { detectConflicts } from '../utils/pumpConflicts.config';
import type { WelcomeBackData, ConflictDetection } from '../types/context7.types';

type Responses = Record<string, number>;
const ITEMS = [
  {
    key: 'Control Preference',
    question:
      'How much control do you want over insulin dosing versus letting the system automate?',
    left: 'Full manual control',
    right: 'Fully automated',
  },
  {
    key: 'Target Adjustability',
    question: 'How important is the ability to customize glucose targets/algorithms?',
    left: 'Default target is fine',
    right: 'Need precise adjustability',
  },
  {
    key: 'App Control',
    question: 'How important is controlling the pump entirely from a phone app?',
    left: 'Not important',
    right: 'Critical',
  },
  {
    key: 'Carb Counting',
    question: 'How comfortable are you with counting and entering carbs for meals?',
    left: 'Prefer minimal counting',
    right: 'Accurate entries OK',
  },
  {
    key: 'Automation Trust',
    question: 'How much do you trust the algorithm to adjust insulin automatically?',
    left: 'Cautious',
    right: 'High trust',
  },
  {
    key: 'Tubing Preference',
    question: 'What’s your preference regarding tubing?',
    left: 'Prefer tubeless',
    right: 'Tubed is fine',
  },
  {
    key: 'Exercise Mode',
    question: 'How important are dedicated exercise/activity modes?',
    left: 'Not important',
    right: 'Very important',
  },
  {
    key: 'Visibility',
    question: 'How discreet should the device be?',
    left: 'Must be discreet',
    right: 'Visibility not an issue',
  },
  {
    key: 'Clinic Support',
    question: 'How important is strong local clinic/trainer support?',
    left: 'Not needed',
    right: 'Very important',
  },
];
const PRIORITY_OPTIONS = ITEMS.map(i => i.key);

export default function PumpDriveWizard() {
  const { user } = useAuth();
  const [responses, setResponses] = useState<Responses>(
    () => Object.fromEntries(ITEMS.map(i => [i.key, 5])) as Responses
  );
  const [priorities, setPriorities] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [welcomeBackData, setWelcomeBackData] = useState<WelcomeBackData | null>(null);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [conflicts, setConflicts] = useState<ConflictDetection | null>(null);
  const [showConflictResolver, setShowConflictResolver] = useState(false);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, string>>({});

  // Check for existing session on mount
  useEffect(() => {
    if (user?.id) {
      const data = pumpContext7Service.getWelcomeBackData(user.id);
      if (data.sessionFound && data.session) {
        setWelcomeBackData(data);
        setShowWelcomeBack(true);
      }
    }
  }, [user?.id]);

  // Auto-save hook
  const autoSaveState = useAutoSave({
    userId: user?.id,
    responses,
    priorities,
    selectedFeatures: [],
    freeText: '',
    totalQuestions: ITEMS.length,
    interval: 30000, // 30 seconds
    enabled: !showWelcomeBack, // Only auto-save when not showing welcome screen
  });

  const canSubmit = useMemo(() => priorities.length > 0, [priorities]);
  const setValue = (k: string, v: number) => {
    setResponses(p => {
      const newResponses = { ...p, [k]: v };
      // Check for conflicts after each change
      const detected = detectConflicts(newResponses, []);
      if (detected.hasConflict) {
        setConflicts(detected);
      }
      return newResponses;
    });
  };
  const togglePriority = (k: string) =>
    setPriorities(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));

  const handleConflictResolve = (conflictName: string, resolution: string) => {
    setConflictResolutions(prev => ({ ...prev, [conflictName]: resolution }));
  };

  const handleConflictDismiss = () => {
    setShowConflictResolver(false);
  };

  // Resume previous session
  const handleResume = () => {
    if (welcomeBackData?.session) {
      const session = welcomeBackData.session;
      setResponses(session.responses);
      setPriorities(session.priorities);
      setShowWelcomeBack(false);
    }
  };

  // Start over (delete old session)
  const handleStartOver = () => {
    if (user?.id) {
      pumpContext7Service.deleteSession(user.id);
      setShowWelcomeBack(false);
      setWelcomeBackData(null);
    }
  };

  async function onSubmit() {
    if (!canSubmit) return;

    // Check for conflicts before submitting
    const detected = detectConflicts(responses, []);
    if (detected.hasConflict && detected.conflicts.some(c => c.rule.severity === 'high')) {
      setConflicts(detected);
      setShowConflictResolver(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      // Save session before submitting
      if (user?.id) {
        const completedQuestions = Object.keys(responses);
        const { sessionId: savedSessionId } = pumpContext7Service.saveSession(
          user.id,
          responses,
          priorities,
          [],
          '',
          completedQuestions,
          ITEMS.length
        );
        setSessionId(savedSessionId);
      }

      const payload = { responses, priorities };
      const res = await request<any>(endpoints.recommendPump, { method: 'POST', json: payload });
      setResult(res);

      // Show feedback form after successful recommendation
      setShowFeedback(true);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Welcome Back Card */}
      {showWelcomeBack && welcomeBackData && (
        <WelcomeBack
          data={welcomeBackData}
          onResume={handleResume}
          onStartOver={handleStartOver}
        />
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Questions</h2>
          <AutoSaveIndicator saveState={autoSaveState} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ITEMS.map(item => (
            <div key={item.key} className="p-5 rounded-2xl border bg-white shadow-sm">
              <div className="mb-2">
                <div className="text-sm font-semibold">{item.key}</div>
                <p className="text-sm text-gray-700">{item.question}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>{item.left}</span>
                <span>{responses[item.key]}</span>
                <span>{item.right}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={responses[item.key]}
                onChange={e => setValue(item.key, Number(e.target.value))}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Pick your priorities</h2>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_OPTIONS.map(opt => {
            const on = priorities.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => togglePriority(opt)}
                className={`px-3 py-1 rounded-full border ${on ? 'bg-blue-100 border-blue-400' : 'bg-white'}`}
                aria-pressed={on}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={onSubmit}
          disabled={submitting || !canSubmit}
          className="px-5 py-2 rounded-lg text-white font-medium disabled:opacity-50"
          style={{ background: '#0a66ff' }}
        >
          {submitting ? 'Scoring…' : 'Get Top Matches'}
        </button>
        {!canSubmit && <span className="text-sm text-gray-600">Pick at least one priority.</span>}
        {error && <span className="text-sm text-red-600">Error: {error}</span>}
      </div>

      {result && (
        <div className="mt-4 p-4 border rounded-lg bg-gray-50">
          <h4 className="font-semibold mb-2">Result</h4>
          <pre className="text-sm overflow-auto max-h-96">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {/* Feedback Form */}
      {showFeedback && result && user?.id && (
        <PumpFeedback
          sessionId={sessionId}
          userId={user.id}
          recommendedPump={result.recommendation || result.topPumps?.[0]?.pumpName || 'Unknown'}
          onComplete={() => setShowFeedback(false)}
        />
      )}

      {/* Conflict Resolver Modal */}
      {showConflictResolver && conflicts && (
        <ConflictResolver
          conflicts={conflicts}
          onResolve={handleConflictResolve}
          onDismiss={handleConflictDismiss}
        />
      )}

      {/* Conflict Indicator (if conflicts exist but not showing modal) */}
      {conflicts && conflicts.hasConflict && !showConflictResolver && (
        <button
          onClick={() => setShowConflictResolver(true)}
          className="mt-4 px-4 py-2 rounded-lg bg-yellow-100 text-yellow-800 border border-yellow-300 hover:bg-yellow-200 transition-colors text-sm font-medium"
        >
          ⚠️ {conflicts.conflicts.length} potential conflict{conflicts.conflicts.length > 1 ? 's' : ''} detected - Click to review
        </button>
      )}
    </div>
  );
}
