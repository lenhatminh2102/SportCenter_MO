import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Link } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/context/auth';
import { importSchedules, validateScheduleFile, type ImportResult, type ScheduleFile } from '@/services/schedule-import';
import { AccessScreen } from '@/components/sport/access';
import { Button, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';

export default function ScheduleImport() {
  const { user, token } = useAuth(); const [file, setFile] = useState<ScheduleFile>(); const [result, setResult] = useState<ImportResult>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const pending = useRef(false);
  if (!user || !token) return <AccessScreen />; if (user.role !== 'CENTER_MANAGER') return <AccessScreen denied />;
  async function choose() {
    if (pending.current) return; pending.current = true; setBusy(true); setError('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true, base64: false });
      if (!picked.canceled) { validateScheduleFile(picked.assets[0]); setFile(picked.assets[0]); setResult(undefined); }
    } catch (e) { setError((e as Error).message); } finally { pending.current = false; setBusy(false); }
  }
  async function upload() {
    if (!file || pending.current) return; pending.current = true; setBusy(true); setError(''); setResult(undefined);
    try { setResult(await importSchedules(token!, file)); setFile(undefined); }
    catch (e) { setError(`${(e as Error).message} Kiểm tra danh sách lịch trước khi thử lại để tránh nhập trùng.`); setFile(undefined); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Screen><Link href={{ pathname: '/workspace/[resource]', params: { resource: 'schedules' } }} style={ui.link}>← Lịch tập</Link><Text style={ui.title}>Import lịch từ Excel</Text>
    <Text style={ui.body}>Chọn tệp .xlsx tối đa 5 MB, tối đa 1000 dòng. Sheet đầu tiên cần các cột: classId, lessonId, roomId, date, startTime, endTime. Dùng mã lớp/bài học/phòng; ngày YYYY-MM-DD, giờ HH:mm.</Text>
    <Button disabled={busy} secondary title="Chọn tệp Excel" onPress={() => void choose()} />{file && <View style={ui.card}><Text style={ui.body}>{file.name}</Text><Text style={ui.body}>Các dòng hợp lệ sẽ được lưu ngay; dòng lỗi được báo riêng.</Text><Button disabled={busy} title={busy ? 'Đang nhập…' : 'Xác nhận nhập lịch'} onPress={() => void upload()} /></View>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{result && <View style={ui.card}><Text style={ui.heading}>Đã nhập {result.successCount}/{result.totalRows} dòng · {result.errorCount} lỗi</Text>{result.errors.map((item, index) => <Text key={index} style={ui.error}>Dòng {item.row}: {item.message}</Text>)}<Text style={ui.body}>Không nhập lại toàn bộ tệp nếu đã có dòng thành công. Chỉ sửa và nhập những dòng lỗi.</Text></View>}
  </Screen>;
}
