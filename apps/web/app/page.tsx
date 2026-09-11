import { SPORT_ID as NFL_SPORT_ID } from '@perfect-season/sport-engine-nfl';
import { SPORT_ID as CFB_SPORT_ID } from '@perfect-season/sport-engine-cfb';

export default function Page() {
  return (
    <main>
      <h1>Perfect Season — scaffold</h1>
      <p>Sport: {NFL_SPORT_ID}</p>
      <p>Sport: {CFB_SPORT_ID}</p>
    </main>
  );
}
