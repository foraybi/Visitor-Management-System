import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Form, Input, Button, Result, Space, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useVisitorStore } from '../../store/visitorStore';

interface ExitModalProps {
  onClose: () => void;
}

export default function ExitModal({ onClose }: ExitModalProps) {
  const { t } = useTranslation();
  const { exitVisitor } = useVisitorStore();
  const [success, setSuccess] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = (values: { visitorId: string }) => {
    const normalizedId = values.visitorId.trim().padStart(4, '0');
    if (!/^\d{4}$/.test(normalizedId)) {
      message.error('Invalid format. Use a 4-digit number (e.g. 0001)');
      return;
    }
    const result = exitVisitor(normalizedId);
    if (result) {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    } else {
      message.error(t('visitor.exitError'));
    }
  };

  if (success) {
    return (
      <Modal open={true} footer={null} closable={false} centered width={420}>
        <Result
          icon={
            <CheckCircleOutlined
              style={{ color: 'rgb(127, 188, 66)', fontSize: 80 }}
            />
          }
          title={t('visitor.exitSuccess')}
          subTitle="Thank you for visiting"
        />
      </Modal>
    );
  }

  return (
    <Modal
      open={true}
      onCancel={onClose}
      footer={null}
      title={t('visitor.exitTitle')}
      centered
      width={420}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          label={t('visitor.visitorIdPlaceholder')}
          name="visitorId"
          rules={[
            { required: true, message: 'Please enter your visitor ID' },
            {
              pattern: /^\d{1,4}$/,
              message: 'Format: 4-digit number (e.g. 0001)',
            },
          ]}
        >
          <Input
            size="large"
            inputMode="numeric"
            type="tel"
            placeholder="0001"
            maxLength={4}
            autoFocus
            onKeyDown={(e) => {
              if (
                !/^[0-9]$/.test(e.key) &&
                !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter'].includes(e.key)
              ) {
                e.preventDefault();
              }
            }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button size="large" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" size="large" htmlType="submit">
              {t('common.submit')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
