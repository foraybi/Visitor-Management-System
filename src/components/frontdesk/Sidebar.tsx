import { useTranslation } from 'react-i18next';
import { Menu, Button, Typography, Space } from 'antd';
import {
  TeamOutlined,
  BankOutlined,
  LogoutOutlined,
  GlobalOutlined,
  SettingOutlined,
  PieChartOutlined,
  AppstoreOutlined,
  FormOutlined,
  FileTextOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { ROLE_TONE } from '../staff/roleTone';

const { Title } = Typography;

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  showAdminMenu?: boolean;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  showAdminMenu = false,
}: SidebarProps) {
  const { t } = useTranslation();
  const { language, toggleLanguage, dir } = useUIStore();
  const { currentRole, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isRTL = dir === 'rtl';

  const menuItems = [
    {
      key: 'visitors',
      icon: <TeamOutlined />,
      label: t('frontdesk.visitors'),
    },
    {
      key: 'companies',
      icon: <BankOutlined />,
      label: t('frontdesk.companies'),
    },
    ...(showAdminMenu
      ? [
          {
            key: 'attendance',
            icon: <CalendarOutlined />,
            label: t('admin.attendance'),
          },
          {
            key: 'analytics',
            icon: <PieChartOutlined />,
            label: t('admin.analytics'),
          },
          {
            key: 'floors',
            icon: <AppstoreOutlined />,
            label: t('admin.manageFloors'),
          },
          {
            key: 'management',
            icon: <SettingOutlined />,
            label: t('admin.manageUsers'),
          },
          {
            key: 'formEditor',
            icon: <FormOutlined />,
            label: t('admin.formEditor'),
          },
          {
            key: 'documentSettings',
            icon: <FileTextOutlined />,
            label: t('admin.documentSettings'),
          },
        ]
      : []),
  ];

  return (
    <div
      className={isRTL ? 'glass-sidebar-rtl' : 'glass-sidebar'}
      style={{
        width: 256,
        height: '100vh',
        position: 'fixed',
        top: 0,
        [isRTL ? 'right' : 'left']: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      <div style={{ padding: 24, borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>
          {t('common.appName')}
        </Title>
        {/* Every role by name. This used to say "Front desk" for anyone who was
            not exactly an admin, super admins included. */}
        {currentRole && (
          <span className="sidebar-role" style={{ background: ROLE_TONE[currentRole].color }}>
            {ROLE_TONE[currentRole].icon}
            {t(`staff.roles.${currentRole}`)}
          </span>
        )}
      </div>

      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        <Menu
          mode="inline"
          selectedKeys={[activeTab]}
          items={menuItems}
          onClick={({ key }) => onTabChange(key)}
          style={{ background: 'transparent' }}
        />
      </div>

      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Button
            block
            icon={<GlobalOutlined />}
            onClick={toggleLanguage}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
            }}
          >
            {language === 'ar' ? 'English' : 'العربية'}
          </Button>
          <Button
            block
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            {t('common.exit')}
          </Button>
        </Space>
      </div>
    </div>
  );
}
