import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { colors } from '@/data/sport';
import { bangkokDate } from '@/services/dashboard';
import { addMinutes, commonStartTimes, dayMonth, durationLabel, formatDateLabel, normalizeTime, parseDateInput, sessionLengths, shortWeekday, upcomingDays } from '@/utils/schedule-time';
import { ui } from './styles';
type ChipProps = { label: string; sublabel?: string; selected?: boolean; disabled?: boolean; onPress: () => void; accessibilityLabel?: string };
export function Chip({ label, sublabel, selected = false, disabled = false, onPress, accessibilityLabel }: ChipProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minWidth: 52, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'white', opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}>
    {!!sublabel && <Text style={{ fontSize: 11, fontWeight: '600', color: selected ? '#ffe3d6' : colors.muted }}>{sublabel}</Text>}
    <Text style={{ fontSize: 14, fontWeight: '700', color: selected ? 'white' : colors.ink }}>{label}</Text>
  </Pressable>;
}
function TypedInput({ value, placeholder, disabled, keyboardType, onCommit, accessibilityLabel }: { value: string; placeholder: string; disabled?: boolean; keyboardType: 'numbers-and-punctuation' | 'number-pad'; onCommit: (text: string) => boolean; accessibilityLabel: string }) {
  // Local draft so partial typing ("18", "18:3") is not rejected while the user types.
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const commit = () => { if (draft === null) return; const ok = !draft.trim() || onCommit(draft); setInvalid(!ok); if (ok) setDraft(null); };
  return <View style={{ gap: 4 }}><TextInput accessibilityLabel={accessibilityLabel} value={draft ?? value} placeholder={placeholder} placeholderTextColor="#94a3b8" editable={!disabled} keyboardType={keyboardType} returnKeyType="done" onChangeText={text => { setDraft(text); setInvalid(false); }} onBlur={commit} onSubmitEditing={commit} style={{ minHeight: 46, borderWidth: 1, borderColor: invalid ? '#dc2626' : colors.border, borderRadius: 12, backgroundColor: 'white', paddingHorizontal: 14, color: colors.ink, fontSize: 15 }} />{invalid && <Text style={ui.error}>Chưa đúng định dạng, thử lại.</Text>}</View>;
}
/** Date picker: next 14 days as chips + free typing (16/11/2026, 16/11, 2026-11-16). Value is ISO. */
export function DateField({ label, value, onChange, error, disabled }: { label: string; value: string; onChange: (iso: string) => void; error?: string; disabled?: boolean }) {
  const today = bangkokDate(new Date());
  const days = upcomingDays(today, 14);
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    <Text style={{ color: value ? colors.primary : colors.muted, fontWeight: '700' }}>{formatDateLabel(value) || 'Chưa chọn ngày'}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {days.map(day => <Chip key={day} label={dayMonth(day)} sublabel={day === today ? 'Hôm nay' : shortWeekday(day)} selected={day === value} disabled={disabled} accessibilityLabel={formatDateLabel(day)} onPress={() => onChange(day)} />)}
    </ScrollView>
    <TypedInput accessibilityLabel={`${label}, nhập tay`} value={value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : ''} placeholder="Hoặc nhập ngày khác: 16/11/2026" disabled={disabled} keyboardType="numbers-and-punctuation" onCommit={text => { const iso = parseDateInput(text, today); if (iso) onChange(iso); return !!iso; }} />
    {!!error && <Text style={ui.error}>{error}</Text>}
  </View>;
}
/**
 * Time picker: common times, ±15 min nudges and typing ("1830" → 18:30).
 * With `from` (the start time) it shows session-length chips instead of fixed times.
 */
export function TimeField({ label, value, onChange, error, disabled, from }: { label: string; value: string; onChange: (time: string) => void; error?: string; disabled?: boolean; from?: string }) {
  const start = from && normalizeTime(from) ? from : '';
  const nudge = (minutes: number) => onChange(addMinutes(value || start || '18:00', minutes));
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Chip label="−15'" disabled={disabled || !value} accessibilityLabel="Lùi 15 phút" onPress={() => nudge(-15)} />
      <View style={{ flex: 1 }}><TypedInput accessibilityLabel={label} value={value} placeholder="HH:mm, ví dụ 18:30" disabled={disabled} keyboardType="numbers-and-punctuation" onCommit={text => { const time = normalizeTime(text); if (time) onChange(time); return !!time; }} /></View>
      <Chip label="+15'" disabled={disabled || !value} accessibilityLabel="Thêm 15 phút" onPress={() => nudge(15)} />
    </View>
    {start ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {sessionLengths.map(minutes => { const time = addMinutes(start, minutes); return <Chip key={minutes} label={time} sublabel={`+${minutes}'`} selected={time === value} disabled={disabled || time <= start} onPress={() => onChange(time)} />; })}
    </View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {commonStartTimes.map(time => <Chip key={time} label={time} selected={time === value} disabled={disabled} onPress={() => onChange(time)} />)}
    </ScrollView>}
    {!!start && !!value && <Text style={[ui.body, { fontSize: 13 }]}>{durationLabel(start, value) ? `Buổi học dài ${durationLabel(start, value)}` : 'Giờ kết thúc phải sau giờ bắt đầu.'}</Text>}
    {!!error && <Text style={ui.error}>{error}</Text>}
  </View>;
}
