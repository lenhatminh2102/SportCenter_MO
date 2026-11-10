import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@/context/auth';
import { isMemberPage, activeMemberTab, memberTabs } from '@/utils/member-navigation';
import { colors } from '@/data/sport';
import { MemberShellContext } from '@/context/member-shell';
import { BottomTabs } from './bottom-tabs';

export function MemberShell({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const path = usePathname();
  const active = user?.role === 'MEMBER' && isMemberPage(path);
  return <MemberShellContext.Provider value={active}>
    <View style={{ flex: 1, backgroundColor: active ? colors.public : 'transparent' }}>
      <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      {active && <BottomTabs tabs={memberTabs} selected={activeMemberTab(path)} />}
    </View>
  </MemberShellContext.Provider>;
}
