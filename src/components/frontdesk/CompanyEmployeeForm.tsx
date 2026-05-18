import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Button,
  Space,
  DatePicker,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { useCompanyStore } from '../../store/companyStore';
import { useUIStore } from '../../store/uiStore';
import { countries } from '../../utils/countryData';
import { generateEmployeeNumber } from '../../utils/idGenerator';
import type { Employee, NationalityType } from '../../types';

interface Props {
  companyId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Front-desk employee creation modal. Always inserts the employee with
 * verificationStatus='pending' so the admin can later approve.
 */
export default function CompanyEmployeeForm({ companyId, open, onClose }: Props) {
  const { t } = useTranslation();
  const { language } = useUIStore();
  const { companies, addEmployee } = useCompanyStore();
  const [form] = Form.useForm();
  const [nationalityType, setNationalityType] = useState<NationalityType | null>(null);

  const nextNumber = generateEmployeeNumber(
    companies.flatMap(c => c.employees.map(e => e.employeeNumber))
  );

  const idRules = () => {
    if (nationalityType === 'national_id')
      return [{ required: true }, { pattern: /^1\d{9}$/, message: t('visitor.validation.nationalIdFormat') }];
    if (nationalityType === 'iqama')
      return [{ required: true }, { pattern: /^[02-9]\d{9}$/, message: t('visitor.validation.iqamaFormat') }];
    if (nationalityType === 'passport')
      return [{ required: true }, { pattern: /^[A-Za-z0-9]+$/ }, { min: 5 }];
    return [{ required: true }];
  };

  const onFinish = (values: any) => {
    const data: Omit<Employee, 'id'> = {
      employeeNumber: values.employeeNumber,
      name: values.name,
      nameAr: values.nameAr,
      phone: values.phone,
      email: values.email,
      nationalityType: values.nationalityType,
      nationalityIdNumber: values.nationalityIdNumber,
      countryCode: values.countryCode,
      gender: values.gender,
      employmentStatus: values.employmentStatus ?? 'active',
      jobType: values.jobType,
      department: values.department,
      position: values.position,
      hireDate: values.hireDate ? dayjs(values.hireDate).format('YYYY-MM-DD') : undefined,
      verificationStatus: 'pending', // ← front-desk additions await admin verification
    };
    addEmployee(companyId, data);
    message.success(t('admin.pending'));
    form.resetFields();
    setNationalityType(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={t('admin.addEmployee')}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnClose
      width={760}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ employeeNumber: nextNumber, countryCode: 'SA', employmentStatus: 'active', jobType: 'full_time' }}
        onFinish={onFinish}
        requiredMark
        style={{ marginTop: 16 }}
      >
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label={t('visitor.employeeNumber')} name="employeeNumber" rules={[{ required: true }, { pattern: /^\d{4}$/ }]}>
              <Input size="large" maxLength={4} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label={t('employee.nameEn')} name="name" rules={[{ required: true }]}>
              <Input size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label={t('employee.nameAr')} name="nameAr" rules={[{ required: true }]}>
              <Input size="large" />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item label={t('table.phone')} name="phone" rules={[{ required: true }, { pattern: /^05\d{8}$/ }]}>
              <Input size="large" inputMode="numeric" maxLength={10} placeholder="0501234567" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label={t('employee.email')} name="email" rules={[{ type: 'email' }]}>
              <Input size="large" type="email" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label={t('company.gender')} name="gender" rules={[{ required: true }]}>
              <Select
                size="large"
                options={[
                  { value: 'male', label: t('company.male') },
                  { value: 'female', label: t('company.female') },
                ]}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item label={t('visitor.nationalityType')} name="nationalityType" rules={[{ required: true }]}>
              <Select
                size="large"
                onChange={(v: NationalityType) => {
                  setNationalityType(v);
                  form.setFieldValue('nationalityIdNumber', '');
                  if (v === 'national_id') form.setFieldValue('countryCode', 'SA');
                }}
                options={[
                  { value: 'national_id', label: language === 'ar' ? 'الهوية الوطنية' : 'National ID' },
                  { value: 'iqama', label: language === 'ar' ? 'الإقامة' : 'Iqama' },
                  { value: 'passport', label: language === 'ar' ? 'جواز السفر' : 'Passport' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label={t('visitor.nationalityId')} name="nationalityIdNumber" rules={idRules()} dependencies={['nationalityType']}>
              <Input
                size="large"
                disabled={!nationalityType}
                maxLength={nationalityType === 'passport' ? 20 : 10}
                inputMode={nationalityType === 'passport' ? 'text' : 'numeric'}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label={t('visitor.country')} name="countryCode" rules={[{ required: true }]}>
              <Select
                size="large"
                showSearch
                options={countries.map(c => ({
                  value: c.value,
                  label: `${c.flag} ${language === 'ar' ? c.labelAr : c.label}`,
                }))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
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
          <Col xs={24} md={8}>
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
          <Col xs={24} md={8}>
            <Form.Item label={t('employee.hireDate')} name="hireDate">
              <DatePicker size="large" style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="primary" htmlType="submit">{t('common.save')}</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
