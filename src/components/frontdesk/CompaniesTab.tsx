import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Input,
  Select,
  Row,
  Col,
  Empty,
  Table,
  Tag,
  Button,
  Space,
  Typography,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  ManOutlined,
  WomanOutlined,
  PhoneOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useCompanyStore } from '../../store/companyStore';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import { useVisitorStore } from '../../store/visitorStore';
import CompanyEmployeeForm from './CompanyEmployeeForm';
import type { Company, Employee, Floor } from '../../types';

const { Title, Text } = Typography;

export default function CompaniesTab() {
  const { t } = useTranslation();
  const { language } = useUIStore();
  const { companies } = useCompanyStore();
  const { floors } = useFloorStore();
  const visitors = useVisitorStore(state => state.visitors);

  const [selectedFloor, setSelectedFloor] = useState<Floor | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [addEmployeeFor, setAddEmployeeFor] = useState<string | null>(null);

  const floorName = (num: number) => {
    const f = floors.find(x => x.number === num);
    if (!f) return `${t('visitor.floor')} ${num}`;
    return language === 'ar' ? f.nameAr : f.name;
  };

  // who's inside the building right now?
  const insideEmployees = useMemo(() => {
    const set = new Set<string>();
    for (const v of visitors) {
      if (v.visitorType === 'employee' && v.status === 'active') {
        set.add(v.nationalityIdNumber);
      }
    }
    return set;
  }, [visitors]);

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const floorMatch = selectedFloor === 'all' || c.floor === selectedFloor;
      const term = searchTerm.toLowerCase();
      const searchMatch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.nameAr.includes(searchTerm) ||
        c.phone.includes(searchTerm);
      return floorMatch && searchMatch;
    });
  }, [companies, selectedFloor, searchTerm]);

  const buildEmployeeColumns = (): ColumnsType<Employee> => [
    {
      title: t('visitor.employeeNumber'),
      dataIndex: 'employeeNumber',
      key: 'employeeNumber',
      width: 90,
      render: n => <strong style={{ color: 'rgb(0, 114, 151)' }}>{n}</strong>,
    },
    {
      title: t('employee.nameAr'),
      dataIndex: 'nameAr',
      key: 'nameAr',
      width: 160,
    },
    {
      title: t('employee.nameEn'),
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: t('table.phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: t('employee.email'),
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#bfbfbf' }}>—</span>,
    },
    {
      title: t('company.gender'),
      dataIndex: 'gender',
      key: 'gender',
      width: 90,
      render: g => (
        <Tag
          icon={g === 'male' ? <ManOutlined /> : <WomanOutlined />}
          color={g === 'male' ? 'blue' : 'pink'}
        >
          {g === 'male' ? t('company.male') : t('company.female')}
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
        return <Tag>{map[j] ?? j}</Tag>;
      },
    },
    {
      title: t('employee.employmentStatus'),
      dataIndex: 'employmentStatus',
      key: 'employmentStatus',
      width: 100,
      render: (s: string) => (
        <Tag color={s === 'active' ? 'green' : 'default'}>
          {s === 'active' ? t('employee.active') : t('employee.inactive')}
        </Tag>
      ),
    },
    {
      title: t('admin.verified'),
      dataIndex: 'verificationStatus',
      key: 'verificationStatus',
      width: 130,
      render: (s: string) => (
        <Tag color={s === 'verified' ? 'success' : 'warning'}>
          {s === 'verified' ? t('admin.verified') : t('admin.pending')}
        </Tag>
      ),
    },
    {
      title: t('employee.visitStatus'),
      key: 'visitStatus',
      width: 130,
      render: (_, r) =>
        insideEmployees.has(r.nationalityIdNumber) ? (
          <Tag color="success">
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'rgb(127,188,66)', marginInlineEnd: 6 }} />
            {t('employee.inside')}
          </Tag>
        ) : (
          <Tag color="default">{t('employee.outside')}</Tag>
        ),
    },
  ];

  const renderCompanyCard = (c: Company) => (
    <Card key={c.id} style={{ marginBottom: 16 }} styles={{ body: { padding: 20 } }}>
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
        <Col xs={24} md={3}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgb(0, 114, 151), rgb(0, 166, 207))',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {c.name.charAt(0).toUpperCase()}
          </div>
        </Col>
        <Col xs={24} md={15}>
          <Title level={4} style={{ margin: 0 }}>{language === 'ar' ? c.nameAr : c.name}</Title>
          <Text type="secondary">{language === 'ar' ? c.name : c.nameAr}</Text>
          <Space size="large" style={{ display: 'flex', marginTop: 8, flexWrap: 'wrap' }}>
            <Space size={4}>
              <PhoneOutlined style={{ color: 'rgb(0, 114, 151)' }} />
              <Text>{c.phone}</Text>
            </Space>
            <Tag color="cyan">{floorName(c.floor)}</Tag>
            <Space size={4}>
              <TeamOutlined style={{ color: 'rgb(0, 114, 151)' }} />
              <Text>{c.employees.length} {t('company.employees')}</Text>
            </Space>
          </Space>
        </Col>
        <Col xs={24} md={6} style={{ textAlign: 'end' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddEmployeeFor(c.id)}
          >
            {t('admin.addEmployee')}
          </Button>
        </Col>
      </Row>

      <Table
        columns={buildEmployeeColumns()}
        dataSource={c.employees}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={{ x: 1200 }}
      />
    </Card>
  );

  return (
    <div>
      <Card styles={{ body: { padding: 20 } }} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Input
              size="large"
              placeholder={t('common.search')}
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={selectedFloor}
              onChange={setSelectedFloor}
              options={[
                { value: 'all', label: t('frontdesk.allFloors') },
                ...floors
                  .slice()
                  .sort((a, b) => a.number - b.number)
                  .map(f => ({
                    value: f.number,
                    label: language === 'ar' ? f.nameAr : f.name,
                  })),
              ]}
            />
          </Col>
        </Row>
      </Card>

      {filteredCompanies.length === 0 ? (
        <Card>
          <Empty description="No companies found" />
        </Card>
      ) : (
        filteredCompanies.map(renderCompanyCard)
      )}

      {addEmployeeFor && (
        <CompanyEmployeeForm
          companyId={addEmployeeFor}
          open={true}
          onClose={() => setAddEmployeeFor(null)}
        />
      )}
    </div>
  );
}
