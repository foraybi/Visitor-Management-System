import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useFloorContactStore } from '../../store/floorContactStore';
import { useFloorStore } from '../../store/floorStore';
import { useUIStore } from '../../store/uiStore';
import type { FloorContact } from '../../types';

const { Title, Paragraph } = Typography;

interface ContactFormValues {
  floor: number;
  name: string;
  phone?: string;
}

/**
 * The administration contacts for each floor, edited by an admin.
 *
 * The front desk sees this list, numbered per floor, when a company's founder
 * or employee list is full.
 */
export default function FloorContactsCard() {
  const { t } = useTranslation();
  const language = useUIStore((s) => s.language);
  const floors = useFloorStore((s) => s.floors);
  const { contacts, addContact, updateContact, deleteContact } = useFloorContactStore();
  const [editing, setEditing] = useState<FloorContact | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<ContactFormValues>();

  const sortedFloors = [...floors].sort((a, b) => a.number - b.number);

  const openAdd = (floor?: number) => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ floor: floor ?? sortedFloors[0]?.number });
    setOpen(true);
  };

  const openEdit = (contact: FloorContact) => {
    setEditing(contact);
    form.setFieldsValue({ floor: contact.floor, name: contact.name, phone: contact.phone });
    setOpen(true);
  };

  const submit = (values: ContactFormValues) => {
    const data = { floor: values.floor, name: values.name.trim(), phone: (values.phone ?? '').trim() };
    if (editing) {
      updateContact(editing.id, data);
    } else {
      const sortOrder = contacts.filter((c) => c.floor === values.floor).length;
      addContact({ ...data, sortOrder });
    }
    setOpen(false);
  };

  const columns: ColumnsType<FloorContact> = [
    { title: '#', key: 'index', width: 50, render: (_, __, index) => index + 1 },
    { title: t('incubation.contactName'), dataIndex: 'name', key: 'name' },
    {
      title: t('incubation.contactPhone'),
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => <span dir="ltr">{phone || '—'}</span>,
    },
    {
      title: t('table.actions'),
      key: 'actions',
      width: 110,
      render: (_, contact) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} aria-label={t('incubation.editContact')} onClick={() => openEdit(contact)} />
          <Popconfirm
            title={t('incubation.deleteContactConfirm')}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteContact(contact.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>{t('incubation.contactsTitle')}</Title>}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd()} disabled={sortedFloors.length === 0}>
          {t('incubation.addContact')}
        </Button>
      }
    >
      <Paragraph type="secondary" style={{ marginTop: 0 }}>{t('incubation.contactsHint')}</Paragraph>

      {sortedFloors.length === 0 ? (
        <Empty description={t('visitor.noFloors')} />
      ) : (
        sortedFloors.map((floor) => {
          const rows = contacts.filter((c) => c.floor === floor.number);
          return (
            <div key={floor.id} style={{ marginBottom: 20 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {t('incubation.floorAdmins', { floor: language === 'ar' ? floor.nameAr : floor.name })}
                </Title>
                <Button size="small" icon={<PlusOutlined />} onClick={() => openAdd(floor.number)}>
                  {t('incubation.addContact')}
                </Button>
              </Space>
              <Table
                columns={columns}
                dataSource={rows}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: t('incubation.noContacts') }}
              />
            </div>
          );
        })
      )}

      <Modal
        open={open}
        title={editing ? t('incubation.editContact') : t('incubation.addContact')}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        centered
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 16 }}>
          <Form.Item label={t('visitor.floor')} name="floor" rules={[{ required: true, message: t('common.required') }]}>
            <Select
              size="large"
              options={sortedFloors.map((f) => ({ value: f.number, label: language === 'ar' ? f.nameAr : f.name }))}
            />
          </Form.Item>
          <Form.Item
            label={t('incubation.contactName')}
            name="name"
            rules={[{ required: true, whitespace: true, message: t('common.required') }]}
          >
            <Input size="large" maxLength={120} />
          </Form.Item>
          <Form.Item label={t('incubation.contactPhone')} name="phone">
            <Input size="large" inputMode="tel" maxLength={32} dir="ltr" placeholder="05XXXXXXXX" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
