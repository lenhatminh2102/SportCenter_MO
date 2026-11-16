import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { safeImageUrl } from '@/utils/image';
import { SportArt } from './sport-art';

export { safeImageUrl };

/** Course photo when it loads, otherwise the sport illustration underneath. */
export function ClassCover({ imageUrl, subject, style, fit = 'cover' }: { imageUrl?: unknown; subject: unknown; style?: StyleProp<ViewStyle>; fit?: 'cover' | 'contain' }) {
  const src = safeImageUrl(imageUrl);
  const [failed, setFailed] = useState('');
  return <View style={[{ overflow: 'hidden', backgroundColor: '#fff0e1' }, style]}>
    <View style={StyleSheet.absoluteFill}><SportArt subject={subject} fit={fit} /></View>
    {!!src && failed !== src && <Image source={{ uri: src }} contentFit="cover" transition={200} style={StyleSheet.absoluteFill} onError={() => setFailed(src)} accessibilityIgnoresInvertColors />}
  </View>;
}
