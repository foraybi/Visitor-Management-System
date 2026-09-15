import { useTranslation } from 'react-i18next';
import {
  Button,
  Col,
  Collapse,
  DatePicker,
  Drawer,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  message,
} from 'antd';
import dayjs from 'dayjs';
import type { EmployeeFormValues } from '../../types/forms';
import { can } from '../../domain/access/access';
import { capacityFor } from '../../domain/incubation/capacity';
import { identityLabelKey, inferIdentityType, parseIdentityNumber } from '../../domain/identity/identity';
import { useAuthStore } from '../../store/authStore';
import { useCompanyStore } from '../../store/companyStore';
import { useUIStore } from '../../store/uiStore';
import { countries } from '../../utils/countryData';
import { generateEmployeeNumber } from '../../utils/idGenerator';
import type { Employee, EmployeeType } from '../../types';

interface Props {
  companyId: string;
  open: boolean;
  onClose: () => void;
  /** Which list the person is added to. */
  employeeType: EmployeeType;
  /** Called instead of saving when the chosen list is already full. */
  onFull: (type: EmployeeType) => void;
}

/**
 * Add a founder or employee to a company, in a side panel.
 *
 * Kept to what is needed to recognise the person at the tablet: who they are,
 * one ID number whose type is read from its shape, and a mobile number. The
 * rest is folded under "More details".
 *
 * The chosen list is checked again on save, because another front desk screen
 * may have filled the last place while this form was open; the database
 * enforces the same limit. Front desk additions wait for an admin to verify
 * them; an admin's are verified straight away.
 */
