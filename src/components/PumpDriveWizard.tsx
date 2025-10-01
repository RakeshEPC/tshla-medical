'use client';
import { useMemo, useState } from 'react';
import { request } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';

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
  const [responses, setResponses] = useState<Responses>(
    () => Object.fromEntries(ITEMS.map(i => [i.key, 5])) as Responses
  );
  const [priorities, setPriorities] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const canSubmit = useMemo(() => priorities.length > 0, [priorities]);
  const setValue = (k: string, v: number) => setResponses(p => ({ ...p, [k]: v }));
  const togglePriority = (k: string) =>
    setPriorities(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const payload = { responses, priorities };
      const res = await request<any>(endpoints.recommendPump, { method: 'POST', json: payload });
      setResult(res);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Questions</h2>
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
    </div>
  );
}
