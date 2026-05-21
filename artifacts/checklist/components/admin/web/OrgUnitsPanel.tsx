import React, { useCallback, useState } from "react";
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

import {
  createOrgUnit,
  deleteOrgUnit,
  updateOrgUnit,
  updateProfile,
  type OrgUnit,
  type OrgUnitType,
  type Profile,
} from "@workspace/api-client-react";

import { describeApiError } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TreeDistrict {
  district: OrgUnit;
  locations: OrgUnit[];
}

interface TreeRegion {
  region: OrgUnit;
  districts: TreeDistrict[];
}

function buildTree(units: OrgUnit[]): TreeRegion[] {
  const alpha = (a: OrgUnit, b: OrgUnit) => a.name.localeCompare(b.name);
  const regions = units.filter((u) => u.type === "region").sort(alpha);
  return regions.map((region) => ({
    region,
    districts: units
      .filter((d) => d.type === "district" && d.parentId === region.id)
      .sort(alpha)
      .map((district) => ({
        district,
        locations: units
          .filter((l) => l.type === "location" && l.parentId === district.id)
          .sort(alpha),
      })),
  }));
}

function subtreeIds(units: OrgUnit[], rootId: number): Set<number> {
  const result = new Set<number>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const u of units) {
      if (u.parentId === curr) {
        result.add(u.id);
        queue.push(u.id);
      }
    }
  }
  return result;
}

function directUserCount(profiles: Profile[], unitId: number): number {
  return profiles.filter((p) => p.orgUnitId === unitId).length;
}

function totalUserCount(profiles: Profile[], units: OrgUnit[], unitId: number): number {
  const ids = subtreeIds(units, unitId);
  return profiles.filter((p) => p.orgUnitId != null && ids.has(p.orgUnitId)).length;
}

function childCount(units: OrgUnit[], parentId: number, type?: OrgUnitType): number {
  return units.filter((u) => u.parentId === parentId && (type == null || u.type === type)).length;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: OrgUnitType }) {
  const colors: Record<OrgUnitType, { bg: string; text: string }> = {
    region:   { bg: "#FEF9C3", text: "#92400E" },
    district: { bg: "#DBEAFE", text: "#1E40AF" },
    location: { bg: "#DCFCE7", text: "#166534" },
  };
  const icon: Record<OrgUnitType, string> = {
    region: "🌐", district: "🏙", location: "📍",
  };
  const { bg, text } = colors[type];
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: bg }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: text, textTransform: "capitalize" }}>
        {icon[type]} {type}
      </Text>
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
  colors: c,
}: {
  icon: string;
  value: number;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        o.statCard,
        { borderColor: c.border, backgroundColor: c.card },
      ]}
    >
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ fontSize: 26, fontWeight: "700", color: c.foreground, lineHeight: 30 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: c.mutedForeground }}>{label}</Text>
    </View>
  );
}

// ─── Unit rename / delete modal ───────────────────────────────────────────────

