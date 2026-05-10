import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Typography, Button, Card } from 'antd';
import { CameraOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface VisitorIdCardProps {
  visitorId: string;
  onClose: () => void;
}

export default function VisitorIdCard({ visitorId, onClose }: VisitorIdCardProps) {
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
    <Modal
      open={true}
      footer={null}
      closable={false}
      centered
      width={440}
      styles={{
        body: { padding: 0 },
      }}
    >
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Title level={3} style={{ marginBottom: 24 }}>
          {t('visitor.idGenerated')}
        </Title>

        <Card
          style={{
            background:
              'linear-gradient(135deg, rgb(0, 114, 151), rgb(0, 166, 207))',
            border: 'none',
            marginBottom: 24,
          }}
          styles={{ body: { padding: 32 } }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
            Visitor ID
          </Text>
          <Title
            level={1}
            style={{
              color: 'white',
              fontSize: 56,
              margin: '12px 0 0',
              letterSpacing: 2,
            }}
          >
            {visitorId}
          </Title>
        </Card>

        <div style={{ marginBottom: 24 }}>
          <CameraOutlined
            style={{
              fontSize: 56,
              color: 'rgb(0, 114, 151)',
              marginBottom: 16,
            }}
          />
          <Text strong style={{ display: 'block', fontSize: 16 }}>
            {t('visitor.photoReminder')}
          </Text>
        </div>

        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Closing in {countdown} seconds...
        </Text>

        <Button type="primary" size="large" block onClick={onClose}>
          {t('common.done')}
        </Button>
      </div>
    </Modal>
  );
}
