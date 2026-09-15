import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Col,
  DatePicker,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import {
  BLOCKING_ISSUES,
  buildImportCandidates,
  type ImportCandidate,
  type ImportIssue,
} from '../../domain/incubation/importCompanies';
import { identityLabelKey } from '../../domain/identity/identity';
import { useCompanyStore, type ImportCompanyPayload } from '../../store/companyStore';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import { readSpreadsheet } from '../../utils/readSpreadsheet';

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

type StatusFilter = 'all' | 'approved' | 'registered' | 'rejected';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ISSUE_COLOR: Record<ImportIssue, string> = {
  missing_company_name: 'red',
  duplicate_in_file: 'orange',
  already_exists: 'orange',
  missing_founder_name: 'gold',
  missing_identity: 'gold',
  invalid_identity: 'gold',
  identity_type_corrected: 'blue',
  missing_counts: 'gold',
};

/**
 * Import incubated companies from the registration export.
 *
 * The admin sees every row before anything is written: which will be imported,
 * with which founder, and what was missing or corrected. Founder and employee
 * places can be adjusted per row. Only approved rows without a blocking problem
 * are ticked to start with.
 */
export default function ImportCompaniesModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const language = useUIStore((s) => s.language);
  const companies = useCompanyStore((s) => s.companies);
  const importCompanies = useCompanyStore((s) => s.importCompanies);
  const floors = useFloorStore((s) => s.floors);

  const [fileName, setFileName] = useState('');
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [limits, setLimits] = useState<Record<string, { founders: number; employees: number }>>({});
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [floor, setFloor] = useState<number | undefined>(undefined);
  const [period, setPeriod] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  const [importing, setImporting] = useState(false);

  const sortedFloors = useMemo(() => [...floors].sort((a, b) => a.number - b.number), [floors]);

  const reset = () => {
    setFileName('');
    setCandidates([]);
    setSelected([]);
    setLimits({});
    setFilter('all');
    setReadError('');
  };

  const close = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setReading(true);
    setReadError('');
    try {
      const rows = await readSpreadsheet(file);
      if (rows.length === 0) {
        setReadError(t('incubation.importEmpty'));
        setCandidates([]);
        return;
      }
      const built = buildImportCandidates(
        rows,
        companies.map((c) => ({ name: c.name, nameAr: c.nameAr, crNumber: c.crNumber, importRef: c.importRef })),
      );
      setFileName(file.name);
      setCandidates(built);
      setSelected(built.filter((c) => c.selectedByDefault).map((c) => c.key));
      setLimits(Object.fromEntries(built.map((c) => [c.key, { founders: c.foundersLimit, employees: c.employeesLimit }])));
    } catch (error) {
      console.error('import read failed:', error);
      setReadError(t('incubation.importReadFailed'));
      setCandidates([]);
    } finally {
      setReading(false);
    }
  };

  const visible = filter === 'all' ? candidates : candidates.filter((c) => c.status === filter);

  const submit = async () => {
    if (floor === undefined) return;
    const chosen = candidates.filter((c) => selected.includes(c.key) && !c.issues.includes('missing_company_name'));
    const payload: ImportCompanyPayload[] = chosen.map((c) => ({
      importRef: c.importRef,
      name: c.name,
      nameAr: c.nameAr,
      phone: c.phone,
      floor,
      crNumber: c.crNumber,
      foundersLimit: limits[c.key]?.founders ?? c.foundersLimit,
      employeesLimit: limits[c.key]?.employees ?? c.employeesLimit,
      incubationStart: period?.[0]?.format('YYYY-MM-DD') ?? null,
      incubationEnd: period?.[1]?.format('YYYY-MM-DD') ?? null,
      founder: c.founder,
    }));

    setImporting(true);
    const result = await importCompanies(payload);
    setImporting(false);

    if (!result.ok) {
      message.error(t('incubation.importFailed', { error: result.error }));
      return;
    }
    message.success(t('incubation.importDone', result));
    reset();
    onClose();
  };

  const statusTag = (status: string) => {
    const color = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'default';
    const label =
      status === 'approved'
        ? t('incubation.statusApproved')
        : status === 'rejected'
          ? t('incubation.statusRejected')
          : t('incubation.statusRegistered');
    return <Tag color={color} style={{ margin: 0 }}>{label}</Tag>;
  };

  const columns: ColumnsType<ImportCandidate> = [
    {
      title: t('table.companyName'),
      key: 'company',
      width: 220,
      render: (_, c) => (
        <div>
          <div className="cell-main">{language === 'ar' ? c.nameAr : c.name}</div>
          <div className="cell-sub">{language === 'ar' ? c.name : c.nameAr}</div>
        </div>
      ),
    },
    {
      title: t('incubation.crNumber'),
      key: 'cr',
      width: 120,
      render: (_, c) => <span dir="ltr" className="cell-mono">{c.crNumber ?? '—'}</span>,
    },
    {
      title: t('incubation.founderColumn'),
      key: 'founder',
      width: 220,
      render: (_, c) =>
        c.founder ? (
          <div>
            <div className="cell-main">{language === 'ar' ? c.founder.nameAr : c.founder.name}</div>
            <div className="cell-sub">
              {t(identityLabelKey(c.founder.nationalityType))} · <span dir="ltr">{c.founder.nationalityIdNumber}</span>
            </div>
          </div>
        ) : (
          <Text type="secondary">{t('incubation.noFounder')}</Text>
        ),
    },
    {
      title: t('incubation.foundersLimit'),
      key: 'founders',
      width: 110,
      render: (_, c) => (
        <InputNumber
          min={c.founder ? 1 : 0}
          max={1000}
          value={limits[c.key]?.founders}
          onChange={(v) =>
            setLimits((prev) => ({ ...prev, [c.key]: { ...prev[c.key], founders: Math.max(c.founder ? 1 : 0, Number(v ?? 0)) } }))
          }
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('incubation.employeesLimit'),
      key: 'employees',
      width: 110,
      render: (_, c) => (
        <InputNumber
          min={0}
          max={100000}
          value={limits[c.key]?.employees}
          onChange={(v) => setLimits((prev) => ({ ...prev, [c.key]: { ...prev[c.key], employees: Number(v ?? 0) } }))}
          style={{ width: '100%' }}
        />
      ),
    },
    { title: t('incubation.status'), key: 'status', width: 100, render: (_, c) => statusTag(c.status) },
    {
      title: t('incubation.issues'),
      key: 'issues',
      width: 220,
      render: (_, c) =>
        c.issues.length === 0 ? (
          <Text type="secondary">—</Text>
        ) : (
          <Space size={4} wrap>
            {c.issues.map((issue) => (
              <Tag key={issue} color={ISSUE_COLOR[issue]} style={{ margin: 0 }}>
                {t(`incubation.issue.${issue}`)}
              </Tag>
            ))}
          </Space>
        ),
    },
  ];

  const counts = {
    total: candidates.length,
    approved: candidates.filter((c) => c.status === 'approved').length,
    registered: candidates.filter((c) => c.status === 'registered').length,
    rejected: candidates.filter((c) => c.status === 'rejected').length,
  };
  const selectedCount = candidates.filter((c) => selected.includes(c.key) && !c.issues.includes('missing_company_name')).length;

  return (
    <Modal
      open={open}
      title={t('incubation.importTitle')}
      onCancel={close}
      width="min(1180px, 96vw)"
      centered
      destroyOnHidden
      footer={
        candidates.length > 0 ? (
          <Space>
            <Button onClick={close} disabled={importing}>{t('common.cancel')}</Button>
            <Button
              type="primary"
              onClick={submit}
              loading={importing}
              disabled={selectedCount === 0 || floor === undefined}
            >
              {t('incubation.importSubmit', { count: selectedCount })}
            </Button>
          </Space>
        ) : null
      }
    >
      <Paragraph type="secondary">{t('incubation.importHint')}</Paragraph>

      {candidates.length === 0 ? (
        <>
          <Upload.Dragger
            accept=".csv,.xlsx,.xls"
            multiple={false}
            showUploadList={false}
            disabled={reading}
            beforeUpload={(file) => {
              void handleFile(file);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">{reading ? t('incubation.importReading') : t('incubation.importDrop')}</p>
          </Upload.Dragger>
          {readError && <Alert type="error" showIcon message={readError} style={{ marginTop: 16 }} />}
        </>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={[12, 12]} align="bottom">
            <Col xs={24} md={8}>
              <Text strong>{t('incubation.importFloor')}</Text>
              <Select
                size="large"
                style={{ width: '100%', marginTop: 4 }}
                placeholder={t('incubation.importFloor')}
                value={floor}
                onChange={setFloor}
                status={floor === undefined ? 'warning' : undefined}
                options={sortedFloors.map((f) => ({ value: f.number, label: language === 'ar' ? f.nameAr : f.name }))}
              />
            </Col>
            <Col xs={24} md={9}>
              <Text strong>{t('incubation.importPeriod')}</Text>
              <RangePicker
                size="large"
                style={{ width: '100%', marginTop: 4 }}
                value={period as [Dayjs, Dayjs] | null}
                onChange={(v) => setPeriod(v as [Dayjs | null, Dayjs | null] | null)}
                format="YYYY-MM-DD"
              />
            </Col>
            <Col xs={24} md={7} style={{ textAlign: 'end' }}>
              <Text type="secondary">{fileName}</Text>
              <br />
              <Button type="link" onClick={reset} style={{ paddingInline: 0 }}>{t('incubation.importAnother')}</Button>
            </Col>
          </Row>

          <Row justify="space-between" align="middle" gutter={[12, 12]}>
            <Col>
              <Segmented<StatusFilter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: `${t('frontdesk.all')} (${counts.total})` },
                  { value: 'approved', label: `${t('incubation.statusApproved')} (${counts.approved})` },
                  { value: 'registered', label: `${t('incubation.statusRegistered')} (${counts.registered})` },
                  { value: 'rejected', label: `${t('incubation.statusRejected')} (${counts.rejected})` },
                ]}
              />
            </Col>
            <Col>
              <Text strong>{t('incubation.importRows', { total: counts.total, selected: selectedCount })}</Text>
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={visible}
            rowKey="key"
            size="middle"
            tableLayout="fixed"
            scroll={{ x: 1100, y: 420 }}
            pagination={false}
            rowSelection={{
              selectedRowKeys: selected,
              preserveSelectedRowKeys: true,
              onChange: setSelected,
              getCheckboxProps: (c) => ({ disabled: c.issues.includes('missing_company_name') }),
            }}
            rowClassName={(c) => (c.issues.some((i) => BLOCKING_ISSUES.has(i)) ? 'import-row-blocked' : '')}
          />
        </Space>
      )}
    </Modal>
  );
}
