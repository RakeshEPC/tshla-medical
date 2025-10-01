'use client';
type Segment = {
  speaker?: string;
  text: string;
  start?: number;
  end?: number;
  confidence?: number;
};
export default function TranscriptView({ segments }: { segments: Segment[] }) {
  if (!segments?.length)
    return (
      <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-white/70">
        No transcript yet.
      </div>
    );
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="mb-2 text-sm text-orange-200">Transcript</div>
      <ul className="space-y-2">
        {segments.map((s, i) => (
          <li key={i} className="rounded-lg bg-white/5 p-2">
            <div className="text-xs text-white/60">
              {s.speaker ?? 'Speaker'}
              {s.start !== undefined ? ` • ${s.start?.toFixed?.(1)}s` : ''}
              {s.confidence !== undefined
                ? ` • conf ${Math.round((s.confidence || 0) * 100)}%`
                : ''}
            </div>
            <div className="text-white/90">{s.text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
