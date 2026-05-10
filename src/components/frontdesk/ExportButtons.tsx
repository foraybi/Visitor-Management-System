import { useTranslation } from 'react-i18next';
import { Button, Space } from 'antd';
import { FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useVisitorStore } from '../../store/visitorStore';
import { exportVisitorsPdf } from '../../utils/exportPdf';
import { exportVisitorsExcel } from '../../utils/exportExcel';

export default function ExportButtons() {
  const { t } = useTranslation();
  const { getTodayVisitors } = useVisitorStore();

  return (
    <Space size="middle">
      <Button
        size="large"
        icon={<FilePdfOutlined />}
        onClick={() => exportVisitorsPdf(getTodayVisitors())}
        style={{
          background: 'rgb(68, 114, 196)',
          borderColor: 'rgb(68, 114, 196)',
          color: 'white',
        }}
      >
        {t('frontdesk.exportPdf')}
      </Button>
      <Button
        size="large"
        icon={<FileExcelOutlined />}
        onClick={() => exportVisitorsExcel(getTodayVisitors())}
        style={{
          background: 'rgb(127, 188, 66)',
          borderColor: 'rgb(127, 188, 66)',
          color: 'white',
        }}
      >
        {t('frontdesk.exportExcel')}
      </Button>
    </Space>
  );
}
