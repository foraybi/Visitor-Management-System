import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table, Input, Select, Tag, Button, Row, Col } from 'antd';
import { SearchOutlined, LogoutOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useVisitorStore } from '../../store/visitorStore';
import { formatTimeFromISO } from '../../utils/timeUtils';
import type { Floor, Visitor } from '../../types';

export default function VisitorTable() {
  const { t } = useTranslation();
  const { getTodayVisitors, exitVisitor } = useVisitorStore();
  const [selectedFloor, setSelectedFloor] = useState<Floor | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const todayVisitors = getTodayVisitors();

  const filteredVisitors = useMemo(() => {
    return todayVisitors.filter(v => {
      const floorMatch = selectedFloor === 'all' || v.floor === selectedFloor;
      const term = searchTerm.toLowerCase();
      const searchMatch =
        !term ||
        v.id.toLowerCase().includes(term) ||
        v.name.toLowerCase().includes(term) ||
        v.phone.includes(searchTerm);
      return floorMatch && searchMatch;
    });
  }, [todayVisitors, selectedFloor, searchTerm]);

  const columns: ColumnsType<Visitor> = [
    {
      title: t('table.visitorId'),
      dataIndex: 'id',
      key: 'id',
      render: id => (
        <span style={{ fontWeight: 600, color: 'rgb(0, 114, 151)' }}>{id}</span>
      ),
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      key: 'status',
      render: status => (
        <Tag
          color={status === 'active' ? 'success' : 'default'}
          style={{ borderRadius: 8, padding: '4px 12px' }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background:
                status === 'active'
                  ? 'rgb(127, 188, 66)'
                  : 'rgb(156, 163, 175)',
              marginInlineEnd: 8,
            }}
          />
          {status === 'active' ? t('table.active') : t('table.exited')}
        </Tag>
      ),
    },
    {
      title: t('table.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('table.phone'),
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: t('table.nationality'),
      dataIndex: 'countryName',
      key: 'countryName',
    },
    {
      title: t('visitor.floor'),
      dataIndex: 'floor',
      key: 'floor',
      render: floor => <Tag color="blue">Floor {floor}</Tag>,
    },
    {
      title: t('table.entryTime'),
      dataIndex: 'entryTime',
      key: 'entryTime',
      render: formatTimeFromISO,
    },
    {
      title: t('table.exitTime'),
      dataIndex: 'exitTime',
      key: 'exitTime',
      render: formatTimeFromISO,
    },
    {
      title: t('table.actions'),
      key: 'actions',
      render: (_, record) =>
        record.status === 'active' ? (
          <Button
            size="small"
            danger
            icon={<LogoutOutlined />}
            onClick={() => exitVisitor(record.id)}
          >
            Exit
          </Button>
        ) : null,
    },
  ];

  return (
    <Card styles={{ body: { padding: 24 } }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
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

      <Table
        columns={columns}
        dataSource={filteredVisitors}
        rowKey="id"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: 1000 }}
      />
    </Card>
  );
}
