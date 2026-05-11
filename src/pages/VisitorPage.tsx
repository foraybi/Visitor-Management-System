import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Typography } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import MainScreen from '../components/visitor/MainScreen';

const { Title } = Typography;

const BLOCKED_KEYS = ['F11', 'Escape'];
const BLOCKED_COMBOS = (e: KeyboardEvent) =>
  (e.ctrlKey && ['w', 'W', 't', 'T', 'n', 'N', 'r', 'R'].includes(e.key)) ||
  (e.metaKey && ['w', 'W', 't', 'T', 'n', 'N', 'r', 'R'].includes(e.key)) ||
  (e.altKey && e.key === 'F4');

const EXIT_HOLD_MS = 5000;

export default function VisitorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [kioskActive, setKioskActive] = useState(false);
  const [showResumeOverlay, setShowResumeOverlay] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartRef = useRef<number>(0);

  const enterKiosk = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen denied — still enter kiosk mode (visual only)
    }
    setKioskActive(true);
    setShowResumeOverlay(false);
  }, []);

  const exitKiosk = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
    setKioskActive(false);
    logout();
    navigate('/');
  }, [logout, navigate]);

  const clearHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  }, []);

  const startHold = useCallback(() => {
    holdStartRef.current = Date.now();
    holdTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      const pct = Math.min(100, (elapsed / EXIT_HOLD_MS) * 100);
      setHoldProgress(pct);
      if (elapsed >= EXIT_HOLD_MS) {
        clearHold();
        exitKiosk();
      }
    }, 50);
  }, [clearHold, exitKiosk]);

  // Block escape keys, refresh, and shortcuts
  useEffect(() => {
    if (!kioskActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (BLOCKED_KEYS.includes(e.key) || BLOCKED_COMBOS(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement && kioskActive) {
        setShowResumeOverlay(true);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [kioskActive]);

  if (!kioskActive) {
    return (
      <div
        className="floating-orbs"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Title style={{ color: 'rgb(0, 114, 151)', marginBottom: 32 }}>
          VMS
        </Title>
        <Button
          type="primary"
          size="large"
          icon={<LoginOutlined />}
          onClick={enterKiosk}
          style={{ height: 80, fontSize: 24, padding: '0 48px' }}
        >
          {t('visitor.kioskStart')}
        </Button>
      </div>
    );
  }

  return (
    <>
      <MainScreen />

      {/* Invisible kiosk-exit button: hold 5 seconds to exit */}
      <button
        className="kiosk-exit-btn"
        onMouseDown={startHold}
        onMouseUp={clearHold}
        onMouseLeave={clearHold}
        onTouchStart={startHold}
        onTouchEnd={clearHold}
        onTouchCancel={clearHold}
        aria-label="exit-kiosk"
      />

      {/* Progress feedback while holding */}
      {holdProgress > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            insetInlineStart: 0,
            width: 60,
            height: 4,
            background: 'rgba(0,0,0,0.1)',
            zIndex: 100000,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: `${holdProgress}%`,
              height: '100%',
              background: 'rgb(0, 114, 151)',
              transition: 'width 50ms linear',
            }}
          />
        </div>
      )}

      {showResumeOverlay && (
        <div
          onClick={enterKiosk}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 114, 151, 0.95)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Title style={{ color: 'white', fontSize: 48 }}>
            {t('visitor.kioskResume')}
          </Title>
        </div>
      )}
    </>
  );
}
