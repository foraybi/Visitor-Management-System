import type { ReactNode } from 'react';
import {
  CrownOutlined,
  CustomerServiceOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { Role } from '../../domain/access/access';

/**
 * Each role's colour, so who is signed in is recognisable at a glance: purple
 * for super admin, teal for admin, Saudi green for front desk.
 */
export const ROLE_TONE: Record<Role, { color: string; icon: ReactNode }> = {
  superadmin: { color: '#6d28d9', icon: <CrownOutlined /> },
  admin: { color: '#007297', icon: <SafetyCertificateOutlined /> },
  frontdesk: { color: '#006c35', icon: <CustomerServiceOutlined /> },
};
