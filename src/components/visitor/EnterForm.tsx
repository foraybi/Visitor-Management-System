import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Form,
  Input,
  Select,
  Radio,
  Button,
  Space,
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
import { useUIStore } from '../../store/uiStore';
import {
  kioskErrorKey,
  useKioskFieldVisible,
  useKioskStore,
} from '../../app/kiosk/kioskStore';
import {
  identityLabelKey,
  inferIdentityType,
  parseIdentityNumber,
} from '../../domain/identity/identity';
import { countries } from '../../utils/countryData';
import VisitorIdCard from './VisitorIdCard';
import EmployeeWelcomeCard from './EmployeeWelcomeCard';
import FloorGrid from './FloorGrid';
import type { NationalityType, VisitorType } from '../../types';

const { Title, Text, Paragraph } = Typography;


interface EnterFormProps {
  onClose: () => void;
}

/** The fields the check-in form collects. Optional where the form branches. */
interface CheckInFormValues {
  visitorType: 'visitor' | 'employee';
  visitedCompanyId: string;
  nationalityType: NationalityType;
  nationalityIdNumber: string;
  name?: string;
  phone?: string;
  email?: string;
  countryCode?: string;
  employeeNumber?: string;
  agreedToTerms?: boolean;
}

/**
 * Match against the searchText we attach to each option so a company or country
 * is findable by either its Arabic or its English name.
 */
function filterBySearchText(input: string, option?: { searchText?: string }): boolean {
  return (option?.searchText ?? '').includes(input.toLowerCase());
}

