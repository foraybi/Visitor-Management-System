import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';

/**
 * One codebase, two builds.
 *
 * Vite replaces `import.meta.env.VITE_APP_TARGET` with a string literal at build
 * time, so the comparison below folds to a constant and Rollup eliminates the
 * branch that is not taken, along with everything it imports. The kiosk build
 * therefore contains no staff code, no Supabase client, and no database
 * credentials, which is stronger than lazy-loading: an unreached chunk is still
 * fetchable, whereas code that was never emitted is not.
 *
 * scripts/verify-kiosk-build.sh fails the build if a Supabase host or a
 * JWT-shaped string reappears in the tablet output.
 */

const root = createRoot(document.getElementById('root')!);

if (import.meta.env.VITE_APP_TARGET === 'kiosk') {
  const { default: KioskApp } = await import('./app/kiosk/KioskApp');
  root.render(
    <StrictMode>
      <KioskApp />
    </StrictMode>,
  );
} else {
  const { default: StaffApp } = await import('./app/staff/StaffApp');
  root.render(
    <StrictMode>
      <StaffApp />
    </StrictMode>,
  );
}
