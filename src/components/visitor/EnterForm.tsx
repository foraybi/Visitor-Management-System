import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  Divider,
  Typography,
  Row,
  Col,
  Card,
  message,
} from 'antd';
import { UserOutlined, HomeOutlined, EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import SignatureCanvas from 'react-signature-canvas';
import { useVisitorStore } from '../../store/visitorStore';
import { useCompanyStore } from '../../store/companyStore';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import { countries } from '../../utils/countryData';
import VisitorIdCard from './VisitorIdCard';
import FloorGrid from './FloorGrid';
import type { EnterFormData, NationalityType } from '../../types';

const { Title, Text } = Typography;

interface EnterFormProps {
  onClose: () => void;
}

export default function EnterForm({ onClose }: EnterFormProps) {
  const { t } = useTranslation();
  const { language } = useUIStore();
  const [form] = Form.useForm();
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [generatedId, setGeneratedId] = useState('');
  const [nationalityType, setNationalityType] = useState<NationalityType | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const { addVisitor } = useVisitorStore();
  const { companies } = useCompanyStore();
  const { floors } = useFloorStore();

  const nationalityOptions = [
    { value: 'national_id', label: t('visitor.nationalityType') + ' - National ID' },
    { value: 'iqama', label: 'Iqama' },
    { value: 'passport', label: 'Passport' },
  ];

  const nationalityLabels: Record<NationalityType, string> = {
    national_id: language === 'ar' ? 'الهوية الوطنية' : 'National ID',
    iqama: language === 'ar' ? 'الإقامة' : 'Iqama',
    passport: language === 'ar' ? 'جواز السفر' : 'Passport',
  };

  const countryOptions = countries.map(c => ({
    value: c.value,
    label: `${c.flag} ${language === 'ar' ? c.labelAr : c.label}`,
  }));

  const visitorTypeOptions = [
    { value: 'visitor', label: t('visitor.visitor') },
    { value: 'employee', label: t('visitor.employee') },
  ];

  const companyOptions = companies.map(c => ({
    value: c.id,
    label: language === 'ar' ? c.nameAr : c.name,
  }));

  // Dynamic validation based on ID type
  const idNumberRules = () => {
    if (nationalityType === 'national_id') {
      return [
        { required: true, message: t('common.required') },
        { pattern: /^1\d{9}$/, message: t('visitor.validation.nationalIdFormat') },
      ];
    }
    if (nationalityType === 'iqama') {
      return [
        { required: true, message: t('common.required') },
        { pattern: /^[02-9]\d{9}$/, message: t('visitor.validation.iqamaFormat') },
      ];
    }
    if (nationalityType === 'passport') {
      return [
        { required: true, message: t('common.required') },
        {
          pattern: /^[A-Za-z0-9]+$/,
          message: t('visitor.validation.passportFormat'),
        },
        { min: 5, message: t('visitor.validation.passportMin') },
      ];
    }
    return [{ required: true, message: t('common.required') }];
  };

  const idPlaceholder = () => {
    if (nationalityType === 'national_id') return '1XXXXXXXXX';
    if (nationalityType === 'iqama') return '2XXXXXXXXX';
    if (nationalityType === 'passport') return 'A1234567';
    return '';
  };

  const onSubmit = (values: any) => {
    if (!selectedFloor) {
      message.error(t('visitor.validation.floorRequired'));
      return;
    }
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      message.error(t('visitor.validation.signatureRequired'));
      return;
    }

    const signatureDataUrl = sigCanvasRef.current.toDataURL();
    const data: EnterFormData = {
      ...values,
      floor: selectedFloor,
      signatureDataUrl,
    };

    const id = addVisitor(data);
    setGeneratedId(id);
  };

  if (generatedId) {
    return <VisitorIdCard visitorId={generatedId} onClose={onClose} />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '24px 16px',
        background: '#ffffff',
      }}
      className="floating-orbs"
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header: Logo + Form Name + Line */}
        <Card
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: 24 } }}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <div>
              <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
                VMS
              </Title>
              <Text type="secondary" style={{ fontSize: 16 }}>
                {t('visitor.enterTitle')}
              </Text>
            </div>
            <Button
              icon={<ArrowLeftOutlined />}
              size="large"
              onClick={onClose}
            >
              {t('common.back')}
            </Button>
          </Space>
          <Divider style={{ margin: '16px 0 0' }} />
        </Card>

        <Form
          form={form}
          layout="vertical"
          onFinish={onSubmit}
          requiredMark={false}
          scrollToFirstError
        >
          {/* ─── Personal Information Section ─── */}
          <Card
            style={{ marginBottom: 16 }}
            title={
              <Space>
                <UserOutlined style={{ color: 'rgb(0, 114, 151)', fontSize: 20 }} />
                <Title level={4} style={{ margin: 0, color: 'rgb(0, 114, 151)' }}>
                  {t('visitor.personalInfo')}
                </Title>
              </Space>
            }
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={t('visitor.name')}
                  name="name"
                  rules={[
                    { required: true, message: t('common.required') },
                    { min: 2, message: t('visitor.validation.nameMin') },
                  ]}
                >
                  <Input size="large" placeholder={t('visitor.namePlaceholder')} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label={t('visitor.phone')}
                  name="phone"
                  rules={[
                    { required: true, message: t('common.required') },
                    { pattern: /^05\d{8}$/, message: t('visitor.validation.phoneFormat') },
                  ]}
                >
                  <Input size="large" placeholder="0501234567" maxLength={10} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label={t('visitor.nationalityType')}
                  name="nationalityType"
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Select
                    size="large"
                    placeholder={t('visitor.validation.selectType')}
                    options={[
                      { value: 'national_id', label: nationalityLabels.national_id },
                      { value: 'iqama', label: nationalityLabels.iqama },
                      { value: 'passport', label: nationalityLabels.passport },
                    ]}
                    onChange={(val: NationalityType) => {
                      setNationalityType(val);
                      form.setFieldValue('nationalityIdNumber', '');
                      form.validateFields(['nationalityIdNumber']);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label={t('visitor.nationalityId')}
                  name="nationalityIdNumber"
                  dependencies={['nationalityType']}
                  rules={idNumberRules()}
                >
                  <Input
                    size="large"
                    placeholder={idPlaceholder()}
                    disabled={!nationalityType}
                    maxLength={nationalityType === 'passport' ? 20 : 10}
                    onKeyDown={(e) => {
                      // Block non-digit keys for ID/Iqama
                      if (
                        (nationalityType === 'national_id' || nationalityType === 'iqama') &&
                        !/^[0-9]$/.test(e.key) &&
                        !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(e.key)
                      ) {
                        e.preventDefault();
                      }
                    }}
                  />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item
                  label={t('visitor.country')}
                  name="countryCode"
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Select
                    size="large"
                    showSearch
                    placeholder={t('visitor.countryPlaceholder')}
                    options={countryOptions}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* ─── Visit Information Section ─── */}
          <Card
            style={{ marginBottom: 16 }}
            title={
              <Space>
                <HomeOutlined style={{ color: 'rgb(0, 114, 151)', fontSize: 20 }} />
                <Title level={4} style={{ margin: 0, color: 'rgb(0, 114, 151)' }}>
                  {t('visitor.visitInfo')}
                </Title>
              </Space>
            }
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={t('visitor.visitorType')}
                  name="visitorType"
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Select
                    size="large"
                    placeholder={t('visitor.validation.selectType')}
                    options={visitorTypeOptions}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label={t('visitor.company')}
                  name="visitedCompanyId"
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Select
                    size="large"
                    showSearch
                    placeholder={t('visitor.validation.selectType')}
                    options={companyOptions}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item label={t('visitor.floor')} required>
                  <FloorGrid
                    value={selectedFloor}
                    onChange={setSelectedFloor}
                    floors={floors}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* ─── Signature Section ─── */}
          <Card
            style={{ marginBottom: 16 }}
            title={
              <Space>
                <EditOutlined style={{ color: 'rgb(0, 114, 151)', fontSize: 20 }} />
                <Title level={4} style={{ margin: 0, color: 'rgb(0, 114, 151)' }}>
                  {t('visitor.signatureSection')}
                </Title>
              </Space>
            }
          >
            <div
              style={{
                border: '2px dashed rgba(0, 114, 151, 0.3)',
                borderRadius: 12,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.9)',
              }}
            >
              <SignatureCanvas
                ref={sigCanvasRef}
                canvasProps={{
                  style: {
                    width: '100%',
                    height: 200,
                    cursor: 'crosshair',
                  },
                }}
              />
            </div>
            <Button
              onClick={() => sigCanvasRef.current?.clear()}
              style={{ marginTop: 12 }}
            >
              {t('visitor.signatureClear')}
            </Button>
          </Card>

          {/* Submit */}
          <Card styles={{ body: { padding: 16 } }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }} size="middle">
              <Button size="large" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" size="large" htmlType="submit">
                {t('common.submit')}
              </Button>
            </Space>
          </Card>
        </Form>
      </div>
    </div>
  );
}
