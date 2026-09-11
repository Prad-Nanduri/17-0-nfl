import Image from 'next/image';
import type { CSSProperties, HTMLAttributes } from 'react';
import type { League, Team } from '../../lib/teams';

const sizes = { xs: 24, sm: 32, md: 48, lg: 72, xl: 120 } as const;

/** Fixed pixel sizes, or `fill` to adopt the parent's box (parent must size itself). */
export type LogoSize = keyof typeof sizes | 'fill';

interface MarkProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: LogoSize;
  /** Load immediately — use for above-the-fold or reveal-card marks. */
  eager?: boolean;
}

function frame(size: LogoSize): {
  px: number;
  style: CSSProperties | undefined;
  className: string;
} {
  if (size === 'fill') return { px: 128, style: undefined, className: 'block h-full w-full' };
  const px = sizes[size];
  return { px, style: { width: px, height: px }, className: 'inline-block shrink-0' };
}

/**
 * Renders the light and dark variants of a mark; theme CSS shows exactly one.
 * Marks are served `unoptimized` on purpose: the source PNGs are already sized and this
 * keeps 300+ logos off the Vercel image-optimization quota (spec §5.1).
 */
function ThemedMark({
  light,
  dark,
  alt,
  px,
  eager,
}: {
  light: string;
  dark: string;
  alt: string;
  px: number;
  eager: boolean;
}) {
  const shared = {
    width: px,
    height: px,
    unoptimized: true,
    draggable: false,
    loading: eager ? ('eager' as const) : ('lazy' as const),
    className: 'h-full w-full object-contain',
  };
  return (
    <>
      <Image src={light} alt={alt} {...shared} data-theme-only="light" />
      <Image src={dark} alt="" aria-hidden {...shared} data-theme-only="dark" />
    </>
  );
}

export interface TeamLogoProps extends MarkProps {
  team: Team;
}

/** `<TeamLogo team={team} size="sm" />` — pair with the team name nearby; alt text carries it otherwise. */
export function TeamLogo({
  team,
  size = 'md',
  eager = false,
  className = '',
  ...props
}: TeamLogoProps) {
  const box = frame(size);
  return (
    <span className={`${box.className} ${className}`} style={box.style} {...props}>
      <ThemedMark
        light={team.logo}
        dark={team.logoDark}
        alt={`${team.displayName} logo`}
        px={box.px}
        eager={eager}
      />
    </span>
  );
}

export interface LeagueMarkProps extends MarkProps {
  league: League;
}

/** `<LeagueMark league={leagues.nfl} size="sm" />` — the league's official mark. */
export function LeagueMark({
  league,
  size = 'md',
  eager = false,
  className = '',
  ...props
}: LeagueMarkProps) {
  const box = frame(size);
  return (
    <span className={`${box.className} ${className}`} style={box.style} {...props}>
      <ThemedMark
        light={league.logo}
        dark={league.logoDark}
        alt={`${league.name} logo`}
        px={box.px}
        eager={eager}
      />
    </span>
  );
}
