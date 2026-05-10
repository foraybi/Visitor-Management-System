import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Row, Col, Empty, Typography } from 'antd';
import { Pie, Column, Line } from '@ant-design/charts';
import { useVisitorStore } from '../../store/visitorStore';
import { useCompanyStore } from '../../store/companyStore';

const { Title } = Typography;

const BRAND_COLORS = [
  'rgb(0, 114, 151)',
  'rgb(0, 166, 207)',
  'rgb(16, 154, 169)',
  'rgb(127, 188, 66)',
  'rgb(68, 114, 196)',
  'rgb(101, 171, 194)',
  'rgb(5, 99, 193)',
  'rgb(5, 117, 127)',
];

export default function AnalyticsTab() {
  const { t } = useTranslation();
  const { visitors } = useVisitorStore();
  const { companies } = useCompanyStore();

  // Gender distribution (from company employees)
  const genderData = useMemo(() => {
    const counts = { male: 0, female: 0 };
    companies.forEach(c => {
      c.employees.forEach(e => {
        counts[e.gender] += 1;
      });
    });
    return [
      { type: t('company.male'), value: counts.male },
      { type: t('company.female'), value: counts.female },
    ].filter(d => d.value > 0);
  }, [companies, t]);

  // Visitor type distribution
  const visitorTypeData = useMemo(() => {
    const counts = { visitor: 0, employee: 0 };
    visitors.forEach(v => {
      counts[v.visitorType] += 1;
    });
    return [
      { type: t('visitor.visitor'), value: counts.visitor },
      { type: t('visitor.employee'), value: counts.employee },
    ].filter(d => d.value > 0);
  }, [visitors, t]);

  // Visits by floor
  const floorData = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    visitors.forEach(v => {
      counts[v.floor] = (counts[v.floor] ?? 0) + 1;
    });
    return [1, 2, 3].map(floor => ({
      floor: `${t('visitor.floor')} ${floor}`,
      visits: counts[floor] ?? 0,
    }));
  }, [visitors, t]);

  // Peak hours (0-23)
  const peakHoursData = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) counts[h] = 0;
    visitors.forEach(v => {
      const hour = new Date(v.entryTime).getHours();
      counts[hour] = (counts[hour] ?? 0) + 1;
    });
    return Object.entries(counts).map(([hour, visits]) => ({
      hour: `${hour.padStart(2, '0')}:00`,
      visits,
    }));
  }, [visitors]);

  // Visits by nationality (top 6)
  const nationalityData = useMemo(() => {
    const counts: Record<string, number> = {};
    visitors.forEach(v => {
      counts[v.countryName] = (counts[v.countryName] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([country, visits]) => ({ country, visits }));
  }, [visitors]);

  // Visits over last 7 days
  const weeklyData = useMemo(() => {
    const counts: Record<string, number> = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0];
      counts[key] = 0;
    }
    visitors.forEach(v => {
      if (counts[v.date] !== undefined) counts[v.date] += 1;
    });
    return Object.entries(counts).map(([date, visits]) => ({
      date: date.slice(5),
      visits,
    }));
  }, [visitors]);

  return (
    <Row gutter={[16, 16]}>
      {/* Gender distribution */}
      <Col xs={24} lg={8}>
        <Card
          title={
            <Title level={5} style={{ margin: 0 }}>
              Employees by Gender
            </Title>
          }
          styles={{ body: { height: 320 } }}
        >
          {genderData.length === 0 ? (
            <Empty description="No data" />
          ) : (
            <Pie
              data={genderData}
              angleField="value"
              colorField="type"
              radius={0.85}
              innerRadius={0.5}
              scale={{
                color: {
                  range: ['rgb(68, 114, 196)', 'rgb(0, 166, 207)'],
                },
              }}
              label={{
                text: 'value',
                style: { fontWeight: 600, fill: '#fff' },
              }}
              legend={{ color: { position: 'bottom' } }}
              height={260}
            />
          )}
        </Card>
      </Col>

      {/* Visitor type */}
      <Col xs={24} lg={8}>
        <Card
          title={
            <Title level={5} style={{ margin: 0 }}>
              Visitors vs Employees
            </Title>
          }
          styles={{ body: { height: 320 } }}
        >
          {visitorTypeData.length === 0 ? (
            <Empty description="No visits yet" />
          ) : (
            <Pie
              data={visitorTypeData}
              angleField="value"
              colorField="type"
              radius={0.85}
              innerRadius={0.5}
              scale={{
                color: {
                  range: ['rgb(0, 114, 151)', 'rgb(127, 188, 66)'],
                },
              }}
              label={{
                text: 'value',
                style: { fontWeight: 600, fill: '#fff' },
              }}
              legend={{ color: { position: 'bottom' } }}
              height={260}
            />
          )}
        </Card>
      </Col>

      {/* Visits by floor */}
      <Col xs={24} lg={8}>
        <Card
          title={
            <Title level={5} style={{ margin: 0 }}>
              Visits by Floor
            </Title>
          }
          styles={{ body: { height: 320 } }}
        >
          {floorData.every(d => d.visits === 0) ? (
            <Empty description="No visits yet" />
          ) : (
            <Column
              data={floorData}
              xField="floor"
              yField="visits"
              colorField="floor"
              scale={{
                color: {
                  range: [
                    'rgb(0, 114, 151)',
                    'rgb(0, 166, 207)',
                    'rgb(16, 154, 169)',
                  ],
                },
              }}
              label={{
                text: 'visits',
                position: 'top',
                style: { fontWeight: 600 },
              }}
              legend={false}
              height={260}
            />
          )}
        </Card>
      </Col>

      {/* Peak hours */}
      <Col xs={24} lg={16}>
        <Card
          title={
            <Title level={5} style={{ margin: 0 }}>
              Peak Visit Hours
            </Title>
          }
          styles={{ body: { height: 340 } }}
        >
          {peakHoursData.every(d => d.visits === 0) ? (
            <Empty description="No visits yet" />
          ) : (
            <Column
              data={peakHoursData}
              xField="hour"
              yField="visits"
              style={{
                fill: 'rgb(0, 114, 151)',
                radiusTopLeft: 4,
                radiusTopRight: 4,
              }}
              height={280}
            />
          )}
        </Card>
      </Col>

      {/* Nationality distribution */}
      <Col xs={24} lg={8}>
        <Card
          title={
            <Title level={5} style={{ margin: 0 }}>
              Top Nationalities
            </Title>
          }
          styles={{ body: { height: 340 } }}
        >
          {nationalityData.length === 0 ? (
            <Empty description="No data" />
          ) : (
            <Pie
              data={nationalityData}
              angleField="visits"
              colorField="country"
              radius={0.85}
              scale={{ color: { range: BRAND_COLORS } }}
              label={{
                text: 'country',
                style: { fontSize: 11 },
              }}
              legend={{ color: { position: 'bottom' } }}
              height={280}
            />
          )}
        </Card>
      </Col>

      {/* Weekly trend */}
      <Col xs={24}>
        <Card
          title={
            <Title level={5} style={{ margin: 0 }}>
              Visits — Last 7 Days
            </Title>
          }
          styles={{ body: { height: 340 } }}
        >
          {weeklyData.every(d => d.visits === 0) ? (
            <Empty description="No visits yet" />
          ) : (
            <Line
              data={weeklyData}
              xField="date"
              yField="visits"
              style={{
                stroke: 'rgb(0, 114, 151)',
                lineWidth: 3,
              }}
              point={{
                sizeField: 6,
                style: {
                  fill: 'rgb(0, 166, 207)',
                  stroke: 'rgb(0, 114, 151)',
                  lineWidth: 2,
                },
              }}
              area={{
                style: {
                  fill: 'linear-gradient(-90deg, rgba(0,114,151,0) 0%, rgba(0,114,151,0.4) 100%)',
                },
              }}
              height={280}
            />
          )}
        </Card>
      </Col>
    </Row>
  );
}
