'use client';

import { useState } from 'react';
import { request } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';

export default function ApiRoundTripTest() {
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runTest() {
    setLoading(true);
    setOut(null);
    setErr(null);
    try {
      const sample = {
        age: 40,
        a1c: '7.1',
        diabetes_type: 'T2D',
        tech_comfort: 'intermediate',
        cgm_use: 'yes',
        insurance: 'BCBS PPO',
        used_pump: 'no',
        pump_feedback: 'n/a',
        preferences: 'discreet',
        ok_with_changes: ['brand', 'tubing'],
        manager: 'Dr Smith',
      };
      const res = await request<any>(endpoints.recommend, { method: 'POST', json: sample });
      setOut(JSON.stringify(res, null, 2));
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded-xl bg-white/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">API Round-trip Test</h3>
        <button
          onClick={runTest}
          disabled={loading}
          className="px-4 py-2 rounded-md text-white font-medium disabled:opacity-50"
          style={{ background: 'var(--brand-blue, #0a66ff)' }}
        >
          {loading ? 'Testing…' : 'Send sample request'}
        </button>
      </div>
      {out && <pre className="text-sm overflow-auto bg-gray-50 p-3 rounded-lg max-h-72">{out}</pre>}
      {err && <p className="text-sm text-red-600">Error: {err}</p>}
      {!out && !err && !loading && (
        <p className="text-sm text-gray-600">
          Posts to <code>{endpoints.recommend}</code> using <code>NEXT_PUBLIC_API_BASE</code>.
        </p>
      )}
    </div>
  );
}
