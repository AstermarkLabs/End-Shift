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
  dragHandleProps: ReturnType<typeof PanResponder.create>["panHandlers"];
}

interface SortableListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (params: SortableRenderParams<T>) => React.ReactNode;
  onReorder: (newData: T[]) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  rowHeight?: number;
  style?: ViewStyle;
}

export function SortableList<T>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  onDragStart,
  onDragEnd,
  rowHeight = 50,
  style,
}: SortableListProps<T>) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Keep data and active index in refs so gesture callbacks see current values
  // without needing to recreate PanResponders on every render
  const dataRef = useRef(data);
  dataRef.current = data;

  const gestureState = useRef({
    activeIndex: -1,
    cumulativeDy: 0,
  });

  const buildPanHandlers = useCallback(
    (key: string, indexAtMount: number) => {
      const responder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, { dx, dy }) =>
          Math.abs(dy) > 4 && Math.abs(dy) > Math.abs(dx),

        onPanResponderGrant: () => {
          gestureState.current = {
            activeIndex: indexAtMount,
            cumulativeDy: 0,
          };
          setActiveKey(key);
          onDragStart?.();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },

        onPanResponderMove: (_, { dy }) => {
          const { activeIndex, cumulativeDy } = gestureState.current;
          const delta = dy - cumulativeDy;
          const threshold = rowHeight * 0.55;

          if (delta > threshold && activeIndex < dataRef.current.length - 1) {
            const newData = [...dataRef.current];
            [newData[activeIndex], newData[activeIndex + 1]] = [
              newData[activeIndex + 1],
              newData[activeIndex],
            ];
            gestureState.current = {
              activeIndex: activeIndex + 1,
              cumulativeDy: cumulativeDy + rowHeight,
            };
            onReorder(newData);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } else if (delta < -threshold && activeIndex > 0) {
            const newData = [...dataRef.current];
            [newData[activeIndex], newData[activeIndex - 1]] = [
              newData[activeIndex - 1],
              newData[activeIndex],
            ];
            gestureState.current = {
              activeIndex: activeIndex - 1,
              cumulativeDy: cumulativeDy - rowHeight,
            };
            onReorder(newData);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },

        onPanResponderRelease: () => {
          gestureState.current = { activeIndex: -1, cumulativeDy: 0 };
          setActiveKey(null);
          onDragEnd?.();
        },

        onPanResponderTerminate: () => {
          gestureState.current = { activeIndex: -1, cumulativeDy: 0 };
          setActiveKey(null);
          onDragEnd?.();
        },
      });
      return responder.panHandlers;
    },
    [rowHeight, onReorder, onDragStart, onDragEnd]
  );

  return (
    <View style={style}>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        const isActive = key === activeKey;
        // panHandlers are rebuilt per render so gesture starts always use the
        // current index — mid-gesture swaps update gestureState.current directly
        const dragHandleProps = buildPanHandlers(key, index);

        return (
          <View
            key={key}
            style={[
              isActive && styles.activeWrapper,
            ]}
          >
            {renderItem({ item, index, isActive, dragHandleProps })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  activeWrapper: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
});
