import { Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '@/data/sport';
import { dayMonth, isIsoDate, MAX_REPEAT, repeatDates, shortWeekday, weekdayOf, weekdayOptions } from '@/utils/schedule-time';
import { Chip } from './date-time-fields';
import { ui } from './styles';
export type RepeatSettings = { enabled: boolean; weekdays: number[]; count: string; advanceLesson: boolean };
export const defaultRepeat: RepeatSettings = { enabled: false, weekdays: [], count: '8', advanceLesson: true };
export const repeatCount = (settings: RepeatSettings) => { const value = Number(settings.count); return Number.isInteger(value) && value >= 1 && value <= MAX_REPEAT ? value : 0; };
/** Dates that will be created; the chosen start date's weekday is always included. */
export function plannedDates(start: string, settings: RepeatSettings) {
  if (!settings.enabled || !isIsoDate(start)) return isIsoDate(start) ? [start] : [];
  const weekdays = settings.weekdays.length ? settings.weekdays : [weekdayOf(start)];
  // The start date may have been changed after picking weekdays: its weekday always counts.
  return repeatDates(start, weekdays.includes(weekdayOf(start)) ? weekdays : [...weekdays, weekdayOf(start)], repeatCount(settings));
}
/** "Lặp lại hàng tuần" block for new schedules: pick weekdays + number of sessions. */
export function ScheduleRepeat({ date, value, onChange, disabled }: { date: string; value: RepeatSettings; onChange: (value: RepeatSettings) => void; disabled?: boolean }) {
  const set = (patch: Partial<RepeatSettings>) => onChange({ ...value, ...patch });
  const startDay = isIsoDate(date) ? weekdayOf(date) : -1;
  const weekdays = value.weekdays.length ? value.weekdays : startDay >= 0 ? [startDay] : [];
  const dates = plannedDates(date, value);
  const count = repeatCount(value);
  return <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value.enabled, disabled }} disabled={disabled} onPress={() => set({ enabled: !value.enabled, weekdays: value.weekdays.length ? value.weekdays : startDay >= 0 ? [startDay] : [] })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
      <View style={{ width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: value.enabled ? colors.primary : colors.border, alignItems: value.enabled ? 'flex-end' : 'flex-start' }}><View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'white' }} /></View>
      <View style={{ flex: 1 }}><Text style={ui.heading}>Lặp lại hàng tuần</Text><Text style={[ui.body, { fontSize: 13 }]}>Tạo nhiều buổi cùng giờ và phòng trong một lần lưu.</Text></View>
    </Pressable>
    {value.enabled && <>
      <Text style={{ color: colors.ink, fontWeight: '600' }}>Các ngày trong tuần</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {weekdayOptions.map(option => <Chip key={option.day} label={option.label} selected={weekdays.includes(option.day)} disabled={disabled || option.day === startDay} accessibilityLabel={option.day === startDay ? `${option.label}, ngày bắt đầu` : option.label}
          onPress={() => set({ weekdays: weekdays.includes(option.day) ? weekdays.filter(day => day !== option.day) : [...weekdays, option.day] })} />)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: colors.ink, fontWeight: '600' }}>Số buổi</Text>
        <Chip label="−" disabled={disabled || count <= 1} accessibilityLabel="Bớt 1 buổi" onPress={() => set({ count: String(Math.max(1, count - 1)) })} />
        <TextInput accessibilityLabel="Số buổi" value={value.count} editable={!disabled} keyboardType="number-pad" onChangeText={text => set({ count: text.replace(/\D/g, '').slice(0, 2) })} style={{ width: 64, minHeight: 44, borderWidth: 1, borderColor: count ? colors.border : '#dc2626', borderRadius: 12, textAlign: 'center', backgroundColor: 'white', color: colors.ink, fontSize: 16, fontWeight: '700' }} />
        <Chip label="+" disabled={disabled || count >= MAX_REPEAT} accessibilityLabel="Thêm 1 buổi" onPress={() => set({ count: String(Math.min(MAX_REPEAT, count + 1)) })} />
      </View>
      {!count && <Text style={ui.error}>Số buổi từ 1 đến {MAX_REPEAT}.</Text>}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value.advanceLesson, disabled }} disabled={disabled} onPress={() => set({ advanceLesson: !value.advanceLesson })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <View style={{ width: 23, height: 23, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: value.advanceLesson ? colors.primary : 'white', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: 'white' }}>{value.advanceLesson ? '✓' : ''}</Text></View>
        <Text style={[ui.body, { flex: 1 }]}>Tự chuyển sang bài tiếp theo mỗi buổi (theo thứ tự bài học của lớp)</Text>
      </Pressable>
      {dates.length > 0 && <View style={{ gap: 6 }}>
        <Text style={{ color: colors.ink, fontWeight: '600' }}>Sẽ tạo {dates.length} buổi</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{dates.map(day => <Text key={day} style={{ fontSize: 12, color: colors.muted, backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>{shortWeekday(day)} {dayMonth(day)}</Text>)}</View>
      </View>}
    </>}
  </View>;
}
