import { useTranslation } from 'react-i18next';
import {
  Card,
  Button,
  List,
  Switch,
  Space,
  Tag,
  Typography,
  Popconfirm,
  message,
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import {
  useFormConfigStore,
  type FormFieldConfig,
} from '../../store/formConfigStore';

const { Title, Paragraph } = Typography;

const SECTION_COLOR: Record<FormFieldConfig['section'], string> = {
  visit: 'cyan',
  personal: 'blue',
  signature: 'purple',
  terms: 'gold',
};

export default function FormEditorTab() {
  const { t } = useTranslation();
  const fields = useFormConfigStore(state => state.fields);
  const setFields = useFormConfigStore(state => state.setFields);
  const toggleVisible = useFormConfigStore(state => state.toggleVisible);
  const reset = useFormConfigStore(state => state.reset);

  const moveField = (index: number, direction: -1 | 1) => {
    const next = [...fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  };

  return (
    <Card
      title={
        <Title level={4} style={{ margin: 0 }}>
          {t('admin.formEditor')}
        </Title>
      }
      extra={
        <Popconfirm
          title={t('admin.resetToDefault') + '?'}
          onConfirm={() => {
            reset();
            message.success(t('admin.resetToDefault'));
          }}
          okText={t('common.save')}
          cancelText={t('common.cancel')}
        >
          <Button icon={<ReloadOutlined />}>{t('admin.resetToDefault')}</Button>
        </Popconfirm>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('admin.formEditorDescription')}
      </Paragraph>

      <List
        bordered
        dataSource={fields}
        renderItem={(field, idx) => (
          <List.Item
            actions={[
              <Space size="small" key="reorder">
                <Button
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={idx === 0}
                  onClick={() => moveField(idx, -1)}
                />
                <Button
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={idx === fields.length - 1}
                  onClick={() => moveField(idx, 1)}
                />
              </Space>,
              field.alwaysRequired ? (
                <Tag color="red" icon={<LockOutlined />} key="lock">
                  {t('common.required')}
                </Tag>
              ) : (
                <Switch
                  key="visible"
                  checked={field.visible}
                  onChange={() => toggleVisible(field.key)}
                  checkedChildren={<EyeOutlined />}
                  unCheckedChildren={<EyeInvisibleOutlined />}
                />
              ),
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <strong>{t(`admin.field.${field.key}`)}</strong>
                  <Tag color={SECTION_COLOR[field.section]}>{field.section}</Tag>
                  {!field.alwaysRequired && (
                    <Tag color={field.visible ? 'green' : 'default'}>
                      {field.visible ? t('admin.fieldVisible') : t('admin.fieldHidden')}
                    </Tag>
                  )}
                </Space>
              }
              description={`#${idx + 1}`}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
