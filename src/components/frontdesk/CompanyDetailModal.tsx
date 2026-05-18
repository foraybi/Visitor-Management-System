import { useMemo } from 'react';
import { Modal, Descriptions, Table, Tag, Typography } from 'antd';
import { ManOutlined, WomanOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { useVisitorStore } from '../../store/visitorStore';
import { useUIStore } from '../../store/uiStore';
import type { Company, Employee } from '../../types';

const { Title } = Typography;

interface CompanyDetailModalProps {
  company: Company;
  onClose: () => void;
}

export default function CompanyDetailModal({ company, onClose }: CompanyDetailModalProps) {
  const { t } = useTranslation();
  const { language } = useUIStore();
  const visitors = useVisitorStore(state => state.visitors);

  const insideEmployees = useMemo(() => {
    const set = new Set<string>();
    for (const v of visitors) {
      if (v.visitorType === 'employee' && v.status === 'active') {
        set.add(v.nationalityIdNumber);
      }
    }
    return set;
  }, [visitors]);

  const columns: ColumnsType<Employee> = [
    {
      title: t('visitor.employeeNumber'),
      dataIndex: 'employeeNumber',
      key: 'employeeNumber',
      width: 90,
      render: n => <strong style={{ color: 'rgb(0, 114, 151)' }}>{n}</strong>,
    },
    {
      title: t('company.name'),
      key: 'name',
      render: (_, r) => (language === 'ar' ? r.nameAr : r.name),
    },
    { title: t('table.phone'), dataIndex: 'phone', key: 'phone' },
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
      title: t('employee.jobType'),
      dataIndex: 'jobType',
      key: 'jobType',
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
      render: (s: string) => (
        <Tag color={s === 'active' ? 'green' : 'default'}>
          {s === 'active' ? t('employee.active') : t('employee.inactive')}
        </Tag>
      ),
    },
    {
      title: t('employee.visitStatus'),
      key: 'visitStatus',
      render: (_, r) =>
        insideEmployees.has(r.employeeNumber) ? (
          <Tag color="success">
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'rgb(127,188,66)', marginInlineEnd: 6 }} />
            {t('employee.inside')}
          </Tag>
        ) : (
          <Tag color="default">{t('employee.outside')}</Tag>
        ),
    },
  ];

  return (
    <Modal open={true} onCancel={onClose} footer={null} title={company.name} width={960} centered>
      <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('company.name')}>{company.name}</Descriptions.Item>
        <Descriptions.Item label={t('company.nameAr')}>{company.nameAr}</Descriptions.Item>
        <Descriptions.Item label={t('company.phone')}>{company.phone}</Descriptions.Item>
        <Descriptions.Item label={t('visitor.floor')}>
          {t('visitor.floor')} {company.floor}
        </Descriptions.Item>
      </Descriptions>

      <Title level={4}>{t('company.employees')}</Title>
      <Table
        columns={columns}
        dataSource={company.employees}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={{ x: 900 }}
      />
    </Modal>
  );
}
