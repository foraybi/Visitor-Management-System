import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { EyeOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
// Weekday names in Arabic. Without this dayjs silently falls back to English.
import 'dayjs/locale/ar';
import {
  buildAttendance,
  type AttendanceRecord,
  type EmployeeAttendance,
} from '../../domain/attendance/attendance';
import { useCompanyStore } from '../../store/companyStore';
import { useUIStore } from '../../store/uiStore';
import { useVisitorStore } from '../../store/visitorStore';
import { formatTimeFromISO } from '../../utils/timeUtils';
import LiveDuration from '../common/LiveDuration';
import { useFormatDuration } from '../common/useFormatDuration';
import type { Employee } from '../../types';

dayjs.extend(isoWeek);

const { RangePicker } = DatePicker;
const { Text, Paragraph } = Typography;

type View = 'overview' | 'employee';
type Row = EmployeeAttendance<Employee>;

/**
 * Attendance for each company's employees, from their kiosk check-ins.
 *
 * Two views over one period: the company overview, one row per employee with
 * days present and total time, and one employee's individual check-ins with
 * time in, time out and time spent. Both export to Excel for the record.
 */
export default function AttendanceTab() {
  const { t } = useTranslation();
  const { language } = useUIStore();
  const companies = useCompanyStore((s) => s.companies);
  const visitors = useVisitorStore((s) => s.visitors);
  const formatDuration = useFormatDuration();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [period, setPeriod] = useState<[Dayjs, Dayjs]>(() => [dayjs().startOf('month'), dayjs()]);
  const [view, setView] = useState<View>('overview');
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const company = companies.find((c) => c.id === companyId) ?? companies[0] ?? null;
  const from = period[0].format('YYYY-MM-DD');
  const to = period[1].format('YYYY-MM-DD');
  const today = dayjs().format('YYYY-MM-DD');

  const sheet = useMemo(
    () => (company ? buildAttendance(company.employees, visitors, { from, to }) : null),
    [company, visitors, from, to],
  );

  const selected = sheet?.employees.find((e) => e.employee.id === employeeId) ?? sheet?.employees[0] ?? null;

  const employeeName = (e: Employee) => (language === 'ar' ? e.nameAr || e.name : e.name || e.nameAr);
  const companyLabel = (c: { name: string; nameAr: string }) => (language === 'ar' ? c.nameAr : c.name);

  if (!company || !sheet) {
    return (
      <Card>
        <Empty description={t('admin.attendanceNoCompanies')} />
      </Card>
    );
  }

  const openRecord = (r: AttendanceRecord) =>
    r.date === today ? (
      <LiveDuration entryTime={r.entryTime} exitTime={null} />
    ) : (
      <Tag color="warning" style={{ margin: 0 }}>{t('admin.attendanceNoCheckout')}</Tag>
    );

  const overviewColumns: ColumnsType<Row> = [
    {
      title: t('admin.attendanceEmployee'),
      key: 'employee',
      width: 210,
      render: (_, r) => (
        <div className="visitor-cell">
          <div className="visitor-avatar" data-type="employee" aria-hidden>
            {(employeeName(r.employee).trim()[0] ?? '?').toUpperCase()}
          </div>
          <div className="visitor-cell-text">
            <div className="cell-main">{employeeName(r.employee)}</div>
            <div className="cell-sub" dir="ltr">#{r.employee.employeeNumber}</div>
          </div>
        </div>
      ),
    },
    {
      title: t('admin.attendanceDaysPresent'),
      dataIndex: 'daysPresent',
      key: 'daysPresent',
      width: 95,
      sorter: (a, b) => a.daysPresent - b.daysPresent,
      render: (n: number) => <strong>{n}</strong>,
    },
    {
      title: t('admin.attendanceCheckIns'),
      dataIndex: 'checkIns',
      key: 'checkIns',
      width: 95,
      sorter: (a, b) => a.checkIns - b.checkIns,
    },
    {
      title: t('admin.attendanceTotalTime'),
      key: 'totalMs',
      width: 115,
      sorter: (a, b) => a.totalMs - b.totalMs,
      defaultSortOrder: 'descend',
      render: (_, r) => <strong>{formatDuration(r.totalMs)}</strong>,
    },
    {
      title: t('admin.attendanceAverage'),
      key: 'average',
      width: 115,
      render: (_, r) => (r.daysPresent > 0 ? formatDuration(r.averageMsPerDay) : '—'),
    },
    {
      title: t('admin.attendanceLastVisit'),
      key: 'last',
      width: 150,
      render: (_, r) =>
        r.lastRecord ? (
          <div>
            <div className="cell-main" dir="ltr" style={{ textAlign: 'start' }}>{r.lastRecord.date}</div>
            <div className="cell-sub" dir="ltr">
              {formatTimeFromISO(r.lastRecord.entryTime)} → {r.lastRecord.exitTime ? formatTimeFromISO(r.lastRecord.exitTime) : '…'}
            </div>
          </div>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: t('table.status'),
      key: 'status',
      width: 125,
      render: (_, r) => {
        if (r.checkIns === 0) return <Tag style={{ margin: 0 }}>{t('employee.neverVisited')}</Tag>;
        if (r.lastRecord && r.lastRecord.exitTime === null && r.lastRecord.date === today) {
          return (
            <Tag color="success" style={{ margin: 0 }}>
              <span className="status-dot" />
              {t('employee.inside')}
            </Tag>
          );
        }
        return <Tag style={{ margin: 0 }}>{t('employee.outside')}</Tag>;
      },
    },
    {
      title: t('table.actions'),
      key: 'actions',
      width: 150,
      render: (_, r) => (
        <Button
          icon={<EyeOutlined />}
          disabled={r.checkIns === 0}
          onClick={() => {
            setEmployeeId(r.employee.id);
            setView('employee');
          }}
        >
          {t('admin.attendanceView')}
        </Button>
      ),
    },
  ];

  const recordColumns: ColumnsType<AttendanceRecord> = [
    {
      title: t('table.date'),
      dataIndex: 'date',
      key: 'date',
      width: 140,
      render: (d: string) => (
        <div>
          <div className="cell-main" dir="ltr" style={{ textAlign: 'start' }}>{d}</div>
          <div className="cell-sub">{dayjs(d).locale(language).format('dddd')}</div>
        </div>
      ),
    },
    {
      title: t('table.entryTime'),
      key: 'in',
      width: 120,
      render: (_, r) => <span dir="ltr">{formatTimeFromISO(r.entryTime)}</span>,
    },
    {
      title: t('table.exitTime'),
      key: 'out',
      width: 140,
      render: (_, r) =>
        r.exitTime ? <span dir="ltr">{formatTimeFromISO(r.exitTime)}</span> : openRecord(r),
    },
    {
      title: t('table.timeSpent'),
      key: 'spent',
      width: 140,
      render: (_, r) =>
        r.durationMs !== null ? <strong>{formatDuration(r.durationMs)}</strong> : openRecord(r),
    },
  ];

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = view === 'employee' && selected ? [selected] : sheet.employees;
    const header = [
      t('visitor.employeeNumber'),
      t('admin.attendanceEmployee'),
      t('table.date'),
      t('table.entryTime'),
      t('table.exitTime'),
      t('table.timeSpent'),
    ];
    const body = rows.flatMap((r) =>
      [...r.records].reverse().map((rec) => [
        r.employee.employeeNumber,
        employeeName(r.employee),
        rec.date,
        formatTimeFromISO(rec.entryTime),
        rec.exitTime ? formatTimeFromISO(rec.exitTime) : t('admin.attendanceNoCheckout'),
        rec.durationMs !== null ? formatDuration(rec.durationMs) : '',
      ]),
    );
    const sheetData = XLSX.utils.aoa_to_sheet([
      [companyLabel(company), `${from} → ${to}`],
      [],
      header,
      ...body,
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheetData, t('admin.attendanceSheetName'));
    const who = view === 'employee' && selected ? `-${selected.employee.employeeNumber}` : '';
    XLSX.writeFile(workbook, `Attendance-${company.name.replace(/[^\w-]+/g, '_')}${who}-${from}_${to}.xlsx`);
  };

  const presets = [
    { label: t('admin.attendanceToday'), value: [dayjs().startOf('day'), dayjs()] as [Dayjs, Dayjs] },
    { label: t('admin.attendanceThisWeek'), value: [dayjs().startOf('isoWeek'), dayjs()] as [Dayjs, Dayjs] },
    { label: t('admin.attendanceThisMonth'), value: [dayjs().startOf('month'), dayjs()] as [Dayjs, Dayjs] },
    {
      label: t('admin.attendanceLastMonth'),
      value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] as [Dayjs, Dayjs],
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card styles={{ body: { padding: 16 } }}>
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          {t('admin.attendanceDescription')}
        </Paragraph>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={8}>
            <Text strong>{t('admin.attendanceCompany')}</Text>
            <Select
              size="large"
              style={{ width: '100%', marginTop: 4 }}
              value={company.id}
              showSearch
              optionFilterProp="label"
              onChange={(id: string) => {
                setCompanyId(id);
                setEmployeeId(null);
              }}
              options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))}
            />
          </Col>
          <Col xs={24} md={9}>
            <Text strong>{t('admin.attendancePeriod')}</Text>
            <RangePicker
              size="large"
              style={{ width: '100%', marginTop: 4 }}
              value={period}
              allowClear={false}
              format="YYYY-MM-DD"
              presets={presets}
              onChange={(vals) => {
                if (vals?.[0] && vals[1]) setPeriod([vals[0], vals[1]]);
              }}
            />
          </Col>
          <Col xs={24} md={7} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="large"
              icon={<FileExcelOutlined style={{ color: '#1d6f42' }} />}
              onClick={exportExcel}
              disabled={sheet.checkIns === 0}
            >
              {t('frontdesk.exportExcel')}
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic
              title={t('admin.attendanceEmployeesPresent')}
              value={sheet.employeesPresent}
              suffix={`/ ${sheet.employees.length}`}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title={t('admin.attendanceCheckIns')} value={sheet.checkIns} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title={t('admin.attendanceTotalTime')} value={formatDuration(sheet.totalMs)} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title={t('admin.attendanceOpenVisits')} value={sheet.openVisits} />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 16 } }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Segmented<View>
            size="large"
            value={view}
            onChange={setView}
            options={[
              { value: 'overview', label: t('admin.attendanceOverview') },
              { value: 'employee', label: t('admin.attendanceByEmployee') },
            ]}
          />

          {view === 'overview' ? (
            <Table
              columns={overviewColumns}
              dataSource={sheet.employees}
              rowKey={(r) => r.employee.id}
              size="middle"
              tableLayout="fixed"
              scroll={{ x: 1055 }}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              locale={{ emptyText: <Empty description={t('admin.attendanceNoRecords')} /> }}
            />
          ) : (
            <>
              <Row gutter={[12, 12]} align="middle">
                <Col xs={24} md={10}>
                  <Select
                    size="large"
                    style={{ width: '100%' }}
                    placeholder={t('admin.attendanceSelectEmployee')}
                    value={selected?.employee.id}
                    showSearch
                    optionFilterProp="label"
                    onChange={setEmployeeId}
                    options={sheet.employees.map((r) => ({
                      value: r.employee.id,
                      label: `${employeeName(r.employee)} (#${r.employee.employeeNumber})`,
                    }))}
                  />
                </Col>
                {selected && (
                  <Col xs={24} md={14}>
                    <Space size="large" wrap>
                      <Text>
                        {t('admin.attendanceDaysPresent')}: <strong>{selected.daysPresent}</strong>
                      </Text>
                      <Text>
                        {t('admin.attendanceTotalTime')}: <strong>{formatDuration(selected.totalMs)}</strong>
                      </Text>
                      <Text>
                        {t('admin.attendanceAverage')}:{' '}
                        <strong>{selected.daysPresent > 0 ? formatDuration(selected.averageMsPerDay) : '—'}</strong>
                      </Text>
                    </Space>
                  </Col>
                )}
              </Row>
              <Table
                columns={recordColumns}
                dataSource={selected?.records ?? []}
                rowKey="visitId"
                size="middle"
                tableLayout="fixed"
                scroll={{ x: 600 }}
                pagination={{ pageSize: 15, showSizeChanger: false }}
                locale={{ emptyText: <Empty description={t('admin.attendanceNoRecords')} /> }}
              />
            </>
          )}
        </Space>
      </Card>
    </Space>
  );
}
