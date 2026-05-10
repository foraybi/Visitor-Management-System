import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Input, Select, Row, Col, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useCompanyStore } from '../../store/companyStore';
import type { Floor } from '../../types';
import CompanyCard from './CompanyCard';
import CompanyDetailModal from './CompanyDetailModal';

export default function CompaniesTab() {
  const { t } = useTranslation();
  const { companies } = useCompanyStore();
  const [selectedFloor, setSelectedFloor] = useState<Floor | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const floorMatch = selectedFloor === 'all' || c.floor === selectedFloor;
      const term = searchTerm.toLowerCase();
      const searchMatch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.nameAr.includes(searchTerm) ||
        c.phone.includes(searchTerm);
      return floorMatch && searchMatch;
    });
  }, [companies, selectedFloor, searchTerm]);

  const selectedCompanyData = companies.find(c => c.id === selectedCompany);

  return (
    <div>
      <Card styles={{ body: { padding: 20 } }} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Input
              size="large"
              placeholder={t('common.search')}
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={selectedFloor}
              onChange={setSelectedFloor}
              options={[
                { value: 'all', label: t('frontdesk.allFloors') },
                { value: 1, label: `${t('visitor.floor')} 1` },
                { value: 2, label: `${t('visitor.floor')} 2` },
                { value: 3, label: `${t('visitor.floor')} 3` },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {filteredCompanies.length === 0 ? (
        <Card>
          <Empty description="No companies found" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredCompanies.map(company => (
            <Col xs={24} sm={12} lg={8} key={company.id}>
              <CompanyCard
                company={company}
                onClick={() => setSelectedCompany(company.id)}
              />
            </Col>
          ))}
        </Row>
      )}

      {selectedCompanyData && (
        <CompanyDetailModal
          company={selectedCompanyData}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
  );
}
