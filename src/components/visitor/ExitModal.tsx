import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Form, Input, Button, Result, Space, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { kioskErrorKey, useKioskStore } from '../../app/kiosk/kioskStore';

interface ExitModalProps {
  onClose: () => void;
}

export default function ExitModal({ onClose }: ExitModalProps) {
  const { t } = useTranslation();
  const checkOut = useKioskStore(s => s.checkOut);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: { visitorId: string }) => {
    const normalizedId = values.visitorId.trim().padStart(4, '0');
    if (!/^\d{4}$/.test(normalizedId)) {
      message.error(t('visitor.validation.visitCodeFormat'));
      return;
    }

    setSubmitting(true);
    const result = await checkOut(normalizedId);
    setSubmitting(false);

    if (result.ok) {
      setSuccess(true);
      setTimeout(onClose, 2500);
      return;
    }

    // Every failure is shown. A dropped network used to look identical to
    // success here, because the update was fired and its error swallowed.
    message.error(
      result.error === 'no_active_visit' ? t('visitor.exitError') : t(kioskErrorKey(result.error)),
    );
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
          subTitle={t('visitor.thankYou')}
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
            { required: true, message: t('common.required') },
            {
              pattern: /^\d{1,4}$/,
              message: t('visitor.validation.visitCodeFormat'),
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
            <Button size="large" onClick={onClose} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" size="large" htmlType="submit" loading={submitting}>
              {t('common.submit')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
