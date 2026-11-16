import { createElement } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { videoEmbed } from '@/utils/video';
import { colors } from '@/data/sport';

/** Web build: a plain iframe (the browser sends the referrer YouTube needs). */
export function VideoEmbed({ url, fallback = null }: { url: unknown; fallback?: React.ReactNode }) {
  const video = videoEmbed(url);
  if (!video) return <>{fallback}</>;
  return <View style={{ gap: 6 }}>
    <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14, overflow: 'hidden', backgroundColor: '#2b211a' }}>
      {createElement('iframe', {
        src: video.embedUrl,
        title: 'Video bài học',
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowFullScreen: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
        style: { width: '100%', height: '100%', border: 0 },
      })}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>▶ {video.provider}</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(String(url))}><Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>Mở trong tab mới</Text></Pressable>
    </View>
  </View>;
}
