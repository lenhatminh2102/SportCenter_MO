import { Pressable, ScrollView, Text, View } from 'react-native';
import { subjectTone, type SubjectOption } from '@/utils/subject-filter';
import { colors } from '@/data/sport';

/** Sport chips: "Tất cả 12 · Bóng bàn 5 · Yoga 7". Hidden when the list has one sport or less. */
export function SubjectFilter({ options, value, onChange, total }: { options: SubjectOption[]; value: string; onChange: (value: string) => void; total: number }) {
  if (options.filter(item => item.id).length < 2 && !value) return null;
  const ids = options.map(item => item.id);
  const chip = (key: string, label: string, count: number, tone?: string) => {
    const active = value === key;
    return <Pressable key={key || 'all'} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(active && key ? '' : key)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.ink : colors.border, backgroundColor: active ? colors.ink : '#fff' }}>
      {tone && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />}
      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : colors.ink }}>{label}</Text>
      <Text style={{ fontSize: 12, color: active ? '#ffffffb3' : colors.muted }}>{count}</Text>
    </Pressable>;
  };
  return <View accessibilityLabel="Lọc theo môn" style={{ gap: 6 }}>
    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 1 }}>MÔN</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {chip('', 'Tất cả', total)}
      {options.map(item => chip(item.id || '-', item.name, item.count, subjectTone(item.id, ids)))}
    </ScrollView>
  </View>;
}
