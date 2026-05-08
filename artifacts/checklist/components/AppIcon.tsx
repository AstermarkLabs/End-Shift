import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";

export const SVG_PREFIX = "__svg__:";

export function isSvgUri(uri: string): boolean {
  return uri.startsWith(SVG_PREFIX);
}

interface Props {
  uri?: string;
  emoji?: string;
  size: number;
  borderRadius?: number;
  style?: object;
}

export function AppIcon({ uri, emoji, size, borderRadius = 10, style }: Props) {
  const br = borderRadius;

  if (uri && isSvgUri(uri)) {
    const xml = uri.slice(SVG_PREFIX.length);
    return (
      <View style={[{ width: size, height: size, borderRadius: br, overflow: "hidden" }, style]}>
        <SvgXml xml={xml} width={size} height={size} />
      </View>
    );
  }

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: br }, style]}
        resizeMode="cover"
      />
    );
  }

  return (
    <Text style={[styles.emoji, { fontSize: size * 0.55 }]}>{emoji ?? "📋"}</Text>
  );
}

const styles = StyleSheet.create({
  emoji: { lineHeight: undefined },
});
