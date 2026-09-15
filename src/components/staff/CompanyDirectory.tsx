import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { can } from '../../domain/access/access';
import { capacityFor, daysUntil, type Capacity } from '../../domain/incubation/capacity';
import { presenceIndex } from '../../domain/presence/presence';
import { useAuthStore } from '../../store/authStore';
import { useCompanyStore } from '../../store/companyStore';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import { useVisitorStore } from '../../store/visitorStore';
import CapacityFullModal from './CapacityFullModal';
import CompanyEmployeeForm from '../frontdesk/CompanyEmployeeForm';
import type { Company, Employee, EmployeeType } from '../../types';

const { Text } = Typography;

type StatusFilter = 'all' | 'space' | 'full' | 'ending';

/** "Ends soon" means within this many days. */
const ENDING_SOON_DAYS = 30;

interface Props {
  /** Buttons shown at the end of the toolbar, such as Import and Add company. */
  toolbarExtra?: ReactNode;
  /** Admin actions. Without them the table is read-and-add only, as for the front desk. */
  onEditCompany?: (company: Company) => void;
  onDeleteCompany?: (company: Company) => void;
  onEditEmployee?: (employee: Employee, companyId: string) => void;
}

function CapacityMeter({ capacity, noLimitLabel }: { capacity: Capacity; noLimitLabel: string }) {
  if (capacity.limit === null) {
    return (
      <span className="cap-meter is-open">
        <span className="cap-meter-track" />
        <span className="cap-meter-value" dir="ltr">{capacity.used}</span>
        <span className="cap-meter-note">{noLimitLabel}</span>
      </span>
    );
  }
  const percent = capacity.limit === 0 ? 100 : Math.min(100, Math.round((capacity.used / capacity.limit) * 100));
  return (
    <span className={`cap-meter${capacity.full ? ' is-full' : ''}`}>
      <span className="cap-meter-track"><i style={{ width: `${percent}%` }} /></span>
      <span className="cap-meter-value" dir="ltr">{capacity.used}/{capacity.limit}</span>
    </span>
  );
}

/**
 * Every incubated company in one table, for the front desk and the admin.
 *
 * One row per company with its founder and employee places at a glance; a row
 * opens in place to show the people. Replaces a page that drew every company's
 * full employee table one under another, which became endless once companies
 * were imported by the hundred.
 *
 * Searching for a person opens the companies they belong to, so the match is
 * visible without another click.
 */
