import type { Metadata } from 'next';
import { Header } from '../../../components/checkpoint/header';
import { Footer } from '../../../components/checkpoint/footer';
import { SportDraft } from '../../../components/draft/sport-draft';

export const metadata: Metadata = { title: 'CFB Core Draft' };

export default function CfbPlayPage() {
  return (
    <div data-sport="cfb">
      <Header page="play" />
      <SportDraft sport="cfb" />
      <Footer />
    </div>
  );
}
