import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

/**
 * Dependency-free monochrome icons drawn with plain Views so the package does
 * not require react-native-svg. Sized for 20x20 by default.
 */

interface IconProps {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function AttachIcon({ color = "#52627a", size = 20, style }: IconProps) {
  const bar = { backgroundColor: color, borderRadius: size * 0.09 };
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <View style={[bar, { width: size * 0.14, height: size * 0.78, position: "absolute" }]} />
      <View style={[bar, { width: size * 0.78, height: size * 0.14, position: "absolute" }]} />
    </View>
  );
}

export function MicIcon({ color = "#52627a", size = 20, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "flex-end" }, style]}>
      {/* capsule */}
      <View
        style={{
          position: "absolute",
          top: 0,
          width: size * 0.34,
          height: size * 0.52,
          borderRadius: size * 0.17,
          backgroundColor: color,
        }}
      />
      {/* cradle */}
      <View
        style={{
          position: "absolute",
          top: size * 0.3,
          width: size * 0.6,
          height: size * 0.36,
          borderWidth: size * 0.09,
          borderColor: color,
          borderTopWidth: 0,
          borderBottomLeftRadius: size * 0.3,
          borderBottomRightRadius: size * 0.3,
        }}
      />
      {/* stem */}
      <View style={{ position: "absolute", bottom: size * 0.08, width: size * 0.09, height: size * 0.2, backgroundColor: color }} />
      {/* base */}
      <View style={{ width: size * 0.42, height: size * 0.09, borderRadius: size * 0.05, backgroundColor: color }} />
    </View>
  );
}

export function SendIcon({ color = "#fff", size = 20, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: size * 0.12,
          borderTopWidth: size * 0.34,
          borderBottomWidth: size * 0.34,
          borderLeftWidth: size * 0.56,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          borderLeftColor: color,
        }}
      />
    </View>
  );
}

export function StopIcon({ color = "#b91c1c", size = 20, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <View style={{ width: size * 0.55, height: size * 0.55, borderRadius: size * 0.12, backgroundColor: color }} />
    </View>
  );
}

export function FileIcon({ color = "#0c8a5f", size = 20, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <View
        style={{
          width: size * 0.62,
          height: size * 0.8,
          borderWidth: size * 0.085,
          borderColor: color,
          borderRadius: size * 0.12,
          borderTopRightRadius: size * 0.3,
          justifyContent: "center",
          gap: size * 0.1,
          paddingHorizontal: size * 0.08,
        }}
      >
        <View style={{ height: size * 0.07, borderRadius: size * 0.04, backgroundColor: color }} />
        <View style={{ height: size * 0.07, width: "70%", borderRadius: size * 0.04, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function PlayIcon({ color = "#0c8a5f", size = 20, style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: size * 0.1,
          borderTopWidth: size * 0.28,
          borderBottomWidth: size * 0.28,
          borderLeftWidth: size * 0.46,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          borderLeftColor: color,
        }}
      />
    </View>
  );
}

export function BackIcon({ color = "#334155", size = 20, style }: IconProps) {
  const stroke = Math.max(2, size * 0.11);
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          marginLeft: size * 0.14,
          borderLeftWidth: stroke,
          borderBottomWidth: stroke,
          borderColor: color,
          borderRadius: 2,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

export function ChatIcon({ color = "#fff", size = 20, style }: IconProps) {
  const stroke = Math.max(2, size * 0.09);
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <View
        style={{
          width: size * 0.82,
          height: size * 0.66,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: size * 0.22,
          justifyContent: "center",
          gap: size * 0.09,
          paddingHorizontal: size * 0.12,
        }}
      >
        <View style={{ height: stroke * 0.8, borderRadius: 2, backgroundColor: color }} />
        <View style={{ height: stroke * 0.8, width: "60%", borderRadius: 2, backgroundColor: color }} />
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          marginRight: size * 0.3,
          borderTopWidth: size * 0.18,
          borderRightWidth: size * 0.18,
          borderTopColor: color,
          borderRightColor: "transparent",
        }}
      />
    </View>
  );
}

export function SearchIcon({ color = "#52627a", size = 20, style }: IconProps) {
  const ring = size * 0.6;
  const stroke = Math.max(1, size * 0.1);
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          position: "absolute",
          top: size * 0.08,
          left: size * 0.08,
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: size * 0.07,
          right: size * 0.06,
          width: size * 0.32,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

export const iconStyles = StyleSheet.create({});