export default function CompanyDirectory({ toolbarExtra, onEditCompany, onDeleteCompany, onEditEmployee }: Props) {
  const { t } = useTranslation();
  const language = useUIStore(s => s.language);
  const companies = useCompanyStore(s => s.companies);
  const verifyEmployee = useCompanyStore(s => s.verifyEmployee);
  const floors = useFloorStore(s => s.floors);
  const visitors = useVisitorStore(s => s.visitors);
  const role = useAuthStore(s => s.currentRole);
  const isAdmin = can(role, 'companies.write');

  const [term, setTerm] = useState('');
  const [floor, setFloor] = useState<number | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<React.Key[]>([]);
  const [adding, setAdding] = useState<{ companyId: string; type: EmployeeType } | null>(null);
  const [full, setFull] = useState<{ floor: number; type: EmployeeType } | null>(null);

  const presence = useMemo(() => presenceIndex(visitors), [visitors]);
  const sortedFloors = useMemo(() => [...floors].sort((a, b) => a.number - b.number), [floors]);

  const nameOf = (c: { name: string; nameAr: string }) => (language === 'ar' ? c.nameAr || c.name : c.name || c.nameAr);
  const altNameOf = (c: { name: string; nameAr: string }) => (language === 'ar' ? c.name : c.nameAr);
  const floorName = (number: number) => {
    const f = floors.find(x => x.number === number);
    if (!f) return `${t('visitor.floor')} ${number}`;
    return language === 'ar' ? f.nameAr : f.name;
  };

  const query = term.trim().toLowerCase();
  const personMatches = (e: Employee) =>
    e.name.toLowerCase().includes(query) ||
    e.nameAr.includes(query) ||
    e.phone.includes(query) ||
    e.employeeNumber.includes(query);

  const filtered = useMemo(() => {
    return companies.filter(c => {
      if (floor !== 'all' && c.floor !== floor) return false;

      const founders = capacityFor(c, 'founder');
      const employees = capacityFor(c, 'employee');
      if (status === 'full' && !(founders.full || employees.full)) return false;
      if (status === 'space' && founders.remaining === 0 && employees.remaining === 0) return false;
      if (status === 'ending') {
        if (!c.incubationEnd) return false;
        const days = daysUntil(c.incubationEnd);
        if (days < 0 || days > ENDING_SOON_DAYS) return false;
      }

      if (!query) return true;
      return (
        c.name.toLowerCase().includes(query) ||
        c.nameAr.includes(query) ||
        (c.crNumber ?? '').includes(query) ||
        c.employees.some(personMatches)
      );
    });
    // personMatches only reads query, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, floor, status, query]);

  // Companies matched through one of their people are shown open.
  const openKeys = useMemo(() => {
    if (!query) return expanded;
    const matched = filtered.filter(c => c.employees.some(personMatches)).map(c => c.id);
    return [...new Set([...expanded, ...matched])];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, filtered, query]);

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

  const incubationTag = (c: Company) => {
    if (!c.incubationStart && !c.incubationEnd) return <Text type="secondary">—</Text>;
    const range = `${c.incubationStart ?? '…'} → ${c.incubationEnd ?? '…'}`;
    let tag: ReactNode;
    if (c.incubationStart && daysUntil(c.incubationStart) > 0) {
      tag = <Tag style={{ margin: 0 }}>{t('incubation.notStarted', { date: c.incubationStart })}</Tag>;
    } else if (!c.incubationEnd) {
      tag = <Tag style={{ margin: 0 }} dir="ltr">{range}</Tag>;
    } else {
      const days = daysUntil(c.incubationEnd);
      tag =
        days < 0 ? (
          <Tag color="error" style={{ margin: 0 }}>{t('incubation.ended')}</Tag>
        ) : (
          <Tag color={days <= ENDING_SOON_DAYS ? 'warning' : 'success'} style={{ margin: 0 }}>
            {t('incubation.daysLeft', { count: days })}
          </Tag>
        );
    }
    return <Tooltip title={<span dir="ltr">{range}</span>}>{tag}</Tooltip>;
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const hasAdminActions = Boolean(onEditCompany || onDeleteCompany);

  const columns: ColumnsType<Company> = [
    {
      title: t('company.name'),
      key: 'company',
      width: 260,
      sorter: (a, b) => nameOf(a).localeCompare(nameOf(b), language),
      render: (_, c) => (
        <div style={{ minWidth: 0 }}>
          <div className="cell-main" title={nameOf(c)}>{nameOf(c)}</div>
          <div className="cell-sub" title={altNameOf(c)}>{altNameOf(c)}</div>
        </div>
      ),
    },
    {
      title: t('visitor.floor'),
      key: 'floor',
      width: 170,
      render: (_, c) => <Tag color="cyan" style={{ margin: 0 }}>{floorName(c.floor)}</Tag>,
    },
    {
      title: t('incubation.crNumber'),
      key: 'cr',
      width: 130,
      render: (_, c) => <span className="cell-mono" dir="ltr">{c.crNumber || '—'}</span>,
    },
    {
      title: t('incubation.founders'),
      key: 'founders',
      width: 150,
      render: (_, c) => <CapacityMeter capacity={capacityFor(c, 'founder')} noLimitLabel={t('incubation.noLimit')} />,
    },
    {
      title: t('incubation.employees'),
      key: 'employees',
      width: 150,
      render: (_, c) => <CapacityMeter capacity={capacityFor(c, 'employee')} noLimitLabel={t('incubation.noLimit')} />,
    },
    {
      title: t('incubation.period'),
      key: 'period',
      width: 160,
      sorter: (a, b) => (a.incubationEnd ?? '9999').localeCompare(b.incubationEnd ?? '9999'),
      render: (_, c) => incubationTag(c),
    },
    {
      title: t('incubation.insideNow'),
      key: 'inside',
      width: 100,
      align: 'center',
      render: (_, c) => {
        const count = c.employees.filter(e => presence.isInside(e)).length;
        return count > 0 ? <Tag color="success" style={{ margin: 0 }}>{count}</Tag> : <Text type="secondary">0</Text>;
      },
    },
  ];

  if (hasAdminActions) {
    columns.push({
      title: t('table.actions'),
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, c) => (
        <Space size={4} onClick={stop}>
          {onEditCompany && (
            <Tooltip title={t('common.edit')}>
              <Button size="small" icon={<EditOutlined />} aria-label={t('common.edit')} onClick={() => onEditCompany(c)} />
            </Tooltip>
          )}
          {onDeleteCompany && (
            <Popconfirm
              title={t('admin.deleteCompanyConfirm')}
              description={t('common.cannotUndo')}
              okText={t('common.delete')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true }}
              onConfirm={() => onDeleteCompany(c)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
            </Popconfirm>
          )}
        </Space>
      ),
    });
  }

  const renderPeople = (c: Company) => (
    <Row gutter={[16, 16]} className="company-people">
      {(['founder', 'employee'] as const).map(type => {
        const capacity = capacityFor(c, type);
        const people = c.employees.filter(e => e.employeeType === type);
        return (
          <Col xs={24} lg={12} key={type}>
            <div className="people-group">
              <div className="people-group-head">
                <Space size="middle" wrap>
                  <strong>{type === 'founder' ? t('incubation.founders') : t('incubation.employees')}</strong>
                  <CapacityMeter capacity={capacity} noLimitLabel={t('incubation.noLimit')} />
                </Space>
                <Button
                  size="small"
                  type={capacity.full ? 'default' : 'primary'}
                  icon={<PlusOutlined />}
                  onClick={() => requestAdd(c, type)}
                >
                  {type === 'founder' ? t('incubation.addFounder') : t('incubation.addEmployee')}
                </Button>
              </div>

              {people.length === 0 ? (
                <Text type="secondary" className="people-empty">{t('incubation.nobodyYet')}</Text>
              ) : (
                <ul className="people-list">
                  {people.map(e => {
                    const inside = presence.isInside(e);
                    const highlighted = query !== '' && personMatches(e);
                    return (
                      <li key={e.id} className={`person-row${highlighted ? ' is-match' : ''}`}>
                        <span className="visit-code" dir="ltr">{e.employeeNumber}</span>
                        <div className="person-main">
                          <div className="cell-main" title={nameOf(e)}>{nameOf(e)}</div>
                          <div className="cell-sub" dir="ltr">{e.phone || '—'}</div>
                        </div>
                        <Space size={4} wrap className="person-tags">
                          <Tag color={e.verificationStatus === 'verified' ? 'success' : 'warning'} style={{ margin: 0 }}>
                            {e.verificationStatus === 'verified' ? t('employee.verified') : t('employee.pending')}
                          </Tag>
                          <Tag color={inside ? 'success' : undefined} style={{ margin: 0 }}>
                            {inside ? t('employee.inside') : t('employee.outside')}
                          </Tag>
                          {isAdmin && e.verificationStatus !== 'verified' && (
                            <Tooltip title={t('employee.verify')}>
                              <Button
                                size="small"
                                type="primary"
                                icon={<CheckOutlined />}
                                aria-label={t('employee.verify')}
                                onClick={() => verifyEmployee(c.id, e.id)}
                              />
                            </Tooltip>
                          )}
                          {onEditEmployee && (
                            <Tooltip title={t('common.edit')}>
                              <Button
                                size="small"
                                icon={<EditOutlined />}
                                aria-label={t('common.edit')}
                                onClick={() => onEditEmployee(e, c.id)}
                              />
                            </Tooltip>
                          )}
                        </Space>
                      </li>
                    );
                  })}
                </ul>
              )}

              {capacity.remaining !== null && capacity.remaining > 0 && (
                <Text type="secondary" className="people-left">
                  {t('incubation.placesLeft', { count: capacity.remaining })}
                </Text>
              )}
            </div>
          </Col>
        );
      })}
    </Row>
  );

  const addingCompany = adding ? companies.find(c => c.id === adding.companyId) : undefined;

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <div className="directory-toolbar">
        <Input
          size="large"
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t('incubation.searchPlaceholder')}
          value={term}
          onChange={e => setTerm(e.target.value)}
          className="directory-search"
        />
        <div className="directory-filters">
          <Segmented<number | 'all'>
            value={floor}
            onChange={setFloor}
            options={[
              { value: 'all', label: t('frontdesk.allFloors') },
              ...sortedFloors.map(f => ({ value: f.number, label: language === 'ar' ? f.nameAr : f.name })),
            ]}
          />
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('frontdesk.all') },
              { value: 'space', label: t('incubation.statusHasSpace') },
              { value: 'full', label: t('incubation.statusFull') },
              { value: 'ending', label: t('incubation.statusEnding') },
            ]}
          />
        </div>
        <div className="directory-actions">
          <Text type="secondary">{t('incubation.companiesCount', { count: filtered.length })}</Text>
          {toolbarExtra}
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        size="middle"
        tableLayout="fixed"
        scroll={{ x: hasAdminActions ? 1220 : 1120 }}
        pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }}
        rowClassName="directory-row"
        locale={{ emptyText: <Empty description={t('admin.noCompaniesFound')} /> }}
        expandable={{
          expandRowByClick: true,
          expandedRowKeys: openKeys,
          onExpand: (open, record) =>
            setExpanded(prev => (open ? [...prev, record.id] : prev.filter(k => k !== record.id))),
          expandedRowRender: renderPeople,
        }}
      />

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
    </Card>
  );
}
