import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Form, Input, Button, Result, Row, Col, message } from 'antd';
import { CheckCircleOutlined, IdcardOutlined } from '@ant-design/icons';
import { kioskErrorKey, useKioskStore } from '../../app/kiosk/kioskStore';
import type { CheckOutRequest } from '../../data/kioskGateway';
import { parseCheckOutInput } from '../../domain/identity/identity';

interface ExitModalProps {
  onClose: () => void;
}

/**
 * Check out at the tablet.
 *
 * One field for everyone, visitor or employee: the mobile number or the ID
 * number they checked in with. Which one it is follows from its shape. The
 * visit code is not asked for here; the front desk and admin see it.
 */
export default function ExitModal({ onClose }: ExitModalProps) {
  const { t } = useTranslation();
  const checkOut = useKioskStore(s => s.checkOut);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: { query?: string }) => {
    const parsed = parseCheckOutInput(values.query ?? '');
    if (!parsed.ok) {
      message.error(t('visitor.checkOutInvalid'));
      return;
    }

    const request: CheckOutRequest =
      parsed.value.kind === 'phone'
        ? { phone: parsed.value.phone }
        : { idType: parsed.value.idType, idNumber: parsed.value.idNumber };

    setSubmitting(true);
    const result = await checkOut(request);
    setSubmitting(false);

    if (result.ok) {
      setSuccess(true);
      setTimeout(onClose, 2500);
      return;
    }

    // Every failure is shown. A dropped network used to look identical to
    // success here, because the update was fired and its error swallowed.
    message.error(
      result.error === 'no_active_visit' ? t('visitor.exitErrorNoMatch') : t(kioskErrorKey(result.error)),
    );
  };

  if (success) {
    return (
      <Modal open={true} footer={null} closable={false} centered width="min(460px, 94vw)">
        <Result
          icon={<CheckCircleOutlined style={{ color: 'rgb(127, 188, 66)', fontSize: 88 }} />}
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
      width="min(600px, 94vw)"
      className="kiosk-modal"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        className="enter-form-large"
        style={{ marginTop: 16 }}
      >
        <Form.Item
          label={t('visitor.checkOutHint')}
          name="query"
          rules={[
            {
              validator: (_, value: string | undefined) => {
                const parsed = parseCheckOutInput(value ?? '');
                if (parsed.ok) return Promise.resolve();
                return Promise.reject(
                  new Error(parsed.reason === 'required' ? t('common.required') : t('visitor.checkOutInvalid')),
                );
              },
            },
          ]}
        >
          <Input
            size="large"
            autoFocus
            autoComplete="off"
            maxLength={20}
            dir="ltr"
            placeholder={t('visitor.checkOutPlaceholder')}
            prefix={<IdcardOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
          />
        </Form.Item>

        <Row gutter={12} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Button size="large" block onClick={onClose} disabled={submitting}>
              {t('common.cancel')}
            </Button>
          </Col>
          <Col span={12}>
            <Button type="primary" size="large" block htmlType="submit" loading={submitting}>
              {t('common.submit')}
            </Button>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
