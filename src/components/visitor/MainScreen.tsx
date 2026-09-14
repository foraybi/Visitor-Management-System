import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Typography, Button, Row, Col } from 'antd';
import {
  LoginOutlined,
  LogoutOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useUIStore } from '../../store/uiStore';
import EnterForm from './EnterForm';
import ExitModal from './ExitModal';

const { Title, Paragraph } = Typography;

type View = 'main' | 'enter' | 'exit';

const ENTER_COLOR = 'rgb(127, 188, 66)';
const EXIT_COLOR = 'rgb(239, 68, 68)';

/**
 * The kiosk's welcome screen.
 *
 * Sized with clamp() so it fills a landscape tablet and still fits a tablet
 * held upright, where the two choices stay side by side.
 */
export default function MainScreen() {
  const { t } = useTranslation();
  const { language, toggleLanguage } = useUIStore();
  const [view, setView] = useState<View>('main');

  if (view === 'enter') {
    return <EnterForm onClose={() => setView('main')} />;
  }

  const choice = (
    key: 'enter' | 'exit',
    color: string,
    icon: React.ReactNode,
    title: string,
    subtitle: string,
  ) => (
    <Card
      hoverable
      role="button"
      onClick={() => setView(key)}
      className="glass-heavy kiosk-choice"
      style={{ borderTop: `6px solid ${color}` }}
      styles={{
        body: {
          padding: 'clamp(16px, min(3vw, 4vh), 40px)',
          minHeight: 'clamp(150px, min(24vw, 30vh), 280px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
    >
      <div style={{ fontSize: 'clamp(44px, min(7vw, 11vh), 92px)', color, lineHeight: 1, marginBottom: 'clamp(8px, 1.6vh, 16px)' }}>
        {icon}
      </div>
      <Title level={2} style={{ color, margin: 0, fontSize: 'clamp(22px, min(3vw, 4.6vh), 36px)' }}>
        {title}
      </Title>
      <Paragraph style={{ color: '#6b7280', margin: '6px 0 0', fontSize: 'clamp(14px, min(1.6vw, 2.4vh), 18px)' }}>
        {subtitle}
      </Paragraph>
    </Card>
  );

  return (
    <div className="floating-orbs kiosk-screen">
      <div className="flex justify-between items-center" style={{ padding: 'clamp(12px, min(2.4vw, 3vh), 24px)', gap: 16 }}>
        <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0, fontSize: 'clamp(18px, min(2.4vw, 3.6vh), 28px)' }}>
          {t('common.appName')}
        </Title>
        <Button
          type="primary"
          icon={<GlobalOutlined />}
          onClick={toggleLanguage}
          size="large"
          style={{ minHeight: 44, paddingInline: 18, fontSize: 16 }}
        >
          {language === 'ar' ? 'English' : 'العربية'}
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: 'clamp(16px, 3vw, 32px)' }}>
        <Title
          level={1}
          style={{
            color: 'rgb(0, 114, 151)',
            fontSize: 'clamp(26px, min(5vw, 7.5vh), 56px)',
            marginBottom: 'clamp(16px, min(4vw, 5vh), 48px)',
            textAlign: 'center',
          }}
        >
          {t('visitor.welcome')}
        </Title>

        <Row gutter={[24, 24]} style={{ width: '100%', maxWidth: 920 }}>
          <Col xs={24} sm={12}>
            {choice('enter', ENTER_COLOR, <LoginOutlined />, t('common.enter'), t('visitor.enterTitle'))}
          </Col>
          <Col xs={24} sm={12}>
            {choice('exit', EXIT_COLOR, <LogoutOutlined />, t('common.exit'), t('visitor.exitTitle'))}
          </Col>
        </Row>
      </div>

      {view === 'exit' && <ExitModal onClose={() => setView('main')} />}
    </div>
  );
}
