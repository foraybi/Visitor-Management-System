import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Typography, Button, Card } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface VisitorIdCardProps {
  onClose: () => void;
}

/**
 * Shown after a visitor checks in.
 *
 * It no longer shows the visit code. Visitors check out with their mobile or ID
 * number, and the code is for the front desk and admin only.
 */
export default function VisitorIdCard({ onClose }: VisitorIdCardProps) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(10);

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
    <Modal open={true} footer={null} closable={false} centered width="min(480px, 94vw)">
      <div style={{ padding: 24, textAlign: 'center' }}>
        <CheckCircleOutlined style={{ fontSize: 88, color: 'rgb(127, 188, 66)', marginBottom: 16 }} />
        <Title level={3} style={{ marginBottom: 24, color: 'black' }}>
          {t('visitor.checkedInTitle')}
        </Title>

        <Card
          size="small"
          style={{
            marginBottom: 16,
            background: 'rgba(0, 114, 151, 0.06)',
            border: '1px solid rgba(0, 114, 151, 0.3)',
          }}
        >
          <Text strong style={{ color: 'black', fontSize: 16 }}>
            {t('visitor.exitInstructions')}
          </Text>
        </Card>

        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          {t('visitor.closingIn', { count: countdown })}
        </Text>

        <Button type="primary" size="large" block onClick={onClose}>
          {t('common.done')}
        </Button>
      </div>
    </Modal>
  );
}
