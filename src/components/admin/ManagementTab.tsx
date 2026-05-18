import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Table,
  Space,
  Popconfirm,
  Tabs,
  Typography,
  Tag,
  Row,
  Col,
  DatePicker,
  Upload,
  Image as AntImage,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ManOutlined,
  WomanOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import { useCompanyStore } from '../../store/companyStore';
import { useFloorStore } from '../../store/floorStore';
import { useVisitorStore } from '../../store/visitorStore';
import { useUIStore } from '../../store/uiStore';
import { generateEmployeeNumber } from '../../utils/idGenerator';
import { countries } from '../../utils/countryData';
import { formatTimeFromISO } from '../../utils/timeUtils';
import type { Company, Employee, NationalityType } from '../../types';

const { Title } = Typography;

export default function ManagementTab() {
  const { t } = useTranslation();
  const { language } = useUIStore();
  const {
    companies,
    addCompany,
    updateCompany,
    deleteCompany,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    verifyEmployee,
  } = useCompanyStore();
  const { floors } = useFloorStore();
  const visitors = useVisitorStore(state => state.visitors);

  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<{ employee: Employee; companyId: string } | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [empNationalityType, setEmpNationalityType] = useState<NationalityType | null>(null);
  const [companyForm] = Form.useForm();
  const [employeeForm] = Form.useForm();

  // ─── Company handlers ───
  const openAddCompany = () => {
    setEditingCompany(null);
    companyForm.resetFields();
    setCompanyModalOpen(true);
  };
  const openEditCompany = (company: Company) => {
    setEditingCompany(company);
    companyForm.setFieldsValue(company);
    setCompanyModalOpen(true);
  };
  const handleCompanySubmit = (values: any) => {
    if (editingCompany) {
      updateCompany(editingCompany.id, values);
    } else {
      addCompany({ ...values, employees: [], employeeCount: 0, logoUrl: '' });
    }
    setCompanyModalOpen(false);
    companyForm.resetFields();
  };

  // ─── Employee handlers ───
  const openAddEmployee = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setEditingEmployee(null);
    setPhotoDataUrl('');
    setEmpNationalityType(null);
    employeeForm.resetFields();
    const allNumbers = companies.flatMap(c => c.employees.map(e => e.employeeNumber));
    employeeForm.setFieldsValue({
      employeeNumber: generateEmployeeNumber(allNumbers),
      employmentStatus: 'active',
      jobType: 'full_time',
      countryCode: 'SA',
    });
    setEmployeeModalOpen(true);
  };

  const openEditEmployee = (employee: Employee, companyId: string) => {
    setEditingEmployee({ employee, companyId });
    setSelectedCompanyId(companyId);
    setPhotoDataUrl(employee.photoDataUrl ?? '');
    setEmpNationalityType(employee.nationalityType);
    employeeForm.setFieldsValue({
      ...employee,
      hireDate: employee.hireDate ? dayjs(employee.hireDate) : undefined,
    });
    setEmployeeModalOpen(true);
  };

  const handleEmployeeSubmit = (values: any) => {
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
      employmentStatus: values.employmentStatus,
      jobType: values.jobType,
      department: values.department,
      position: values.position,
      // Admin-added employees are auto-verified; edits preserve existing status
      verificationStatus: editingEmployee?.employee.verificationStatus ?? 'verified',
      hireDate: values.hireDate ? dayjs(values.hireDate).format('YYYY-MM-DD') : undefined,
      photoDataUrl,
      notes: values.notes,
    };
    if (editingEmployee) {
      updateEmployee(editingEmployee.companyId, editingEmployee.employee.id, data);
    } else if (selectedCompanyId) {
      addEmployee(selectedCompanyId, data);
    }
    setEmployeeModalOpen(false);
    employeeForm.resetFields();
    setPhotoDataUrl('');
    setEditingEmployee(null);
  };

  // ─── Derived: per-employee visit status ───
  // Match visitors of type 'employee' by nationalityIdNumber (which holds employeeNumber)
  const employeeVisitMap = useMemo(() => {
    const map = new Map<string, { lastVisit: string | null; lastEntry: string | null; lastExit: string | null; inside: boolean; everVisited: boolean }>();
    for (const v of visitors) {
      if (v.visitorType !== 'employee') continue;
      const key = v.nationalityIdNumber; // = employeeNumber
      const prev = map.get(key);
      const entry = v.entryTime;
      const exit = v.exitTime;
      if (!prev || (entry > (prev.lastEntry ?? ''))) {
        map.set(key, {
          lastVisit: v.date,
          lastEntry: entry,
          lastExit: exit,
          inside: v.status === 'active',
          everVisited: true,
        });
      }
    }
    return map;
  }, [visitors]);

  // ─── Tables ───
  const companyColumns: ColumnsType<Company> = [
    { title: t('company.name'), dataIndex: 'name', key: 'name' },
    { title: t('company.nameAr'), dataIndex: 'nameAr', key: 'nameAr' },
    {
      title: t('visitor.floor'),
      dataIndex: 'floor',
      key: 'floor',
      render: floor => <Tag color="cyan">{t('visitor.floor')} {floor}</Tag>,
    },
    { title: t('table.phone'), dataIndex: 'phone', key: 'phone' },
    {
      title: t('company.employeeCount'),
      key: 'count',
      render: (_, record) => <Tag>{record.employees.length}</Tag>,
    },
    {
      title: t('table.actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={() => openAddEmployee(record.id)}>
            {t('admin.addEmployee')}
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditCompany(record)}>
            {t('common.edit')}
          </Button>
          <Popconfirm title="Delete company?" onConfirm={() => deleteCompany(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const allEmployees = companies.flatMap(c =>
    c.employees.map(e => ({ ...e, companyName: c.name, companyNameAr: c.nameAr, companyId: c.id }))
  );

  type EmployeeRow = Employee & { companyName: string; companyNameAr: string; companyId: string };

  const employeeColumns: ColumnsType<EmployeeRow> = [
    {
      title: t('visitor.employeeNumber'),
      dataIndex: 'employeeNumber',
      key: 'employeeNumber',
      width: 90,
      render: num => <strong style={{ color: 'rgb(0, 114, 151)' }}>{num}</strong>,
    },
    {
      title: language === 'ar' ? t('employee.nameAr') : t('employee.nameEn'),
      key: 'name',
      width: 180,
      render: (_, r) => (language === 'ar' ? r.nameAr : r.name),
    },
    {
      title: 'Company',
      key: 'companyName',
      width: 140,
      render: (_, r) => (language === 'ar' ? r.companyNameAr : r.companyName),
    },
    {
      title: t('table.phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 110,
    },
    {
      title: t('visitor.nationalityType'),
      dataIndex: 'nationalityType',
      key: 'nationalityType',
      width: 110,
      render: (v: NationalityType) =>
        v === 'national_id' ? t('visitor.nationalityType') :
        v === 'iqama' ? 'Iqama' : 'Passport',
    },
    {
      title: t('table.idNumber'),
      dataIndex: 'nationalityIdNumber',
      key: 'nationalityIdNumber',
      width: 120,
      render: id => <span style={{ fontFamily: 'monospace' }}>{id}</span>,
    },
    {
      title: t('table.nationality'),
      dataIndex: 'countryCode',
      key: 'countryCode',
      width: 110,
      render: (code: string) => {
        const c = countries.find(x => x.value === code);
        if (!c) return code;
        return `${c.flag} ${language === 'ar' ? c.labelAr : c.label}`;
      },
    },
    {
      title: t('company.gender'),
      dataIndex: 'gender',
      key: 'gender',
      width: 90,
      render: gender => (
        <Tag
          icon={gender === 'male' ? <ManOutlined /> : <WomanOutlined />}
          color={gender === 'male' ? 'blue' : 'pink'}
        >
          {gender === 'male' ? t('company.male') : t('company.female')}
        </Tag>
      ),
    },
    {
      title: t('employee.employmentStatus'),
      dataIndex: 'employmentStatus',
      key: 'employmentStatus',
      width: 110,
      render: (s: string) => (
        <Tag color={s === 'active' ? 'green' : 'default'}>
          {s === 'active' ? t('employee.active') : t('employee.inactive')}
        </Tag>
      ),
    },
    {
      title: t('employee.jobType'),
      dataIndex: 'jobType',
      key: 'jobType',
      width: 110,
      render: (j: string) => {
        const map: Record<string, string> = {
          full_time: t('employee.fullTime'),
          part_time: t('employee.partTime'),
          internship: t('employee.internship'),
          contract: t('employee.contract'),
        };
        const colorMap: Record<string, string> = {
          full_time: 'blue',
          part_time: 'cyan',
          internship: 'gold',
          contract: 'purple',
        };
        return <Tag color={colorMap[j]}>{map[j] ?? j}</Tag>;
      },
    },
    {
      title: t('employee.visitStatus'),
      key: 'visitStatus',
      width: 140,
      render: (_, r) => {
        const v = employeeVisitMap.get(r.employeeNumber);
        if (!v || !v.everVisited)
          return <Tag color="default">{t('employee.neverVisited')}</Tag>;
        if (v.inside)
          return (
            <Tag color="success" style={{ borderRadius: 8 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'rgb(127,188,66)', marginInlineEnd: 6 }} />
              {t('employee.inside')}
            </Tag>
          );
        return <Tag color="default">{t('employee.outside')}</Tag>;
      },
    },
    {
      title: t('employee.lastVisit'),
      key: 'lastVisit',
      width: 130,
      render: (_, r) => {
        const v = employeeVisitMap.get(r.employeeNumber);
        if (!v?.lastVisit) return <span style={{ color: '#bfbfbf' }}>—</span>;
        return (
          <span style={{ fontSize: 11 }}>
            {v.lastVisit}
            <br />
            <span style={{ color: '#888' }}>
              {formatTimeFromISO(v.lastEntry)}{v.lastExit ? ` → ${formatTimeFromISO(v.lastExit)}` : ''}
            </span>
          </span>
        );
      },
    },
    {
      title: t('admin.verified'),
      dataIndex: 'verificationStatus',
      key: 'verificationStatus',
      width: 140,
      render: (s: string, record) =>
        s === 'verified' ? (
          <Tag color="success">{t('admin.verified')}</Tag>
        ) : (
          <Space size="small">
            <Tag color="warning">{t('admin.pending')}</Tag>
            <Button
              size="small"
              type="primary"
              onClick={() => verifyEmployee(record.companyId, record.id)}
            >
              {t('admin.verify')}
            </Button>
          </Space>
        ),
    },
    {
      title: t('table.actions'),
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditEmployee(record, record.companyId)}
          />
          <Popconfirm title="Delete employee?" onConfirm={() => deleteEmployee(record.companyId, record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ─── Photo upload ───
  const photoUploadProps: UploadProps = {
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => setPhotoDataUrl(e.target?.result as string);
      reader.readAsDataURL(file);
      return false;
    },
  };

  // ─── ID validation by type ───
  const idPlaceholder =
    empNationalityType === 'national_id' ? '1XXXXXXXXX' :
    empNationalityType === 'iqama' ? '2XXXXXXXXX' :
    empNationalityType === 'passport' ? 'A1234567' : '';

  const idRules = () => {
    if (empNationalityType === 'national_id')
      return [{ required: true }, { pattern: /^1\d{9}$/, message: t('visitor.validation.nationalIdFormat') }];
    if (empNationalityType === 'iqama')
      return [{ required: true }, { pattern: /^[02-9]\d{9}$/, message: t('visitor.validation.iqamaFormat') }];
    if (empNationalityType === 'passport')
      return [{ required: true }, { pattern: /^[A-Za-z0-9]+$/, message: t('visitor.validation.passportFormat') }, { min: 5 }];
    return [{ required: true }];
  };

  return (
    <>
      <Tabs
        defaultActiveKey="companies"
        items={[
          {
            key: 'companies',
            label: t('frontdesk.companies'),
            children: (
              <Card
                title={<Title level={4} style={{ margin: 0 }}>{t('frontdesk.companies')}</Title>}
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={openAddCompany}>
                    {t('company.addCompany')}
                  </Button>
                }
              >
                <Table columns={companyColumns} dataSource={companies} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 900 }} />
              </Card>
            ),
          },
          {
            key: 'employees',
            label: t('company.employees'),
            children: (
              <Card title={<Title level={4} style={{ margin: 0 }}>{t('company.employees')}</Title>}>
                <Table
                  columns={employeeColumns}
                  dataSource={allEmployees}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1500 }}
                  size="small"
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Company Modal */}
      <Modal
        open={companyModalOpen}
        title={editingCompany ? t('company.editCompany') : t('company.addCompany')}
        onCancel={() => setCompanyModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        <Form form={companyForm} layout="vertical" onFinish={handleCompanySubmit} requiredMark={false} style={{ marginTop: 16 }}>
          <Form.Item label={t('company.name')} name="name" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item label={t('company.nameAr')} name="nameAr" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item label={t('company.phone')} name="phone" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item label={t('visitor.floor')} name="floor" rules={[{ required: true }]}>
            <Select
              size="large"
              options={floors.slice().sort((a, b) => a.number - b.number).map(f => ({
                value: f.number,
                label: `${f.name} (${t('visitor.floor')} ${f.number})`,
              }))}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCompanyModalOpen(false)}>{t('common.cancel')}</Button>
              <Button type="primary" htmlType="submit">{t('common.save')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Employee Modal */}
      <Modal
        open={employeeModalOpen}
        title={editingEmployee ? t('admin.editEmployee') : t('admin.addEmployee')}
        onCancel={() => {
          setEmployeeModalOpen(false);
          setEditingEmployee(null);
          setPhotoDataUrl('');
        }}
        footer={null}
        centered
        destroyOnClose
        width={760}
      >
        <Form
          form={employeeForm}
          layout="vertical"
          onFinish={handleEmployeeSubmit}
          requiredMark={true}
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
                <Input size="large" placeholder="John Doe" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={t('employee.nameAr')} name="nameAr" rules={[{ required: true }]}>
                <Input size="large" placeholder="محمد أحمد" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label={t('table.phone')} name="phone" rules={[{ required: true }, { pattern: /^05\d{8}$/ }]}>
                <Input size="large" inputMode="numeric" maxLength={10} placeholder="0501234567" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={t('employee.email')} name="email" rules={[{ type: 'email' }]}>
                <Input size="large" type="email" placeholder="name@company.com" />
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
                    setEmpNationalityType(v);
                    employeeForm.setFieldValue('nationalityIdNumber', '');
                    if (v === 'national_id') employeeForm.setFieldValue('countryCode', 'SA');
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
                  disabled={!empNationalityType}
                  placeholder={idPlaceholder}
                  maxLength={empNationalityType === 'passport' ? 20 : 10}
                  inputMode={empNationalityType === 'passport' ? 'text' : 'numeric'}
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
              <Form.Item label={t('employee.employmentStatus')} name="employmentStatus" rules={[{ required: true }]}>
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
              <Form.Item label={t('employee.hireDate')} name="hireDate">
                <DatePicker size="large" style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label={t('employee.department')} name="department">
                <Input size="large" placeholder="IT / HR / Sales" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('employee.position')} name="position">
                <Input size="large" placeholder="Software Engineer" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label={t('employee.photo')}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {photoDataUrl ? (
                    <AntImage src={photoDataUrl} alt="" width={80} height={80} style={{ objectFit: 'cover', borderRadius: 8 }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserOutlined style={{ fontSize: 32, color: '#bfbfbf' }} />
                    </div>
                  )}
                  <Space>
                    <Upload {...photoUploadProps}>
                      <Button icon={<UploadOutlined />}>{t('admin.uploadLogo')}</Button>
                    </Upload>
                    {photoDataUrl && <Button danger onClick={() => setPhotoDataUrl('')}>{t('common.delete')}</Button>}
                  </Space>
                </Space>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('employee.notes')} name="notes">
                <Input.TextArea rows={4} placeholder="..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEmployeeModalOpen(false)}>{t('common.cancel')}</Button>
              <Button type="primary" htmlType="submit">{t('common.save')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
