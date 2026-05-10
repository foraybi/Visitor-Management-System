import { Modal, Descriptions, Table, Tag, Typography } from 'antd';
import { ManOutlined, WomanOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import type { Company, Employee } from '../../types';

const { Title } = Typography;

interface CompanyDetailModalProps {
  company: Company;
  onClose: () => void;
}

export default function CompanyDetailModal({
  company,
  onClose,
}: CompanyDetailModalProps) {
  const { t } = useTranslation();

  const columns: ColumnsType<Employee> = [
    {
      title: t('company.name'),
      dataIndex: 'name',
      key: 'name',
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
  ];

  return (
    <Modal
      open={true}
      onCancel={onClose}
      footer={null}
      title={company.name}
      width={720}
      centered
    >
      <Descriptions
        bordered
        column={2}
        size="small"
        style={{ marginBottom: 24 }}
      >
        <Descriptions.Item label={t('company.name')}>
          {company.name}
        </Descriptions.Item>
        <Descriptions.Item label={t('company.nameAr')}>
          {company.nameAr}
        </Descriptions.Item>
        <Descriptions.Item label={t('company.phone')}>
          {company.phone}
        </Descriptions.Item>
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
      />
    </Modal>
  );
}
