import Link from 'next/link';
import { AppearanceMenu } from './appearance-menu';

export function Footer() {
  return (
    <footer className="page-container pb-6 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-5 text-caption text-muted">
        <Link href="/" className="min-h-11 content-center font-semibold hover:text-action">
          Perfect Season
        </Link>
        <p>Design preview. The season starts later.</p>
        <div className="md:hidden">
          <AppearanceMenu />
        </div>
        <span className="hidden md:inline">Built for the love of the game.</span>
      </div>
    </footer>
  );
}
