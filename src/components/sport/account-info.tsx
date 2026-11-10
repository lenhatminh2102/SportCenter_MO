import { useCallback } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useApiQuery } from '@/hooks/use-api-query';
import { findUserEmail } from '@/services/account-email';
import { colors } from '@/data/sport';
import { ui } from './styles';
/** Read-only login account of a coach/staff profile: email when it can be found, otherwise the User ID. */
export function AccountInfo({ token, userId }: { token: string; userId: string }) {
  const load = useCallback(() => findUserEmail(token, userId), [token, userId]);
  const query = useApiQuery(load, !!userId);
  return <View style={[ui.card, { backgroundColor: colors.pale, gap: 6 }]}>
    <Text style={ui.eyebrow}>TÀI KHOẢN ĐĂNG NHẬP</Text>
    {query.loading ? <ActivityIndicator accessibilityLabel="Đang tìm email" color={colors.primary} /> : query.data
      ? <Text selectable style={[ui.heading, { fontSize: 17 }]}>{query.data}</Text>
      : <Text style={ui.body}>Chưa lấy được email từ hệ thống.</Text>}
    <Text selectable style={[ui.body, { fontSize: 12 }]}>User ID: {userId || 'chưa có'}</Text>
    <Text style={[ui.body, { fontSize: 12 }]}>Email là tài khoản đăng nhập, không sửa được ở đây.</Text>
  </View>;
}
