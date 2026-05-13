import { useTranslation } from 'react-i18next';
import { Card, Row, Col, Statistic } from 'antd';
import {
  TeamOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  BuildOutlined,
} from '@ant-design/icons';
import { useVisitorStore } from '../../store/visitorStore';
import {
  computeTotalHoursToday,
  getMostVisitedFloor,
  getTodayDateString,
} from '../../utils/timeUtils';

export default function StatCards() {
  const { t } = useTranslation();
  // Subscribe to the visitors array directly so stats refresh on changes
  const visitors = useVisitorStore(state => state.visitors);

  const today = getTodayDateString();
  const todayVisitors = visitors.filter(v => v.date === today);
  const activeToday = todayVisitors.filter(v => v.status === 'active');

  const stats = [
    {
      label: t('frontdesk.totalToday'),
      value: todayVisitors.length,
      icon: <TeamOutlined />,
      color: 'rgb(68, 114, 196)',
      bg: 'rgba(68, 114, 196, 0.15)',
    },
    {
      label: t('frontdesk.activeVisitors'),
      value: activeToday.length,
      icon: <RiseOutlined />,
      color: 'rgb(127, 188, 66)',
      bg: 'rgba(127, 188, 66, 0.15)',
    },
    {
      label: t('frontdesk.totalHours'),
      value: computeTotalHoursToday(todayVisitors),
      icon: <ClockCircleOutlined />,
      color: 'rgb(0, 166, 207)',
      bg: 'rgba(0, 166, 207, 0.15)',
    },
    {
      label: t('frontdesk.mostVisited'),
      value: getMostVisitedFloor(todayVisitors),
      icon: <BuildOutlined />,
      color: 'rgb(5, 99, 193)',
      bg: 'rgba(5, 99, 193, 0.15)',
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {stats.map((stat, idx) => (
        <Col xs={24} sm={12} lg={6} key={idx}>
          <Card styles={{ body: { padding: 24 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Statistic
                  title={stat.label}
                  value={stat.value}
                  valueStyle={{ color: stat.color, fontSize: 28, fontWeight: 700 }}
                />
              </div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: stat.bg,
                  color: stat.color,
                  fontSize: 24,
                }}
              >
                {stat.icon}
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
