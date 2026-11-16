import { Linking, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { videoEmbed } from '@/utils/video';
import { colors } from '@/data/sport';

// The player runs inside an HTML page with an https base URL: YouTube refuses embeds that send no
// referrer (error 153), which is what a bare WebView pointing at the embed URL would do.
const page = (src: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#2b211a}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head><body><iframe src="${src}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;

/** 16:9 lesson guide player (YouTube / Vimeo / Google Drive link). Renders `fallback` for other links. */
export function VideoEmbed({ url, fallback = null }: { url: unknown; fallback?: React.ReactNode }) {
  const video = videoEmbed(url);
  if (!video) return <>{fallback}</>;
  return <View style={{ gap: 6 }}>
    <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14, overflow: 'hidden', backgroundColor: '#2b211a' }}>
      <WebView
        source={{ html: page(video.embedUrl), baseUrl: 'https://activehub.app' }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['https://*']}
        setSupportMultipleWindows={false}
        style={{ backgroundColor: '#2b211a' }}
      />
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>▶ {video.provider}</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(String(url))}><Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>Mở bằng ứng dụng</Text></Pressable>
    </View>
  </View>;
}
