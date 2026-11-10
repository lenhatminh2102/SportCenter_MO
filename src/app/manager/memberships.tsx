import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { ApiError } from '@/services/api';
import { managerApi, type MembershipPlan, type PlanInput } from '@/services/manager';
import { currency } from '@/services/payments';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { RelationField } from '@/components/sport/relation-field';
import { Button, Field, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';

export default function ManagerMemberships() {
  const { user, token } = useAuth();
  const { memberId, memberName } = useLocalSearchParams<{ memberId?: string; memberName?: string }>();
  if (!user || !token) return <AccessScreen />;
  if (user.role !== 'CENTER_MANAGER') return <AccessScreen denied />;
  return <MembershipWorkspace key={memberId || 'catalog'} token={token} initialMember={memberId} memberName={memberName} />;
}

function MembershipWorkspace({ token, initialMember, memberName }: { token: string; initialMember?: string; memberName?: string }) {
  const [memberId, setMember] = useState(initialMember || '');
  const [editing, setEditing] = useState<MembershipPlan | 'new' | null>(null);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => managerApi.listPlans(token), [token]);
  const query = useApiQuery(load);
  return <Screen>
    <Link href={initialMember ? '/members' : '/manager'} style={ui.link}>{initialMember ? '← Hội viên' : '← Tổng quan'}</Link>
    <Text style={ui.title}>Gói thành viên</Text>
    <View style={ui.card}>
      <Text style={ui.heading}>Gói của hội viên</Text>
      <RelationField label="Hội viên" path="/api/members" token={token} value={memberId} onChange={setMember} disabled={false}
        initialLabel={memberId === initialMember ? memberName : undefined} />
      {memberId ? <MembershipTerm key={memberId} token={token} memberId={memberId} plans={query.data ?? undefined} /> :
        <Text style={ui.body}>Chọn hội viên để xem, gán hoặc gia hạn gói.</Text>}
    </View>
    <Text style={ui.heading}>Danh mục gói</Text>
    {!!notice && <Text accessibilityRole="alert" style={ui.body}>{notice}</Text>}
    {editing ? <PlanEditor key={editing === 'new' ? 'new' : editing._id} token={token} plan={editing === 'new' ? undefined : editing}
      onCancel={() => setEditing(null)} onSaved={() => {
        setEditing(null);
        setNotice('Đã lưu gói thành viên.');
        query.reload();
      }} /> : <Button title="+ Tạo gói thành viên" onPress={() => { setNotice(''); setEditing('new'); }} />}
    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    {query.data?.length === 0 && <Text style={ui.body}>Chưa có gói thành viên.</Text>}
    {query.data?.map(plan => <View style={ui.card} key={plan._id}>
      <Text style={ui.eyebrow}>{plan.status === 'ACTIVE' ? 'ĐANG ÁP DỤNG' : 'NGỪNG ÁP DỤNG'}</Text>
      <Text style={ui.heading}>{plan.name}</Text>
      <Text style={ui.body}>{currency(plan.price)} · {plan.durationDays} ngày</Text>
      {!editing && <Button title="Chỉnh sửa gói" secondary onPress={() => { setNotice(''); setEditing(plan); }} />}
    </View>)}
  </Screen>;
}

