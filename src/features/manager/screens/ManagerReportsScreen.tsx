import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { chartBars, managerApi, reportPresets, type ManagerReport } from '@/services/manager';
import { bangkokDate } from '@/services/dashboard';
import { currency } from '@/services/payments';
import { dayMonth, formatDateLabel, parseDateInput } from '@/utils/schedule-time';
import { MetricGrid } from '@/components/dashboard/home-widgets';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Field, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

const vnDate = (iso: string) => `${dayMonth(iso)}/${iso.slice(0, 4)}`;
const STATUS_ROWS = [['CONFIRMED', 'Đã xác nhận', colors.green], ['PENDING_PAYMENT', 'Chờ thanh toán', '#b45309'], ['CANCELLED', 'Đã hủy', '#94a3b8']] as const;

export default function ManagerReports() {
  const { user, token } = useAuth();
  const today = bangkokDate(new Date());
  const [range, setRange] = useState(() => ({ from: `${today.slice(0, 7)}-01`, to: today }));
  const [from, setFrom] = useState(vnDate(range.from));
  const [to, setTo] = useState(vnDate(range.to));
  const [error, setError] = useState('');
  const allowed = !!token && user?.role === 'CENTER_MANAGER';
  const load = useCallback(() => managerApi.report(token!, range.from, range.to), [token, range]);
  const query = useApiQuery(load, allowed);
  if (!user || !token) return <AccessScreen />;
  if (!allowed) return <AccessScreen denied />;

  function apply() {
    const start = parseDateInput(from, today);
    const end = parseDateInput(to, today);
    if (!start || !end) return setError('Chọn đủ ngày bắt đầu và kết thúc, ví dụ 16/11/2026.');
    if (end < start) return setError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
    if (Date.parse(end) - Date.parse(start) >= 366 * 86400000) return setError('Khoảng thời gian tối đa 366 ngày.');
    setError('');
    setRange({ from: start, to: end });
  }

  return <Screen>
    <Link href="/manager" style={ui.link}>← Tổng quan</Link>
    <Text style={ui.title}>Báo cáo & doanh thu</Text>
    <Text style={ui.body}>Dữ liệu rõ ràng, quyết định vững vàng. Doanh thu theo ngày thực thu.</Text>
    <View style={ui.card}>
      <Text style={ui.heading}>Chọn nhanh</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {reportPresets(today).map(preset => <Button key={preset.label} secondary={range.from !== preset.from || range.to !== preset.to} title={preset.label}
          onPress={() => { setError(''); setFrom(vnDate(preset.from)); setTo(vnDate(preset.to)); setRange({ from: preset.from, to: preset.to }); }} />)}
      </View>
      <Text style={ui.heading}>Khoảng thời gian</Text>
      <Text style={ui.body}>Tính theo giờ Việt Nam (UTC+7), gồm cả ngày bắt đầu và ngày kết thúc.</Text>
      <Field label="Từ ngày" value={from} onChangeText={setFrom} placeholder="DD/MM/YYYY" />
      <Field label="Đến ngày" value={to} onChangeText={setTo} placeholder="DD/MM/YYYY" />
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      <Button title="Xem báo cáo" onPress={apply} />
    </View>
    <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />
    {query.data && <ReportResults key={`${range.from}:${range.to}`} report={query.data} />}
  </Screen>;
}

