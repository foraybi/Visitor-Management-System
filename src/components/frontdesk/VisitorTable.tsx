import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table, Input, Select, Tag, Button, Row, Col, DatePicker, Tooltip, Space } from 'antd';
import { SearchOutlined, LogoutOutlined, FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import { exportVisitorsPdf } from '../../utils/exportPdf';
import { exportVisitorsExcel } from '../../utils/exportExcel';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useVisitorStore } from '../../store/visitorStore';
import { useCompanyStore } from '../../store/companyStore';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import { useDocumentSettingsStore } from '../../store/documentSettingsStore';
import { formatTimeFromISO, formatTimeSpent } from '../../utils/timeUtils';
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

  // Live-tick: re-render every 60s so Time Spent stays current for active visitors
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const companyName = (id: string) => {
    const c = companies.find(x => x.id === id);
    if (!c) return id;
    return language === 'ar' ? c.nameAr : c.name;
  };

  const floorName = (num: number) => {
    const f = floors.find(x => x.number === num);
    if (!f) return `${t('visitor.floor')} ${num}`;
    return language === 'ar' ? f.nameAr : f.name;
  };

  // For employee-type visitor records, prefer the employeeNumber over the auto VST id
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
      return employeeIdLookup.get(v.nationalityIdNumber) ?? v.id;
    }
    return v.id;
  };

  // Compute [from, to] window. Date Mode picks the anchor; Period widens it.
  const dateWindow = useMemo<[string, string] | null>(() => {
    // Date Mode resolves first
    if (dateMode === 'all') return null;

    let anchor: Dayjs;
    let rangeFrom: Dayjs | null = null;
    let rangeTo: Dayjs | null = null;

    if (dateMode === 'today') {
      anchor = dayjs();
    } else if (dateMode === 'specific') {
      anchor = singleDate;
    } else {
      // dateMode === 'range'
      if (!dateRange || !dateRange[0] || !dateRange[1]) return null;
      rangeFrom = dateRange[0];
      rangeTo = dateRange[1];
      anchor = rangeFrom;
    }

    // Period widens the window around the anchor (or the explicit range)
    let start: Dayjs;
    let end: Dayjs;
    if (dateMode === 'range') {
      // For explicit range, period optionally widens by week/month/year on the from-date
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
      // today / specific — period defines the window size around the anchor
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

  const handleExportPdf = () => {
    exportVisitorsPdf(filteredVisitors, {
      language,
      companyLookup: companyName,
      floorLookup: floorName,
      filterLabel,
      documentHeader,
      labels: {
        title: t('frontdesk.exportReportTitle'),
        generated: t('frontdesk.exportGenerated'),
        filter: t('frontdesk.exportFilter'),
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
      },
    });
  };

  const handleExportExcel = () => {
    exportVisitorsExcel(filteredVisitors, {
      language,
      companyLookup: companyName,
      floorLookup: floorName,
      filterLabel,
      documentHeader,
      labels: {
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
        sheetName: t('frontdesk.exportSheetName'),
        filter: t('frontdesk.exportFilter'),
      },
    });
  };

  const filteredVisitors = useMemo(() => {
    return dateFilteredVisitors.filter(v => {
      const floorMatch = selectedFloor === 'all' || v.floor === selectedFloor;
      const term = searchTerm.toLowerCase();
      const searchMatch =
        !term ||
        v.id.toLowerCase().includes(term) ||
        v.name.toLowerCase().includes(term) ||
        v.phone.includes(searchTerm) ||
        (v.email ?? '').toLowerCase().includes(term) ||
        v.nationalityIdNumber.toLowerCase().includes(term) ||
        companyName(v.visitedCompanyId).toLowerCase().includes(term);
      return floorMatch && searchMatch;
    });
  }, [dateFilteredVisitors, selectedFloor, searchTerm, companies, language]);

  // Show the Date column only when the filter spans more than today
  const showDateColumn = useMemo(() => {
    if (dateMode === 'all') return true;
    if (dateMode === 'range') return true;
    if (dateMode === 'specific' && !singleDate.isSame(dayjs(), 'day')) return true;
    if (periodMode === 'week' || periodMode === 'month' || periodMode === 'year') return true;
    return false;
  }, [dateMode, singleDate, periodMode]);

  const columns: ColumnsType<Visitor> = [
    {
      title: t('table.visitorId'),
      key: 'displayId',
      width: 85,
      render: (_, record) => (
        <span style={{ fontWeight: 700, color: 'rgb(0, 114, 151)' }}>
          {displayId(record)}
        </span>
      ),
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: status => (
        <Tag
          color={status === 'active' ? 'success' : 'default'}
          style={{ borderRadius: 6, padding: '2px 6px', margin: 0 }}
        >
          {status === 'active' ? t('table.active') : t('table.exited')}
        </Tag>
      ),
    },
    {
      title: t('table.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: { showTitle: false },
      render: (name: string) => (
        <Tooltip title={name}>
          <span>{name}</span>
        </Tooltip>
      ),
    },
    {
      title: t('table.phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 100,
    },
    {
      title: t('table.email'),
      dataIndex: 'email',
      key: 'email',
      ellipsis: { showTitle: false },
      render: (email: string) =>
        email ? (
          <Tooltip title={email}>
            <span>{email}</span>
          </Tooltip>
        ) : (
          <span style={{ color: '#bfbfbf' }}>—</span>
        ),
    },
    {
      title: t('table.nationality'),
      dataIndex: 'countryName',
      key: 'countryName',
      width: 100,
      ellipsis: { showTitle: false },
      render: (cn: string) => (
        <Tooltip title={cn}>
          <span>{cn}</span>
        </Tooltip>
      ),
    },
    {
      title: t('table.idNumber'),
      dataIndex: 'nationalityIdNumber',
      key: 'nationalityIdNumber',
      width: 110,
      render: idNum => <span style={{ fontFamily: 'monospace' }}>{idNum}</span>,
    },
    {
      title: t('visitor.floor'),
      dataIndex: 'floor',
      key: 'floor',
      width: 110,
      render: (num: number) => (
        <Tooltip title={floorName(num)}>
          <Tag color="blue" style={{ margin: 0 }}>{floorName(num)}</Tag>
        </Tooltip>
      ),
    },
    {
      title: t('table.companyName'),
      dataIndex: 'visitedCompanyId',
      key: 'companyName',
      ellipsis: { showTitle: false },
      render: (id: string) => {
        const name = companyName(id);
        return (
          <Tooltip title={name}>
            <span>{name}</span>
          </Tooltip>
        );
      },
    },
    {
      title: t('employee.type'),
      dataIndex: 'visitorType',
      key: 'visitorType',
      width: 90,
      render: (vt: string) => (
        <Tag color={vt === 'employee' ? 'purple' : 'geekblue'}>
          {vt === 'employee' ? t('visitor.employee') : t('visitor.visitor')}
        </Tag>
      ),
    },
    {
      title: t('table.entryTime'),
      dataIndex: 'entryTime',
      key: 'entryTime',
      width: 80,
      render: formatTimeFromISO,
    },
    {
      title: t('table.exitTime'),
      dataIndex: 'exitTime',
      key: 'exitTime',
      width: 80,
      render: formatTimeFromISO,
    },
    {
      title: t('table.timeSpent'),
      key: 'timeSpent',
      width: 90,
      render: (_, record) => (
        <span style={{ fontWeight: 600 }}>
          {formatTimeSpent(record.entryTime, record.exitTime)}
        </span>
      ),
    },
    ...(showDateColumn
      ? [
          {
            title: t('table.date'),
            dataIndex: 'date',
            key: 'date',
            width: 100,
          } as const,
        ]
      : []),
    {
      title: t('table.actions'),
      key: 'actions',
      width: 80,
      render: (_, record) =>
        record.status === 'active' ? (
          <Button
            size="small"
            danger
            icon={<LogoutOutlined />}
            onClick={() => exitVisitor(record.id)}
          />
        ) : null,
    },
  ];

  return (
    <Card styles={{ body: { padding: 16 } }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'flex-end' }} size="middle" wrap>
        <Button
          icon={<FilePdfOutlined />}
          onClick={handleExportPdf}
          style={{
            background: 'rgb(68, 114, 196)',
            borderColor: 'rgb(68, 114, 196)',
            color: 'white',
          }}
        >
          {t('frontdesk.exportPdf')}
        </Button>
        <Button
          icon={<FileExcelOutlined />}
          onClick={handleExportExcel}
          style={{
            background: 'rgb(127, 188, 66)',
            borderColor: 'rgb(127, 188, 66)',
            color: 'white',
          }}
        >
          {t('frontdesk.exportExcel')}
        </Button>
      </Space>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={24} lg={6}>
          <Input
            size="large"
            placeholder={t('common.search')}
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Select
            size="large"
            style={{ width: '100%' }}
            value={selectedFloor}
            onChange={setSelectedFloor}
            placeholder={t('frontdesk.filterByFloor')}
            options={[
              { value: 'all', label: t('frontdesk.allFloors') },
              { value: 1, label: `${t('visitor.floor')} 1` },
              { value: 2, label: `${t('visitor.floor')} 2` },
              { value: 3, label: `${t('visitor.floor')} 3` },
            ]}
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Select
            size="large"
            style={{ width: '100%' }}
            value={dateMode}
            onChange={(v: DateMode) => setDateMode(v)}
            placeholder={t('frontdesk.filterByDate')}
            options={[
              { value: 'today', label: t('frontdesk.today') },
              { value: 'specific', label: t('frontdesk.filterByDate') },
              { value: 'range', label: t('frontdesk.dateRange') },
              { value: 'all', label: t('frontdesk.allDates') },
            ]}
          />
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Select
            size="large"
            style={{ width: '100%' }}
            value={periodMode}
            onChange={(v: PeriodMode) => setPeriodMode(v)}
            placeholder={t('frontdesk.viewBy')}
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
        <Col xs={24} sm={24} lg={8}>
          {dateMode === 'specific' && (
            <DatePicker
              size="large"
              style={{ width: '100%' }}
              value={singleDate}
              onChange={(d) => d && setSingleDate(d)}
              format="YYYY-MM-DD"
              allowClear={false}
            />
          )}
          {dateMode === 'range' && (
            <RangePicker
              size="large"
              style={{ width: '100%' }}
              value={dateRange as [Dayjs, Dayjs] | null}
              onChange={(vals) => setDateRange(vals as [Dayjs | null, Dayjs | null] | null)}
              format="YYYY-MM-DD"
            />
          )}
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredVisitors}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        size="middle"
        tableLayout="fixed"
      />
    </Card>
  );
}
