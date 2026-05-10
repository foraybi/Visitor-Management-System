import { useState } from 'react';
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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ManOutlined,
  WomanOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useCompanyStore } from '../../store/companyStore';
import { useFloorStore } from '../../store/floorStore';
import type { Company, Employee } from '../../types';

const { Title } = Typography;

export default function ManagementTab() {
  const { t } = useTranslation();
  const {
    companies,
    addCompany,
    updateCompany,
    deleteCompany,
    addEmployee,
    deleteEmployee,
  } = useCompanyStore();
  const { floors } = useFloorStore();

  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyForm] = Form.useForm();
  const [employeeForm] = Form.useForm();

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

  const openAddEmployee = (companyId: string) => {
    setSelectedCompanyId(companyId);
    employeeForm.resetFields();
    setEmployeeModalOpen(true);
  };

  const handleEmployeeSubmit = (values: Omit<Employee, 'id'>) => {
    if (selectedCompanyId) {
      addEmployee(selectedCompanyId, values);
    }
    setEmployeeModalOpen(false);
    employeeForm.resetFields();
  };

  const companyColumns: ColumnsType<Company> = [
    {
      title: t('company.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('company.nameAr'),
      dataIndex: 'nameAr',
      key: 'nameAr',
    },
    {
      title: t('visitor.floor'),
      dataIndex: 'floor',
      key: 'floor',
      render: floor => <Tag color="cyan">Floor {floor}</Tag>,
    },
    {
      title: t('table.phone'),
      dataIndex: 'phone',
      key: 'phone',
    },
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
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => openAddEmployee(record.id)}
          >
            {t('admin.addEmployee')}
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditCompany(record)}
          >
            {t('common.edit')}
          </Button>
          <Popconfirm
            title="Delete company?"
            onConfirm={() => deleteCompany(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const allEmployees = companies.flatMap(c =>
    c.employees.map(e => ({ ...e, companyName: c.name, companyId: c.id }))
  );

  const employeeColumns: ColumnsType<Employee & { companyName: string; companyId: string }> = [
    {
      title: t('company.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Company',
      dataIndex: 'companyName',
      key: 'companyName',
    },
    {
      title: t('table.phone'),
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: t('company.gender'),
      dataIndex: 'gender',
      key: 'gender',
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
      title: t('table.actions'),
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Delete employee?"
          onConfirm={() => deleteEmployee(record.companyId, record.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

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
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openAddCompany}
                  >
                    {t('company.addCompany')}
                  </Button>
                }
              >
                <Table
                  columns={companyColumns}
                  dataSource={companies}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 900 }}
                />
              </Card>
            ),
          },
          {
            key: 'employees',
            label: t('company.employees'),
            children: (
              <Card
                title={<Title level={4} style={{ margin: 0 }}>{t('company.employees')}</Title>}
              >
                <Table
                  columns={employeeColumns}
                  dataSource={allEmployees}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 800 }}
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
        <Form
          form={companyForm}
          layout="vertical"
          onFinish={handleCompanySubmit}
          requiredMark={false}
          style={{ marginTop: 16 }}
        >
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
              options={floors
                .slice()
                .sort((a, b) => a.number - b.number)
                .map(f => ({
                  value: f.number,
                  label: `${f.name} (${t('visitor.floor')} ${f.number})`,
                }))}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCompanyModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit">
                {t('common.save')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Employee Modal */}
      <Modal
        open={employeeModalOpen}
        title={t('admin.addEmployee')}
        onCancel={() => setEmployeeModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        <Form
          form={employeeForm}
          layout="vertical"
          onFinish={handleEmployeeSubmit}
          requiredMark={false}
          style={{ marginTop: 16 }}
        >
          <Form.Item label={t('company.name')} name="name" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item label={t('table.phone')} name="phone" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item label={t('company.gender')} name="gender" rules={[{ required: true }]}>
            <Select
              size="large"
              options={[
                { value: 'male', label: t('company.male') },
                { value: 'female', label: t('company.female') },
              ]}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEmployeeModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit">
                {t('common.save')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
