import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Row, Col, Statistic } from 'antd';
import {
  TeamOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  BuildOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { visitDurationMs } from '../../domain/attendance/attendance';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import { useVisitorStore } from '../../store/visitorStore';
import { useFormatDuration } from '../common/useFormatDuration';

export default function StatCards() {
  const { t } = useTranslation();
  const { language } = useUIStore();
  const formatDuration = useFormatDuration();
  // Subscribe to the visitors array directly so stats refresh on changes
  const visitors = useVisitorStore(state => state.visitors);
  const floors = useFloorStore(state => state.floors);

  const { todayCount, activeCount, totalMs, busiestFloor } = useMemo(() => {
    // The building's local date, which is how visits are dated. The previous
    // UTC date rolled over at 3am in Riyadh.
    const today = dayjs().format('YYYY-MM-DD');
    const todayVisitors = visitors.filter(v => v.date === today);

    const perFloor = new Map<number, number>();
    for (const v of todayVisitors) perFloor.set(v.floor, (perFloor.get(v.floor) ?? 0) + 1);
    const busiest = [...perFloor.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      todayCount: todayVisitors.length,
      activeCount: todayVisitors.filter(v => v.status === 'active').length,
      totalMs: todayVisitors.reduce((sum, v) => sum + (visitDurationMs(v.entryTime, v.exitTime) ?? 0), 0),
      busiestFloor: busiest,
    };
  }, [visitors]);

  const floorLabel = (num: number | null) => {
    if (num === null) return '—';
    const floor = floors.find(f => f.number === num);
    if (!floor) return `${t('visitor.floor')} ${num}`;
    return language === 'ar' ? floor.nameAr : floor.name;
  };

  const stats = [
    {
      label: t('frontdesk.totalToday'),
      value: todayCount,
      icon: <TeamOutlined />,
      color: 'var(--brand)',
      bg: 'rgba(var(--brand-rgb), 0.12)',
    },
    {
      label: t('frontdesk.activeVisitors'),
      value: activeCount,
      icon: <RiseOutlined />,
      color: 'rgb(82, 150, 30)',
      bg: 'rgba(127, 188, 66, 0.15)',
    },
    {
      label: t('frontdesk.totalHours'),
      value: formatDuration(totalMs),
      icon: <ClockCircleOutlined />,
      color: 'rgb(0, 140, 180)',
      bg: 'rgba(0, 166, 207, 0.15)',
    },
    {
      label: t('frontdesk.mostVisited'),
      value: floorLabel(busiestFloor),
      icon: <BuildOutlined />,
      color: 'rgb(5, 99, 193)',
      bg: 'rgba(5, 99, 193, 0.12)',
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {stats.map(stat => (
        <Col xs={24} sm={12} lg={6} key={stat.label}>
          <Card styles={{ body: { padding: 24 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
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
