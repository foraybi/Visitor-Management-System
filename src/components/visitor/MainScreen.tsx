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

export default function MainScreen() {
  const { t } = useTranslation();
  const { language, toggleLanguage } = useUIStore();
  const [view, setView] = useState<View>('main');

  if (view === 'enter') {
    return <EnterForm onClose={() => setView('main')} />;
  }

  return (
    <div className="floating-orbs min-h-screen flex flex-col">
      <div className="flex justify-between items-center p-6">
        <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
          VMS
        </Title>
        <Button
          type="primary"
          icon={<GlobalOutlined />}
          onClick={toggleLanguage}
          size="large"
        >
          {language.toUpperCase()}
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <Title
          level={1}
          style={{
            color: 'rgb(0, 114, 151)',
            fontSize: 64,
            marginBottom: 48,
            textAlign: 'center',
          }}
        >
          {t('visitor.welcome')}
        </Title>

        <Row gutter={[32, 32]} style={{ width: '100%', maxWidth: 800 }}>
          <Col xs={24} md={12}>
            <Card
              hoverable
              onClick={() => setView('enter')}
              className="glass-heavy"
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'transform 0.3s',
              }}
              styles={{ body: { padding: 48 } }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <LoginOutlined
                  style={{ fontSize: 96, color: 'rgb(127, 188, 66)' }}
                />
              </div>
              <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
                {t('common.enter')}
              </Title>
              <Paragraph style={{ color: '#6b7280', marginTop: 8 }}>
                {t('visitor.enterTitle')}
              </Paragraph>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card
              hoverable
              onClick={() => setView('exit')}
              className="glass-heavy"
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'transform 0.3s',
              }}
              styles={{ body: { padding: 48 } }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <LogoutOutlined
                  style={{ fontSize: 96, color: 'rgb(5, 99, 193)' }}
                />
              </div>
              <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
                {t('common.exit')}
              </Title>
              <Paragraph style={{ color: '#6b7280', marginTop: 8 }}>
                {t('visitor.exitTitle')}
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </div>

      {view === 'exit' && <ExitModal onClose={() => setView('main')} />}
    </div>
  );
}