function ReportResults({ report }: { report: ManagerReport }) {
  const [page, setPage] = useState(0);
  const pageSize = 14;
  const { summary } = report;
  const days = report.daily.length;
  const registrations = STATUS_ROWS.reduce((sum, [status]) => sum + summary.registrations[status], 0);
  const active = [...report.daily].reverse().filter(day => day.newMembers || day.registrations || day.successfulPayments);
  const pages = Math.ceil(active.length / pageSize);
  const bars = chartBars(report.daily);
  const peak = Math.max(0, ...bars.map(bar => bar.value));
  const list = (resource: string) => ({ pathname: '/workspace/[resource]' as const, params: { resource } });
  return <>
    <MetricGrid items={[
      { label: 'Tổng hội viên', value: String(summary.totalMembers), detail: 'Hiện có trên hệ thống', href: '/members' },
      { label: 'Hội viên mới', value: String(summary.newMembers), detail: `Trong ${days} ngày đã chọn`, href: '/members' },
      { label: 'Đăng ký trong kỳ', value: String(registrations), detail: `${summary.registrations.CONFIRMED} đã xác nhận`, href: list('class-registrations') },
      { label: 'Doanh thu thực thu', value: currency(summary.revenue), detail: `${summary.successfulPayments} giao dịch thành công`, href: '/payments' },
    ]} />

    <View style={ui.card}>
      <View style={ui.between}><Text style={ui.heading}>Biểu đồ thực thu</Text><Text style={[ui.body, { fontSize: 12 }]}>{vnDate(report.from)} – {vnDate(report.to)}</Text></View>
      {peak > 0 ? <View accessibilityLabel={`Biểu đồ doanh thu, cao nhất ${currency(peak)}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 150 }}>
        {bars.map(bar => <View key={bar.title} accessibilityLabel={`${bar.title}: ${currency(bar.value)}`} style={{ flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <View style={{ width: '100%', maxWidth: 22, borderRadius: 4, backgroundColor: bar.value ? colors.primary : colors.border, height: `${Math.max(2, (bar.value / peak) * 82)}%` }} />
          <Text numberOfLines={1} style={{ fontSize: 9, color: colors.muted }}>{bar.label}</Text>
        </View>)}
      </View> : <Text style={ui.body}>Chưa có dữ liệu trong kỳ.</Text>}
      <Text style={[ui.body, { fontSize: 13 }]}>Học phí lớp {currency(summary.classRevenue)} · Gói tập {currency(summary.membershipRevenue)}. Chỉ gồm giao dịch thành công, tính theo ngày thanh toán.</Text>
    </View>

    <View style={ui.card}>
      <Text style={ui.heading}>Trạng thái đăng ký</Text>
      {STATUS_ROWS.map(([status, label, color]) => {
        const count = summary.registrations[status];
        return <View key={status} style={{ gap: 6 }}>
          <View style={ui.between}><Text style={ui.body}>{label}</Text><Text style={[ui.heading, { fontSize: 15 }]}>{count}</Text></View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' }}>
            <View style={{ height: 8, width: `${registrations ? (count / registrations) * 100 : 0}%`, backgroundColor: color }} />
          </View>
        </View>;
      })}
    </View>

    <View style={ui.between}><Text style={ui.heading}>Chi tiết theo ngày</Text><Text style={[ui.body, { fontSize: 12 }]}>{days} ngày</Text></View>
    <Text style={ui.body}>Chỉ hiện ngày có hoạt động, mới nhất trước. Đăng ký tính theo ngày đăng ký; doanh thu theo ngày thực thu.</Text>
    {!active.length && <Text style={ui.body}>Không có hoạt động trong kỳ. Thử chọn khoảng thời gian khác.</Text>}
    {active.slice(page * pageSize, (page + 1) * pageSize).map(day => <View key={day.date} style={ui.card}>
      <View style={ui.between}><Text style={ui.heading}>{formatDateLabel(day.date) || day.date}</Text><Text style={[ui.heading, { fontSize: 15 }]}>{currency(day.revenue)}</Text></View>
      <Text style={ui.body}>Hội viên mới: {day.newMembers} · Đăng ký: {day.registrations} · Giao dịch: {day.successfulPayments}</Text>
    </View>)}
    {pages > 1 && <View style={{ gap: 8 }}>
      <Text style={ui.body}>Trang {page + 1}/{pages}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button secondary title="Trang trước" disabled={page === 0} onPress={() => setPage(value => Math.max(0, value - 1))} />
        <Button secondary title="Trang sau" disabled={page + 1 >= pages} onPress={() => setPage(value => Math.min(pages - 1, value + 1))} />
      </View>
    </View>}
  </>;
}
