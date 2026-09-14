import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Form, Input, Button, Result, Row, Col, Segmented, message } from 'antd';
import { CheckCircleOutlined, IdcardOutlined, NumberOutlined } from '@ant-design/icons';
import { kioskErrorKey, useKioskStore } from '../../app/kiosk/kioskStore';
import type { CheckOutRequest } from '../../data/kioskGateway';
import { inferIdentityType, parseIdentityNumber } from '../../domain/identity/identity';

interface ExitModalProps {
  onClose: () => void;
}

type Mode = 'code' | 'employee';

const DIGIT_KEYS = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter'];

/**
 * Check out at the tablet.
 *
 * A visitor enters the code from their visitor card. An employee is never shown
 * a code, so they choose "Employee ID" and enter the identity number they
 * checked in with. Before this, employees had no way to check out at the kiosk
 * and their attendance never got an exit time.
 */
export default function ExitModal({ onClose }: ExitModalProps) {
  const { t } = useTranslation();
  const checkOut = useKioskStore(s => s.checkOut);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<Mode>('code');
  const [form] = Form.useForm();

  const handleSubmit = async (values: { visitCode?: string; idNumber?: string }) => {
    let request: CheckOutRequest;
    if (mode === 'code') {
      const code = (values.visitCode ?? '').trim().padStart(4, '0');
      if (!/^\d{4}$/.test(code)) {
        message.error(t('visitor.validation.visitCodeFormat'));
        return;
      }
      request = { visitCode: code };
    } else {
      const idNumber = values.idNumber ?? '';
      // One number, as at check-in: the type follows from its shape.
      request = { idType: inferIdentityType(idNumber), idNumber };
    }

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
    if (result.error === 'no_active_visit') {
      message.error(mode === 'code' ? t('visitor.exitError') : t('visitor.exitErrorEmployee'));
    } else {
      message.error(t(kioskErrorKey(result.error)));
    }
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
        <Form.Item label={t('visitor.checkOutWith')}>
          <Segmented<Mode>
            block
            size="large"
            value={mode}
            onChange={(next) => {
              setMode(next);
              form.resetFields();
            }}
            options={[
              { value: 'code', label: t('visitor.checkOutByCode'), icon: <NumberOutlined /> },
              { value: 'employee', label: t('visitor.checkOutByEmployeeId'), icon: <IdcardOutlined /> },
            ]}
          />
        </Form.Item>

        {mode === 'code' ? (
          <Form.Item
            label={t('visitor.checkOutCodeHint')}
            name="visitCode"
            rules={[
              { required: true, message: t('common.required') },
              { pattern: /^\d{1,4}$/, message: t('visitor.validation.visitCodeFormat') },
            ]}
          >
            <Input
              className="kiosk-code-input"
              inputMode="numeric"
              type="tel"
              placeholder="0001"
              maxLength={4}
              autoFocus
              onKeyDown={(e) => {
                if (!/^[0-9]$/.test(e.key) && !DIGIT_KEYS.includes(e.key)) e.preventDefault();
              }}
            />
          </Form.Item>
        ) : (
          <Form.Item
            label={t('visitor.checkOutEmployeeHint')}
            name="idNumber"
            rules={[
              {
                validator: (_, value: string | undefined) => {
                  if (!value?.trim()) return Promise.reject(new Error(t('common.required')));
                  return parseIdentityNumber(inferIdentityType(value), value).ok
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('visitor.errors.invalid_identity')));
                },
              },
            ]}
          >
            <Input
              size="large"
              autoFocus
              autoComplete="off"
              maxLength={20}
              placeholder={t('visitor.employeeIdNumberPlaceholder')}
              prefix={<IdcardOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
            />
          </Form.Item>
        )}

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
