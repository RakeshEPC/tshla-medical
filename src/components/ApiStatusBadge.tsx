'use client';
import { useApiHealth } from '@/lib/useApiHealth';

export default function ApiStatusBadge() {
  const ok = useApiHealth();
  let label = 'Checking API…',
    color = '#6b7280';
  if (ok === true) {
    label = 'API: OK';
    color = '#059669';
  }
  if (ok === false) {
    label = 'API: Unreachable';
    color = '#dc2626';
  }
  return (
    <span
      className="text-xs font-medium px-3 py-1 rounded-full"
      style={{ background: '#F3F4F6', color }}
    >
      {label}
    </span>
  );
}
