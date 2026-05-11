import { useEffect, useRef, useState } from 'react';
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
  Checkbox,
  Modal,
  message,
} from 'antd';
import {
  UserOutlined,
  HomeOutlined,
  EditOutlined,
  ArrowLeftOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import type { InputRef, RefSelectProps } from 'antd';
import SignatureCanvas from 'react-signature-canvas';
import { useVisitorStore } from '../../store/visitorStore';
import { useCompanyStore } from '../../store/companyStore';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import { countries } from '../../utils/countryData';
import VisitorIdCard from './VisitorIdCard';
import FloorGrid from './FloorGrid';
import type { EnterFormData, NationalityType, VisitorType } from '../../types';

const { Title, Text, Paragraph } = Typography;

const DRAFT_KEY = 'vms-visitor-draft';
const DRAFT_TTL_MS = 10_000;

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
  const [visitorType, setVisitorType] = useState<VisitorType | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const { addVisitor } = useVisitorStore();
  const { companies } = useCompanyStore();
  const { floors } = useFloorStore();

  // Refs for keyboard navigation
  const visitorTypeRef = useRef<RefSelectProps>(null);
  const companyRef = useRef<RefSelectProps>(null);
  const empPhoneRef = useRef<InputRef>(null);
  const empNumberRef = useRef<InputRef>(null);
  const nameRef = useRef<InputRef>(null);
  const phoneRef = useRef<InputRef>(null);
  const idTypeRef = useRef<RefSelectProps>(null);
  const idNumberRef = useRef<InputRef>(null);
  const countryRef = useRef<RefSelectProps>(null);

  // ─── Draft recovery on mount ───
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const { values, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp < DRAFT_TTL_MS) {
        form.setFieldsValue(values);
        if (values.visitorType) setVisitorType(values.visitorType);
        if (values.nationalityType) setNationalityType(values.nationalityType);
        if (values.floor) setSelectedFloor(values.floor);
        message.success(t('visitor.draftRestored'));
      } else {
        sessionStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  }, [form, t]);

  // Save draft on every value change
  const handleValuesChange = (_: any, all: any) => {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ values: all, timestamp: Date.now() })
      );
    } catch {
      // sessionStorage full / disabled — ignore
    }
  };

  const nationalityLabels: Record<NationalityType, string> = {
    national_id: language === 'ar' ? 'الهوية الوطنية' : 'National ID',
    iqama: language === 'ar' ? 'الإقامة' : 'Iqama',
    passport: language === 'ar' ? 'جواز السفر' : 'Passport',
  };

  const countryOptions = countries.map(c => ({
    value: c.value,
    label: `${c.flag} ${language === 'ar' ? c.labelAr : c.label}`,
    searchText: `${c.label} ${c.labelAr}`.toLowerCase(),
  }));

  const visitorTypeOptions = [
    { value: 'visitor', label: t('visitor.visitor') },
    { value: 'employee', label: t('visitor.employee') },
  ];

  const companyOptions = companies.map(c => ({
    value: c.id,
    label: language === 'ar' ? c.nameAr : c.name,
    searchText: `${c.name} ${c.nameAr}`.toLowerCase(),
  }));

  // Dynamic ID rules
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
        { pattern: /^[A-Za-z0-9]+$/, message: t('visitor.validation.passportFormat') },
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

  const idInputMode: 'numeric' | 'text' =
    nationalityType === 'passport' ? 'text' : 'numeric';

  // Lookup employee by phone + employee number across all companies
  const findEmployee = (phone: string, employeeNumber: string) => {
    for (const c of companies) {
      const found = c.employees.find(
        e => e.phone === phone && e.employeeNumber === employeeNumber
      );
      if (found) return { employee: found, company: c };
    }
    return null;
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
    if (!values.agreedToTerms) {
      message.error(t('visitor.validation.termsRequired'));
      return;
    }

    let data: EnterFormData;

    if (values.visitorType === 'employee') {
      const match = findEmployee(values.phone, values.employeeNumber);
      if (!match) {
        message.error(t('visitor.validation.employeeNotFound'));
        return;
      }
      const signatureDataUrl = sigCanvasRef.current.toDataURL();
      data = {
        name: match.employee.name,
        phone: match.employee.phone,
        nationalityType: 'national_id',
        nationalityIdNumber: match.employee.employeeNumber,
        countryCode: 'SA',
        visitorType: 'employee',
        visitedCompanyId: values.visitedCompanyId,
        floor: selectedFloor,
        signatureDataUrl,
      };
    } else {
      const signatureDataUrl = sigCanvasRef.current.toDataURL();
      data = {
        name: values.name,
        phone: values.phone,
        nationalityType: values.nationalityType,
        nationalityIdNumber: values.nationalityIdNumber,
        countryCode: values.countryCode,
        visitorType: 'visitor',
        visitedCompanyId: values.visitedCompanyId,
        floor: selectedFloor,
        signatureDataUrl,
      };
    }

    const id = addVisitor(data);
    sessionStorage.removeItem(DRAFT_KEY);
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
        {/* Header */}
        <Card style={{ marginBottom: 16 }} styles={{ body: { padding: 24 } }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <div>
              <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
                تسجيل دخول زائر
              </Title>
              <Text type="secondary" style={{ fontSize: 16 }}>
                {t('visitor.enterTitle')}
              </Text>
            </div>
            <Button icon={<ArrowLeftOutlined />} size="large" onClick={onClose}>
              {t('common.back')}
            </Button>
          </Space>
          <Divider style={{ margin: '16px 0 0' }} />
        </Card>

        <Form
          form={form}
          layout="vertical"
          onFinish={onSubmit}
          onValuesChange={handleValuesChange}
          requiredMark={true}
          scrollToFirstError
          className="enter-form-large"
        >
          {/* ─── Visit Information (now FIRST) ─── */}
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
                    ref={visitorTypeRef}
                    size="large"
                    classNames={{ popup: { root: 'enter-form-dropdown' } }}
                    placeholder={t('visitor.validation.selectType')}
                    options={visitorTypeOptions}
                    onChange={(val: VisitorType) => {
                      setVisitorType(val);
                      // Clear personal info on switch
                      form.setFieldsValue({
                        name: undefined,
                        phone: undefined,
                        nationalityType: undefined,
                        nationalityIdNumber: undefined,
                        countryCode: undefined,
                        employeeNumber: undefined,
                      });
                      setNationalityType(null);
                      setTimeout(() => companyRef.current?.focus(), 0);
                    }}
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
                    ref={companyRef}
                    size="large"
                    showSearch
                    classNames={{ popup: { root: 'enter-form-dropdown' } }}
                    placeholder={t('visitor.validation.selectType')}
                    options={companyOptions}
                    filterOption={(input, option) =>
                      ((option as any)?.searchText ?? '').includes(input.toLowerCase())
                    }
                    onChange={(companyId: string) => {
                      const company = companies.find(c => c.id === companyId);
                      if (company) {
                        setSelectedFloor(company.floor);
                      }
                    }}
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

          {/* ─── Personal Information (conditional on visitorType) ─── */}
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
            {visitorType === 'employee' ? (
              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={t('visitor.employeePhone')}
                    name="phone"
                    rules={[
                      { required: true, message: t('common.required') },
                      { pattern: /^05\d{8}$/, message: t('visitor.validation.phoneFormat') },
                    ]}
                  >
                    <Input
                      ref={empPhoneRef}
                      size="large"
                      type="tel"
                      inputMode="numeric"
                      placeholder="0501234567"
                      maxLength={10}
                      onPressEnter={(e) => {
                        e.preventDefault();
                        empNumberRef.current?.focus();
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={t('visitor.employeeNumber')}
                    name="employeeNumber"
                    rules={[
                      { required: true, message: t('common.required') },
                      { pattern: /^\d{4}$/, message: 'Format: 4-digit number (e.g. 0001)' },
                    ]}
                  >
                    <Input
                      ref={empNumberRef}
                      size="large"
                      type="tel"
                      inputMode="numeric"
                      placeholder={t('visitor.employeeNumberPlaceholder')}
                      maxLength={4}
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
                </Col>
              </Row>
            ) : (
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
                    <Input
                      ref={nameRef}
                      size="large"
                      placeholder={t('visitor.namePlaceholder')}
                      onPressEnter={(e) => {
                        e.preventDefault();
                        phoneRef.current?.focus();
                      }}
                    />
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
                    <Input
                      ref={phoneRef}
                      size="large"
                      type="tel"
                      inputMode="numeric"
                      placeholder="0501234567"
                      maxLength={10}
                      onPressEnter={(e) => {
                        e.preventDefault();
                        idTypeRef.current?.focus();
                      }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={t('visitor.nationalityType')}
                    name="nationalityType"
                    rules={[{ required: true, message: t('common.required') }]}
                  >
                    <Select
                      ref={idTypeRef}
                      size="large"
                      classNames={{ popup: { root: 'enter-form-dropdown' } }}
                      placeholder={t('visitor.validation.selectType')}
                      options={[
                        { value: 'national_id', label: nationalityLabels.national_id },
                        { value: 'iqama', label: nationalityLabels.iqama },
                        { value: 'passport', label: nationalityLabels.passport },
                      ]}
                      onChange={(val: NationalityType) => {
                        setNationalityType(val);
                        form.setFieldValue('nationalityIdNumber', '');
                        // Auto-select Saudi Arabia when National ID is chosen
                        if (val === 'national_id') {
                          form.setFieldValue('countryCode', 'SA');
                        }
                        form.validateFields(['nationalityIdNumber']);
                        setTimeout(() => idNumberRef.current?.focus(), 0);
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
                      ref={idNumberRef}
                      size="large"
                      placeholder={idPlaceholder()}
                      disabled={!nationalityType}
                      inputMode={idInputMode}
                      type={nationalityType === 'passport' ? 'text' : 'tel'}
                      maxLength={nationalityType === 'passport' ? 20 : 10}
                      onPressEnter={(e) => {
                        e.preventDefault();
                        countryRef.current?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (
                          (nationalityType === 'national_id' || nationalityType === 'iqama') &&
                          !/^[0-9]$/.test(e.key) &&
                          ![
                            'Backspace',
                            'Delete',
                            'ArrowLeft',
                            'ArrowRight',
                            'Tab',
                            'Home',
                            'End',
                            'Enter',
                          ].includes(e.key)
                        ) {
                          e.preventDefault();
                        }
                      }}
                      prefix={<IdcardOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
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
                      ref={countryRef}
                      size="large"
                      showSearch
                      classNames={{ popup: { root: 'enter-form-dropdown' } }}
                      placeholder={t('visitor.countryPlaceholder')}
                      options={countryOptions}
                      filterOption={(input, option) =>
                        ((option as any)?.searchText ?? '').includes(input.toLowerCase())
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>
            )}

            {!visitorType && (
              <Text type="secondary">{t('visitor.validation.selectType')}</Text>
            )}
          </Card>

          {/* ─── Signature ─── */}
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
                  style: { width: '100%', height: 200, cursor: 'crosshair' },
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

          {/* ─── Terms + Submit ─── */}
          <Card styles={{ body: { padding: 16 } }}>
            <Form.Item
              name="agreedToTerms"
              valuePropName="checked"
              rules={[
                {
                  validator: (_, value) =>
                    value
                      ? Promise.resolve()
                      : Promise.reject(new Error(t('visitor.validation.termsRequired'))),
                },
              ]}
              style={{ marginBottom: 16 }}
            >
              <Checkbox className="terms-box" style={{ width: '100%', borderColor: "#000" }}>
                <span style={{ fontWeight: 500 }}>
                  {t('visitor.agreeToTerms')}{' '}
                  <Button
                    type="link"
                    size="small"
                    style={{
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTermsModalOpen(true);
                    }}

                  >
                    ({t('visitor.termsTitle')})
                  </Button>
                </span>
              </Checkbox>
            </Form.Item>

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

      <Modal
        open={termsModalOpen}
        title={t('visitor.termsTitle')}
        onCancel={() => setTermsModalOpen(false)}
        onOk={() => setTermsModalOpen(false)}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText={t('common.done')}
        centered
      >
        <Paragraph>{t('visitor.termsContent')}</Paragraph>
      </Modal>
    </div>
  );
}