function UnitEditModal({
  unit,
  onClose,
  onSaved,
  onDeleted,
}: {
  unit: OrgUnit;
  onClose: () => void;
  onSaved: (updated: OrgUnit) => void;
  onDeleted: (id: number) => void;
}) {
  const colors = useColors();
  const [name, setName] = useState(unit.name);
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === unit.name) { onClose(); return; }
    setBusy(true);
    try {
      const updated = await updateOrgUnit(unit.id, { name: trimmed });
      onSaved(updated);
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(
      `Delete ${unit.type}`,
      `Delete "${unit.name}"? This will fail if it still has children or assigned users.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteOrgUnit(unit.id);
              onDeleted(unit.id);
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
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={md.overlay}>
        <View style={[md.dialog, { backgroundColor: colors.card }]}>
          <View style={md.header}>
            <Text style={[md.title, { color: colors.foreground }]}>
              Edit {unit.type}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.mutedForeground, fontSize: 20 }}>×</Text>
            </TouchableOpacity>
          </View>

          <Text style={[md.label, { color: colors.foreground }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={!busy}
            autoCapitalize="words"
            style={[md.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, outlineWidth: 0 } as object]}
          />

          <View style={md.footer}>
            <TouchableOpacity
              style={[md.dangerBtn, { backgroundColor: colors.destructive, opacity: busy ? 0.6 : 1 }]}
              onPress={onDelete}
              disabled={busy}
            >
              <Text style={{ color: colors.destructiveForeground, fontWeight: "600", fontSize: 14 }}>
                Delete
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[md.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[md.saveBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
              onPress={onSave}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 14 }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Assign user modal ────────────────────────────────────────────────────────

function AssignUserModal({
  unit,
  profiles,
  onClose,
  onSaved,
}: {
  unit: OrgUnit;
  profiles: Profile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useColors();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  // Show users not already assigned to this unit
  const candidates = profiles.filter(
    (p) => p.orgUnitId !== unit.id && !p.role.isSystem,
  );

  const filtered = candidates.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.displayName.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    );
  });

  const assign = async (profile: Profile) => {
    setBusy(true);
    try {
      await updateProfile(profile.id, { orgUnitId: unit.id });
      onSaved();
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={md.overlay}>
        <View style={[md.dialog, { backgroundColor: colors.card, width: 440 }]}>
          <View style={md.header}>
            <Text style={[md.title, { color: colors.foreground }]}>
              Assign User to {unit.name}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.mutedForeground, fontSize: 20 }}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={[au.searchBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={{ color: colors.mutedForeground }}>🔍</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search users..."
              placeholderTextColor={colors.mutedForeground}
              style={{ flex: 1, color: colors.foreground, fontSize: 14, outlineWidth: 0 } as object}
            />
          </View>

          <ScrollView style={{ maxHeight: 320 }}>
            {filtered.map((profile) => (
              <TouchableOpacity
                key={profile.id}
                style={[au.userRow, { borderBottomColor: colors.border, opacity: busy ? 0.6 : 1 }]}
                onPress={() => assign(profile)}
                disabled={busy}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", color: colors.foreground, fontSize: 14 }}>
                    {profile.displayName}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {profile.email ?? profile.username} · {profile.role.name}
                  </Text>
                </View>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Assign →</Text>
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: colors.mutedForeground }}>No users available.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add child modal ──────────────────────────────────────────────────────────

function AddChildModal({
  parent,
  childType,
  onClose,
  onCreated,
}: {
  parent: OrgUnit;
  childType: OrgUnitType;
  onClose: () => void;
  onCreated: (unit: OrgUnit) => void;
}) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const created = await createOrgUnit({ name: trimmed, type: childType, parentId: parent.id });
      onCreated(created);
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const label = childType === "district" ? "District" : "Location";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={md.overlay}>
        <View style={[md.dialog, { backgroundColor: colors.card }]}>
          <View style={md.header}>
            <Text style={[md.title, { color: colors.foreground }]}>
              Add {label} to {parent.name}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.mutedForeground, fontSize: 20 }}>×</Text>
            </TouchableOpacity>
          </View>

          <Text style={[md.label, { color: colors.foreground }]}>{label} name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={`e.g. ${label === "District" ? "Downtown" : "The Crow Bar"}`}
            placeholderTextColor={colors.mutedForeground}
            editable={!busy}
            autoCapitalize="words"
            style={[md.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, outlineWidth: 0 } as object]}
            onSubmitEditing={onSave}
          />

          <View style={md.footer}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[md.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[md.saveBtn, { backgroundColor: colors.primary, opacity: busy || !name.trim() ? 0.6 : 1 }]}
              onPress={onSave}
              disabled={busy || !name.trim()}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 14 }}>
                  Add {label}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add region modal ─────────────────────────────────────────────────────────

function AddRegionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (unit: OrgUnit) => void;
}) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const created = await createOrgUnit({ name: trimmed, type: "region" });
      onCreated(created);
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={md.overlay}>
        <View style={[md.dialog, { backgroundColor: colors.card }]}>
          <View style={md.header}>
            <Text style={[md.title, { color: colors.foreground }]}>Add Region</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.mutedForeground, fontSize: 20 }}>×</Text>
            </TouchableOpacity>
          </View>

          <Text style={[md.label, { color: colors.foreground }]}>Region name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. North Bay"
            placeholderTextColor={colors.mutedForeground}
            editable={!busy}
            autoCapitalize="words"
            style={[md.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, outlineWidth: 0 } as object]}
            onSubmitEditing={onSave}
          />

          <View style={md.footer}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[md.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[md.saveBtn, { backgroundColor: colors.primary, opacity: busy || !name.trim() ? 0.6 : 1 }]}
              onPress={onSave}
              disabled={busy || !name.trim()}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 14 }}>Add Region</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── OrgUnitsPanel ────────────────────────────────────────────────────────────

export function OrgUnitsPanel({
  orgUnits: initialUnits,
  profiles,
  canManage,
  currentUser: _currentUser,
  onReload,
}: {
  orgUnits: OrgUnit[];
  profiles: Profile[];
  canManage: boolean;
  currentUser: Profile;
  onReload: () => void;
}) {
  const colors = useColors();
  const [units, setUnits] = useState<OrgUnit[]>(initialUnits);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedRegions, setExpandedRegions] = useState<Set<number>>(new Set());
  const [expandedDistricts, setExpandedDistricts] = useState<Set<number>>(new Set());

  // Modal states
  const [editUnit, setEditUnit] = useState<OrgUnit | null>(null);
  const [assignUnit, setAssignUnit] = useState<OrgUnit | null>(null);
  const [addChildUnit, setAddChildUnit] = useState<{ parent: OrgUnit; childType: OrgUnitType } | null>(null);
  const [showAddRegion, setShowAddRegion] = useState(false);

  React.useEffect(() => { setUnits(initialUnits); }, [initialUnits]);

  const toggleRegion = (id: number) =>
    setExpandedRegions((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleDistrict = (id: number) =>
    setExpandedDistricts((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const tree = buildTree(units);
  const selected = selectedId != null ? units.find((u) => u.id === selectedId) ?? null : null;

  const handleUnitUpdated = useCallback((updated: OrgUnit) => {
    setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setEditUnit(null);
  }, []);

  const handleUnitDeleted = useCallback((id: number) => {
    setUnits((prev) => prev.filter((u) => u.id !== id));
    if (selectedId === id) setSelectedId(null);
    setEditUnit(null);
    onReload();
  }, [selectedId, onReload]);

  const handleUnitCreated = useCallback((created: OrgUnit) => {
    setUnits((prev) => [...prev, created]);
    setSelectedId(created.id);
    setAddChildUnit(null);
    setShowAddRegion(false);
  }, []);

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {/* Left tree panel */}
      <View style={[o.tree, { borderRightColor: colors.border, backgroundColor: colors.card }]}>
        <View style={[o.treeHeader, { borderBottomColor: colors.border }]}>
          <Text style={[o.treeTitle, { color: colors.mutedForeground }]}>STRUCTURE</Text>
        </View>
        <ScrollView>
          {tree.map(({ region, districts }) => {
            const expanded = expandedRegions.has(region.id);
            const count = totalUserCount(profiles, units, region.id);
            const isSelected = selectedId === region.id;
            return (
              <View key={region.id}>
                {/* Region row */}
                <TouchableOpacity
                  style={[
                    o.treeRow,
                    isSelected && { backgroundColor: colors.secondary },
                  ]}
                  onPress={() => { setSelectedId(region.id); toggleRegion(region.id); }}
                >
                  <TouchableOpacity
                    style={o.treeArrow}
                    onPress={(e) => { e.stopPropagation?.(); toggleRegion(region.id); }}
                  >
                    <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700" }}>
                      {expanded ? "▼" : "▶"}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 14, marginRight: 4 }}>🌐</Text>
                  <Text
                    style={[o.treeNodeName, { color: isSelected ? colors.primary : colors.foreground, fontWeight: isSelected ? "600" : "400" }]}
                    numberOfLines={1}
                  >
                    {region.name}
                  </Text>
                  {count > 0 && (
                    <View style={[o.countBadge, { backgroundColor: colors.secondary }]}>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: "600" }}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Districts */}
                {expanded && districts.map(({ district, locations }) => {
                  const dExpanded = expandedDistricts.has(district.id);
                  const dCount = totalUserCount(profiles, units, district.id);
                  const dSelected = selectedId === district.id;
                  return (
                    <View key={district.id}>
                      <TouchableOpacity
                        style={[
                          o.treeRow,
                          o.treeRowIndent1,
                          dSelected && { backgroundColor: colors.secondary },
                        ]}
                        onPress={() => { setSelectedId(district.id); toggleDistrict(district.id); }}
                      >
                        <TouchableOpacity
                          style={o.treeArrow}
                          onPress={(e) => { e.stopPropagation?.(); toggleDistrict(district.id); }}
                        >
                          <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700" }}>
                            {locations.length > 0 ? (dExpanded ? "▼" : "▶") : " "}
                          </Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 14, marginRight: 4 }}>🏙</Text>
                        <Text
                          style={[o.treeNodeName, { color: dSelected ? colors.primary : colors.foreground, fontWeight: dSelected ? "600" : "400" }]}
                          numberOfLines={1}
                        >
                          {district.name}
                        </Text>
                        {dCount > 0 && (
                          <View style={[o.countBadge, { backgroundColor: colors.secondary }]}>
                            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: "600" }}>{dCount}</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Locations */}
                      {dExpanded && locations.map((loc) => {
                        const lCount = directUserCount(profiles, loc.id);
                        const lSelected = selectedId === loc.id;
                        return (
                          <TouchableOpacity
                            key={loc.id}
                            style={[
                              o.treeRow,
                              o.treeRowIndent2,
                              lSelected && { backgroundColor: colors.secondary },
                            ]}
                            onPress={() => setSelectedId(loc.id)}
                          >
                            <View style={o.treeArrow} />
                            <Text style={{ fontSize: 14, marginRight: 4 }}>📍</Text>
                            <Text
                              style={[o.treeNodeName, { color: lSelected ? colors.primary : colors.foreground, fontWeight: lSelected ? "600" : "400" }]}
                              numberOfLines={1}
                            >
                              {loc.name}
                            </Text>
                            {lCount > 0 && (
                              <View style={[o.countBadge, { backgroundColor: colors.secondary }]}>
                                <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: "600" }}>{lCount}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            );
          })}

          {tree.length === 0 && (
            <View style={{ padding: 24 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>No org units yet.</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Right detail panel */}
      <View style={o.detail}>
        {/* Header row */}
        <View style={[o.detailHeader, { borderBottomColor: colors.border }]}>
          <Text style={[o.panelTitle, { color: colors.foreground }]}>Org Units</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 2, flex: 1 }}>
            Manage your regions, districts, and unit locations.
          </Text>
          {canManage && (
            <TouchableOpacity
              style={[o.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddRegion(true)}
            >
              <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 14 }}>
                + Add Region
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 32 }}>
          {selected == null ? (
            // Empty state
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>👈</Text>
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground, marginBottom: 8 }}>
                Select an org unit
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: "center" }}>
                Click any region, district, or unit in the tree{"\n"}to view and manage it.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 20 }}>
              {/* Unit header card */}
              <View style={[o.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={[o.unitIconBg, { backgroundColor: colors.secondary }]}>
                    <Text style={{ fontSize: 22 }}>
                      {selected.type === "region" ? "🌐" : selected.type === "district" ? "🏙" : "📍"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>
                      {selected.name}
                    </Text>
                    <TypeBadge type={selected.type} />
                  </View>
                  {canManage && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={[o.actionBtn, { borderColor: colors.border }]}
                        onPress={() => setEditUnit(selected)}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>✏️ Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[o.actionBtn, { borderColor: "#FCA5A5" }]}
                        onPress={() => {
                          Alert.alert(
                            `Delete ${selected.type}`,
                            `Delete "${selected.name}"? This will fail if it still has children or assigned users.`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: async () => {
                                  try {
                                    await deleteOrgUnit(selected.id);
                                    handleUnitDeleted(selected.id);
                                  } catch (e) {
                                    Alert.alert("Failed", describeApiError(e));
                                  }
                                },
                              },
                            ],
                          );
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#DC2626" }}>🗑 Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* Stats */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <StatCard
                  icon="👤"
                  value={directUserCount(profiles, selected.id)}
                  label="Direct users"
                  colors={colors}
                />
                <StatCard
                  icon="👥"
                  value={totalUserCount(profiles, units, selected.id)}
                  label="Total users"
                  colors={colors}
                />
                {selected.type === "region" && (
                  <StatCard
                    icon="🏙"
                    value={childCount(units, selected.id, "district")}
                    label="Districts"
                    colors={colors}
                  />
                )}
                {selected.type === "district" && (
                  <StatCard
                    icon="📍"
                    value={childCount(units, selected.id, "location")}
                    label="Locations"
                    colors={colors}
                  />
                )}
              </View>

              {/* Assigned users */}
              <View style={[o.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: 16 }}>
                    Assigned Users
                  </Text>
                  {canManage && (
                    <TouchableOpacity
                      style={[o.assignBtn, { borderColor: colors.border }]}
                      onPress={() => setAssignUnit(selected)}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                        + Assign User
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {profiles.filter((p) => p.orgUnitId === selected.id).map((profile, i, arr) => (
                  <View
                    key={profile.id}
                    style={[
                      o.userRow,
                      i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: "#3B82F6",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                        {[...profile.displayName.trim().split(/\s+/)].map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "600", color: colors.foreground, fontSize: 14 }}>
                        {profile.displayName}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                        {profile.email ?? profile.username}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" }}>
                        <Text style={{ fontSize: 12, color: "#2563EB", fontWeight: "500" }}>{profile.role.name}</Text>
                      </View>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: profile.isActive ? "#86EFAC" : "#CBD5E1", backgroundColor: profile.isActive ? "#F0FDF4" : "#F8FAFC" }}>
                        <Text style={{ fontSize: 12, color: profile.isActive ? "#15803D" : "#64748B", fontWeight: "500" }}>
                          {profile.isActive ? "Active" : "Inactive"}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}

                {profiles.filter((p) => p.orgUnitId === selected.id).length === 0 && (
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, paddingVertical: 8 }}>
                    No users directly assigned.
                  </Text>
                )}
              </View>

              {/* Add child CTA */}
              {canManage && selected.type !== "location" && (
                <TouchableOpacity
                  style={[o.addChildBtn, { borderColor: colors.border }]}
                  onPress={() =>
                    setAddChildUnit({
                      parent: selected,
                      childType: selected.type === "region" ? "district" : "location",
                    })
                  }
                >
                  <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                    + Add {selected.type === "region" ? "District" : "Location"} to {selected.name}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Modals */}
      {editUnit && (
        <UnitEditModal
          unit={editUnit}
          onClose={() => setEditUnit(null)}
          onSaved={handleUnitUpdated}
          onDeleted={handleUnitDeleted}
        />
      )}
      {assignUnit && (
        <AssignUserModal
          unit={assignUnit}
          profiles={profiles}
          onClose={() => setAssignUnit(null)}
          onSaved={() => { setAssignUnit(null); onReload(); }}
        />
      )}
      {addChildUnit && (
        <AddChildModal
          parent={addChildUnit.parent}
          childType={addChildUnit.childType}
          onClose={() => setAddChildUnit(null)}
          onCreated={handleUnitCreated}
        />
      )}
      {showAddRegion && (
        <AddRegionModal
          onClose={() => setShowAddRegion(false)}
          onCreated={handleUnitCreated}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const o = StyleSheet.create({
  tree: {
    width: 260,
    borderRightWidth: 1,
  },
  treeHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  treeTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  treeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 2,
  },
  treeRowIndent1: { paddingLeft: 28 },
  treeRowIndent2: { paddingLeft: 44 },
  treeArrow: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  treeNodeName: { flex: 1, fontSize: 14 },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 22,
    alignItems: "center",
  },
  detail: { flex: 1 },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderBottomWidth: 1,
    flexWrap: "wrap",
  },
  panelTitle: { fontSize: 28, fontWeight: "700" },
  primaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: "auto" as any,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  unitIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "flex-start",
    gap: 4,
  },
  assignBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  addChildBtn: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
});

const md = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    width: 420,
    borderRadius: 16,
    padding: 24,
    gap: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});

const au = StyleSheet.create({
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
});
