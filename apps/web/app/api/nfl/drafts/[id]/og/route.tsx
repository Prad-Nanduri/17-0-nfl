import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import React from 'react';
import { getDraftStore } from '../../../../../../lib/server/draft-store';
import { getNflTrophyDefinitions } from '@perfect-season/sport-engine-nfl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const packageRequire = createRequire(import.meta.url);

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeData = Buffer.from(type);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeData, data])), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, typeData, data, checksum]);
}

const GLYPHS: Record<string, readonly string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
};

function drawText(
  raw: Buffer,
  width: number,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: readonly [number, number, number],
): void {
  let cursor = x;
  for (const character of text.toUpperCase()) {
    const glyph = GLYPHS[character] ?? GLYPHS[' '];
    if (glyph === undefined) continue;
    for (let row = 0; row < glyph.length; row += 1) {
      const glyphRow = glyph[row];
      if (glyphRow === undefined) continue;
      for (let column = 0; column < glyphRow.length; column += 1) {
        if (glyphRow[column] !== '1') continue;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const pixelX = cursor + column * scale + dx;
            const pixelY = y + row * scale + dy;
            if (pixelX < 0 || pixelX >= width || pixelY < 0) continue;
            const offset = pixelY * (1 + width * 4) + 1 + pixelX * 4;
            raw[offset] = color[0];
            raw[offset + 1] = color[1];
            raw[offset + 2] = color[2];
            raw[offset + 3] = 255;
          }
        }
      }
    }
    cursor += 6 * scale;
  }
}

