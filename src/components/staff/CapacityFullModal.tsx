import { useTranslation } from 'react-i18next';
import { Modal, Result, Typography, Empty } from 'antd';
import { PhoneOutlined } from '@ant-design/icons';
import { useFloorContactStore } from '../../store/floorContactStore';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import type { EmployeeType } from '../../types';

const { Title, Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  /** The company's floor, listed first. */
  companyFloor: number | null;
  type: EmployeeType | null;
}

/**
 * Shown to the front desk when a company's founder or employee list is full.
 *
 * The front desk cannot raise a limit, so this names who can: the
 * administration contacts for each floor, with the company's own floor first.
 */
export default function CapacityFullModal({ open, onClose, companyFloor, type }: Props) {
  const { t } = useTranslation();
  const language = useUIStore((s) => s.language);
  const contacts = useFloorContactStore((s) => s.contacts);
  const floors = useFloorStore((s) => s.floors);

  const floorName = (number: number) => {
    const floor = floors.find((f) => f.number === number);
    if (!floor) return `${t('visitor.floor')} ${number}`;
    return language === 'ar' ? floor.nameAr : floor.name;
  };

  const floorNumbers = [...new Set(contacts.map((c) => c.floor))].sort((a, b) => {
    if (a === companyFloor) return -1;
    if (b === companyFloor) return 1;
    return a - b;
  });

  const listLabel = type === 'founder' ? t('incubation.founders') : t('incubation.employees');

  return (
    <Modal open={open} onCancel={onClose} onOk={onClose} okText={t('common.close')} cancelButtonProps={{ hidden: true }} centered width="min(520px, 94vw)">
      <Result
        status="warning"
        title={t('incubation.fullTitle', { list: listLabel })}
        subTitle={t('incubation.fullBody')}
        style={{ paddingBottom: 8 }}
      />

      {floorNumbers.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('incubation.noContacts')} />
      ) : (
        floorNumbers.map((floor) => (
          <div key={floor} style={{ marginBottom: 16 }}>
            <Title level={5} style={{ marginBottom: 8 }}>
              {t('incubation.floorAdmins', { floor: floorName(floor) })}
            </Title>
            <ol style={{ margin: 0, paddingInlineStart: 22 }}>
              {contacts
                .filter((c) => c.floor === floor)
                .map((c) => (
                  <li key={c.id} style={{ marginBottom: 6 }}>
                    <Text strong>{c.name}</Text>
                    {c.phone && (
                      <>
                        {': '}
                        <a href={`tel:${c.phone}`} dir="ltr">
                          <PhoneOutlined /> {c.phone}
                        </a>
                      </>
                    )}
                  </li>
                ))}
            </ol>
          </div>
        ))
      )}
    </Modal>
  );
}
