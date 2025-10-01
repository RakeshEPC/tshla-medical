'use client';
export default function ExportButtons({ json }: { json: any }) {
  function downloadJSON() {
    const blob = new Blob([JSON.stringify(json ?? {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'visit_export.json',
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="flex gap-2">
      <button
        onClick={downloadJSON}
        className="rounded-lg border border-white/25 px-3 py-2 text-white/90"
      >
        Download JSON
      </button>
      <button disabled className="rounded-lg border border-white/25 px-3 py-2 text-white/50">
        PDF (soon)
      </button>
      <button disabled className="rounded-lg border border-white/25 px-3 py-2 text-white/50">
        CSV (soon)
      </button>
    </div>
  );
}
