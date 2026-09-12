import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { Header } from '../../components/checkpoint/header';
import { Footer } from '../../components/checkpoint/footer';
import { AccountPanel } from '../../components/session/account-panel';

export const metadata: Metadata = { title: 'Account' };

const statuses = ['linked', 'invalid', 'disabled', 'noguest'] as const;
type Status = (typeof statuses)[number];

function parseStatus(value: string | string[] | undefined): Status | null {
  const first = Array.isArray(value) ? value[0] : value;
  return statuses.find((status) => status === first) ?? null;
}

export default function AccountPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <>
      <Header page="account" />
      <main id="main" className="page-container pb-section pt-8">
        <Link href="/" className="text-link">
          <ArrowLeft size={16} aria-hidden="true" /> Back to the game
        </Link>
        <p className="eyebrow mb-3 mt-10">Guest → account</p>
        <h1 className="display-heading text-display">Save your progress.</h1>
        <p className="mt-3 max-w-copy text-body text-muted">
          Guest sessions live in this browser. Linking an email keeps your drafts and pre-selects
          your default sport on every return visit. Playing never requires it.
        </p>
        <div className="mt-8">
          <AccountPanel status={parseStatus(searchParams.status)} />
        </div>
      </main>
      <Footer />
    </>
  );
}
