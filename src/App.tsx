import { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import arEG from 'antd/locale/ar_EG';
import './index.css';
import AppRouter from './router/AppRouter';
import { useUIStore } from './store/uiStore';
import { useAuthStore } from './store/authStore';
import { useVisitorStore } from './store/visitorStore';
import { useCompanyStore } from './store/companyStore';
import { useFloorStore } from './store/floorStore';
import { useFormConfigStore } from './store/formConfigStore';
import { useDocumentSettingsStore } from './store/documentSettingsStore';
import { useSeedData } from './hooks/useSeedData';
import './i18n';

function App() {
  const { dir, language } = useUIStore();
  const initialize = useAuthStore(s => s.initialize);
  const fetchVisitors = useVisitorStore(s => s.fetchVisitors);
  const subscribeToVisitors = useVisitorStore(s => s.subscribeToVisitors);
  const fetchCompanies = useCompanyStore(s => s.fetchCompanies);
  const fetchFloors = useFloorStore(s => s.fetchFloors);
  const fetchFormConfig = useFormConfigStore(s => s.fetchFormConfig);
  const fetchDocumentSettings = useDocumentSettingsStore(s => s.fetchDocumentSettings);

  useSeedData();

  useEffect(() => {
    initialize();
    fetchVisitors();
    fetchCompanies();
    fetchFloors();
    fetchFormConfig();
    fetchDocumentSettings();
    const unsubscribe = subscribeToVisitors();
    return unsubscribe;
  }, [initialize, fetchVisitors, subscribeToVisitors, fetchCompanies, fetchFloors, fetchFormConfig, fetchDocumentSettings]);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  return (
    <ConfigProvider
      direction={dir}
      locale={language === 'ar' ? arEG : enUS}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: 'rgb(0, 114, 151)',
          colorInfo: 'rgb(0, 166, 207)',
          colorSuccess: 'rgb(127, 188, 66)',
          colorWarning: 'rgb(255, 180, 0)',
          colorError: 'rgb(239, 68, 68)',
          colorBgContainer: 'rgba(255, 255, 255, 0.7)',
          colorBgElevated: 'rgba(255, 255, 255, 0.95)',
          colorBorder: 'rgba(255, 255, 255, 0.4)',
          borderRadius: 12,
          fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif",
        },
        components: {
          Card: {
            colorBgContainer: 'rgba(255, 255, 255, 0.7)',
          },
          Button: {
            colorPrimary: 'rgb(0, 114, 151)',
          },
        },
      }}
    >
      <AppRouter />
    </ConfigProvider>
  );
}

export default App;
