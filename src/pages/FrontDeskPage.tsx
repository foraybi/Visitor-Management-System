import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ConfigProvider, Space, Tooltip } from 'antd';
import { MutedOutlined, SoundOutlined } from '@ant-design/icons';
import { SoundProvider, useSoundEnabled } from 'react-sounds';
import { useUIStore } from '../store/uiStore';
import Sidebar from '../components/frontdesk/Sidebar';
import StatCards from '../components/frontdesk/StatCards';
import VisitorTable from '../components/frontdesk/VisitorTable';
import CompaniesTab from '../components/frontdesk/CompaniesTab';
import DashboardHeader from '../components/staff/DashboardHeader';
import { useVisitorSounds } from '../app/staff/visitorSounds';

/** Saudi green. The front desk screen only; admin keeps the brand teal. */
const FRONTDESK_GREEN = 'rgb(0, 108, 53)';

function FrontDeskScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('visitors');
  const { dir } = useUIStore();
  const [soundsOn, setSoundsOn] = useSoundEnabled();

  useVisitorSounds(soundsOn);

  // On <body> rather than a wrapper: modals and dropdowns render into body, and
  // they should be green too.
  useEffect(() => {
    document.body.classList.add('theme-frontdesk');
    return () => document.body.classList.remove('theme-frontdesk');
  }, []);

  const isRTL = dir === 'rtl';
  const soundLabel = soundsOn ? t('common.soundsOn') : t('common.soundsOff');

  const soundToggle = (
    <Tooltip title={soundLabel}>
      <Button
        shape="circle"
        size="large"
        icon={soundsOn ? <SoundOutlined /> : <MutedOutlined />}
        aria-label={soundLabel}
        aria-pressed={soundsOn}
        onClick={() => setSoundsOn(!soundsOn)}
      />
    </Tooltip>
  );

  return (
    <div className="floating-orbs" style={{ minHeight: '100vh' }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div
        style={{
          [isRTL ? 'marginRight' : 'marginLeft']: 256,
          padding: 32,
          minHeight: '100vh',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {activeTab === 'visitors' ? (
            <>
              <DashboardHeader title={t('frontdesk.visitors')} extra={soundToggle} />
              <StatCards />
              <VisitorTable />
            </>
          ) : (
            <>
              <DashboardHeader title={t('frontdesk.companies')} extra={soundToggle} />
              <CompaniesTab />
            </>
          )}
        </Space>
      </div>
    </div>
  );
}

export default function FrontDeskPage() {
  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: FRONTDESK_GREEN, colorInfo: FRONTDESK_GREEN, colorLink: FRONTDESK_GREEN },
        components: { Button: { colorPrimary: FRONTDESK_GREEN } },
      }}
    >
      <SoundProvider initialEnabled={true}>
        <FrontDeskScreen />
      </SoundProvider>
    </ConfigProvider>
  );
}
