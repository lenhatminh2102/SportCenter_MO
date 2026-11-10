import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { managerApi, type ManagerReport } from '@/services/manager';
import { bangkokDate } from '@/services/dashboard';
import { currency } from '@/services/payments';
import { formatDateLabel, parseDateInput } from '@/utils/schedule-time';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Field, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';

export default function ManagerReports() {
  const { user, token } = useAuth();
  const today = bangkokDate(new Date());
  const [range, setRange] = useState(() => ({ from: `${today.slice(0, 7)}-01`, to: today }));
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [error, setError] = useState('');
  const allowed = !!token && user?.role === 'CENTER_MANAGER';
  const load = useCallback(() => managerApi.report(token!, range.from, range.to), [token, range]);
  const query = useApiQuery(load, allowed);
  if (!user || !token) return <AccessScreen />;
  if (!allowed) return <AccessScreen denied />;

  function apply() {
    const start = parseDateInput(from, today);
    const end = parseDateInput(to, today);
    if (!start || !end) return setError('Nhập ngày hợp lệ, ví dụ 16/11/2026.');
    if (end < start || Date.parse(end) - Date.parse(start) >= 366 * 86400000) {
      return setError('Chọn khoảng từ 1 đến 366 ngày, theo thứ tự từ ngày đến ngày.');
    }
    setError('');
    setRange({ from: start, to: end });
  }

  return <Screen>
    <Link href="/manager" style={ui.link}>← Tổng quan</Link>
    <Text style={ui.title}>Báo cáo trung tâm</Text>
    <View style={ui.card}>
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
  const pages = Math.ceil(report.daily.length / pageSize);
  const { summary } = report;
  return <>
    <View style={ui.card}>
      <Text style={ui.heading}>Tổng hợp</Text>
      <Text style={ui.body}>Từ {report.from} đến {report.to}</Text>
      <Text style={ui.body}>Tổng hội viên hiện tại: {summary.totalMembers}</Text>
      <Text style={ui.body}>Hội viên mới trong kỳ: {summary.newMembers}</Text>
      <Text style={ui.body}>Đăng ký chờ thanh toán: {summary.registrations.PENDING_PAYMENT}</Text>
      <Text style={ui.body}>Đăng ký đã xác nhận: {summary.registrations.CONFIRMED}</Text>
      <Text style={ui.body}>Đăng ký đã hủy: {summary.registrations.CANCELLED}</Text>
      <Text style={ui.heading}>Doanh thu: {currency(summary.revenue)}</Text>
      <Text style={ui.body}>{summary.successfulPayments} giao dịch thành công theo ngày thực thu.</Text>
      {!!report.undatedSuccessfulPayments && <Text style={ui.body}>Có {report.undatedSuccessfulPayments} giao dịch thành công thiếu ngày thu trên hệ thống. Các giao dịch này không được tính vào doanh thu theo ngày.</Text>}
    </View>
    <Text style={ui.heading}>Chi tiết theo ngày</Text>
    <Text style={ui.body}>Đăng ký được nhóm theo ngày đăng ký và trạng thái hiện tại.</Text>
    {report.daily.slice(page * pageSize, (page + 1) * pageSize).map(day => <View key={day.date} style={ui.card}>
      <Text style={ui.heading}>{formatDateLabel(day.date) || day.date}</Text>
      <Text style={ui.body}>Hội viên mới: {day.newMembers} · Doanh thu: {currency(day.revenue)}</Text>
      <Text style={ui.body}>Đăng ký: {day.registrations.PENDING_PAYMENT} chờ · {day.registrations.CONFIRMED} xác nhận · {day.registrations.CANCELLED} hủy</Text>
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
