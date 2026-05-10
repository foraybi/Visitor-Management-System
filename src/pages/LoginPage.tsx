import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Input, Button, Space, Typography, Alert, Form, Row, Col } from 'antd';
import {
  LoginOutlined,
  CustomerServiceOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

const { Title, Text, Paragraph } = Typography;

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { language, toggleLanguage } = useUIStore();
  const [selectedRole, setSelectedRole] = useState<'frontdesk' | 'admin' | null>(null);
  const [error, setError] = useState('');

  const handleVisitorLogin = () => {
    login('visitor');
    navigate('/visitor');
  };

  const handleFrontDeskLogin = (values: { username: string; password: string }) => {
    if (!values.username || !values.password) {
      setError(t('login.invalidCredentials'));
      return;
    }
    login('frontdesk', values.username);
    navigate('/frontdesk');
  };

  const handleAdminLogin = (values: { password: string }) => {
    if (values.password !== 'admin123') {
      setError(t('login.invalidCredentials'));
      return;
    }
    login('admin');
    navigate('/admin');
  };

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
              <Col xs={24} md={8}>
                <Card
                  hoverable
                  onClick={handleVisitorLogin}
                  className="h-full glass-heavy"
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  styles={{ body: { padding: 40 } }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <LoginOutlined
                      style={{ fontSize: 64, color: 'rgb(0, 114, 151)' }}
                    />
                  </div>
                  <Title level={3} style={{ color: 'rgb(0, 114, 151)' }}>
                    {t('login.visitorScreen')}
                  </Title>
                  <Paragraph style={{ color: '#6b7280' }}>
                    {t('visitor.welcome')}
                  </Paragraph>
                </Card>
              </Col>

              <Col xs={24} md={8}>
                <Card
                  hoverable
                  onClick={() => setSelectedRole('frontdesk')}
                  className="h-full glass-heavy"
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  styles={{ body: { padding: 40 } }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <CustomerServiceOutlined
                      style={{ fontSize: 64, color: 'rgb(16, 154, 169)' }}
                    />
                  </div>
                  <Title level={3} style={{ color: 'rgb(16, 154, 169)' }}>
                    {t('login.frontDesk')}
                  </Title>
                  <Paragraph style={{ color: '#6b7280' }}>
                    {t('frontdesk.visitors')}
                  </Paragraph>
                </Card>
              </Col>

              <Col xs={24} md={8}>
                <Card
                  hoverable
                  onClick={() => setSelectedRole('admin')}
                  className="h-full glass-heavy"
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  styles={{ body: { padding: 40 } }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <SafetyCertificateOutlined
                      style={{ fontSize: 64, color: 'rgb(5, 99, 193)' }}
                    />
                  </div>
                  <Title level={3} style={{ color: 'rgb(5, 99, 193)' }}>
                    {t('login.admin')}
                  </Title>
                  <Paragraph style={{ color: '#6b7280' }}>
                    {t('admin.manageUsers')}
                  </Paragraph>
                </Card>
              </Col>
            </Row>
          ) : (
            <div style={{ maxWidth: 400, margin: '0 auto' }}>
              <Card className="glass-heavy" styles={{ body: { padding: 32 } }}>
                <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
                  {selectedRole === 'frontdesk'
                    ? t('login.frontDesk')
                    : t('login.admin')}
                </Title>

                {error && (
                  <Alert
                    message={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}

                {selectedRole === 'frontdesk' ? (
                  <Form
                    layout="vertical"
                    onFinish={handleFrontDeskLogin}
                    requiredMark={false}
                  >
                    <Form.Item
                      label={t('login.username')}
                      name="username"
                      rules={[{ required: true }]}
                    >
                      <Input size="large" placeholder="john.doe" />
                    </Form.Item>
                    <Form.Item
                      label={t('login.password')}
                      name="password"
                      rules={[{ required: true }]}
                    >
                      <Input.Password size="large" placeholder="••••••••" />
                    </Form.Item>
                    <Space style={{ width: '100%' }} size="middle">
                      <Button
                        size="large"
                        onClick={() => {
                          setSelectedRole(null);
                          setError('');
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button type="primary" htmlType="submit" size="large">
                        {t('login.login')}
                      </Button>
                    </Space>
                  </Form>
                ) : (
                  <Form
                    layout="vertical"
                    onFinish={handleAdminLogin}
                    requiredMark={false}
                  >
                    <Form.Item
                      label={t('login.password')}
                      name="password"
                      rules={[{ required: true }]}
                    >
                      <Input.Password size="large" placeholder="admin123" />
                    </Form.Item>
                    <Space style={{ width: '100%' }} size="middle">
                      <Button
                        size="large"
                        onClick={() => {
                          setSelectedRole(null);
                          setError('');
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button type="primary" htmlType="submit" size="large">
                        {t('login.login')}
                      </Button>
                    </Space>
                  </Form>
                )}
              </Card>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Text type="secondary">
              Default admin password: admin123
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}
