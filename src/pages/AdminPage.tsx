import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Space } from 'antd';
import { useUIStore } from '../store/uiStore';
import Sidebar from '../components/frontdesk/Sidebar';
import StatCards from '../components/frontdesk/StatCards';
import VisitorTable from '../components/frontdesk/VisitorTable';
import CompaniesTab from '../components/frontdesk/CompaniesTab';
import ManagementTab from '../components/admin/ManagementTab';
import AnalyticsTab from '../components/admin/AnalyticsTab';
import FloorsTab from '../components/admin/FloorsTab';
import FormEditorTab from '../components/admin/FormEditorTab';
import DocumentSettingsTab from '../components/admin/DocumentSettingsTab';
import AttendanceTab from '../components/admin/AttendanceTab';
import DashboardHeader from '../components/staff/DashboardHeader';

export default function AdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('visitors');
  const { dir } = useUIStore();

  const isRTL = dir === 'rtl';

  const sections: Record<string, { title: string; content: ReactNode }> = {
    visitors: {
      title: t('frontdesk.visitors'),
      content: (
        <>
          <StatCards />
          <VisitorTable />
        </>
      ),
    },
    companies: { title: t('frontdesk.companies'), content: <CompaniesTab /> },
    attendance: { title: t('admin.attendance'), content: <AttendanceTab /> },
    analytics: { title: t('admin.analytics'), content: <AnalyticsTab /> },
    floors: { title: t('admin.manageFloors'), content: <FloorsTab /> },
    management: { title: t('admin.manageUsers'), content: <ManagementTab /> },
    formEditor: { title: t('admin.formEditor'), content: <FormEditorTab /> },
    documentSettings: { title: t('admin.documentSettings'), content: <DocumentSettingsTab /> },
  };

  const section = sections[activeTab] ?? sections.visitors;

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
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <DashboardHeader title={section.title} />
          {section.content}
        </Space>
      </div>
    </div>
  );
}