function fallbackPng(lines: readonly string[]): Buffer {
  const width = 1200;
  const height = 630;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + width * 4);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4;
      raw[offset] = 11;
      raw[offset + 1] = 15;
      raw[offset + 2] = 13;
      raw[offset + 3] = 255;
    }
  }
  drawText(raw, width, lines[0] ?? '', 64, 64, 4, [110, 201, 146]);
  drawText(raw, width, lines[1] ?? '', 64, 160, 14, [232, 237, 232]);
  drawText(raw, width, lines[2] ?? '', 64, 390, 4, [156, 171, 161]);
  drawText(raw, width, lines[3] ?? '', 64, 470, 4, [156, 171, 161]);
  drawText(raw, width, lines[4] ?? '', 870, 500, 6, [110, 201, 146]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export async function GET(_request: Request, context: { params: { id: string } }) {
  const draft = getDraftStore().get(context.params.id);
  if (draft === undefined) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  if (draft.result === null) {
    return NextResponse.json({ error: 'Season not simulated yet' }, { status: 404 });
  }
  const { season, trophies, mvp, fullGauntlet } = draft.result;
  const resolvedPackagePath = packageRequire.resolve('@fontsource/barlow-condensed/package.json');
  const fallbackPackagePath = [
    join(process.cwd(), 'node_modules', '@fontsource', 'barlow-condensed', 'package.json'),
    join(process.cwd(), '..', 'node_modules', '@fontsource', 'barlow-condensed', 'package.json'),
    join(
      process.cwd(),
      '..',
      '..',
      'node_modules',
      '@fontsource',
      'barlow-condensed',
      'package.json',
    ),
  ].find((candidate) => existsSync(candidate));
  const packagePath = existsSync(resolvedPackagePath) ? resolvedPackagePath : fallbackPackagePath;
  if (packagePath === undefined) throw new Error('Barlow Condensed font package was not found');
  const barlowPath = join(dirname(packagePath), 'files', 'barlow-condensed-latin-700-normal.woff');
  const barlowData = await readFile(barlowPath);
  const resolvedNextPackagePath = packageRequire.resolve('next/package.json');
  const fallbackNextPackagePath = [
    join(process.cwd(), 'node_modules', 'next', 'package.json'),
    join(process.cwd(), '..', 'node_modules', 'next', 'package.json'),
    join(process.cwd(), '..', '..', 'node_modules', 'next', 'package.json'),
  ].find((candidate) => existsSync(candidate));
  const nextPackagePath = existsSync(resolvedNextPackagePath)
    ? resolvedNextPackagePath
    : fallbackNextPackagePath;
  if (nextPackagePath === undefined) throw new Error('Next package was not found');
  const fallbackFontPath = join(
    dirname(nextPackagePath),
    'dist',
    'compiled',
    '@vercel',
    'og',
    'noto-sans-v27-latin-regular.ttf',
  );
  const usesFallbackFont = barlowData.subarray(0, 4).toString('ascii') === 'wOFF';
  const fontData = usesFallbackFont ? await readFile(fallbackFontPath) : barlowData;
  const fontFamily = usesFallbackFont ? 'Noto Sans' : 'Barlow Condensed';
  const trophyNames = new Map(
    getNflTrophyDefinitions().map((definition) => [definition.code, definition.name]),
  );
  const record = `${season.record.wins}-${season.record.losses}${
    season.record.ties > 0 ? `-${season.record.ties}` : ''
  }`;
  const gauntletLabel =
    season.postseasonResult === 'won_super_bowl'
      ? 'Won the Super Bowl'
      : season.postseasonResult === 'lost_super_bowl'
        ? 'Lost the Super Bowl'
        : season.postseasonResult === 'lost_conference'
          ? 'Lost the Conference Championship'
          : season.postseasonResult === 'lost_divisional'
            ? 'Lost in the Divisional Round'
            : season.postseasonResult === 'lost_wild_card'
              ? 'Lost in the Wild Card Round'
              : 'Missed the playoffs';
  const element = (
    <div
      style={{
        background: '#0b0f0d',
        color: '#e8ede8',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '64px',
        width: '100%',
        fontFamily,
      }}
    >
      <div style={{ color: '#6ec992', display: 'flex', fontSize: 24, letterSpacing: 4 }}>
        {'PERFECT SEASON \u00b7 NFL CORE DRAFT'}
      </div>
      <div
        style={{
          alignItems: 'flex-end',
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily, fontSize: 144, fontWeight: 700 }}>{record}</div>
          <div style={{ color: '#9caba1', display: 'flex', fontSize: 28 }}>
            Point differential {signed(season.pointsFor - season.pointsAgainst)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
          <div style={{ color: '#9caba1', display: 'flex', fontSize: 22 }}>MVP</div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>{mvp.fullName}</div>
          <div style={{ color: '#6ec992', display: 'flex', fontSize: 28 }}>
            {mvp.primaryPosition} {'\u00b7'} {mvp.rating}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 42 }}>
        {trophies.map((trophy) => (
          <div
            key={trophy.code}
            style={{
              background: '#1b241f',
              border: '1px solid #2e3b34',
              borderRadius: 999,
              color: '#d8e4da',
              display: 'flex',
              fontSize: 22,
              padding: '10px 18px',
            }}
          >
            {trophyNames.get(trophy.code) ?? trophy.code}
          </div>
        ))}
      </div>
      <div style={{ alignItems: 'center', display: 'flex', marginTop: 'auto' }}>
        <div style={{ color: '#6ec992', display: 'flex', fontSize: 32 }}>
          17-0 {season.record.wins === 17 && season.record.losses === 0 ? '\u2713' : '\u2717'}
        </div>
        {fullGauntlet ? (
          <div style={{ color: '#9caba1', display: 'flex', fontSize: 26, marginLeft: 32 }}>
            {'Full Gauntlet \u00b7 '}
            {gauntletLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
  const options = {
    width: 1200,
    height: 630,
    fonts: [{ name: fontFamily, data: fontData, style: 'normal' as const, weight: 700 as const }],
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  };
  if (process.platform === 'win32') {
    try {
      const resolvedOgPath = packageRequire.resolve('next/dist/compiled/@vercel/og/index.node.js');
      const fallbackOgPath = [
        join(
          process.cwd(),
          'node_modules',
          'next',
          'dist',
          'compiled',
          '@vercel',
          'og',
          'index.node.js',
        ),
        join(
          process.cwd(),
          '..',
          'node_modules',
          'next',
          'dist',
          'compiled',
          '@vercel',
          'og',
          'index.node.js',
        ),
        join(
          process.cwd(),
          '..',
          '..',
          'node_modules',
          'next',
          'dist',
          'compiled',
          '@vercel',
          'og',
          'index.node.js',
        ),
      ].find((candidate) => existsSync(candidate));
      const ogPath = existsSync(resolvedOgPath) ? resolvedOgPath : fallbackOgPath;
      if (ogPath === undefined) throw new Error('Next OG runtime was not found');
      const og = await import(/* webpackIgnore: true */ pathToFileURL(ogPath).href);
      return new og.ImageResponse(element, options);
    } catch {
      return new Response(
        fallbackPng([
          'PERFECT SEASON NFL CORE DRAFT',
          record,
          `POINT DIFFERENTIAL ${signed(season.pointsFor - season.pointsAgainst)}`,
          `MVP ${mvp.fullName} ${mvp.primaryPosition} ${mvp.rating}`,
          season.record.wins === 17 && season.record.losses === 0 ? '17-0' : '17-0 NO',
        ]) as unknown as BodyInit,
        {
          headers: {
            'Cache-Control': 'public, max-age=0, s-maxage=3600',
            'Content-Type': 'image/png',
          },
        },
      );
    }
  }
  return new ImageResponse(element, options);
}
