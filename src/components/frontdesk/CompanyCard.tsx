import { Card, Typography, Tag, Space } from 'antd';
import { PhoneOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Company } from '../../types';

const { Title, Text } = Typography;

interface CompanyCardProps {
  company: Company;
  onClick: () => void;
}

export default function CompanyCard({ company, onClick }: CompanyCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      hoverable
      onClick={onClick}
      style={{ cursor: 'pointer', height: '100%' }}
      styles={{ body: { padding: 24 } }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            background:
              'linear-gradient(135deg, rgb(0, 114, 151), rgb(0, 166, 207))',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          {company.name.charAt(0).toUpperCase()}
        </div>
        <Tag color="cyan">
          {t('visitor.floor')} {company.floor}
        </Tag>
      </div>

      <Title level={4} style={{ margin: 0 }}>
        {company.name}
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {company.nameAr}
      </Text>

      <Space direction="vertical" size={4}>
        <Space>
          <TeamOutlined style={{ color: 'rgb(0, 114, 151)' }} />
          <Text>
            {company.employees.length} {t('company.employees')}
          </Text>
        </Space>
        <Space>
          <PhoneOutlined style={{ color: 'rgb(0, 114, 151)' }} />
          <Text>{company.phone}</Text>
        </Space>
      </Space>
    </Card>
  );
}
