import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { useAuth } from '@/context/auth';
import { StaffShellContext } from '@/context/staff-shell';
import { activeStaffTab, isStaffPage, isWorkspaceRole, staffTabs } from '@/utils/staff-navigation';
import { colors } from '@/data/sport';
import { BottomTabs } from './bottom-tabs';

const roleLabels = { CENTER_MANAGER: 'Quản lý trung tâm', COACH: 'Huấn luyện viên', RECEPTIONIST: 'Lễ tân' };

export function StaffShell({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const path = usePathname();
  const role = isWorkspaceRole(user?.role) && isStaffPage(path) ? user.role : null;
  return <StaffShellContext.Provider value={!!role}>
    <View style={{ flex: 1, backgroundColor: role ? colors.public : 'transparent' }}>
      {role && <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>ActiveHub</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{roleLabels[role]}</Text>
          </View>
        </View>
      </SafeAreaView>}
      <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      {role && <BottomTabs tabs={staffTabs(role)} selected={activeStaffTab(path, role)} />}
    </View>
  </StaffShellContext.Provider>;
}
