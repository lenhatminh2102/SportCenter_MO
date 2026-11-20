import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/context/auth';
import { CATALOG_SHEETS, downloadCatalogTemplate, importCatalog, type CatalogReport } from '@/services/catalog-import';
import { validateScheduleFile, type ScheduleFile } from '@/services/schedule-import';
import { AccessScreen } from '@/components/sport/access';
import { Button, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

const ACTIONS = { create: { text: 'Tạo mới', color: colors.green }, update: { text: 'Cập nhật', color: '#2f66a8' }, skip: { text: 'Đã có', color: colors.muted } };
const ROWS_SHOWN = 30;

/** Manager: create courses, learning paths, classes and lessons from one Excel file — check first, then import. */
export default function CatalogImport() {
  const { user, token } = useAuth();
  const [file, setFile] = useState<ScheduleFile>();
  const [report, setReport] = useState<CatalogReport>();
  const [busy, setBusy] = useState<'' | 'pick' | 'check' | 'import' | 'template'>('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  if (!user || !token) return <AccessScreen />;
  if (user.role !== 'CENTER_MANAGER') return <AccessScreen denied />;

  async function run(kind: 'pick' | 'check' | 'import' | 'template', task: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(kind); setError('');
    try { await task(); } catch (e) { setError((e as Error).message); } finally { pending.current = false; setBusy(''); }
  }
  const choose = () => run('pick', async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true, base64: false });
    if (picked.canceled) return;
    validateScheduleFile(picked.assets[0]);
    setFile(picked.assets[0]); setReport(undefined);
    // Check straight away: the manager sees what will happen before anything is saved.
    setBusy('check');
    setReport(await importCatalog(token!, picked.assets[0], true));
  });
  const confirm = () => file && run('import', async () => { setReport(await importCatalog(token!, file, false)); setFile(undefined); });

  const total = report ? CATALOG_SHEETS.reduce((sum, sheet) => sum + report.summary[sheet.key].create + report.summary[sheet.key].update, 0) : 0;
  return <Screen>
    <Link href={{ pathname: '/workspace/[resource]', params: { resource: 'courses' } }} style={ui.link}>← Khóa học</Link>
    <Text style={ui.eyebrow}>NHẬP NHANH DANH MỤC</Text>
    <Text style={ui.title}>Import khóa học từ Excel</Text>
    <Text style={ui.body}>Một tệp .xlsx gồm 4 sheet, liên kết với nhau bằng TÊN (không cần mã ID). Hệ thống kiểm tra toàn bộ trước; chỉ khi không có lỗi mới cho nhập.</Text>

    <View style={ui.card}>
      {CATALOG_SHEETS.map((sheet, index) => <View key={sheet.key} style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{index + 1}</Text></View>
        <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.ink }}>Sheet “{sheet.title}” · {sheet.label}</Text><Text style={{ fontSize: 12.5, color: colors.muted }}>{sheet.columns}</Text></View>
      </View>)}
      {Platform.OS === 'web'
        ? <Button secondary disabled={!!busy} title={busy === 'template' ? 'Đang tải…' : 'Tải tệp mẫu (.xlsx)'} onPress={() => void run('template', () => downloadCatalogTemplate(token))} />
        : <Text style={{ fontSize: 12.5, color: colors.muted }}>Tệp mẫu có sẵn danh sách môn và email HLV: tải ở bản web (Quản lý → Import khóa học).</Text>}
    </View>

    <Button disabled={!!busy} title={busy === 'pick' ? 'Đang mở…' : busy === 'check' ? 'Đang kiểm tra tệp…' : file ? 'Chọn tệp khác' : 'Chọn tệp Excel'} secondary={!!file} onPress={() => void choose()} />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}

    {report && <>
      <View style={{ borderRadius: 14, padding: 14, gap: 4, backgroundColor: report.imported ? '#e7f6ec' : !report.valid ? '#fdeceb' : total ? '#eef4fc' : '#fff6e5' }}>
        <Text style={{ fontWeight: '800', color: report.imported ? colors.green : !report.valid ? '#b91c1c' : total ? '#2f66a8' : '#9a6700' }}>
          {report.imported ? `✓ Đã nhập ${total} mục vào hệ thống` : !report.valid ? `Tệp có ${report.errors.length} lỗi — chưa nhập dữ liệu nào` : total ? `Tệp hợp lệ · sẵn sàng nhập ${total} mục` : 'Mọi dòng đã có trên hệ thống, không có gì mới để nhập'}
        </Text>
        {!report.valid && <Text style={{ fontSize: 13, color: colors.muted }}>Sửa các dòng bên dưới trong Excel rồi chọn lại tệp.</Text>}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATALOG_SHEETS.map(sheet => {
          const count = report.summary[sheet.key];
          return <View key={sheet.key} style={[ui.card, { flexBasis: '47%', flexGrow: 1, padding: 12, gap: 2 }]}>
            <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>{sheet.label}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>{count.create + count.update}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{[count.create && `${count.create} mới`, count.update && `${count.update} cập nhật`, count.skip && `${count.skip} đã có`, count.error && `${count.error} lỗi`].filter(Boolean).join(' · ') || 'Trống'}</Text>
          </View>;
        })}
      </View>

      {!!report.errors.length && <View style={ui.card}>
        <Text style={ui.heading}>Cần sửa</Text>
        {report.errors.map((item, index) => <Text key={index} style={ui.error}>{item.sheet} · dòng {item.row}: {item.message}</Text>)}
      </View>}

      {report.valid && !!report.rows.length && <View style={ui.card}>
        <Text style={ui.heading}>{report.imported ? 'Đã xử lý' : 'Sẽ thực hiện'}</Text>
        {report.rows.slice(0, ROWS_SHOWN).map((item, index) => <View key={index} style={[ui.between, { borderTopWidth: index ? 1 : 0, borderTopColor: colors.border, paddingTop: index ? 8 : 0 }]}>
          <Text style={{ flex: 1, color: colors.ink }} numberOfLines={1}>{item.label}<Text style={{ color: colors.muted, fontSize: 12 }}>  {item.sheet} · dòng {item.row}</Text></Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: ACTIONS[item.action].color }}>{ACTIONS[item.action].text}</Text>
        </View>)}
        {report.rows.length > ROWS_SHOWN && <Text style={ui.body}>… và {report.rows.length - ROWS_SHOWN} dòng khác</Text>}
      </View>}

      {file && report.valid && !report.imported && total > 0 && <Button disabled={!!busy} title={busy === 'import' ? 'Đang nhập dữ liệu…' : `Nhập ${total} mục vào hệ thống`} onPress={() => void confirm()} />}
      {report.imported && <Link href={{ pathname: '/workspace/[resource]', params: { resource: 'classes' } }} style={ui.link}>Xem danh sách lớp học →</Link>}
    </>}
  </Screen>;
}
