import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { splitDuration } from '../../domain/attendance/attendance';

/**
 * A duration as "2h 15m" in English and "2 س 15 د" in Arabic.
 *
 * The previous formatter hardcoded the English letters, so an Arabic screen
 * showed "0.0 hrs".
 */
export function useFormatDuration(): (ms: number) => string {
  const { t } = useTranslation();
  return useCallback(
    (ms: number) => {
      const { hours, minutes } = splitDuration(ms);
      return hours > 0
        ? t('common.durationHM', { hours, minutes })
        : t('common.durationM', { minutes });
    },
    [t],
  );
}
