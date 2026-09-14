import { useTranslation } from 'react-i18next';
import { Row, Col, Empty } from 'antd';
import { BuildOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useUIStore } from '../../store/uiStore';


/**
 * The floor fields this grid renders. Narrower than the stored record on
 * purpose: the kiosk receives only these, and widening the prop would drag the
 * database row shape onto the tablet.
 */
export interface FloorOption {
  number: number;
  name: string;
  nameAr: string;
  imageUrl: string;
}

interface FloorGridProps {
  value: number | null;
  onChange: (floor: number) => void;
  floors: FloorOption[];
}

/**
 * The floor picker.
 *
 * The chosen floor has to be obvious from across a lobby, so selection is
 * carried by several cues at once rather than a border colour alone: a thick
 * brand outline with a glow, a check badge, a "Selected" label, and the other
 * floors dimmed.
 */
export default function FloorGrid({ value, onChange, floors }: FloorGridProps) {
  const { t } = useTranslation();
  const { language } = useUIStore();

  if (floors.length === 0) {
    return <Empty description={t('visitor.noFloors')} />;
  }

  const sortedFloors = [...floors].sort((a, b) => a.number - b.number);
  const colSpan = sortedFloors.length <= 3 ? 24 / sortedFloors.length : 8;
  const hasSelection = value !== null;

  return (
    <Row gutter={[16, 16]} role="radiogroup" aria-label={t('visitor.floor')}>
      {sortedFloors.map((floor) => {
        const selected = value === floor.number;
        return (
          <Col xs={24} sm={12} md={colSpan} key={floor.number}>
            <div
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => onChange(floor.number)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange(floor.number);
                }
              }}
              className={`floor-card${selected ? ' floor-card-selected' : ''}${
                hasSelection && !selected ? ' floor-card-dimmed' : ''
              }`}
            >
              {selected && (
                <span className="floor-card-badge" aria-hidden>
                  <CheckCircleFilled />
                </span>
              )}

              {floor.imageUrl ? (
                <div className="floor-card-media" style={{ backgroundImage: `url(${floor.imageUrl})` }} />
              ) : (
                <div className="floor-card-media floor-card-media-empty">
                  <BuildOutlined />
                </div>
              )}

              <div className="floor-card-body">
                <div className="floor-card-name">
                  {language === 'ar' ? floor.nameAr : floor.name}
                </div>
                <div className="floor-card-meta">
                  {selected ? (
                    <span className="floor-card-selected-label">
                      <CheckCircleFilled /> {t('visitor.floorSelected')}
                    </span>
                  ) : (
                    <>
                      {t('visitor.floor')} {floor.number}
                    </>
                  )}
                </div>
              </div>
            </div>
          </Col>
        );
      })}
    </Row>
  );
}
