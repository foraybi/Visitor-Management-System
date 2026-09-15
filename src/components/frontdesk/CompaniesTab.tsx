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
  Progress,
  Modal,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  ManOutlined,
  WomanOutlined,
  PhoneOutlined,
  CalendarOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { can } from '../../domain/access/access';
import { capacityFor, daysUntil, type Capacity } from '../../domain/incubation/capacity';
import { presenceIndex } from '../../domain/presence/presence';
import { useAuthStore } from '../../store/authStore';
import { useCompanyStore } from '../../store/companyStore';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import { useVisitorStore } from '../../store/visitorStore';
import CapacityFullModal from '../staff/CapacityFullModal';
import CompanyEmployeeForm from './CompanyEmployeeForm';
import type { Company, Employee, EmployeeType, Floor } from '../../types';

const { Title, Text } = Typography;

/** Empty places drawn before the rest are summarised as "+N more". */
const MAX_EMPTY_SLOTS_SHOWN = 12;

export default function CompaniesTab() {
  const { t } = useTranslation();
  const { language } = useUIStore();
  const { companies } = useCompanyStore();
  const { floors } = useFloorStore();
  const visitors = useVisitorStore(state => state.visitors);
  const role = useAuthStore(s => s.currentRole);
  const isAdmin = can(role, 'companies.write');

  const [selectedFloor, setSelectedFloor] = useState<Floor | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [adding, setAdding] = useState<{ companyId: string; type: EmployeeType } | null>(null);
  const [full, setFull] = useState<{ floor: number; type: EmployeeType } | null>(null);

  const floorName = (num: number) => {
    const f = floors.find(x => x.number === num);
    if (!f) return `${t('visitor.floor')} ${num}`;
    return language === 'ar' ? f.nameAr : f.name;
  };

  // Who is inside the building right now. Shared with the admin employee table
  // via the presence module, so the two cannot drift apart again.
  const presence = useMemo(() => presenceIndex(visitors), [visitors]);

  const filteredCompanies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return companies.filter(c => {
      const floorMatch = selectedFloor === 'all' || c.floor === selectedFloor;
      const searchMatch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.nameAr.includes(term) ||
        c.phone.includes(term) ||
        (c.crNumber ?? '').includes(term) ||
        c.employees.some(e => e.name.toLowerCase().includes(term) || e.nameAr.includes(term));
      return floorMatch && searchMatch;
    });
  }, [companies, selectedFloor, searchTerm]);

  /**
   * Open the add form, or explain why not. The front desk is stopped at a full
   * list and told whom to contact; an admin is warned and may add anyway.
   */
  const requestAdd = (company: Company, type: EmployeeType) => {
    const capacity = capacityFor(company, type);
    if (!capacity.full) {
      setAdding({ companyId: company.id, type });
      return;
    }
    if (!isAdmin) {
      setFull({ floor: company.floor, type });
      return;
    }
    Modal.confirm({
      title: t('incubation.fullAdminTitle'),
      content: t('incubation.fullAdminBody', { limit: capacity.limit ?? 0 }),
      okText: t('incubation.addAnyway'),
      cancelText: t('common.cancel'),
      onOk: () => setAdding({ companyId: company.id, type }),
    });
  };

  const genderTag = (g: Employee['gender']) => {
    if (!g) return <Text type="secondary">—</Text>;
    return (
      <Tag icon={g === 'male' ? <ManOutlined /> : <WomanOutlined />} color={g === 'male' ? 'blue' : 'pink'} style={{ margin: 0 }}>
        {g === 'male' ? t('company.male') : t('company.female')}
      </Tag>
    );
  };

  const columns: ColumnsType<Employee> = [
    {
      title: t('visitor.employeeNumber'),
      dataIndex: 'employeeNumber',
      key: 'employeeNumber',
      width: 90,
      render: n => <span className="visit-code" dir="ltr">{n}</span>,
    },
    {
      title: t('table.name'),
      key: 'name',
      width: 220,
      render: (_, e) => (
        <div>
          <div className="cell-main">{language === 'ar' ? e.nameAr : e.name}</div>
          <div className="cell-sub">{language === 'ar' ? e.name : e.nameAr}</div>
        </div>
      ),
    },
    {
      title: t('table.phone'),
      key: 'contact',
      width: 200,
      render: (_, e) => (
        <div>
          <div className="cell-main" dir="ltr" style={{ textAlign: 'start' }}>{e.phone || '—'}</div>
          {e.email && <div className="cell-sub" dir="ltr">{e.email}</div>}
        </div>
      ),
    },
    { title: t('company.gender'), dataIndex: 'gender', key: 'gender', width: 100, render: genderTag },
    {
      title: t('employee.verified'),
      dataIndex: 'verificationStatus',
      key: 'verificationStatus',
      width: 140,
      render: (s: string) => (
        <Tag color={s === 'verified' ? 'success' : 'warning'} style={{ margin: 0 }}>
          {s === 'verified' ? t('employee.verified') : t('employee.pending')}
        </Tag>
      ),
    },
    {
      title: t('employee.visitStatus'),
      key: 'visitStatus',
      width: 140,
      render: (_, r) =>
        presence.isInside(r) ? (
          <Tag color="success" style={{ margin: 0 }}>
            <span className="status-dot" />
            {t('employee.inside')}
          </Tag>
        ) : (
          <Tag style={{ margin: 0 }}>{t('employee.outside')}</Tag>
        ),
    },
  ];

  const incubationTags = (c: Company) => {
    if (!c.incubationStart && !c.incubationEnd) return null;
    const tags = [
      <Tag key="period" icon={<CalendarOutlined />} color="geekblue" style={{ margin: 0 }}>
        <span dir="ltr">{c.incubationStart ?? '…'} → {c.incubationEnd ?? '…'}</span>
      </Tag>,
    ];
    if (c.incubationStart && daysUntil(c.incubationStart) > 0) {
      tags.push(<Tag key="state" style={{ margin: 0 }}>{t('incubation.notStarted', { date: c.incubationStart })}</Tag>);
    } else if (c.incubationEnd) {
      const days = daysUntil(c.incubationEnd);
      tags.push(
        days < 0 ? (
          <Tag key="state" color="error" style={{ margin: 0 }}>{t('incubation.ended')}</Tag>
        ) : (
          <Tag key="state" color={days <= 30 ? 'warning' : 'success'} style={{ margin: 0 }}>
            {t('incubation.daysLeft', { count: days })}
          </Tag>
        ),
      );
    }
    return tags;
  };

  const renderSlots = (company: Company, type: EmployeeType, capacity: Capacity) => {
    if (capacity.remaining === null || capacity.remaining === 0) return null;
    const shown = Math.min(capacity.remaining, MAX_EMPTY_SLOTS_SHOWN);
    return (
      <div className="slot-list">
        {Array.from({ length: shown }, (_, i) => (
          <button
            key={i}
            type="button"
            className="slot-empty"
            onClick={() => requestAdd(company, type)}
          >
            <PlusOutlined /> {t('incubation.emptySlot', { n: capacity.used + i + 1 })}
          </button>
        ))}
        {capacity.remaining > shown && (
          <span className="slot-more">{t('incubation.moreEmptySlots', { count: capacity.remaining - shown })}</span>
        )}
      </div>
    );
  };

  const renderSection = (company: Company, type: EmployeeType) => {
    const capacity = capacityFor(company, type);
    const people = company.employees.filter(e => e.employeeType === type);
    const label = type === 'founder' ? t('incubation.founders') : t('incubation.employees');
    const percent = capacity.limit ? Math.min(100, Math.round((capacity.used / capacity.limit) * 100)) : 0;

    return (
      <div className="people-section">
        <div className="people-section-head">
          <Space size="middle" wrap>
            <Title level={5} style={{ margin: 0 }}>{label}</Title>
            {capacity.limit === null ? (
              <Tag style={{ margin: 0 }}>{t('incubation.noLimit')} · {capacity.used}</Tag>
            ) : (
              <Space size={8}>
                <Progress
                  percent={percent}
                  size="small"
                  showInfo={false}
                  status={capacity.full ? 'exception' : 'normal'}
                  style={{ width: 110, margin: 0 }}
                />
                <Tag color={capacity.full ? 'error' : 'default'} style={{ margin: 0 }}>
                  {t('incubation.used', { used: capacity.used, limit: capacity.limit })}
                </Tag>
              </Space>
            )}
          </Space>
          <Button
            icon={<PlusOutlined />}
            type={capacity.full ? 'default' : 'primary'}
            onClick={() => requestAdd(company, type)}
          >
            {type === 'founder' ? t('incubation.addFounder') : t('incubation.addEmployee')}
          </Button>
        </div>

        {people.length > 0 && (
          <Table
            columns={columns}
            dataSource={people}
            rowKey="id"
            pagination={false}
            size="small"
            tableLayout="fixed"
            scroll={{ x: 890 }}
          />
        )}
        {renderSlots(company, type, capacity)}
        {people.length === 0 && capacity.limit === null && (
          <Text type="secondary">{t('incubation.nobodyYet')}</Text>
        )}
      </div>
    );
  };

  const renderCompanyCard = (c: Company) => (
    <Card key={c.id} style={{ marginBottom: 16 }} styles={{ body: { padding: 20 } }}>
      <div className="company-head">
        <div className="company-avatar" aria-hidden>
          {(c.name.trim()[0] ?? '?').toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Title level={4} style={{ margin: 0 }}>{language === 'ar' ? c.nameAr : c.name}</Title>
          <Text type="secondary">{language === 'ar' ? c.name : c.nameAr}</Text>
          <Space size={[8, 8]} wrap style={{ display: 'flex', marginTop: 8 }}>
            <Tag color="cyan" style={{ margin: 0 }}>{floorName(c.floor)}</Tag>
            {c.phone && (
              <Tag icon={<PhoneOutlined />} style={{ margin: 0 }}><span dir="ltr">{c.phone}</span></Tag>
            )}
            {c.crNumber && (
              <Tag icon={<IdcardOutlined />} style={{ margin: 0 }}>
                {t('incubation.crNumber')}: <span dir="ltr">{c.crNumber}</span>
              </Tag>
            )}
            {incubationTags(c)}
          </Space>
        </div>
      </div>

      {renderSection(c, 'founder')}
      {renderSection(c, 'employee')}
    </Card>
  );

  const addingCompany = adding ? companies.find(c => c.id === adding.companyId) : undefined;

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
              aria-label={t('frontdesk.filterByFloor')}
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
          <Empty description={t('admin.noCompaniesFound')} />
        </Card>
      ) : (
        filteredCompanies.map(renderCompanyCard)
      )}

      {adding && addingCompany && (
        <CompanyEmployeeForm
          companyId={adding.companyId}
          employeeType={adding.type}
          open={true}
          onClose={() => setAdding(null)}
          onFull={type => {
            setAdding(null);
            setFull({ floor: addingCompany.floor, type });
          }}
        />
      )}

      <CapacityFullModal
        open={full !== null}
        onClose={() => setFull(null)}
        companyFloor={full?.floor ?? null}
        type={full?.type ?? null}
      />
    </div>
  );
}
