import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-black/20 backdrop-blur border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-extrabold text-xl tracking-tight">
          <span style={{ color: 'var(--brand)', fontFamily: 'cursive' }}>TSHLA</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/passenger" className="text-white/80 hover:text-white">
            Passenger
          </Link>
          <a href="/#driver" className="text-white/80 hover:text-white">
            Driver
          </a>
          <a
            href="https://api.tshla.ai/docs"
            target="_blank"
            className="text-white/60 hover:text-white/80"
          >
            API Docs
          </a>
          <a href="/pumpdrive/form" className="text-white/80 hover:text-white">
            Pump Test Drive
          </a>
        </nav>
      </div>
    </header>
  );
}