export default function EnterForm({ onClose }: EnterFormProps) {
  const { t } = useTranslation();
  const { language } = useUIStore();
  const [form] = Form.useForm();
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [generatedId, setGeneratedId] = useState('');
  const [employeeWelcome, setEmployeeWelcome] = useState<{
    name: string;
    number: string;
  } | null>(null);
  const [nationalityType, setNationalityType] = useState<NationalityType | null>(null);
  const [visitorType, setVisitorType] = useState<VisitorType | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  // The tablet holds no database credentials. Everything it needs comes from
  // /api/kiosk/*, which returns a company picker and nothing else. The previous
  // version loaded every employee record onto the device so it could scan them
  // in memory.
  const companies = useKioskStore(s => s.companies);
  const floors = useKioskStore(s => s.floors);
  const checkIn = useKioskStore(s => s.checkIn);
  const lookupEmployee = useKioskStore(s => s.lookupEmployee);
  const isFieldVisible = useKioskFieldVisible();
  const [submitting, setSubmitting] = useState(false);

  // Refs for keyboard navigation
  const companyRef = useRef<RefSelectProps>(null);
  const empPhoneRef = useRef<InputRef>(null);
  const empNumberRef = useRef<InputRef>(null);
  const nameRef = useRef<InputRef>(null);
  const phoneRef = useRef<InputRef>(null);
  const idNumberRef = useRef<InputRef>(null);
  const countryRef = useRef<RefSelectProps>(null);

  // ─── Draft recovery on mount ───
  // A kiosk form is never restored across sessions. The previous draft feature
  // wrote identity numbers to sessionStorage on every keystroke and replayed
  // them for whoever touched the tablet next, which leaked one visitor's
  // national id to the following visitor. The idle timeout clears the form
  // instead.

  const nationalityLabels: Record<NationalityType, string> = {
    national_id: t(identityLabelKey('national_id')),
    iqama: t(identityLabelKey('iqama')),
    passport: t(identityLabelKey('passport')),
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

  /**
   * Submit the check-in.
   *
   * Everything below the validation goes through the kiosk gateway, which
   * returns a result rather than throwing. A failed check-in therefore has no
   * visit code to render, so the visitor cannot be handed an id card for a
   * record that was never written. That is exactly what used to happen: the
   * insert was fired, its error logged to a console nobody was watching, and the
   * card shown regardless.
   */
  const onSubmit = async (values: CheckInFormValues) => {
    if (!selectedFloor) {
      message.error(t('visitor.validation.floorRequired'));
      return;
    }
    if (isFieldVisible('signature') && (!sigCanvasRef.current || sigCanvasRef.current.isEmpty())) {
      message.error(t('visitor.validation.signatureRequired'));
      return;
    }
    if (!values.agreedToTerms) {
      message.error(t('visitor.validation.termsRequired'));
      return;
    }

    const signatureDataUrl = sigCanvasRef.current?.toDataURL() ?? '';
    setSubmitting(true);

    try {
      if (values.visitorType === 'employee') {
        // The tablet no longer holds the employee directory, so recognition
        // happens server-side and returns one display name.
        // The employee screen asks for one number rather than a type and a
        // number, so the type comes from the number's shape. The lookup used to
        // send no type at all, and the server refused every employee check-in.
        const idType = inferIdentityType(values.nationalityIdNumber);
        const found = await lookupEmployee(idType, values.nationalityIdNumber);
        if (!found.ok) {
          message.error(t(kioskErrorKey(found.error)));
          return;
        }
        if (!found.value?.company) {
          message.error(t('visitor.employeeNotInSystem'));
          return;
        }

        const employee = found.value;
        const { company } = employee;
        if (!company) {
          message.error(t('visitor.employeeNotInSystem'));
          return;
        }

        const result = await checkIn({
          visitorType: 'employee',
          name: employee.name,
          phone: '',
          nationalityType: idType,
          nationalityIdNumber: values.nationalityIdNumber,
          countryCode: 'SA',
          countryName: '',
          visitedCompanyId: company.id,
          floor: company.floor,
          signatureDataUrl,
        });

        if (!result.ok) {
          message.error(t(kioskErrorKey(result.error)));
          return;
        }

        setEmployeeWelcome({
          name: language === 'ar' ? employee.nameAr : employee.name,
          number: employee.employeeNumber,
        });
        return;
      }

      // The form marks these required, but the values object cannot express
      // "required only on this branch". Check rather than defaulting, so a
      // validation gap surfaces as a message instead of an empty name in the
      // visitor log.
      const { name, phone, countryCode } = values;
      if (!name || !phone || !countryCode) {
        message.error(t('common.required'));
        return;
      }

      const country = countries.find(c => c.value === countryCode);

      const result = await checkIn({
        visitorType: 'visitor',
        name,
        phone,
        email: values.email,
        nationalityType: values.nationalityType,
        nationalityIdNumber: values.nationalityIdNumber,
        countryCode,
        countryName: country ? country.label : '',
        visitedCompanyId: values.visitedCompanyId,
        floor: selectedFloor,
        signatureDataUrl,
      });

      if (!result.ok) {
        message.error(t(kioskErrorKey(result.error)));
        return;
      }

      setGeneratedId(result.value.visitCode);
    } finally {
      setSubmitting(false);
    }
  };

  if (employeeWelcome) {
    return (
      <EmployeeWelcomeCard
        employeeName={employeeWelcome.name}
        employeeNumber={employeeWelcome.number}
        onClose={onClose}
      />
    );
  }

  if (generatedId) {
    return <VisitorIdCard visitorId={generatedId} onClose={onClose} />;
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        padding: 'clamp(12px, 2.5vw, 28px) clamp(12px, 2.5vw, 28px) 24px',
        background: '#ffffff',
      }}
      className="floating-orbs"
      // A tablet's on-screen keyboard covers the lower half of the screen. Bring
      // the field being typed into to the middle once the keyboard has opened.
      onFocusCapture={(e) => {
        const field = e.target as HTMLElement;
        if (field.matches('input, textarea')) {
          window.setTimeout(() => field.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
        }
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* Header */}
        <Card style={{ marginBottom: 12 }} styles={{ body: { padding: 'clamp(10px, 2vh, 20px) clamp(14px, 2vw, 24px)' } }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <div>
              <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0, fontSize: 'clamp(20px, min(2.6vw, 4vh), 30px)' }}>
                {t('visitor.checkInHeading')}
              </Title>
              <Text type="secondary" style={{ fontSize: 'clamp(13px, min(1.4vw, 2.2vh), 16px)' }}>
                {t('visitor.enterTitle')}
              </Text>
            </div>
            <Button icon={<ArrowLeftOutlined />} size="large" onClick={onClose}>
              {t('common.back')}
            </Button>
          </Space>
        </Card>

        <Form
          form={form}
          layout="vertical"
          onFinish={onSubmit}
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
              <Col xs={24} lg={12}>
                <Form.Item
                  label={t('visitor.visitorType')}
                  name="visitorType"
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Radio.Group
                    size="large"
                    optionType="button"
                    buttonStyle="solid"
                    options={visitorTypeOptions}
                    onChange={(e) => {
                      const val: VisitorType = e.target.value;
                      setVisitorType(val);
                      form.setFieldsValue({
                        name: undefined,
                        phone: undefined,
                        email: undefined,
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
              <Col xs={24} lg={12}>
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
                    filterOption={filterBySearchText}
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
                <Col xs={24}>
                  <Form.Item
                    label={t('visitor.employeeIdNumberLabel')}
                    name="nationalityIdNumber"
                    rules={[
                      {
                        // Validated with the same rules the server applies, so a
                        // typo is caught here instead of as a failed check-in.
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
                      ref={empPhoneRef}
                      size="large"
                      placeholder={t('visitor.employeeIdNumberPlaceholder')}
                      maxLength={20}
                      autoFocus
                      autoComplete="off"
                      prefix={<IdcardOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={t('visitor.employeePhoneOptional')}
                    name="phone"
                  >
                    <Input
                      size="large"
                      type="tel"
                      inputMode="numeric"
                      placeholder="0501234567"
                      maxLength={10}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={t('visitor.employeeNumberOptional')}
                    name="employeeNumber"
                  >
                    <Input
                      ref={empNumberRef}
                      size="large"
                      type="tel"
                      inputMode="numeric"
                      placeholder={t('visitor.employeeNumberPlaceholder')}
                      maxLength={4}
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
                        idNumberRef.current?.focus();
                      }}
                    />
                  </Form.Item>
                </Col>

                {isFieldVisible('email') && (
                  <Col xs={24} md={12}>
                    <Form.Item
                      label={t('visitor.email')}
                      name="email"
                      rules={[
                        { type: 'email', message: t('visitor.validation.emailFormat') },
                      ]}
                    >
                      <Input
                        size="large"
                        type="email"
                        inputMode="email"
                        placeholder={t('visitor.emailPlaceholder')}
                        autoComplete="email"
                      />
                    </Form.Item>
                  </Col>
                )}

                <Col xs={24} lg={12}>
                  <Form.Item
                    label={t('visitor.nationalityType')}
                    name="nationalityType"
                    rules={[{ required: true, message: t('common.required') }]}
                  >
                    <Radio.Group
                      size="large"
                      optionType="button"
                      buttonStyle="solid"
                      options={[
                        { value: 'national_id', label: nationalityLabels.national_id },
                        { value: 'iqama', label: nationalityLabels.iqama },
                        { value: 'passport', label: nationalityLabels.passport },
                      ]}
                      onChange={(e) => {
                        const val: NationalityType = e.target.value;
                        setNationalityType(val);
                        form.setFieldValue('nationalityIdNumber', '');
                        if (val === 'national_id') {
                          form.setFieldValue('countryCode', 'SA');
                        }
                        form.validateFields(['nationalityIdNumber']);
                        setTimeout(() => idNumberRef.current?.focus(), 0);
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
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
                      filterOption={filterBySearchText}
                    />
                  </Form.Item>
                </Col>
              </Row>
            )}

            {!visitorType && (
              <Text type="secondary">{t('visitor.validation.selectType')}</Text>
            )}
          </Card>

          {/* ─── Signature (only when enabled in form editor) ─── */}
          {isFieldVisible('signature') && (
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
          )}

          {/* ─── Terms + Submit ─── */}
          {/* Sticky, so the submit button is reachable without scrolling back
              down on a tablet held upright. */}
          <Card className="kiosk-submit-bar" styles={{ body: { padding: 16 } }}>
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
              <Button size="large" onClick={onClose} disabled={submitting}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" size="large" htmlType="submit" loading={submitting}>
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
