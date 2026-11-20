import { Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { ui } from '@/components/sport/styles';
import { colors } from '@/data/sport';

/** One figure on a staff home (web DashboardView metric): value, label, a short detail and where it leads. */
export type HomeMetric = { label: string; value: string; detail: string; href: Href };
/** A "needs attention" row (web DashboardView attention): urgent rows are tinted. */
export type HomeAttention = { title: string; detail: string; cta: string; href: Href; tone: 'urgent' | 'ok' | 'info' };

const tones = {
  urgent: { background: '#fff4e5', border: '#f5c27a', mark: '#b45309', symbol: '!' },
  ok: { background: '#effaf3', border: '#a7dcb9', mark: colors.green, symbol: '✓' },
  info: { background: '#eef4ff', border: '#bcd0f5', mark: '#1d4ed8', symbol: 'i' },
} as const;

/** Two tiles per row; each tile opens its list. */
export function MetricGrid({ items }: { items: HomeMetric[] }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
    {items.map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label}: ${item.value}`}
      onPress={() => router.push(item.href)}
      style={({ pressed }) => [ui.card, { flexBasis: '47%', flexGrow: 1, minHeight: 104, padding: 14, gap: 4, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[ui.body, { fontSize: 13, lineHeight: 18 }]}>{item.label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>{item.value}</Text>
      <Text style={[ui.body, { fontSize: 12, lineHeight: 16 }]}>{item.detail}</Text>
    </Pressable>)}
  </View>;
}

export function AttentionList({ title = 'Cần chú ý', items }: { title?: string; items: HomeAttention[] }) {
  return <View style={{ gap: 10 }}>
    <Text style={ui.heading}>{title}</Text>
    {items.map(item => {
      const tone = tones[item.tone];
      return <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.cta}`} onPress={() => router.push(item.href)}
        style={({ pressed }) => [{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, backgroundColor: tone.background, borderColor: tone.border, opacity: pressed ? 0.7 : 1 }]}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tone.mark, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: 'white', fontWeight: '800' }}>{tone.symbol}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[ui.heading, { fontSize: 15 }]}>{item.title}</Text>
          <Text style={[ui.body, { fontSize: 13, lineHeight: 18 }]}>{item.detail}</Text>
          <Text style={[ui.link, { fontSize: 13 }]}>{item.cta} →</Text>
        </View>
      </Pressable>;
    })}
  </View>;
}
