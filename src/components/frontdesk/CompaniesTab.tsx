import CompanyDirectory from '../staff/CompanyDirectory';

/**
 * The companies screen for the front desk and the admin dashboard.
 *
 * Both see the same table; adding is limited by each company's places, and only
 * the management screen passes the admin edit and delete actions.
 */
export default function CompaniesTab() {
  return <CompanyDirectory />;
}
