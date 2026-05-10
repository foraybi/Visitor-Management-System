import { useTranslation } from 'react-i18next';
import { Row, Col, Card, Empty } from 'antd';
import { BuildOutlined } from '@ant-design/icons';
import { useUIStore } from '../../store/uiStore';
import type { FloorInfo } from '../../types';

interface FloorGridProps {
  value: number | null;
  onChange: (floor: number) => void;
  floors: FloorInfo[];
}

export default function FloorGrid({ value, onChange, floors }: FloorGridProps) {
  const { t } = useTranslation();
  const { language } = useUIStore();

  if (floors.length === 0) {
    return <Empty description="No floors configured" />;
  }

  // Sort by floor number
  const sortedFloors = [...floors].sort((a, b) => a.number - b.number);

  const colSpan = sortedFloors.length <= 3 ? 24 / sortedFloors.length : 8;

  return (
    <Row gutter={[16, 16]}>
      {sortedFloors.map(floor => (
        <Col xs={24} sm={12} md={colSpan} key={floor.id}>
          <Card
            hoverable
            onClick={() => onChange(floor.number)}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              border:
                value === floor.number
                  ? '2px solid rgb(0, 114, 151)'
                  : '2px solid rgba(0, 0, 0, 0.06)',
              background:
                value === floor.number
                  ? 'rgba(0, 114, 151, 0.08)'
                  : 'rgba(255, 255, 255, 0.7)',
              transition: 'all 0.3s',
              overflow: 'hidden',
            }}
            styles={{ body: { padding: 0 } }}
          >
            {floor.imageUrl ? (
              <div
                style={{
                  height: 100,
                  backgroundImage: `url(${floor.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            ) : (
              <div
                style={{
                  height: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    value === floor.number
                      ? 'linear-gradient(135deg, rgb(0, 114, 151), rgb(0, 166, 207))'
                      : 'linear-gradient(135deg, #f5f5f5, #e0e0e0)',
                }}
              >
                <BuildOutlined
                  style={{
                    fontSize: 40,
                    color: value === floor.number ? 'white' : '#9ca3af',
                  }}
                />
              </div>
            )}
            <div style={{ padding: 16 }}>
              <div
                style={{
                  fontWeight: 700,
                  color: value === floor.number ? 'rgb(0, 114, 151)' : '#1f1f1f',
                  fontSize: 16,
                }}
              >
                {language === 'ar' ? floor.nameAr : floor.name}
              </div>
              <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
                {t('visitor.floor')} {floor.number}
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