function PlanEditor({ token, plan, onCancel, onSaved }: { token: string; plan?: MembershipPlan; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(plan?.name || '');
  const [price, setPrice] = useState(plan ? String(plan.price) : '');
  const [duration, setDuration] = useState(plan ? String(plan.durationDays) : '');
  const [status, setStatus] = useState<PlanInput['status']>(plan?.status || 'ACTIVE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function save() {
    if (pending.current) return;
    const amount = Number(price.trim());
    const days = Number(duration.trim());
    if (!name.trim() || name.trim().length > 120) return setError('Tên gói cần từ 1 đến 120 ký tự.');
    if (!/^\d+$/.test(price.trim()) || !Number.isSafeInteger(amount)) return setError('Nhập giá bằng số nguyên VND, ví dụ 400000.');
    if (!/^\d+$/.test(duration.trim()) || days < 1 || days > 3650) return setError('Nhập thời hạn từ 1 đến 3650 ngày.');
    const input = { name: name.trim(), price: amount, durationDays: days, status };
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (plan) await managerApi.updatePlan(token, plan._id, input);
      else await managerApi.createPlan(token, input);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <View style={ui.card}>
    <Text style={ui.heading}>{plan ? 'Chỉnh sửa gói' : 'Tạo gói'}</Text>
    <Field label="Tên gói" value={name} onChangeText={setName} editable={!busy} />
    <Field label="Giá gói (VND)" value={price} onChangeText={setPrice} keyboardType="number-pad" editable={!busy} />
    <Field label="Thời hạn (ngày)" value={duration} onChangeText={setDuration} keyboardType="number-pad" editable={!busy} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button title="Áp dụng" secondary={status !== 'ACTIVE'} disabled={busy} onPress={() => setStatus('ACTIVE')} />
      <Button title="Ngừng áp dụng" secondary={status !== 'INACTIVE'} disabled={busy} onPress={() => setStatus('INACTIVE')} />
    </View>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Button title={busy ? 'Đang lưu…' : 'Lưu gói'} disabled={busy} onPress={() => void save()} />
    <Button title="Hủy chỉnh sửa" secondary disabled={busy} onPress={onCancel} />
  </View>;
}

function MembershipTerm({ token, memberId, plans }: { token: string; memberId: string; plans?: MembershipPlan[] }) {
  const [planId, setPlan] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const load = useCallback(() => managerApi.getMembership(token, memberId), [token, memberId]);
  const query = useApiQuery(load);
  const term = query.data;
  const activePlans = (plans || []).filter(plan => plan.status === 'ACTIVE');
  const selectedPlan = activePlans.find(plan => plan._id === planId);
  const renewalPlan = activePlans.find(plan => plan._id === term?.planId);
  const formatTime = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });

  async function save(renewing: boolean) {
    if (pending.current || (renewing ? !term || !renewalPlan : !selectedPlan)) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      if (renewing && term) await managerApi.renewMembership(token, memberId, term.expiresAt);
      else await managerApi.assignMembership(token, memberId, planId);
      setPlan('');
      setNotice(renewing ? 'Đã gia hạn gói.' : 'Đã gán gói cho hội viên.');
      query.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError('Thông tin gói đã thay đổi. Kiểm tra hạn hiện tại trước khi thử lại.');
        query.reload();
      } else setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <>
    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    {!query.loading && !query.error && <>
      {term ? <>
        <Text style={ui.eyebrow}>{term.status === 'ACTIVE' ? 'CÒN HẠN' : 'HẾT HẠN'}</Text>
        <Text style={ui.heading}>{term.planName}</Text>
        <Text style={ui.body}>Bắt đầu: {formatTime(term.startsAt)} · Hết hạn: {formatTime(term.expiresAt)}</Text>
        <Text style={ui.body}>Giá gói đã lưu: {currency(term.price)}</Text>
        {renewalPlan && <Button secondary disabled={busy} title={`Gia hạn ${renewalPlan.durationDays} ngày · ${currency(renewalPlan.price)}`}
          onPress={() => void save(true)} />}
        {plans && !renewalPlan && <Text style={ui.body}>Gói này đã ngừng áp dụng nên không thể gia hạn.</Text>}
      </> : <Text style={ui.body}>Hội viên chưa có gói.</Text>}
      {plans && term?.status !== 'ACTIVE' && (activePlans.length ? <>
        <RelationField label="Gói đang áp dụng" path="/api/manager/membership-plans" token={token} value={planId}
          onChange={setPlan} disabled={busy} filter={item => item.status === 'ACTIVE'} />
        {selectedPlan && <Text style={ui.body}>{selectedPlan.durationDays} ngày · {currency(selectedPlan.price)}</Text>}
        <Button title="Gán gói cho hội viên" disabled={busy || !selectedPlan} onPress={() => void save(false)} />
      </> : <Text style={ui.body}>Cần có ít nhất một gói đang áp dụng để gán.</Text>)}
    </>}
    {busy && <Text style={ui.body}>Đang lưu…</Text>}
    {!!notice && <Text accessibilityRole="alert" style={ui.body}>{notice}</Text>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </>;
}
