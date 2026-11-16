import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { entityId, type Entity } from '@/services/operations';
import { paymentsApi, validatePaymentUrl } from '@/services/payments';
import { Button } from './ui';
import { ui } from './styles';
export function PaymentActions({ item, token, onRefresh, disabled = false, onBusyChange }: {
  item: Entity; token: string; onRefresh: () => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [confirm, setConfirm] = useState<'SUCCESS' | 'FAILED' | null>(null);
  // In the app, payOS returns straight into the payment-result screen; the web build keeps a browser tab.
  const appReturn = Platform.OS === 'web' ? undefined : Linking.createURL('payment-result');
  function begin() {
    if (pending.current || disabled) return false;
    pending.current = true; setBusy(true); onBusyChange?.(true); setError(''); return true;
  }
  function finish() { pending.current = false; setBusy(false); onBusyChange?.(false); }
  async function prepare() {
    if (!begin()) return;
    try { const result = await paymentsApi.checkout(token, entityId(item), appReturn); setCheckoutUrl(validatePaymentUrl(result.paymentUrl)); }
    catch (e) { setError((e as Error).message); } finally { finish(); }
  }
  async function open() {
    if (!begin()) return;
    try {
      // Open directly from this new user gesture; awaiting the API first can block web popups.
      if (appReturn) {
        const result = await WebBrowser.openAuthSessionAsync(validatePaymentUrl(checkoutUrl), appReturn);
        if (result.type === 'success') {
          // BE checked the payment with payOS and sent us back with ?id=…
          const paymentId = Linking.parse(result.url).queryParams?.id;
          router.push({ pathname: '/payment-result', params: { id: typeof paymentId === 'string' ? paymentId : entityId(item) } });
          return;
        }
      } else {
        await WebBrowser.openBrowserAsync(validatePaymentUrl(checkoutUrl));
      }
      onRefresh();
    } catch (e) { setError((e as Error).message); } finally { finish(); }
  }
  async function simulate(status: 'SUCCESS' | 'FAILED') {
    if (!begin()) return;
    try { await paymentsApi.simulate(token, entityId(item), status); setConfirm(null); onRefresh(); }
    catch (e) { setError((e as Error).message); } finally { finish(); }
  }
  async function checkStatus() {
    if (!begin()) return;
    try {
      await paymentsApi.status(token, entityId(item));
      onRefresh();
    } catch (e) { setError((e as Error).message); } finally { finish(); }
  }
  const locked = busy || disabled;
  return <View style={ui.card}>
    <Text style={ui.heading}>Tiếp tục thanh toán</Text>
    {item.paymentMethod === 'ONLINE' ? checkoutUrl ? <><Text style={ui.body}>Trang thanh toán payOS đã sẵn sàng: quét VietQR bằng app ngân hàng hoặc chuyển khoản theo hướng dẫn. Thanh toán xong bạn sẽ được đưa về ứng dụng.</Text><Button disabled={locked} title="Mở trang thanh toán →" onPress={() => void open()} /></> : <Button disabled={locked} title={busy ? 'Đang tạo liên kết…' : 'Thanh toán qua payOS'} onPress={() => void prepare()} /> : <Text style={ui.body}>Liên hệ lễ tân để được hướng dẫn thanh toán tiền mặt hoặc chuyển khoản tại trung tâm.</Text>}
    <Text style={ui.body}>Sau khi quay lại, bấm kiểm tra để xem trạng thái mới nhất.</Text>
    <Button secondary disabled={locked} title="Kiểm tra trạng thái mới nhất" onPress={() => void checkStatus()} />
    {process.env.EXPO_PUBLIC_ENABLE_PAYMENT_DEMO === 'true' && <View style={{ gap: 12 }}><Text style={ui.eyebrow}>KIỂM THỬ · KHÔNG THU TIỀN</Text><Text style={ui.body}>Chỉ dùng với BE PAYMENT_MODE=mock. Kết quả mô phỏng có thể xác nhận đăng ký lớp.</Text>{confirm ? <><Text style={ui.body}>Xác nhận mô phỏng {confirm === 'SUCCESS' ? 'thành công và xác nhận đăng ký lớp' : 'thất bại'}?</Text><Button disabled={locked} title="Xác nhận mô phỏng" onPress={() => void simulate(confirm)} /><Button secondary disabled={locked} title="Hủy" onPress={() => setConfirm(null)} /></> : <><Button secondary disabled={locked} title="Mô phỏng thành công" onPress={() => setConfirm('SUCCESS')} /><Button secondary disabled={locked} title="Mô phỏng thất bại" onPress={() => setConfirm('FAILED')} /></>}</View>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>;
}
