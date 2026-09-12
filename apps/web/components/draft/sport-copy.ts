import type { SportId } from '@perfect-season/sport-engine-core';

export const SPORT_DRAFT_COPY: Readonly<
  Record<
    SportId,
    {
      readonly setupEyebrow: string;
      readonly setupBlurb: string;
      readonly wheelLabel: string;
      readonly revealEyebrow: string;
      readonly revealBody: string;
    }
  >
> = {
  nfl: {
    setupEyebrow: 'NFL / Core draft',
    setupBlurb: 'Build a 24-player roster from every available franchise season.',
    wheelLabel: 'NFL franchise spin wheel',
    revealEyebrow: 'Franchise season',
    revealBody: 'Spin the wheel to reveal a franchise season.',
  },
  cfb: {
    setupEyebrow: 'CFB / Core draft',
    setupBlurb: 'Build a 24-player roster from every available program season.',
    wheelLabel: 'FBS program spin wheel',
    revealEyebrow: 'Program season',
    revealBody: 'Spin the wheel to reveal a program season.',
  },
};

export const SPORT_SCHEME_LABELS: Readonly<
  Record<SportId, readonly { value: string; label: string }[]>
> = {
  nfl: [
    { value: '4-3', label: 'Base 4-3' },
    { value: '3-4', label: 'Base 3-4' },
    { value: 'nickel', label: 'Nickel' },
  ],
  cfb: [
    { value: '4-3', label: 'Base 4-3' },
    { value: '3-4', label: 'Base 3-4' },
    { value: 'nickel', label: 'Spread Defense' },
  ],
};
