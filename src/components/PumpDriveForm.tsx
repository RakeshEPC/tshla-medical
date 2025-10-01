'use client';

import { useMemo, useState } from 'react';
import questions, { DIM_LABELS, type Dimension } from '@/data/pump_questions_full';
import { endpoints } from '@/lib/endpoints';
import { request } from '@/lib/api';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

type ResultRow = {
  pump: string;
  score: number;
  by_dimension?: Record<string, number>;
};

type ApiResult = {
  top_matches: string[];
  scored_results: ResultRow[];
  explanation?: string;
};

const ALL_DIMS: Dimension[] = [...DIM_LABELS];
const RANK_WEIGHTS = [2.0, 1.8, 1.6, 1.4, 1.2] as const;

// ---------------- Helpers ----------------
function normalize(res: Record<string, number>) {
  const out: Record<string, number> = {};
  ALL_DIMS.forEach(d => (out[d] = Math.max(0, Math.min(10, Number(res[d] ?? 0)))));
  // keep tubing from dominating
  if (out['Tubing Preference'] != null) {
    out['Tubing Preference'] = Math.max(0, Math.min(10, Number(out['Tubing Preference']) * 0.6));
  }
  return out;
}

function coerceResult(raw: any): ApiResult {
  const top_matches = Array.isArray(raw?.top_matches) ? raw.top_matches.map(String) : [];
  const scored_results: ResultRow[] = Array.isArray(raw?.scored_results)
    ? raw.scored_results.map((r: any) => {
        const byDim: Record<string, number> = {};
        if (r?.by_dimension && typeof r.by_dimension === 'object') {
          for (const [k, v] of Object.entries(r.by_dimension)) byDim[String(k)] = Number(v);
        }
        return {
          pump: String(r?.pump ?? 'Unknown'),
          score: Number(r?.score ?? 0),
          by_dimension: byDim,
        };
      })
    : [];
  return {
    top_matches,
    scored_results,
    explanation: typeof raw?.explanation === 'string' ? raw.explanation : undefined,
  };
}

function pickTop<T>(arr: T[], n: number) {
  return arr.slice(0, Math.max(0, n));
}
function sentenceJoin(parts: string[]) {
  return parts.filter(Boolean).join(' ');
}

