import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
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
  /** Spread these on the drag-handle View (or on the item itself for full-item drag) */
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
   * Estimated size (height for vertical, width for horizontal) used as the
   * swap threshold. Also used as the wrapper shadow when active.
   */
  itemSize?: number;
  /**
   * When false the PanResponder only claims the gesture on *movement*
   * (not on initial press), which lets child Touchables handle taps normally.
   * Use false for horizontal tab bars where items are also tappable.
   * Defaults to true.
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
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;

  const gestureState = useRef({ activeIndex: -1, cumulativeDelta: 0 });

  const isHorizontal = direction === "horizontal";

  const buildPanHandlers = useCallback(
    (key: string, indexAtMount: number) => {
      const responder = PanResponder.create({
        onStartShouldSetPanResponder: () => claimOnStart,
        onMoveShouldSetPanResponder: (_, { dx, dy }) => {
          if (isHorizontal) return Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 1.5;
          return Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx) * 1.5;
        },

        onPanResponderGrant: () => {
          gestureState.current = { activeIndex: indexAtMount, cumulativeDelta: 0 };
          setActiveKey(key);
          onDragStart?.();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },

        onPanResponderMove: (_, gestureEvent) => {
          const delta = isHorizontal ? gestureEvent.dx : gestureEvent.dy;
          const { activeIndex, cumulativeDelta } = gestureState.current;
          const relDelta = delta - cumulativeDelta;
          const threshold = itemSize * 0.55;

          if (relDelta > threshold && activeIndex < dataRef.current.length - 1) {
            const newData = [...dataRef.current];
            [newData[activeIndex], newData[activeIndex + 1]] = [
              newData[activeIndex + 1],
              newData[activeIndex],
            ];
            gestureState.current = {
              activeIndex: activeIndex + 1,
              cumulativeDelta: cumulativeDelta + itemSize,
            };
            onReorder(newData);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } else if (relDelta < -threshold && activeIndex > 0) {
            const newData = [...dataRef.current];
            [newData[activeIndex], newData[activeIndex - 1]] = [
              newData[activeIndex - 1],
              newData[activeIndex],
            ];
            gestureState.current = {
              activeIndex: activeIndex - 1,
              cumulativeDelta: cumulativeDelta - itemSize,
            };
            onReorder(newData);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },

        onPanResponderRelease: () => {
          gestureState.current = { activeIndex: -1, cumulativeDelta: 0 };
          setActiveKey(null);
          onDragEnd?.();
        },

        onPanResponderTerminate: () => {
          gestureState.current = { activeIndex: -1, cumulativeDelta: 0 };
          setActiveKey(null);
          onDragEnd?.();
        },
      });

      return responder.panHandlers;
    },
    [isHorizontal, claimOnStart, itemSize, onReorder, onDragStart, onDragEnd]
  );

  return (
    <View style={[isHorizontal && styles.rowContainer, style]}>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        const isActive = key === activeKey;
        const dragHandleProps = buildPanHandlers(key, index);

        return (
          <View
            key={key}
            style={isActive ? styles.activeWrapper : undefined}
          >
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
