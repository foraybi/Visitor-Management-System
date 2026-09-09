import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /**
   * Reload after this many milliseconds. The kiosk sets it: an unattended
   * tablet has nobody to press a button, so it must recover on its own.
   */
  autoReloadMs?: number;
  label?: string;
}

interface State {
  failed: boolean;
}

/**
 * Catch a render failure instead of white-screening.
 *
 * There was no error boundary anywhere. A single throw during render left the
 * kiosk permanently blank, in a lobby, with no recovery short of someone
 * noticing and reloading the tablet by hand.
 *
 * Deliberately plain: no translation lookups, no antd, no store reads. Anything
 * this component depends on is something that can fail and take the fallback
 * down with it, which would leave the white screen it exists to prevent. The
 * message is bilingual for the same reason, rather than reading a locale.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  private timer: number | undefined;

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.label ?? 'app'}] render failed:`, error, info.componentStack);

    if (this.props.autoReloadMs) {
      this.timer = window.setTimeout(() => window.location.reload(), this.props.autoReloadMs);
    }
  }

  componentWillUnmount(): void {
    if (this.timer) window.clearTimeout(this.timer);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: 32,
          textAlign: 'center',
          background: '#f0f4f8',
          color: 'rgb(0, 114, 151)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 600 }}>حدث خطأ. جارٍ إعادة التشغيل…</div>
        <div style={{ fontSize: 20, opacity: 0.75 }}>Something went wrong. Restarting…</div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 12,
            padding: '14px 32px',
            fontSize: 18,
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            background: 'rgb(0, 114, 151)',
          }}
        >
          إعادة التحميل / Reload
        </button>
      </div>
    );
  }
}
