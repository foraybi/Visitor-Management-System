import { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import arEG from 'antd/locale/ar_EG';
import './index.css';
import AppRouter from './router/AppRouter';
import { useUIStore } from './store/uiStore';
import { useSeedData } from './hooks/useSeedData';
import './i18n';

function App() {
  const { dir, language } = useUIStore();
  useSeedData();

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
