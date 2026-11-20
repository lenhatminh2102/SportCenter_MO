import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { filterStaff, staffApi, staffFilters, validateStaffAccount, type StaffFilter, type StaffAccount, type StaffAccountInput, type StaffUpdate } from '@/services/staff';
import { referenceId, referenceLabel } from '@/services/operations';
import { useApiQuery } from '@/hooks/use-api-query';
import { validEmail, validPhone } from '@/utils/validation';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Field, Screen } from '@/components/sport/ui';
import { RelationField } from '@/components/sport/relation-field';
import { ui } from '@/components/sport/styles';
const empty: StaffAccountInput = { email: '', password: '', role: 'COACH', fullName: '', phone: '', subjectId: '' };
const staffRoles = [['COACH', 'Huấn luyện viên'], ['RECEPTIONIST', 'Lễ tân']] as const;

export default function StaffAccounts() {
  const { user, token } = useAuth();
  const { create } = useLocalSearchParams<{ create?: string }>();
  const [creating, setCreating] = useState(create === '1');
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StaffFilter>('ALL');
  const [notice, setNotice] = useState('');
  const canManage = !!token && user?.role === 'CENTER_MANAGER';
  const load = useCallback(() => staffApi.list(token!), [token]);
  const query = useApiQuery(load, canManage);
  if (!user || !token) return <AccessScreen />;
  if (!canManage) return <AccessScreen denied />;

  const filtered = filterStaff(query.data || [], search, filter);
  const count = (value: StaffFilter) => filterStaff(query.data || [], '', value).length;
  return <Screen>
    <Link href="/manager" style={ui.link}>← Tổng quan</Link>
    <Text style={ui.title}>Huấn luyện viên & nhân sự</Text>
    <Text style={ui.body}>Quản lý tài khoản huấn luyện viên và lễ tân của trung tâm.</Text>
    {creating ? <CreateStaffAccount token={token} onSaved={query.reload} onBack={() => setCreating(false)} /> :
      editing ? <EditStaffAccount key={editing._id} token={token} account={editing} onCancel={() => setEditing(null)} onSaved={() => {
        setEditing(null);
        setNotice('Đã cập nhật tài khoản nhân viên.');
        query.reload();
      }} /> : <>
        <Button title="+ Tạo tài khoản nhân viên" onPress={() => { setNotice(''); setCreating(true); }} />
        {!!notice && <Text accessibilityRole="alert" style={ui.body}>{notice}</Text>}
        <Field label="Tìm nhân viên" value={search} onChangeText={setSearch} placeholder="Tên, email hoặc số điện thoại" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{staffFilters.map(item =>
          <Button key={item.value} secondary={filter !== item.value} title={query.data ? `${item.label} (${count(item.value)})` : item.label} onPress={() => setFilter(item.value)} />)}</View>
        <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
        {query.data && !filtered.length && <Text style={ui.body}>Không tìm thấy nhân viên phù hợp.</Text>}
        {filtered.map(account => <View style={ui.card} key={account._id}>
          <Text style={ui.eyebrow}>{account.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG' : 'ĐÃ KHÓA'}</Text>
          <Text style={ui.heading}>{account.fullName || account.email}</Text>
          <Text style={ui.body}>{staffRoles.find(([role]) => role === account.role)?.[1]} · {account.email}</Text>
          {!!account.phone && <Text style={ui.body}>{account.phone}</Text>}
          {account.coach?.subjectId && <Text style={ui.body}>Môn phụ trách: {referenceLabel(account.coach.subjectId)}</Text>}
          <Button secondary title="Chỉnh sửa tài khoản" onPress={() => { setNotice(''); setEditing(account); }} />
        </View>)}
      </>}
  </Screen>;
}

function CreateStaffAccount({ token, onSaved, onBack }: { token: string; onSaved: () => void; onBack: () => void }) {
  const [form, setForm] = useState<StaffAccountInput>(empty);
  const [submitted, setSubmitted] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [created, setCreated] = useState<{ email: string; role: string } | null>(null);
  const pending = useRef(false);
  const errors = validateStaffAccount(form, validEmail, validPhone);
  const set = (key: keyof StaffAccountInput) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  async function save() {
    if (pending.current) return;
    setSubmitted(true); setError(''); setCreated(null);
    if (Object.keys(errors).length) return;
    pending.current = true; setBusy(true);
    try { await staffApi.createAccount(token, form); setCreated({ email: form.email.trim().toLowerCase(), role: form.role }); setForm(empty); setSubmitted(false); onSaved(); }
    catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <>
    <Button secondary disabled={busy} title="← Danh sách nhân viên" onPress={onBack} />
    <Text style={ui.heading}>Tạo tài khoản nhân viên</Text>
    <Text style={ui.body}>Tạo tài khoản đăng nhập cho huấn luyện viên hoặc lễ tân. Với huấn luyện viên, hồ sơ HLV được tạo cùng lúc và có thể phân công vào lớp ngay.</Text>
    {created && <View style={ui.card}><Text accessibilityRole="alert" style={{ color: '#15803d', lineHeight: 23 }}>Đã tạo tài khoản {created.role === 'COACH' ? 'huấn luyện viên' : 'lễ tân'} {created.email}. Gửi email và mật khẩu ban đầu cho nhân viên để đăng nhập.</Text>{created.role === 'COACH' && <Button secondary title="Xem danh sách huấn luyện viên →" onPress={() => router.push({ pathname: '/workspace/[resource]', params: { resource: 'coaches' } })} />}</View>}
    <View style={ui.card}>
      <Text style={ui.heading}>Vai trò</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{staffRoles.map(([value, label]) => <Button key={value} secondary={form.role !== value} disabled={busy} title={label} onPress={() => set('role')(value)} />)}</View>
      <Field label="Email đăng nhập" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="off" editable={!busy} error={submitted ? errors.email : undefined} />
      <Field label="Mật khẩu ban đầu (ít nhất 6 ký tự)" password value={form.password} onChangeText={set('password')} autoCapitalize="none" autoComplete="new-password" editable={!busy} error={submitted ? errors.password : undefined} />
      <Field label="Họ và tên" value={form.fullName} onChangeText={set('fullName')} editable={!busy} error={submitted ? errors.fullName : undefined} />
      <Field label="Số điện thoại" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" editable={!busy} error={submitted ? errors.phone : undefined} />
      {form.role === 'COACH' && <RelationField label="Môn thể thao phụ trách" path="/api/subjects" token={token} value={form.subjectId || ''} onChange={set('subjectId')} disabled={busy} error={submitted ? errors.subjectId : undefined} />}
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      <Button disabled={busy} title={busy ? 'Đang tạo…' : 'Tạo tài khoản'} onPress={() => void save()} />
    </View>
    <Text style={[ui.body, { fontSize: 12 }]}>Đã có tài khoản COACH nhưng chưa có hồ sơ HLV? Dùng “Thêm huấn luyện viên” trong danh sách huấn luyện viên và nhập User ID.</Text>
  </>;
}

function EditStaffAccount({ token, account, onCancel, onSaved }: { token: string; account: StaffAccount; onCancel: () => void; onSaved: () => void }) {
  const initialSubject = referenceId(account.coach?.subjectId);
  const [fullName, setName] = useState(account.fullName || '');
  const [phone, setPhone] = useState(account.phone || '');
  const [role, setRole] = useState(account.role);
  const [status, setStatus] = useState(account.status);
  const [subjectId, setSubject] = useState(initialSubject);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const input: StaffUpdate = {};
  if (fullName.trim() !== (account.fullName || '')) input.fullName = fullName.trim();
  if (phone.trim() !== (account.phone || '')) input.phone = phone.replace(/[\s.-]/g, '');
  if (role !== account.role) input.role = role;
  if (status !== account.status) input.status = status;
  if (role === 'COACH' && subjectId && subjectId !== initialSubject) input.subjectId = subjectId;

  async function save() {
    if (pending.current || !Object.keys(input).length) return;
    if (input.fullName !== undefined && input.fullName.length < 2) return setError('Nhập họ tên từ 2 ký tự.');
    if (input.phone !== undefined && !validPhone(input.phone)) return setError('Nhập số điện thoại Việt Nam hợp lệ.');
    if (input.role === 'COACH' && !subjectId) return setError('Chọn môn thể thao cho huấn luyện viên.');
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await staffApi.update(token, account._id, input);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <View style={ui.card}>
    <Text style={ui.heading}>Chỉnh sửa {account.email}</Text>
    <Field label="Họ và tên" value={fullName} onChangeText={setName} editable={!busy} />
    <Field label="Số điện thoại" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!busy} />
    <Text style={ui.heading}>Vai trò</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{staffRoles.map(([value, label]) =>
      <Button key={value} secondary={role !== value} disabled={busy} title={label} onPress={() => setRole(value)} />)}</View>
    {role === 'COACH' && <RelationField label="Môn thể thao phụ trách" path="/api/subjects" token={token} value={subjectId} onChange={setSubject} disabled={busy} initialLabel={initialSubject ? referenceLabel(account.coach?.subjectId) : undefined} />}
    <Text style={ui.heading}>Trạng thái tài khoản</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button title="Hoạt động" secondary={status !== 'ACTIVE'} disabled={busy} onPress={() => setStatus('ACTIVE')} />
      <Button title="Đã khóa" secondary={status !== 'INACTIVE'} disabled={busy} onPress={() => setStatus('INACTIVE')} />
    </View>
    {(input.role || input.status) && <Text style={ui.body}>Khi lưu thay đổi vai trò hoặc trạng thái, phiên đăng nhập hiện tại của nhân viên sẽ hết hiệu lực.</Text>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Button title={busy ? 'Đang lưu…' : 'Lưu thay đổi'} disabled={busy || !Object.keys(input).length} onPress={() => void save()} />
    <Button title="Hủy chỉnh sửa" secondary disabled={busy} onPress={onCancel} />
  </View>;
}
