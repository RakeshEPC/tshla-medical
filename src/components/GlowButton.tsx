'use client';
import { useState } from 'react';

export default function GlowButton({
  children,
  onClick,
  className = '',
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-3 rounded-2xl font-semibold transition relative ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
      style={{
        boxShadow: hover ? '0 0 30px rgba(255,255,255,0.25)' : 'none',
        background: disabled ? '#24456d' : '#1d4ed8',
      }}
    >
      {children}
    </button>
  );
}
