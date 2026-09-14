import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStopwatch } from 'react-timer-hook';
import { visitDurationMs } from '../../domain/attendance/attendance';
import { useFormatDuration } from './useFormatDuration';

const pad = (n: number) => String(n).padStart(2, '0');

/** A visit still in progress: a clock counting up from the entry time. */
function RunningDuration({ entryTime }: { entryTime: string }) {
  const { t } = useTranslation();

  // react-timer-hook starts a stopwatch from an offset expressed as a moment in
  // the future, that far ahead of now. Computed once, so the clock runs from the
  // real entry time rather than from when the row happened to render.
  const [offset] = useState(() => {
    const elapsed = Math.max(0, Date.now() - Date.parse(entryTime));
    return new Date(Date.now() + elapsed);
  });
  const { totalSeconds } = useStopwatch({ autoStart: true, offsetTimestamp: offset });

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <span className="live-duration" dir="ltr">
      {t('common.durationHMS', { hours: pad(hours), minutes: pad(minutes), seconds: pad(seconds) })}
    </span>
  );
}

/**
 * Time spent on a visit: ticking while the visitor is inside, fixed once they
 * have left.
 */
export default function LiveDuration({
  entryTime,
  exitTime,
}: {
  entryTime: string | null;
  exitTime: string | null;
}) {
  const format = useFormatDuration();

  if (!entryTime) return <span>—</span>;
  if (!exitTime) return <RunningDuration entryTime={entryTime} />;

  const ms = visitDurationMs(entryTime, exitTime);
  return <span style={{ fontWeight: 600 }}>{ms === null ? '—' : format(ms)}</span>;
}
