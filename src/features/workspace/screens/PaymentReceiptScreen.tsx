import { useCallback, useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useApiQuery } from '@/hooks/use-api-query';
import { canManagePayments, paymentsApi } from '@/services/payments';
import { receiptRows } from '@/utils/payment-receipt';
import { AccessScreen, QueryStatus } from '@/components/sport/access';
import { Button, Screen } from '@/components/sport/ui';
import { ui } from '@/components/sport/styles';

export default function PaymentReceipt() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, token } = useAuth();
  const [error, setError] = useState('');
  const load = useCallback(async () => receiptRows(await paymentsApi.receipt(token!, id!)), [token, id]);
  const query = useApiQuery(load, !!id && !!token && canManagePayments(user?.role));
  if (!user || !token) return <AccessScreen />;
  if (!canManagePayments(user.role)) return <AccessScreen denied />;
  async function share() {
    try { setError(''); await Share.share({ title: 'Biên nhận Sport Center', message: 'SPORT CENTER · BIÊN NHẬN THANH TOÁN\n' + query.data!.map(row => row.join(': ')).join('\n') }); }
    catch (e) { setError((e as Error).message); }
  }
  return <Screen><Link href="/payments" style={ui.link}>← Thanh toán</Link><Text style={ui.title}>Biên nhận thanh toán</Text>
    {!id ? <Text style={ui.error}>Thiếu mã thanh toán.</Text> : <QueryStatus loading={query.loading} error={query.error} retry={query.reload} />}
    {query.data && <><View style={ui.card}>{query.data.map(([label, value], index) => <View key={index} style={{ gap: 4 }}><Text style={ui.eyebrow}>{label}</Text><Text selectable style={ui.body}>{value}</Text></View>)}</View>{Platform.OS === 'web' ? <Button title="In / Lưu PDF" onPress={() => window.print()} /> : <Button title="Chia sẻ nội dung biên nhận" onPress={() => void share()} />}</>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </Screen>;
}