function buildNarrativesFromScored(scored: ResultRow[], ranked: Dimension[]) {
  const ordered = scored.slice().sort((a, b) => Number(b.score) - Number(a.score));
  const winner = ordered[0];
  const others = ordered.slice(1);

  let winnerText = '';
  if (winner) {
    const priorities = pickTop(ranked, 5);
    const byDim = winner.by_dimension || {};
    const strengths = priorities
      .map(p => ({ dim: p, val: Number(byDim[p] ?? 0) }))
      .sort((a, b) => b.val - a.val);

    const lead = `Based on your priorities${priorities.length ? `—${priorities.join(', ')}—` : ''}, ${winner.pump} stands out as the best fit.`;
    const strengthsLine =
      strengths.length > 0
        ? `It aligns especially well with ${strengths
            .slice(0, 3)
            .map(s => s.dim)
            .join(
              ', '
            )}${strengths.length > 3 ? ' and more' : ''}, keeping trade-offs low where it matters most to you.`
        : `It delivers a strong overall balance across the areas you care about, minimizing trade-offs.`;
    const lifestyle = `In day-to-day use, that means smoother routines, fewer workarounds, and support that adapts to your schedule.`;
    const enticing = `With this combination, ${winner.pump} isn’t just a match—it’s positioned to make your daily management easier, more predictable, and closer to the outcomes you want.`;

    winnerText = sentenceJoin([lead, strengthsLine, lifestyle, enticing]);
  }

  const whyNot = others.map(r => {
    const rd = r.by_dimension || {};
    const priorities = pickTop(ranked, 5);
    const align = priorities
      .map(p => ({ dim: p, val: Number(rd[p] ?? 0) }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 1)
      .map(x => x.dim);
    const weak = priorities
      .map(p => ({ dim: p, val: Number(rd[p] ?? 0) }))
      .sort((a, b) => a.val - b.val)
      .slice(0, 2)
      .map(x => x.dim);

    const first = align.length
      ? `${r.pump} aligns with you on ${align.join(', ')}`
      : `${r.pump} has a solid profile`;
    const second = weak.length
      ? ` but ranks lower given relatively less alignment on ${weak.join(' and ')}.`
      : ` but ranks lower overall when weighed against your top priorities.`;
    return `${first}${second}`;
  });

  return { winnerText, whyNot, rankedNames: ordered.map(o => o.pump) };
}

function buildNarrativesFlexible(result: ApiResult, ranked: Dimension[]) {
  if (result.scored_results?.length) {
    return buildNarrativesFromScored(result.scored_results, ranked);
  }
  // Fallback when we only have top_matches
  const names = result.top_matches || [];
  const winnerName = names[0];
  if (!winnerName) return { winnerText: '', whyNot: [], rankedNames: [] };

  const priorities = pickTop(ranked, 5);
  const lead = `Based on your priorities${priorities.length ? `—${priorities.join(', ')}—` : ''}, ${winnerName} stands out as the best fit.`;
  const strengthsLine = `It aligns closely with how you like to manage day-to-day decisions, offering quick adjustments when you need them and fewer trade-offs across your top choices.`;
  const lifestyle = `In practice, that means smoother routines with less friction and support that adapts to your schedule.`;
  const enticing = `Put simply, ${winnerName} is positioned to make daily management easier, more predictable, and closer to the outcomes you want.`;
  const winnerText = sentenceJoin([lead, strengthsLine, lifestyle, enticing]);

  const whyNot = names.slice(1).map(name => {
    return priorities.length
      ? `${name} covers several of your priorities, but emphasizes ${priorities[0]}${priorities[1] ? ' and ' + priorities[1] : ''} less than your top match, so it ranked lower for your mix.`
      : `${name} is a strong option, but ranked slightly lower overall compared with your top match.`;
  });

  return { winnerText, whyNot, rankedNames: names };
}

// ---------------- Component ----------------
export default function PumpDriveForm() {
  // answers for each question index -> selected option index
  const [answers, setAnswers] = useState<Record<number, number>>({});
  // ranked Top 5 priorities
  const [ranked, setRanked] = useState<Dimension[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // api state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);

  // aggregate disguised Q answers to per-dimension 0..10
  const byDimension = useMemo(() => {
    const totals: Record<string, { sum: number; count: number }> = {};
    ALL_DIMS.forEach(d => (totals[d] = { sum: 0, count: 0 }));
    questions.forEach((q, idx) => {
      const optIndex = answers[idx];
      if (optIndex != null) {
        const opt = q.options[optIndex];
        totals[q.dimension].sum += Number(opt.score);
        totals[q.dimension].count += 1;
      }
    });
    const normalized: Record<string, number> = {};
    ALL_DIMS.forEach(d => {
      const { sum, count } = totals[d];
      normalized[d] = count ? Math.max(0, Math.min(10, sum / count)) : 0;
    });
    return normalized;
  }, [answers]);

  const remainingDims = useMemo(() => ALL_DIMS.filter(d => !ranked.includes(d)), [ranked]);

  const addPriority = (dim: Dimension) =>
    setRanked(prev => (prev.length >= 5 || prev.includes(dim) ? prev : [...prev, dim]));
  const removePriority = (dim: Dimension) => setRanked(prev => prev.filter(d => d !== dim));
  const move = (idx: number, dir: -1 | 1) =>
    setRanked(prev => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const submit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const responses = normalize(byDimension);
      const priorities_ranked = ranked.map((dimension, i) => ({
        dimension,
        rank: i + 1,
        weight: RANK_WEIGHTS[i] ?? 1.0,
      }));

      const payload = { responses, priorities: ranked, priorities_ranked };

      const raw = await request<ApiResult>(endpoints.recommendPump, {
        method: 'POST',
        json: payload,
      });
      const data = coerceResult(raw);

      if ((!data.top_matches || !data.top_matches.length) && data.scored_results?.length) {
        data.top_matches = data.scored_results
          .slice()
          .sort((a, b) => Number(b.score) - Number(a.score))
          .map(r => r.pump);
      }

      setResult(data);
    } catch (e: any) {
      logError('PumpDriveForm', 'Error message', {});
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: any) => {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(1) : '—';
  };

  const narratives = useMemo(() => {
    if (!result) return null;
    return buildNarrativesFlexible(result, ranked);
  }, [result, ranked]);

  return (
    <div className="space-y-8 text-orange-200">
      {/* Ranked Top 5 */}
      <div>
        <h2 className="text-xl font-semibold text-orange-400 mb-3">Rank your Top 5 priorities</h2>
        <div className="rounded-xl border border-white/15 p-4">
          {ranked.length === 0 ? (
            <p className="text-white/80">No priorities selected yet.</p>
          ) : (
            <ol className="space-y-2">
              {ranked.map((d, i) => (
                <li key={d} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-[#0f254f] font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{d}</span>
                    <span className="text-white/70">weight ×{RANK_WEIGHTS[i] ?? 1.0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="px-2 py-1 rounded-md border border-white/20 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(i, +1)}
                      disabled={i === ranked.length - 1}
                      className="px-2 py-1 rounded-md border border-white/20 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removePriority(d)}
                      className="px-2 py-1 rounded-md border border-white/20"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-4">
            <button
              onClick={() => setPickerOpen(true)}
              disabled={ranked.length >= 5}
              className="px-3 py-2 rounded-md bg-orange-500 text-[#0f254f] font-semibold disabled:opacity-60"
            >
              {ranked.length >= 5 ? 'Top 5 selected' : 'Add priorities'}
            </button>
          </div>
        </div>

        {pickerOpen && (
          <div className="mt-3 rounded-xl border border-white/15 p-4">
            <div className="flex flex-wrap gap-2">
              {remainingDims.map(d => (
                <button
                  key={d}
                  onClick={() => addPriority(d)}
                  className="px-3 py-1 rounded-full border border-white/25 hover:border-white/50"
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <button
                onClick={() => setPickerOpen(false)}
                className="px-3 py-1 rounded-md border border-white/25"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Disguised Questionnaire (dimension label hidden) */}
      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div key={idx} className="rounded-lg border border-white/15 p-4">
            {/* Removed the dimension label to avoid bias */}
            <div className="text-lg font-medium text-orange-400 mb-2">{q.question}</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {q.options.map((opt, oi) => {
                const selected = answers[idx] === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => setAnswers(a => ({ ...a, [idx]: oi }))}
                    className={`text-left px-3 py-2 rounded-md border ${
                      selected
                        ? 'border-orange-400 bg-orange-400/20'
                        : 'border-white/15 hover:border-white/35'
                    }`}
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading}
          className="px-5 py-2 rounded-md bg-orange-500 text-[#0f254f] font-semibold disabled:opacity-60"
        >
          {loading ? 'Scoring…' : 'Get Top Matches'}
        </button>
        {error && <span className="text-red-300">{error}</span>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/15 p-4">
            <h3 className="text-lg font-semibold text-orange-400">Top match</h3>
            <p className="mt-2 text-white/90">
              {narratives?.winnerText ??
                (result.top_matches?.[0]
                  ? `Your best overall fit is ${result.top_matches[0]}.`
                  : 'No top match returned.')}
            </p>
          </div>

          {narratives?.whyNot?.length ? (
            <div className="rounded-xl border border-white/15 p-4">
              <h4 className="text-base font-semibold text-orange-400">Why not the others</h4>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                {narratives.whyNot.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {narratives?.rankedNames?.length ? (
            <div className="rounded-xl border border-white/15 p-4">
              <h4 className="text-base font-semibold text-orange-400">Full ranking</h4>
              <ol className="list-decimal pl-6 mt-2 space-y-1">
                {narratives.rankedNames.map(name => (
                  <li key={name}>{name}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {result.scored_results?.length ? (
            <div className="rounded-xl border border-white/15 p-4 overflow-x-auto">
              <h4 className="text-base font-semibold text-orange-400 mb-3">Score table</h4>
              <table className="min-w-[640px] w-full text-sm">
                <thead>
                  <tr className="text-white/70">
                    <th className="text-left py-2 pr-4">Pump</th>
                    <th className="text-left py-2 pr-4">Score</th>
                    {ALL_DIMS.map(d => (
                      <th key={d} className="text-left py-2 pr-4">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.scored_results
                    .slice()
                    .sort((a, b) => Number(b.score) - Number(a.score))
                    .map(row => (
                      <tr key={row.pump} className="border-t border-white/10">
                        <td className="py-2 pr-4">{row.pump}</td>
                        <td className="py-2 pr-4">{fmt(row.score)}</td>
                        {ALL_DIMS.map(d => (
                          <td key={d} className="py-2 pr-4">
                            {fmt(row.by_dimension?.[d])}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
