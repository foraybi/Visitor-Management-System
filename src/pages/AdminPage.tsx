import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Space, Flex } from 'antd';
import { useUIStore } from '../store/uiStore';
import Sidebar from '../components/frontdesk/Sidebar';
import StatCards from '../components/frontdesk/StatCards';
import VisitorTable from '../components/frontdesk/VisitorTable';
import CompaniesTab from '../components/frontdesk/CompaniesTab';
import ExportButtons from '../components/frontdesk/ExportButtons';
import ManagementTab from '../components/admin/ManagementTab';
import AnalyticsTab from '../components/admin/AnalyticsTab';
import FloorsTab from '../components/admin/FloorsTab';

const { Title } = Typography;

export default function AdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('visitors');
  const { dir } = useUIStore();

  const isRTL = dir === 'rtl';

  const renderContent = () => {
    switch (activeTab) {
      case 'visitors':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Flex justify="space-between" align="center" wrap="wrap" gap="middle">
              <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
                {t('frontdesk.visitors')}
              </Title>
              <ExportButtons />
            </Flex>
            <StatCards />
            <VisitorTable />
          </Space>
        );
      case 'companies':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
              {t('frontdesk.companies')}
            </Title>
            <CompaniesTab />
          </Space>
        );
      case 'analytics':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
              {t('admin.analytics')}
            </Title>
            <AnalyticsTab />
          </Space>
        );
      case 'floors':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
              {t('admin.manageFloors')}
            </Title>
            <FloorsTab />
          </Space>
        );
      case 'management':
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2} style={{ color: 'rgb(0, 114, 151)', margin: 0 }}>
              {t('admin.manageUsers')}
            </Title>
            <ManagementTab />
          </Space>
        );
      default:
        return null;
    }
  };

  return (
    <div className="floating-orbs" style={{ minHeight: '100vh' }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showAdminMenu={true}
      />

      <div
        style={{
          [isRTL ? 'marginRight' : 'marginLeft']: 256,
          padding: 32,
          minHeight: '100vh',
        }}
      >
        {renderContent()}
      </div>
    </div>
  );
}
