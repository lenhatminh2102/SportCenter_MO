import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { useApiQuery } from '@/hooks/use-api-query';
import { entityId, lessonsApi } from '@/services/operations';
import { QueryStatus } from './access';
import { ui } from './styles';
export function ClassLessons({ token, classId }: { token: string; classId: string }) {
  const load = useCallback(() => lessonsApi.byClass(token, classId), [token, classId]);
  const query = useApiQuery(load);
  return <View style={ui.card}><Text style={ui.heading}>Bài học của lớp</Text><QueryStatus loading={query.loading} error={query.error} retry={query.reload} />{query.data?.length === 0 && <Text style={ui.body}>Chưa có bài học được trả về cho lớp này.</Text>}{query.data?.map(item => <View key={entityId(item)}><Text style={ui.heading}>{String(item.order || '')}. {String(item.title || '')}</Text><Text style={ui.body}>{String(item.description || '')}</Text></View>)}</View>;
}
