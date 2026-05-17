import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  createOrgUnit,
  deleteOrgUnit,
  updateOrgUnit,
  type OrgUnit,
} from "@workspace/api-client-react";
import { describeApiError } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeasuredZone {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TreeDistrict {
  district: OrgUnit;
  locations: OrgUnit[];
}

interface TreeRegion {
  region: OrgUnit;
  districts: TreeDistrict[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTree(units: OrgUnit[]): TreeRegion[] {
  const regions = units.filter((u) => u.type === "region");
  const districts = units.filter((u) => u.type === "district");
  const locations = units.filter((u) => u.type === "location");
  return regions.map((region) => ({
    region,
    districts: districts
      .filter((d) => d.parentId === region.id)
      .map((district) => ({
        district,
        locations: locations.filter((l) => l.parentId === district.id),
      })),
  }));
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OrgUnitTreeProps {
  orgUnits: OrgUnit[];
  canManage: boolean;
  /** Called with false when drag starts (disable outer scroll), true when done */
  onScrollEnable: (enabled: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrgUnitTree({
  orgUnits,
  canManage,
  onScrollEnable,
}: OrgUnitTreeProps) {
  const colors = useColors();

  // ── Local units state — syncs from prop on initial load / parent refresh ────
  const [units, setUnits] = useState<OrgUnit[]>(orgUnits);
  useEffect(() => { setUnits(orgUnits); }, [orgUnits]);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const dragItemRef = useRef<OrgUnit | null>(null);
  const activeDropZoneRef = useRef<number | null>(null);
  const measuredZonesRef = useRef<MeasuredZone[]>([]);
  const busyRef = useRef(false);

  const [dragItemId, setDragItemId] = useState<number | null>(null);
  const [activeDropZoneId, setActiveDropZoneId] = useState<number | null>(null);

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [editUnit, setEditUnit] = useState<OrgUnit | null>(null);

  // ── Add inputs ──────────────────────────────────────────────────────────────
  const [newRegionName, setNewRegionName] = useState("");
  const [districtInputs, setDistrictInputs] = useState<Record<number, string>>({});
  const [locationInputs, setLocationInputs] = useState<Record<number, string>>({});

  const tree = useMemo(() => buildTree(units), [units]);

  // ── Drop zone view refs (one per region and per district) ───────────────────
  const dropZoneViews = useRef(new Map<number, View | null>());

  // Stable ref updated every render — gestures read from here so they always
  // see the current units list, measureZones function, and callbacks without
  // needing to be recreated.
  const unitsRef = useRef(units);
  unitsRef.current = units;

  const cbRef = useRef({
    onScrollEnable,
    setDragItemId,
    setActiveDropZoneId,
    dragItemRef,
    activeDropZoneRef,
    measuredZonesRef,
    busyRef,
    unitsRef,
    // measureZones is added below after it's defined
    measureZones: null as null | ((t: "district" | "location") => void),
  });
  cbRef.current.onScrollEnable = onScrollEnable;
  cbRef.current.setDragItemId = setDragItemId;
  cbRef.current.setActiveDropZoneId = setActiveDropZoneId;

  // ── Measure drop zones ──────────────────────────────────────────────────────
  const measureZones = useCallback(
    (itemType: "district" | "location") => {
      const ids =
        itemType === "district"
          ? tree.map(({ region }) => region.id)
          : tree.flatMap(({ districts }) =>
              districts.map(({ district }) => district.id),
            );
      let pending = ids.length;
      if (pending === 0) {
        measuredZonesRef.current = [];
        return;
      }
      const zones: MeasuredZone[] = [];
      for (const id of ids) {
        const view = dropZoneViews.current.get(id);
        if (view) {
          view.measureInWindow((x, y, w, h) => {
            zones.push({ id, x, y, w, h });
            if (--pending === 0) measuredZonesRef.current = zones;
          });
        } else if (--pending === 0) {
          measuredZonesRef.current = zones;
        }
      }
    },
    [tree],
  );
  // Keep cbRef.measureZones current so cached gestures always call the latest version.
  cbRef.current.measureZones = measureZones;

  // ── Hit-test ────────────────────────────────────────────────────────────────
  const findZone = useCallback((x: number, y: number): number | null => {
    for (const z of measuredZonesRef.current) {
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) {
        return z.id;
      }
    }
    return null;
  }, []);

  // ── Cancel drag ─────────────────────────────────────────────────────────────
  const cancelDrag = useCallback(() => {
    dragItemRef.current = null;
    activeDropZoneRef.current = null;
    setDragItemId(null);
    setActiveDropZoneId(null);
    cbRef.current.onScrollEnable(true);
  }, []);

  // ── Execute drop — optimistic: update local state, revert on error ──────────
  const executeDrop = useCallback(
    async (item: OrgUnit, newParentId: number) => {
      busyRef.current = true;
      const prevParentId = item.parentId ?? null;
      setUnits((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, parentId: newParentId } : u)),
      );
      try {
        await updateOrgUnit(item.id, { parentId: newParentId });
      } catch (e) {
        setUnits((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, parentId: prevParentId } : u,
          ),
        );
        Alert.alert("Failed to move", describeApiError(e));
      } finally {
        busyRef.current = false;
      }
    },
    [],
  );

  // ── Gesture cache — keyed by item ID, captures only the stable ID ───────────
  // All mutable state (parentId, measureZones, etc.) is read via cbRef/unitsRef
  // at gesture-fire time, so cached gestures stay correct after moves.
  const gestureCache = useRef(new Map<number, ReturnType<typeof Gesture.Pan>>());

  const getGesture = useCallback(
    (itemId: number, isDistrict: boolean) => {
      if (gestureCache.current.has(itemId)) {
        return gestureCache.current.get(itemId)!;
      }
      const gesture = Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(400)
        .onBegin(() => {
          cbRef.current.measureZones?.(isDistrict ? "district" : "location");
        })
        .onStart(() => {
          if (cbRef.current.busyRef.current) return;
          // Look up the current version of the item so parentId is fresh.
          const item = cbRef.current.unitsRef.current.find((u) => u.id === itemId);
          if (!item) return;
          cbRef.current.dragItemRef.current = item;
          cbRef.current.setDragItemId(itemId);
          cbRef.current.onScrollEnable(false);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        })
        .onUpdate((e) => {
          const item = cbRef.current.dragItemRef.current;
          if (!item) return;
          const zoneId = findZone(e.absoluteX, e.absoluteY);
          // Exclude the item's current parent (read from dragItemRef, not closure).
          const valid = zoneId !== null && zoneId !== item.parentId ? zoneId : null;
          cbRef.current.activeDropZoneRef.current = valid;
          cbRef.current.setActiveDropZoneId(valid);
        })
        .onEnd(() => {
          const dragging = cbRef.current.dragItemRef.current;
          const dropId = cbRef.current.activeDropZoneRef.current;
          cancelDrag();
          if (dragging && dropId !== null) {
            void executeDrop(dragging, dropId);
          }
        })
        .onFinalize(() => {
          cancelDrag();
        });
      gestureCache.current.set(itemId, gesture);
      return gesture;
    },
    [findZone, cancelDrag, executeDrop],
  );

  // Evict gestures for deleted items only (moved items keep their gesture —
  // it's now safe because state is read via refs, not closures).
  for (const id of gestureCache.current.keys()) {
    if (!units.some((u) => u.id === id)) gestureCache.current.delete(id);
  }

  // ── Add handlers — append API response to local state ───────────────────────
  const handleAddRegion = useCallback(async () => {
    const name = newRegionName.trim();
    if (!name) return;
    setNewRegionName("");
    try {
      const created = await createOrgUnit({ name, type: "region" });
      setUnits((prev) => [...prev, created]);
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    }
  }, [newRegionName]);

  const handleAddDistrict = useCallback(
    async (regionId: number) => {
      const name = (districtInputs[regionId] ?? "").trim();
      if (!name) return;
      setDistrictInputs((prev) => ({ ...prev, [regionId]: "" }));
      try {
        const created = await createOrgUnit({ name, type: "district", parentId: regionId });
        setUnits((prev) => [...prev, created]);
      } catch (e) {
        Alert.alert("Failed", describeApiError(e));
      }
    },
    [districtInputs],
  );

  const handleAddLocation = useCallback(
    async (districtId: number) => {
      const name = (locationInputs[districtId] ?? "").trim();
      if (!name) return;
      setLocationInputs((prev) => ({ ...prev, [districtId]: "" }));
      try {
        const created = await createOrgUnit({ name, type: "location", parentId: districtId });
        setUnits((prev) => [...prev, created]);
      } catch (e) {
        Alert.alert("Failed", describeApiError(e));
      }
    },
    [locationInputs],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  const isDraggingDistrict = dragItemId !== null && dragItemRef.current?.type === "district";
  const isDraggingLocation = dragItemId !== null && dragItemRef.current?.type === "location";

  return (
    <View>
      {tree.map(({ region, districts }) => {
        const isActiveRegion = activeDropZoneId === region.id;
        const isHighlightedRegion = isDraggingDistrict;

        return (
          <View
            key={region.id}
            ref={(v) => { dropZoneViews.current.set(region.id, v); }}
            style={[
              s.regionCard,
              {
                borderColor: isActiveRegion
                  ? colors.primary
                  : isHighlightedRegion
                  ? colors.primary + "55"
                  : colors.border,
                backgroundColor: isActiveRegion
                  ? colors.primary + "12"
                  : colors.card,
              },
            ]}
          >
            {/* ── Region header ─────────────────────────────────────────── */}
            <View style={s.regionHeaderRow}>
              <Text style={[s.regionName, { color: colors.foreground }]}>
                {region.name}
              </Text>
              {canManage && (
                <TouchableOpacity
                  onPress={() => setEditUnit(region)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[s.menuBtn, { color: colors.mutedForeground }]}>
                    ···
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Districts ─────────────────────────────────────────────── */}
            {districts.map(({ district, locations }) => {
              const isDraggingThisDistrict = dragItemId === district.id;
              const isActiveDistrict = activeDropZoneId === district.id;
              const isHighlightedDistrict = isDraggingLocation;
              const gesture = getGesture(district.id, true);

              return (
                <View
                  key={district.id}
                  ref={(v) => { dropZoneViews.current.set(district.id, v); }}
                  style={[
                    s.districtSection,
                    {
                      borderColor: isActiveDistrict
                        ? colors.primary
                        : isHighlightedDistrict
                        ? colors.primary + "55"
                        : colors.border,
                      backgroundColor: isActiveDistrict
                        ? colors.primary + "12"
                        : colors.background,
                      opacity: isDraggingThisDistrict ? 0.35 : 1,
                    },
                  ]}
                >
                  {/* District header */}
                  <View style={s.districtHeaderRow}>
                    {canManage ? (
                      <GestureDetector gesture={gesture}>
                        <View
                          style={s.dragHandle}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text
                            style={[
                              s.dragHandleIcon,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            ≡
                          </Text>
                        </View>
                      </GestureDetector>
                    ) : (
                      <Text
                        style={[s.districtArrow, { color: colors.mutedForeground }]}
                      >
                        ▸
                      </Text>
                    )}
                    <Text
                      style={[s.districtName, { color: colors.foreground }]}
                    >
                      {district.name}
                    </Text>
                    {canManage && (
                      <TouchableOpacity
                        onPress={() => setEditUnit(district)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text
                          style={[s.menuBtn, { color: colors.mutedForeground }]}
                        >
                          ···
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Locations */}
                  {locations.map((loc) => {
                    const isDraggingThisLoc = dragItemId === loc.id;
                    const locGesture = getGesture(loc.id, false);
                    return (
                      <View
                        key={loc.id}
                        style={[
                          s.locationRow,
                          { opacity: isDraggingThisLoc ? 0.35 : 1 },
                        ]}
                      >
                        {canManage ? (
                          <GestureDetector gesture={locGesture}>
                            <View
                              style={s.dragHandle}
                              hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                              }}
                            >
                              <Text
                                style={[
                                  s.dragHandleIcon,
                                  { color: colors.mutedForeground },
                                ]}
                              >
                                ≡
                              </Text>
                            </View>
                          </GestureDetector>
                        ) : (
                          <Text
                            style={[
                              s.locationPin,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            📍
                          </Text>
                        )}
                        <Text
                          style={[s.locationName, { color: colors.foreground }]}
                        >
                          {loc.name}
                        </Text>
                        {canManage && (
                          <TouchableOpacity
                            onPress={() => setEditUnit(loc)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text
                              style={[
                                s.menuBtn,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              ···
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                  {/* Add location */}
                  {canManage && (
                    <TextInput
                      value={locationInputs[district.id] ?? ""}
                      onChangeText={(v) =>
                        setLocationInputs((prev) => ({
                          ...prev,
                          [district.id]: v,
                        }))
                      }
                      onSubmitEditing={() => handleAddLocation(district.id)}
                      placeholder="＋ Add location"
                      placeholderTextColor={colors.primary}
                      returnKeyType="done"
                      style={[
                        s.addInput,
                        {
                          color: colors.foreground,
                          borderColor: colors.border,
                          marginLeft: 28,
                          marginTop: 4,
                        },
                      ]}
                    />
                  )}
                </View>
              );
            })}

            {/* Add district */}
            {canManage && (
              <TextInput
                value={districtInputs[region.id] ?? ""}
                onChangeText={(v) =>
                  setDistrictInputs((prev) => ({ ...prev, [region.id]: v }))
                }
                onSubmitEditing={() => handleAddDistrict(region.id)}
                placeholder="＋ Add district"
                placeholderTextColor={colors.primary}
                returnKeyType="done"
                style={[
                  s.addInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    marginTop: 6,
                  },
                ]}
              />
            )}
          </View>
        );
      })}

      {/* Add region */}
      {canManage && (
        <TextInput
          value={newRegionName}
          onChangeText={setNewRegionName}
          onSubmitEditing={handleAddRegion}
          placeholder="＋ Add region"
          placeholderTextColor={colors.primary}
          returnKeyType="done"
          style={[
            s.addRegionInput,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        />
      )}

      {tree.length === 0 && !canManage && (
        <Text style={{ color: colors.mutedForeground, fontSize: 13, paddingHorizontal: 4 }}>
          No org units configured.
        </Text>
      )}

      <UnitEditModal
        unit={editUnit}
        onClose={() => setEditUnit(null)}
        onUnitUpdated={(updated) => {
          setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          setEditUnit(null);
        }}
        onUnitDeleted={(id) => {
          setUnits((prev) => prev.filter((u) => u.id !== id));
          setEditUnit(null);
        }}
      />
    </View>
  );
}

// ─── Unit Edit Modal ──────────────────────────────────────────────────────────

function UnitEditModal({
  unit,
  onClose,
  onUnitUpdated,
  onUnitDeleted,
}: {
  unit: OrgUnit | null;
  onClose: () => void;
  onUnitUpdated: (updated: OrgUnit) => void;
  onUnitDeleted: (id: number) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (unit) setName(unit.name);
  }, [unit]);

  const onSave = async () => {
    if (!unit) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === unit.name) { onClose(); return; }
    setBusy(true);
    try {
      const updated = await updateOrgUnit(unit.id, { name: trimmed });
      onUnitUpdated(updated);
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!unit) return;
    Alert.alert(
      `Delete ${unit.type}`,
      `Delete "${unit.name}"? This will fail if it still has child units or assigned users.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteOrgUnit(unit.id);
              onUnitDeleted(unit.id);
            } catch (e) {
              Alert.alert("Failed", describeApiError(e));
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={unit !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          gap: 12,
        }}
      >
        <View style={s.modalHeader}>
          <Text style={[s.modalTitle, { color: colors.foreground }]}>
            Edit {unit?.type}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: colors.primary }}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.fieldLabel, { color: colors.foreground }]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          editable={!busy}
          autoCapitalize="words"
          style={[
            s.modalInput,
            {
              borderColor: colors.input,
              color: colors.foreground,
              backgroundColor: colors.card,
            },
          ]}
        />

        <TouchableOpacity
          style={[
            s.primaryBtn,
            { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 },
          ]}
          onPress={onSave}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>
              Save
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.dangerBtn, { backgroundColor: colors.destructive }]}
          onPress={onDelete}
          disabled={busy}
        >
          <Text
            style={{ color: colors.destructiveForeground, fontWeight: "600" }}
          >
            Delete {unit?.type}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Region
  regionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  regionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  regionName: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },

  // District
  districtSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  districtHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  districtArrow: {
    fontSize: 13,
    width: 20,
  },
  districtName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },

  // Location
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 28,
    paddingVertical: 4,
  },
  locationPin: {
    fontSize: 13,
    width: 20,
  },
  locationName: {
    flex: 1,
    fontSize: 14,
  },

  // Drag handle
  dragHandle: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandleIcon: {
    fontSize: 18,
    fontWeight: "600",
  },

  // Menu button
  menuBtn: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
    paddingHorizontal: 2,
  },

  // Inputs
  addInput: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
    fontSize: 14,
  },
  addRegionInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 4,
  },

  // Modal
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  dangerBtn: {
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
});
