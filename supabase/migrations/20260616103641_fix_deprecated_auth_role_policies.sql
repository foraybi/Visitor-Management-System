-- Recovered from the cloud project's migration history, where it was applied
-- from the dashboard but never committed here. Kept so the local directory and
-- the remote history agree; 20260909000004_policies.sql replaces every policy
-- below.

-- Replace all deprecated auth.role() policies with the modern TO authenticated syntax

-- companies
DROP POLICY companies_modify ON companies;
CREATE POLICY companies_modify ON companies
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- employees
DROP POLICY employees_modify ON employees;
CREATE POLICY employees_modify ON employees
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- floors
DROP POLICY floors_modify ON floors;
CREATE POLICY floors_modify ON floors
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- form_config
DROP POLICY form_config_modify ON form_config;
CREATE POLICY form_config_modify ON form_config
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- document_settings
DROP POLICY doc_settings_modify ON document_settings;
CREATE POLICY doc_settings_modify ON document_settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- profiles
DROP POLICY profiles_auth ON profiles;
CREATE POLICY profiles_auth ON profiles
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
