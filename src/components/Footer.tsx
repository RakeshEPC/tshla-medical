export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-black/10">
      <div className="max-w-6xl mx-auto px-4 py-8 text-xs text-white/60 flex flex-col md:flex-row gap-2 md:gap-6 items-center justify-between">
        <div>© {new Date().getFullYear()} TSHLA.ai • All rights reserved</div>
        <div className="flex items-center gap-4">
          <a href="/privacy" className="hover:text-white/80">
            Privacy
          </a>
          <a href="/terms" className="hover:text-white/80">
            Terms
          </a>
          <a href="mailto:support@tshla.ai" className="hover:text-white/80">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
