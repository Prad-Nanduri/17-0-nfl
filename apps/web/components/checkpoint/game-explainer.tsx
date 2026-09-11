'use client';

import { ArrowRight, Trophy } from '@phosphor-icons/react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export function GameExplainer({ compact = false }: { compact?: boolean }) {
  return (
    <Modal
      trigger={
        <Button variant="ghost" className={compact ? '' : '-ml-6'}>
          {compact ? 'Preview notes' : 'The idea'}
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
      }
      title={compact ? 'A look inside the draft.' : 'Build your football what-if.'}
      description="This checkpoint explores the visual system. Drafts, player ratings, and simulations are not connected."
    >
      <div className="space-y-6">
        <p className="text-small">
          The platform will bring players from different eras into one 24-slot roster. Your
          selections will shape a simulated season.
        </p>
        <div className="border-l-2 border-sport pl-4">
          <Badge tone="sport">
            <Trophy size={14} aria-hidden="true" />
            The perfect season
          </Badge>
          <p className="mt-3 text-small text-muted">
            An undefeated run is the ambition. The draft is where it begins.
          </p>
        </div>
        <p className="text-caption text-muted">
          You can explore the reveal animation, change appearance, and inspect sample roster slots.
          All content is illustrative.
        </p>
      </div>
    </Modal>
  );
}
