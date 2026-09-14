import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Tag, Typography } from 'antd';
import { useAuthStore } from '../../store/authStore';
import { ROLE_TONE } from './roleTone';

const { Title } = Typography;

function initials(text: string): string {
  const parts = text.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

/** The section title, with the signed-in person and their role badge. */
export default function DashboardHeader({ title, extra }: { title: string; extra?: ReactNode }) {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.currentRole);
  const name = useAuthStore((s) => s.currentName);
  const email = useAuthStore((s) => s.currentEmail);

  const display = name || email || '';
  const tone = role ? ROLE_TONE[role] : null;

  return (
    <div className="dashboard-header">
      <Title level={2} style={{ color: 'var(--brand)', margin: 0 }}>
        {title}
      </Title>

      <div className="dashboard-header-end">
        {extra}
        {role && tone && (
          <div className="dashboard-user" style={{ borderColor: tone.color }}>
            <Avatar style={{ background: tone.color, flex: 'none' }}>{initials(display)}</Avatar>
            <div style={{ minWidth: 0 }}>
              <div className="dashboard-user-label">{t('common.signedInAs')}</div>
              <div className="dashboard-user-name" title={email ?? undefined}>
                {display}
              </div>
            </div>
            <Tag color={tone.color} icon={tone.icon} className="dashboard-role-tag">
              {t(`staff.roles.${role}`)}
            </Tag>
          </div>
        )}
      </div>
    </div>
  );
}
