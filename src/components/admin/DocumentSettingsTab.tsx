import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Input,
  Button,
  Row,
  Col,
  Upload,
  Space,
  Typography,
  Image as AntImage,
  Divider,
  message,
} from 'antd';
import { UploadOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useDocumentSettingsStore } from '../../store/documentSettingsStore';

const { Title, Text, Paragraph } = Typography;

export default function DocumentSettingsTab() {
  const { t } = useTranslation();
  const settings = useDocumentSettingsStore(state => state.settings);
  const setSettings = useDocumentSettingsStore(state => state.setSettings);
  const uploadLogo = useDocumentSettingsStore(state => state.uploadLogo);
  const removeLogo = useDocumentSettingsStore(state => state.removeLogo);
  const reset = useDocumentSettingsStore(state => state.reset);

  const [form] = Form.useForm();
  const [logoUploading, setLogoUploading] = useState(false);

  const onFinish = (values: any) => {
    setSettings(values);
    message.success(t('common.save'));
  };

  const uploadProps: UploadProps = {
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: async (file) => {
      setLogoUploading(true);
      try {
        await uploadLogo(file);
        message.success('Logo uploaded');
      } catch {
        message.error('Failed to upload logo');
      } finally {
        setLogoUploading(false);
      }
      return false;
    },
  };

  return (
    <Card
      title={
        <Title level={4} style={{ margin: 0 }}>
          {t('admin.documentSettings')}
        </Title>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            reset();
            form.resetFields();
            message.success(t('admin.resetToDefault'));
          }}
        >
          {t('admin.resetToDefault')}
        </Button>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('admin.documentSettingsDescription')}
      </Paragraph>

      {/* Live preview */}
      <Card
        size="small"
        style={{
          marginBottom: 24,
          background: '#fafafa',
          border: '1px dashed #d9d9d9',
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          Preview
        </Text>
        <Divider style={{ margin: '8px 0' }} />
        <Row gutter={16} align="middle">
          <Col xs={24} md={10}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div>
                <Text strong style={{ marginInlineEnd: 8 }}>
                  {settings.admissionLabel}:
                </Text>
                <Text>{settings.admissionName || '—'}</Text>
              </div>
              <div>
                <Text strong style={{ marginInlineEnd: 8 }}>
                  {settings.formIdVersionLabel}:
                </Text>
                <Text>{settings.formIdVersion || '—'}</Text>
              </div>
              <div>
                <Text strong style={{ marginInlineEnd: 8 }}>
                  {settings.visionNumberLabel}:
                </Text>
                <Text>{settings.visionNumber || '—'}</Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={9} style={{ textAlign: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>
              {settings.formName}
            </Title>
          </Col>
          <Col xs={24} md={5} style={{ textAlign: 'center' }}>
            {settings.logoUrl ? (
              <AntImage
                src={settings.logoUrl}
                alt="logo"
                height={80}
                style={{ objectFit: 'contain', maxWidth: '100%' }}
                preview={false}
              />
            ) : (
              <div
                style={{
                  height: 80,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#bfbfbf',
                  fontSize: 12,
                  border: '1px dashed #d9d9d9',
                  borderRadius: 8,
                }}
              >
                Logo
              </div>
            )}
          </Col>
        </Row>
      </Card>

      <Form
        form={form}
        layout="vertical"
        initialValues={settings}
        onFinish={onFinish}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label={t('admin.documentAdmissionLabel')} name="admissionLabel">
              <Input size="large" placeholder={t('admin.documentAdmissionLabel')} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('admin.documentAdmissionValue')} name="admissionName">
              <Input size="large" placeholder={t('admin.documentAdmissionValue')} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label={t('admin.documentFormIdLabel')} name="formIdVersionLabel">
              <Input size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('admin.documentFormIdValue')} name="formIdVersion">
              <Input size="large" placeholder="v1.0" />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label={t('admin.documentVisionLabel')} name="visionNumberLabel">
              <Input size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('admin.documentVisionValue')} name="visionNumber">
              <Input size="large" placeholder="2030" />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label={t('admin.documentFormName')} name="formName">
              <Input size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('admin.documentLogo')}>
              <Space>
                <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />} loading={logoUploading}>
                    {t('admin.uploadLogo')}
                  </Button>
                </Upload>
                {settings.logoUrl && (
                  <Button danger onClick={removeLogo}>
                    {t('admin.removeLogo')}
                  </Button>
                )}
              </Space>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" size="large" htmlType="submit" icon={<SaveOutlined />}>
            {t('common.save')}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
