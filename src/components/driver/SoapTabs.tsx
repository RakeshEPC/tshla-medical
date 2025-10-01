'use client';
import { useState } from 'react';
export default function SoapTabs({ soap, summary }: { soap?: any; summary?: any }) {
  const [tab, setTab] = useState<'soap' | 'summary'>('soap');
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5">
      <div className="flex gap-2 border-b border-white/10 p-2">
        <button
          onClick={() => setTab('soap')}
          className={`rounded px-3 py-1 text-sm ${tab === 'soap' ? 'bg-orange-500 text-[#0a3d62] font-semibold' : 'text-white/90 border border-white/20'}`}
        >
          SOAP
        </button>
        <button
          onClick={() => setTab('summary')}
          className={`rounded px-3 py-1 text-sm ${tab === 'summary' ? 'bg-orange-500 text-[#0a3d62] font-semibold' : 'text-white/90 border border-white/20'}`}
        >
          Patient Summary
        </button>
      </div>
      <div className="p-4 text-white/90 text-sm">
        {tab === 'soap' ? (
          <pre className="whitespace-pre-wrap text-white/90">
            {JSON.stringify(soap ?? { note: 'No SOAP yet.' }, null, 2)}
          </pre>
        ) : (
          <pre className="whitespace-pre-wrap text-white/90">
            {JSON.stringify(summary ?? { summary: 'No summary yet.' }, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
