import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Table,
  Space,
  Popconfirm,
  Typography,
  Upload,
  Image as AntImage,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  BuildOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import { useFloorStore } from '../../store/floorStore';
import type { FloorInfo } from '../../types';

const { Title } = Typography;

export default function FloorsTab() {
  const { t } = useTranslation();
  const { floors, addFloor, updateFloor, deleteFloor } = useFloorStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<FloorInfo | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [form] = Form.useForm();

  const openAdd = () => {
    setEditingFloor(null);
    setImageUrl('');
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (floor: FloorInfo) => {
    setEditingFloor(floor);
    setImageUrl(floor.imageUrl);
    form.setFieldsValue(floor);
    setModalOpen(true);
  };

  const handleSubmit = (values: Omit<FloorInfo, 'id' | 'imageUrl'>) => {
    const data = { ...values, imageUrl };
    if (editingFloor) {
      updateFloor(editingFloor.id, data);
      message.success('Floor updated');
    } else {
      addFloor(data);
      message.success('Floor added');
    }
    setModalOpen(false);
    form.resetFields();
    setImageUrl('');
  };

  const uploadProps: UploadProps = {
    name: 'image',
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      return false; // prevent auto upload
    },
  };

  const columns: ColumnsType<FloorInfo> = [
    {
      title: t('admin.floorImage'),
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 100,
      render: (url: string) =>
        url ? (
          <AntImage
            src={url}
            alt=""
            width={64}
            height={64}
            style={{ objectFit: 'cover', borderRadius: 8 }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgb(0, 114, 151), rgb(0, 166, 207))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BuildOutlined style={{ color: 'white', fontSize: 24 }} />
          </div>
        ),
    },
    {
      title: t('admin.floorNumber'),
      dataIndex: 'number',
      key: 'number',
      sorter: (a, b) => a.number - b.number,
      render: (num) => <strong style={{ color: 'rgb(0, 114, 151)' }}>{num}</strong>,
    },
    {
      title: t('admin.floorName') + ' (EN)',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('admin.floorName') + ' (AR)',
      dataIndex: 'nameAr',
      key: 'nameAr',
    },
    {
      title: t('table.actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            {t('common.edit')}
          </Button>
          <Popconfirm
            title="Delete floor?"
            description="This cannot be undone"
            onConfirm={() => {
              deleteFloor(record.id);
              message.success('Floor deleted');
            }}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={
          <Title level={4} style={{ margin: 0 }}>
            {t('admin.manageFloors')}
          </Title>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            {t('admin.addFloor')}
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={floors}
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editingFloor ? t('admin.editFloor') : t('admin.addFloor')}
        onCancel={() => setModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label={t('admin.floorNumber')}
            name="number"
            rules={[{ required: true }]}
          >
            <InputNumber size="large" min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={`${t('admin.floorName')} (English)`}
            name="name"
            rules={[{ required: true }]}
          >
            <Input size="large" placeholder="Ground Floor" />
          </Form.Item>
          <Form.Item
            label={`${t('admin.floorName')} (العربية)`}
            name="nameAr"
            rules={[{ required: true }]}
          >
            <Input size="large" placeholder="الطابق الأرضي" />
          </Form.Item>
          <Form.Item label={t('admin.floorImage')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {imageUrl && (
                <AntImage
                  src={imageUrl}
                  alt=""
                  width={200}
                  style={{ borderRadius: 8, objectFit: 'cover' }}
                />
              )}
              <Space>
                <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />}>Upload Image</Button>
                </Upload>
                {imageUrl && (
                  <Button onClick={() => setImageUrl('')} danger>
                    Remove
                  </Button>
                )}
              </Space>
            </Space>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit">
                {t('common.save')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
