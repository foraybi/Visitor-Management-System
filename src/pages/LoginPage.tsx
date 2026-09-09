import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { GlobalOutlined, LoginOutlined } from '@ant-design/icons';
import { homeRouteFor } from '../domain/access/access';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

const { Title, Paragraph } = Typography;

/**
 * The only way into the staff app.
 *
 * Two things are deliberately absent.
 *
 * There is no visitor card. The kiosk is a separate build on a separate origin,
 * so a visitor never reaches this page, and a tablet cannot be walked from the
 * check-in screen to a staff sign-in.
 *
 * There is no role picker. The previous screen asked the user to declare
 * themselves front desk or admin, then compared that against a claim the user
 * could edit from the browser console. The account's own role decides where it
 * lands, read from `profiles`, and the database enforces the rest.
 *
 * There is also no sign-up route anywhere in this build. Accounts are created by
 * an administrator.
 */
export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);
  const language = useUIStore((s) => s.language);
  const toggleLanguage = useUIStore((s) => s.toggleLanguage);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError('');

    const message = await loginWithPassword(values.email, values.password);
    setLoading(false);

    if (message) {
      setError(message);
      return;
    }

    // The role decides the destination, so a front desk account cannot land on
    // an admin screen by asking for one.
    const role = useAuthStore.getState().currentRole;
    navigate(role ? homeRouteFor(role) : '/', { replace: true });
  };

  return (
    <div className="floating-orbs min-h-screen flex flex-col">
      <div className="flex justify-between items-center p-6">
        <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
          {t('common.appName')}
        </Title>
        <Button type="primary" icon={<GlobalOutlined />} onClick={toggleLanguage} size="large">
          {language.toUpperCase()}
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="glass-heavy" style={{ width: '100%', maxWidth: 420 }}>
          <Title level={3} style={{ color: 'rgb(0, 114, 151)', marginTop: 0 }}>
            {t('login.staffSignIn')}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 24 }}>
            {t('login.staffSignInHint')}
          </Paragraph>

          {error ? (
            <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
          ) : null}

          <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <Form.Item
              label={t('login.email')}
              name="email"
              rules={[
                { required: true, message: t('common.required') },
                { type: 'email', message: t('login.emailInvalid') },
              ]}
            >
              <Input size="large" autoComplete="username" inputMode="email" autoFocus />
            </Form.Item>

            <Form.Item
              label={t('login.password')}
              name="password"
              rules={[{ required: true, message: t('common.required') }]}
            >
              <Input.Password size="large" autoComplete="current-password" />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={<LoginOutlined />}
              loading={loading}
              block
            >
              {t('login.signIn')}
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