export default function CompanyEmployeeForm({ companyId, open, onClose, employeeType, onFull }: Props) {
  const { t } = useTranslation();
  const language = useUIStore(s => s.language);
  const { companies, addEmployee } = useCompanyStore();
  const role = useAuthStore(s => s.currentRole);
  const isAdmin = can(role, 'companies.write');
  const [form] = Form.useForm();

  const company = companies.find(c => c.id === companyId);
  const idValue: string = Form.useWatch('nationalityIdNumber', form) ?? '';
  const detectedType = idValue.trim() ? inferIdentityType(idValue) : null;
  const detectedOk = detectedType ? parseIdentityNumber(detectedType, idValue).ok : false;

  const nextNumber = generateEmployeeNumber(companies.flatMap(c => c.employees.map(e => e.employeeNumber)));

  const typeOption = (type: EmployeeType) => {
    const capacity = company ? capacityFor(company, type) : null;
    const note =
      !capacity || capacity.limit === null
        ? t('incubation.noLimit')
        : capacity.full
          ? t('incubation.statusFull')
          : t('incubation.placesLeft', { count: capacity.remaining ?? 0 });
    return (
      <Radio.Button value={type} disabled={Boolean(capacity?.full) && !isAdmin} className="type-pick-option">
        <span className="type-pick-title">{type === 'founder' ? t('incubation.founder') : t('incubation.employee')}</span>
        <span className="type-pick-note">{note}</span>
      </Radio.Button>
    );
  };

  const onFinish = (values: EmployeeFormValues) => {
    const type: EmployeeType = values.employeeType ?? employeeType;
    if (company && capacityFor(company, type).full && !isAdmin) {
      onFull(type);
      return;
    }

    const nationalityType = inferIdentityType(values.nationalityIdNumber);
    const parsed = parseIdentityNumber(nationalityType, values.nationalityIdNumber);
    if (!parsed.ok) return;

    const data: Omit<Employee, 'id'> = {
      employeeNumber: values.employeeNumber,
      name: values.name,
      nameAr: values.nameAr,
      phone: values.phone,
      email: values.email,
      nationalityType,
      nationalityIdNumber: parsed.value,
      countryCode: nationalityType === 'national_id' ? 'SA' : values.countryCode,
      gender: values.gender,
      employmentStatus: values.employmentStatus ?? 'active',
      jobType: values.jobType,
      department: values.department,
      position: values.position,
      hireDate: values.hireDate ? dayjs(values.hireDate).format('YYYY-MM-DD') : undefined,
      verificationStatus: isAdmin ? 'verified' : 'pending',
      employeeType: type,
    };
    addEmployee(companyId, data);
    if (!isAdmin) message.success(t('employee.pending'));
    form.resetFields();
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnHidden
      placement={language === 'ar' ? 'left' : 'right'}
      size="min(560px, 100vw)"
      title={
        <div>
          <div>{employeeType === 'founder' ? t('incubation.addFounder') : t('incubation.addEmployee')}</div>
          {company && (
            <div className="drawer-subtitle">{language === 'ar' ? company.nameAr : company.name}</div>
          )}
        </div>
      }
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="primary" onClick={() => form.submit()}>{t('common.save')}</Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onFinish}
        initialValues={{
          employeeType,
          employeeNumber: nextNumber,
          countryCode: 'SA',
          employmentStatus: 'active',
          jobType: 'full_time',
        }}
        className="panel-form"
      >
        <section className="form-section">
          <div className="form-section-title">{t('incubation.whoSection')}</div>
          <Form.Item name="employeeType" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
            <Radio.Group className="type-pick">
              {typeOption('founder')}
              {typeOption('employee')}
            </Radio.Group>
          </Form.Item>
        </section>

        <section className="form-section">
          <div className="form-section-title">{t('incubation.identitySection')}</div>
          <Form.Item
            label={t('incubation.idLabel')}
            name="nationalityIdNumber"
            extra={
              detectedType && detectedOk ? (
                <span className="id-detected">{t('incubation.idDetected', { type: t(identityLabelKey(detectedType)) })}</span>
              ) : (
                t('incubation.idHint')
              )
            }
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
            <Input size="large" dir="ltr" autoComplete="off" maxLength={20} placeholder="1XXXXXXXXX" autoFocus />
          </Form.Item>

          {detectedType && detectedType !== 'national_id' && (
            <Form.Item label={t('visitor.country')} name="countryCode" rules={[{ required: true, message: t('common.required') }]}>
              <Select
                size="large"
                showSearch
                options={countries.map(c => ({ value: c.value, label: `${c.flag} ${language === 'ar' ? c.labelAr : c.label}` }))}
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          )}

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item label={t('employee.nameAr')} name="nameAr" rules={[{ required: true, message: t('common.required') }]}>
                <Input size="large" dir="rtl" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label={t('employee.nameEn')} name="name" rules={[{ required: true, message: t('common.required') }]}>
                <Input size="large" dir="ltr" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={t('table.phone')}
                name="phone"
                rules={[
                  { required: true, message: t('common.required') },
                  { pattern: /^05\d{8}$/, message: t('visitor.validation.phoneFormat') },
                ]}
              >
                <Input size="large" inputMode="numeric" maxLength={10} placeholder="05XXXXXXXX" dir="ltr" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label={t('company.gender')} name="gender" rules={[{ required: true, message: t('common.required') }]}>
                <Select
                  size="large"
                  options={[
                    { value: 'male', label: t('company.male') },
                    { value: 'female', label: t('company.female') },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </section>

        <Collapse
          className="form-more"
          items={[
            {
              key: 'more',
              label: t('incubation.moreDetails'),
              forceRender: true,
              children: (
                <Row gutter={12}>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('employee.email')} name="email" rules={[{ type: 'email', message: t('visitor.validation.emailFormat') }]}>
                      <Input size="large" type="email" dir="ltr" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('visitor.employeeNumber')} name="employeeNumber" rules={[{ required: true }, { pattern: /^\d{4}$/ }]}>
                      <Input size="large" maxLength={4} dir="ltr" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('employee.jobType')} name="jobType" rules={[{ required: true }]}>
                      <Select
                        size="large"
                        options={[
                          { value: 'full_time', label: t('employee.fullTime') },
                          { value: 'part_time', label: t('employee.partTime') },
                          { value: 'internship', label: t('employee.internship') },
                          { value: 'contract', label: t('employee.contract') },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('employee.employmentStatus')} name="employmentStatus">
                      <Select
                        size="large"
                        options={[
                          { value: 'active', label: t('employee.active') },
                          { value: 'inactive', label: t('employee.inactive') },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('employee.department')} name="department">
                      <Input size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('employee.position')} name="position">
                      <Input size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('employee.hireDate')} name="hireDate">
                      <DatePicker size="large" style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                  </Col>
                </Row>
              ),
            },
          ]}
        />
      </Form>
    </Drawer>
  );
}
