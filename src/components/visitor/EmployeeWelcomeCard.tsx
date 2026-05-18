import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Typography, Button, Card, Space } from 'antd';
import { CheckCircleOutlined, LogoutOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface EmployeeWelcomeCardProps {
  employeeName: string;
  employeeNumber: string;
  onClose: () => void;
}

export default function EmployeeWelcomeCard({
  employeeName,
  employeeNumber,
  onClose,
}: EmployeeWelcomeCardProps) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <Modal open={true} footer={null} closable={false} centered width={500}>
      <div style={{ padding: 16, textAlign: 'center' }}>
        <CheckCircleOutlined style={{ fontSize: 64, color: 'rgb(127, 188, 66)', marginBottom: 16 }} />
        <Title level={2} style={{ color: 'rgb(0, 114, 151)', marginBottom: 8 }}>
          {t('visitor.employeeWelcome', { name: employeeName })}
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          #{employeeNumber}
        </Text>

        <Card
          style={{
            marginTop: 24,
            background: '#fafafa',
            border: '1px solid rgb(0, 114, 151)',
          }}
          styles={{ body: { padding: 20 } }}
        >
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <LogoutOutlined style={{ fontSize: 32, color: 'rgb(0, 114, 151)' }} />
            <Paragraph strong style={{ margin: 0, fontSize: 16, color: 'black' }}>
              {t('visitor.employeeExitInstructions')}
            </Paragraph>
          </Space>
        </Card>

        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
          ({countdown}s)
        </Text>
        <Button type="primary" size="large" block onClick={onClose} style={{ marginTop: 16 }}>
          {t('common.done')}
        </Button>
      </div>
    </Modal>
  );
}
