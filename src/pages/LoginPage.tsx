import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Input, Button, Space, Typography, Alert, Form, Row, Col, Spin } from 'antd';
import {
  LoginOutlined,
  CustomerServiceOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

const { Title, Paragraph } = Typography;

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loginAsVisitor, loginWithPassword } = useAuthStore();
  const { language, toggleLanguage } = useUIStore();
  const [selectedRole, setSelectedRole] = useState<'frontdesk' | 'admin' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVisitorLogin = () => {
    loginAsVisitor();
    navigate('/visitor');
  };

  const handleStaffLogin = async (values: { email: string; password: string }) => {
    if (!selectedRole) return;
    setLoading(true);
    setError('');
    const err = await loginWithPassword(values.email, values.password, selectedRole);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    navigate(selectedRole === 'admin' ? '/admin' : '/frontdesk');
  };

  return (
    <div className="floating-orbs min-h-screen flex flex-col">
      <div className="flex justify-between items-center p-6">
        <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
          {t('common.appName')}
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

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl">
          <Title
            level={1}
            style={{ color: 'rgb(0, 114, 151)', textAlign: 'center', marginBottom: 48 }}
          >
            {t('login.selectRole')}
          </Title>

          {selectedRole === null ? (
            <Row gutter={[24, 24]} justify="center">
              {/* Visitor */}
              <Col xs={24} md={8}>
                <Card
                  hoverable
                  onClick={handleVisitorLogin}
                  className="h-full glass-heavy"
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  styles={{ body: { padding: 40 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <LoginOutlined style={{ fontSize: 64, color: 'rgb(0, 114, 151)' }} />
                  </div>
                  <Title level={3} style={{ color: 'rgb(0, 114, 151)' }}>
                    {t('login.visitorScreen')}
                  </Title>
                  <Paragraph style={{ color: '#6b7280' }}>{t('visitor.welcome')}</Paragraph>
                </Card>
              </Col>

              {/* Front Desk */}
              <Col xs={24} md={8}>
                <Card
                  hoverable
                  onClick={() => { setSelectedRole('frontdesk'); setError(''); }}
                  className="h-full glass-heavy"
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  styles={{ body: { padding: 40 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <CustomerServiceOutlined style={{ fontSize: 64, color: 'rgb(16, 154, 169)' }} />
                  </div>
                  <Title level={3} style={{ color: 'rgb(16, 154, 169)' }}>
                    {t('login.frontDesk')}
                  </Title>
                  <Paragraph style={{ color: '#6b7280' }}>{t('frontdesk.visitors')}</Paragraph>
                </Card>
              </Col>

              {/* Admin */}
              <Col xs={24} md={8}>
                <Card
                  hoverable
                  onClick={() => { setSelectedRole('admin'); setError(''); }}
                  className="h-full glass-heavy"
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  styles={{ body: { padding: 40 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <SafetyCertificateOutlined style={{ fontSize: 64, color: 'rgb(5, 99, 193)' }} />
                  </div>
                  <Title level={3} style={{ color: 'rgb(5, 99, 193)' }}>
                    {t('login.admin')}
                  </Title>
                  <Paragraph style={{ color: '#6b7280' }}>{t('admin.manageUsers')}</Paragraph>
                </Card>
              </Col>
            </Row>
          ) : (
            <div style={{ maxWidth: 420, margin: '0 auto' }}>
              <Card className="glass-heavy" styles={{ body: { padding: 36 } }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <Button
                    icon={<ArrowLeftOutlined />}
                    type="text"
                    onClick={() => { setSelectedRole(null); setError(''); }}
                  />
                  <Title level={3} style={{ margin: 0 }}>
                    {selectedRole === 'frontdesk' ? t('login.frontDesk') : t('login.admin')}
                  </Title>
                </div>

                {error && (
                  <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
                )}

                <Spin spinning={loading}>
                  <Form layout="vertical" onFinish={handleStaffLogin} requiredMark={false}>
                    <Form.Item
                      label={t('login.email') || 'Email'}
                      name="email"
                      rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
                    >
                      <Input
                        size="large"
                        type="email"
                        placeholder="name@company.com"
                        autoComplete="email"
                      />
                    </Form.Item>
                    <Form.Item
                      label={t('login.password')}
                      name="password"
                      rules={[{ required: true, message: 'Password is required' }]}
                    >
                      <Input.Password
                        size="large"
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                    </Form.Item>
                    <Space style={{ width: '100%' }} size="middle">
                      <Button
                        size="large"
                        onClick={() => { setSelectedRole(null); setError(''); }}
                        disabled={loading}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button type="primary" htmlType="submit" size="large" loading={loading}>
                        {t('login.login')}
                      </Button>
                    </Space>
                  </Form>
                </Spin>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
