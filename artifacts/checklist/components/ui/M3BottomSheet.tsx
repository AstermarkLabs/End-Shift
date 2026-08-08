// Material 3 modal bottom sheet — the design prototype's BottomSheet/SheetRow
// (m3/components-nav.jsx, m3/App.jsx) on top of @gorhom/bottom-sheet.
//
// react-native-paper has no sheet component. Rendering is declarative here
// (`visible` / `onDismiss`) so call sites look like Paper's Dialog rather than
// juggling a ref.
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TouchableRipple } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import shape from "@/constants/shape";
import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";

export function M3BottomSheet({
  visible,
  onDismiss,
  title,
  children,
}: {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const md = useMd();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  // gorhom fires onDismiss for *every* close — backdrop tap, swipe, and our own
  // programmatic dismiss(). Without this guard, closing via `visible=false`
  // bounces an extra onDismiss back at the caller, which then re-runs whatever
  // state reset it does. Track who initiated the close.
  const presented = useRef(false);

  useEffect(() => {
    if (visible && !presented.current) {
      presented.current = true;
      ref.current?.present();
    } else if (!visible && presented.current) {
      presented.current = false;
      ref.current?.dismiss();
    }
  }, [visible]);

  const handleDismiss = () => {
    // Only propagate when the sheet closed itself (swipe / backdrop). A close
    // the caller already requested needs no echo.
    if (presented.current) {
      presented.current = false;
      onDismiss();
    }
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: md.surfaceContainerLow,
        borderTopLeftRadius: shape.xl,
        borderTopRightRadius: shape.xl,
      }}
      handleIndicatorStyle={{
        backgroundColor: md.onSurfaceVariant,
        opacity: 0.4,
        width: 32,
        height: 4,
      }}
    >
      <BottomSheetView style={{ paddingBottom: 8 + insets.bottom }}>
        {title && (
          <Text style={[typeStyle("titleLarge"), styles.title, { color: md.onSurface }]}>
            {title}
          </Text>
        )}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

export function SheetRow({
  icon,
  label,
  onPress,
  destructive,
  disabled,
  badge,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Trailing count pill (e.g. saved shifts on a History row). */
  badge?: number;
}) {
  const md = useMd();
  const fg = destructive ? md.error : md.onSurface;

  return (
    <TouchableRipple onPress={disabled ? undefined : onPress} rippleColor={fg} disabled={disabled}>
      <View style={[styles.row, disabled && styles.rowDisabled]}>
        <Ionicons name={icon} size={22} color={fg} />
        <Text style={[typeStyle("bodyLarge"), styles.rowLabel, { color: fg }]}>{label}</Text>
        {badge != null && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: md.error }]}>
            <Text style={[typeStyle("labelSmall"), { color: md.onError }]}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        )}
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  rowDisabled: { opacity: 0.38 },
  rowLabel: { flex: 1 },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
