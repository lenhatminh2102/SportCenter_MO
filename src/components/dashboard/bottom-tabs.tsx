import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/data/sport';
import type { AppTab } from '@/utils/staff-navigation';

export function BottomTabs({ tabs, selected }: { tabs: AppTab[]; selected?: string }) {
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border }}>
    <View style={{ flexDirection: 'row', width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 4, paddingVertical: 5 }}>
      {tabs.map(tab => {
        const active = selected === tab.path;
        return <Pressable key={tab.path} accessibilityRole="tab" accessibilityState={{ selected: active }}
          onPress={() => router.navigate(tab.href)}
          style={({ pressed }) => ({ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2, opacity: pressed ? 0.65 : 1 })}>
          <View style={{ minWidth: 42, minHeight: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.pale : 'transparent' }}>
            <Text style={{ fontSize: 21, lineHeight: 26, color: active ? colors.primary : colors.muted }}>{tab.symbol}</Text>
          </View>
          <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: active ? '800' : '600', color: active ? colors.primary : colors.muted }}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}
