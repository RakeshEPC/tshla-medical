'use client';
import GlowButton from '@/components/GlowButton';

export default function RoleCard({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="card p-6 flex flex-col items-center text-center gap-4 w-full max-w-sm">
      <div className="text-2xl font-bold">{title}</div>
      <p className="text-white/80 text-sm">{description}</p>
      <GlowButton onClick={onClick} className="w-full">
        {action}
      </GlowButton>
    </div>
  );
}
