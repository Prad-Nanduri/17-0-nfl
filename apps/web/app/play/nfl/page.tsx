import type { Metadata } from 'next';
import { Header } from '../../../components/checkpoint/header';
import { Footer } from '../../../components/checkpoint/footer';
import { NflDraft } from '../../../components/draft/nfl-draft';

export const metadata: Metadata = { title: 'NFL Core Draft' };

export default function NflPlayPage() {
  return (
    <div data-sport="nfl">
      <Header page="play" />
      <NflDraft />
      <Footer />
    </div>
  );
}
