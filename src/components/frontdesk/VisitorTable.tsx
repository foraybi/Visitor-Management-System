import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Table,
  Input,
  Select,
  Tag,
  Button,
  Row,
  Col,
  DatePicker,
  Space,
  Popconfirm,
  Empty,
} from 'antd';
import { SearchOutlined, LogoutOutlined, FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { identityLabelKey } from '../../domain/identity/identity';
import { visitPurposeLabelKey } from '../../domain/visit/visitPurpose';
import { useVisitorStore } from '../../store/visitorStore';
import { useCompanyStore } from '../../store/companyStore';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import { useDocumentSettingsStore } from '../../store/documentSettingsStore';
import { formatTimeFromISO } from '../../utils/timeUtils';
import LiveDuration from '../common/LiveDuration';
import type { Floor, Visitor } from '../../types';

dayjs.extend(isoWeek);

type DateMode = 'today' | 'specific' | 'range' | 'all';
type PeriodMode = 'day' | 'week' | 'month' | 'year' | 'all';

const { RangePicker } = DatePicker;

export default function VisitorTable() {
  const { t } = useTranslation();
  const { language } = useUIStore();
  const visitors = useVisitorStore(state => state.visitors);
  const exitVisitor = useVisitorStore(state => state.exitVisitor);
  const companies = useCompanyStore(state => state.companies);
  const floors = useFloorStore(state => state.floors);
  const documentHeader = useDocumentSettingsStore(state => state.settings);

  const [selectedFloor, setSelectedFloor] = useState<Floor | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [singleDate, setSingleDate] = useState<Dayjs>(dayjs());
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');

  // Index once rather than scanning the list per row. The search filter runs
  // this per visitor on every keystroke, so a linear find made filtering
  // O(visitors x companies).
  const companiesById = useMemo(
    () => new Map(companies.map(c => [c.id, c])),
    [companies],
  );
  const floorsByNumber = useMemo(
    () => new Map(floors.map(f => [f.number, f])),
    [floors],
  );

  const companyName = (id: string) => {
    const c = companiesById.get(id);
    if (!c) return id;
    return language === 'ar' ? c.nameAr : c.name;
  };

  const floorName = (num: number) => {
    const f = floorsByNumber.get(num);
    if (!f) return `${t('visitor.floor')} ${num}`;
    return language === 'ar' ? f.nameAr : f.name;
  };

  // For employee visits, show the employee number rather than the visit code.
  const employeeIdLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies) {
      for (const e of c.employees) {
        map.set(e.nationalityIdNumber, e.employeeNumber);
      }
    }
    return map;
  }, [companies]);

  const displayId = (v: Visitor) => {
    if (v.visitorType === 'employee') {
      return employeeIdLookup.get(v.nationalityIdNumber) ?? v.visitCode;
    }
    return v.visitCode;
  };

  // Compute [from, to] window. Date Mode picks the anchor; Period widens it.
  const dateWindow = useMemo<[string, string] | null>(() => {
    if (dateMode === 'all') return null;

    let anchor: Dayjs;
    let rangeFrom: Dayjs | null = null;
    let rangeTo: Dayjs | null = null;

    if (dateMode === 'today') {
      anchor = dayjs();
    } else if (dateMode === 'specific') {
      anchor = singleDate;
    } else {
      if (!dateRange || !dateRange[0] || !dateRange[1]) return null;
      rangeFrom = dateRange[0];
      rangeTo = dateRange[1];
      anchor = rangeFrom;
    }

    let start: Dayjs;
    let end: Dayjs;
    if (dateMode === 'range') {
      start = rangeFrom!.startOf('day');
      end = rangeTo!.endOf('day');
      if (periodMode === 'week') {
        start = rangeFrom!.startOf('isoWeek');
        end = rangeTo!.endOf('isoWeek');
      } else if (periodMode === 'month') {
        start = rangeFrom!.startOf('month');
        end = rangeTo!.endOf('month');
      } else if (periodMode === 'year') {
        start = rangeFrom!.startOf('year');
        end = rangeTo!.endOf('year');
      }
    } else {
      if (periodMode === 'all' || periodMode === 'day') {
        start = anchor.startOf('day');
        end = anchor.endOf('day');
      } else if (periodMode === 'week') {
        start = anchor.startOf('isoWeek');
        end = anchor.endOf('isoWeek');
      } else if (periodMode === 'month') {
        start = anchor.startOf('month');
        end = anchor.endOf('month');
      } else {
        start = anchor.startOf('year');
        end = anchor.endOf('year');
      }
    }
    return [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')];
  }, [dateMode, singleDate, dateRange, periodMode]);

  const dateFilteredVisitors = useMemo(() => {
    if (!dateWindow) return visitors;
    const [from, to] = dateWindow;
    return visitors.filter(v => v.date >= from && v.date <= to);
  }, [visitors, dateWindow]);

  // Human-readable description of the active date filter, included in exports
  const filterLabel = useMemo(() => {
    if (dateMode === 'all') return t('frontdesk.allDates');
    if (!dateWindow) return '';
    const [from, to] = dateWindow;
    if (from === to) return from;
    return `${from} → ${to}`;
  }, [dateMode, dateWindow, t]);

  const filteredVisitors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return dateFilteredVisitors.filter(v => {
      const floorMatch = selectedFloor === 'all' || v.floor === selectedFloor;
      const company = companiesById.get(v.visitedCompanyId);
      const searchMatch =
        !term ||
        v.visitCode.includes(term) ||
        v.name.toLowerCase().includes(term) ||
        v.phone.includes(term) ||
        (v.email ?? '').toLowerCase().includes(term) ||
        v.nationalityIdNumber.toLowerCase().includes(term) ||
        (company?.name ?? '').toLowerCase().includes(term) ||
        (company?.nameAr ?? '').includes(term);
      return floorMatch && searchMatch;
    });
  }, [dateFilteredVisitors, selectedFloor, searchTerm, companiesById]);

  const exportLabels = {
    visitorId: t('table.visitorId'),
    status: t('table.status'),
    name: t('table.name'),
    phone: t('table.phone'),
    email: t('table.email'),
    nationality: t('table.nationality'),
    idNumber: t('table.idNumber'),
    floor: t('visitor.floor'),
    company: t('table.companyName'),
    timeIn: t('table.entryTime'),
    timeOut: t('table.exitTime'),
    timeSpent: t('table.timeSpent'),
    active: t('table.active'),
    exited: t('table.exited'),
  };

  const handleExportPdf = async () => {
    const { exportVisitorsPdf } = await import('../../utils/exportPdf');
    await exportVisitorsPdf(filteredVisitors, {
      language,
      companyLookup: companyName,
      floorLookup: floorName,
      filterLabel,
      documentHeader,
      labels: {
        ...exportLabels,
        title: t('frontdesk.exportReportTitle'),
        generated: t('frontdesk.exportGenerated'),
        filter: t('frontdesk.exportFilter'),
      },
    });
  };

  const handleExportExcel = async () => {
    const { exportVisitorsExcel } = await import('../../utils/exportExcel');
    exportVisitorsExcel(filteredVisitors, {
      language,
      companyLookup: companyName,
      floorLookup: floorName,
      filterLabel,
      documentHeader,
      labels: {
        ...exportLabels,
        sheetName: t('frontdesk.exportSheetName'),
        filter: t('frontdesk.exportFilter'),
      },
    });
  };

  // Show the date under the times only when the filter spans more than one day.
  const showDate = useMemo(() => {
    if (dateMode === 'all' || dateMode === 'range') return true;
    if (dateMode === 'specific' && !singleDate.isSame(dayjs(), 'day')) return true;
    return periodMode === 'week' || periodMode === 'month' || periodMode === 'year';
  }, [dateMode, singleDate, periodMode]);

  const columns: ColumnsType<Visitor> = [
    {
      title: t('table.visitor'),
      key: 'visitor',
      width: 220,
      render: (_, v) => (
        <div className="visitor-cell">
          <div className="visitor-avatar" data-type={v.visitorType} aria-hidden>
            {(v.name.trim()[0] ?? '?').toUpperCase()}
          </div>
          <div className="visitor-cell-text">
            <div className="cell-main" title={v.name}>{v.name || '—'}</div>
            <div className="cell-sub">
              <span dir="ltr">{v.phone || '—'}</span>
              <Tag bordered={false} color={v.visitorType === 'employee' ? 'purple' : 'geekblue'} style={{ margin: 0 }}>
                {v.visitorType === 'employee' ? t('visitor.employee') : t('visitor.visitor')}
              </Tag>
            </div>
            {v.email && (
              <div className="cell-sub" title={v.email}>
                <span dir="ltr" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.email}</span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: t('table.visitCode'),
      key: 'code',
      width: 84,
      render: (_, v) => <span className="visit-code" dir="ltr">{displayId(v)}</span>,
    },
    {
      title: t('table.identity'),
      key: 'identity',
      width: 165,
      render: (_, v) => (
        <div>
          <div className="cell-main cell-mono" dir="ltr">{v.nationalityIdNumber}</div>
          <div className="cell-sub">
            {t(identityLabelKey(v.nationalityType))}
            {v.countryName ? ` · ${v.countryName}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: t('table.companyFloor'),
      key: 'company',
      width: 185,
      render: (_, v) => {
        const name = companyName(v.visitedCompanyId);
        return (
          <div style={{ minWidth: 0 }}>
            <div className="cell-main" title={name}>{name}</div>
            <div className="cell-sub">
              <Tag color="cyan" style={{ margin: 0 }}>{floorName(v.floor)}</Tag>
            </div>
            {v.visitPurpose && (
              <div className="cell-sub" title={t(visitPurposeLabelKey(v.visitPurpose))}>
                {t(visitPurposeLabelKey(v.visitPurpose))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: t('table.inOut'),
      key: 'inOut',
      width: 125,
      render: (_, v) => (
        <div>
          <div className="cell-main" dir="ltr" style={{ textAlign: 'start' }}>
            {formatTimeFromISO(v.entryTime)} → {v.exitTime ? formatTimeFromISO(v.exitTime) : '…'}
          </div>
          {showDate && <div className="cell-sub" dir="ltr">{v.date}</div>}
        </div>
      ),
    },
    {
      // Status and time spent share a column: the ticking clock is what "active"
      // means, and one column fewer keeps the check-out button on screen.
      title: t('table.timeSpent'),
      key: 'status',
      width: 130,
      render: (_, v) => (
        <div>
          <Tag color={v.status === 'active' ? 'success' : 'default'} style={{ margin: 0 }}>
            <span className="status-dot" />
            {v.status === 'active' ? t('table.active') : t('table.exited')}
          </Tag>
          <div style={{ marginTop: 4 }}>
            <LiveDuration entryTime={v.entryTime} exitTime={v.exitTime} />
          </div>
        </div>
      ),
    },
    {
      title: t('table.actions'),
      key: 'actions',
      width: 140,
      render: (_, v) =>
        v.status === 'active' ? (
          <Popconfirm
            title={t('table.checkOutConfirm')}
            okText={t('table.checkOut')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true }}
            onConfirm={() => exitVisitor(v.id)}
          >
            <Button danger icon={<LogoutOutlined />}>
              {t('table.checkOut')}
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  const pickers =
    dateMode === 'specific' ? (
      <DatePicker
        size="large"
        style={{ width: '100%' }}
        value={singleDate}
        onChange={(d) => d && setSingleDate(d)}
        format="YYYY-MM-DD"
        allowClear={false}
      />
    ) : dateMode === 'range' ? (
      <RangePicker
        size="large"
        style={{ width: '100%' }}
        value={dateRange as [Dayjs, Dayjs] | null}
        onChange={(vals) => setDateRange(vals as [Dayjs | null, Dayjs | null] | null)}
        format="YYYY-MM-DD"
      />
    ) : null;

  return (
    <Card styles={{ body: { padding: 16 } }}>
      <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 12 }}>
        <Col xs={24} lg={9}>
          <Input
            size="large"
            placeholder={t('common.search')}
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={12} md={8} lg={5}>
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
        <Col xs={12} md={8} lg={5}>
          <Select
            size="large"
            style={{ width: '100%' }}
            value={dateMode}
            onChange={(v: DateMode) => setDateMode(v)}
            aria-label={t('frontdesk.filterByDate')}
            options={[
              { value: 'today', label: t('frontdesk.today') },
              { value: 'specific', label: t('frontdesk.filterByDate') },
              { value: 'range', label: t('frontdesk.dateRange') },
              { value: 'all', label: t('frontdesk.allDates') },
            ]}
          />
        </Col>
        <Col xs={12} md={8} lg={5}>
          <Select
            size="large"
            style={{ width: '100%' }}
            value={periodMode}
            onChange={(v: PeriodMode) => setPeriodMode(v)}
            aria-label={t('frontdesk.viewBy')}
            disabled={dateMode === 'all'}
            options={[
              { value: 'all', label: t('frontdesk.all') },
              { value: 'day', label: t('frontdesk.day') },
              { value: 'week', label: t('frontdesk.week') },
              { value: 'month', label: t('frontdesk.month') },
              { value: 'year', label: t('frontdesk.year') },
            ]}
          />
        </Col>
      </Row>

      {/* Second row: the date picker when one applies, and the exports, which
          used to wrap onto two lines in a column too narrow for them. */}
      <Row gutter={[12, 12]} align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={9}>
          {pickers}
        </Col>
        <Col xs={24} md={12} lg={15} style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Space wrap>
            <Button size="large" icon={<FilePdfOutlined style={{ color: '#d4380d' }} />} onClick={handleExportPdf}>
              {t('frontdesk.exportPdf')}
            </Button>
            <Button size="large" icon={<FileExcelOutlined style={{ color: '#1d6f42' }} />} onClick={handleExportExcel}>
              {t('frontdesk.exportExcel')}
            </Button>
          </Space>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredVisitors}
        rowKey="id"
        size="middle"
        tableLayout="fixed"
        scroll={{ x: 1049 }}
        rowClassName={(v) => (v.status === 'active' ? 'visitor-row-active' : '')}
        locale={{ emptyText: <Empty description={t('table.noVisitors')} /> }}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => t('table.total', { count: total }),
        }}
      />
    </Card>
  );
}
