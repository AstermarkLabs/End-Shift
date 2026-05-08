import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

export interface SortableRenderParams<T> {
  item: T;
  index: number;
  isActive: boolean;
  /** Spread these on the drag-handle View (or on the whole item for full-item drag) */
  dragHandleProps: ReturnType<typeof PanResponder.create>["panHandlers"];
}

interface SortableListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (params: SortableRenderParams<T>) => React.ReactNode;
  onReorder: (newData: T[]) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  direction?: "vertical" | "horizontal";
  /**
   * Estimated item size in the drag direction (height for vertical, width for
   * horizontal). Used as the swap-distance threshold.
   */
  itemSize?: number;
  /**
   * When false the PanResponder only claims the gesture on movement (not on
   * initial press), so child Touchables can still handle taps normally.
   * Use false for horizontal tab bars. Defaults to true.
   */
  claimOnStart?: boolean;
  style?: ViewStyle;
}

export function SortableList<T>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  onDragStart,
  onDragEnd,
  direction = "vertical",
  itemSize = 50,
  claimOnStart = true,
  style,
}: SortableListProps<T>) {
  const isHorizontal = direction === "horizontal";

  const [activeKey, setActiveKey] = useState<string | null>(null);

  // ── Stable refs ─────────────────────────────────────────────────────────────
  // Keep latest values accessible from inside cached PanResponder closures
  // without triggering re-creates.
  const dataRef = useRef(data);
  dataRef.current = data;

  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;

  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  // Track each item's current index so grant handlers see the right starting point
  const itemIndexRef = useRef<Map<string, number>>(new Map());
  data.forEach((item, index) => itemIndexRef.current.set(keyExtractor(item), index));

  // Active drag state (no setState — mutations don't need to re-render)
  const gestureState = useRef({ activeIndex: -1, cumulativeDelta: 0 });

  // ── Cached PanResponder instances (one per item key, created once) ──────────
  const panRespondersRef = useRef<Map<string, ReturnType<typeof PanResponder.create>["panHandlers"]>>(new Map());

  // Remove stale keys (items that have been deleted)
  const currentKeys = new Set(data.map(keyExtractor));
  for (const k of [...panRespondersRef.current.keys()]) {
    if (!currentKeys.has(k)) panRespondersRef.current.delete(k);
  }

  const getPanHandlers = (key: string) => {
    if (!panRespondersRef.current.has(key)) {
      const responder = PanResponder.create({
        onStartShouldSetPanResponder: () => claimOnStart,
        onMoveShouldSetPanResponder: (_, { dx, dy }) => {
          if (isHorizontal) return Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 1.5;
          return Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx) * 1.5;
        },

        onPanResponderGrant: () => {
          const index = itemIndexRef.current.get(key) ?? 0;
          gestureState.current = { activeIndex: index, cumulativeDelta: 0 };
          setActiveKey(key);
          onDragStartRef.current?.();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },

        onPanResponderMove: (_, ge) => {
          const rawDelta = isHorizontal ? ge.dx : ge.dy;
          const { activeIndex, cumulativeDelta } = gestureState.current;
          const relDelta = rawDelta - cumulativeDelta;
          const threshold = itemSize * 0.55;
          const count = dataRef.current.length;

          if (relDelta > threshold && activeIndex < count - 1) {
            const next = [...dataRef.current];
            [next[activeIndex], next[activeIndex + 1]] = [next[activeIndex + 1], next[activeIndex]];
            gestureState.current = {
              activeIndex: activeIndex + 1,
              cumulativeDelta: cumulativeDelta + itemSize,
            };
            onReorderRef.current(next);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } else if (relDelta < -threshold && activeIndex > 0) {
            const next = [...dataRef.current];
            [next[activeIndex], next[activeIndex - 1]] = [next[activeIndex - 1], next[activeIndex]];
            gestureState.current = {
              activeIndex: activeIndex - 1,
              cumulativeDelta: cumulativeDelta - itemSize,
            };
            onReorderRef.current(next);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },

        onPanResponderRelease: () => {
          gestureState.current = { activeIndex: -1, cumulativeDelta: 0 };
          setActiveKey(null);
          onDragEndRef.current?.();
        },

        onPanResponderTerminate: () => {
          gestureState.current = { activeIndex: -1, cumulativeDelta: 0 };
          setActiveKey(null);
          onDragEndRef.current?.();
        },
      });
      panRespondersRef.current.set(key, responder.panHandlers);
    }
    return panRespondersRef.current.get(key)!;
  };

  return (
    <View style={[isHorizontal && styles.rowContainer, style]}>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        const isActive = key === activeKey;
        // getPanHandlers returns the *same* object reference on every render —
        // React won't touch the DOM/native event listeners, so the gesture is
        // never interrupted by a re-render triggered by a swap.
        const dragHandleProps = getPanHandlers(key);

        return (
          <View key={key} style={isActive ? styles.activeWrapper : undefined}>
            {renderItem({ item, index, isActive, dragHandleProps })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  activeWrapper: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
});
