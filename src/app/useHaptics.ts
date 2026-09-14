import { useEffect } from 'react';

/**
 * A short vibration on every tap of something pressable, in both apps.
 *
 * One listener on the document rather than an onClick on every button: it
 * covers Ant Design's buttons, cards, radio buttons, menu items and selects
 * without touching each component, and cannot be forgotten on the next button
 * someone adds.
 *
 * Uses the Vibration API, which Android tablets support. iPad Safari does not
 * implement it, so there this does nothing.
 */

const PRESSABLE = [
  'button',
  '[role="button"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="tab"]',
  'a[href]',
  '.ant-card-hoverable',
  '.ant-radio-button-wrapper',
  '.ant-checkbox-wrapper',
  '.ant-select-selector',
  '.ant-select-item-option',
  '.ant-segmented-item',
  '.ant-pagination-item',
  '.ant-switch',
].join(', ');

const DISABLED = '[disabled], [aria-disabled="true"], .ant-btn-disabled, .ant-radio-button-wrapper-disabled';

const PULSE_MS = 12;

export function useHaptics(): void {
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const pressable = target?.closest(PRESSABLE);
      if (!pressable || pressable.closest(DISABLED)) return;
      // The hidden hold-to-exit corner on the kiosk must give nothing away.
      if (pressable.closest('.kiosk-exit-btn')) return;
      navigator.vibrate(PULSE_MS);
    };

    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true });
  }, []);
}
