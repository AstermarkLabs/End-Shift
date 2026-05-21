import React, { useEffect, useState } from "react";
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
  createRole,
  deleteRole,
  updateRole,
  type Role,
} from "@workspace/api-client-react";

import { describeApiError } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type DraftRole = {
  tempId: string;
  id: number | null;
  name: string;
  isOwner: boolean;
};

function makeTempId() {
  return Math.random().toString(36).slice(2);
}

export function RoleHierarchyModal({
  roles,
  visible,
  onClose,
  onSaved,
}: {
  roles: Role[];
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useColors();
  const [draft, setDraft] = useState<DraftRole[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const nonSystem = [...roles]
      .filter((r) => !r.isSystem)
      .sort((a, b) => b.level - a.level);
    setDraft(
      nonSystem.map((r) => ({
        tempId: String(r.id),
        id: r.id,
        name: r.name,
        isOwner: r.name === "Owner",
      })),
    );
    setNewName("");
  }, [visible, roles]);

  const moveUp = (index: number) => {
    if (index <= 1) return;
    setDraft((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    setDraft((prev) => {
      if (index === 0 || index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const removeRole = (tid: string, name: string) => {
    Alert.alert(
      "Delete Role",
      `Delete "${name}"? Users assigned this role will need reassignment.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => setDraft((prev) => prev.filter((r) => r.tempId !== tid)),
        },
      ],
    );
  };

  const addRole = () => {
    const name = newName.trim();
    if (!name) return;
    setDraft((prev) => [
      ...prev,
      { tempId: makeTempId(), id: null, name, isOwner: false },
    ]);
    setNewName("");
  };

  const save = async () => {
    setSaving(true);
    try {
      const originalIds = new Set(
        roles.filter((r) => !r.isSystem).map((r) => r.id),
      );
      const draftExistingIds = new Set(
        draft.filter((r) => r.id !== null).map((r) => r.id!),
      );

      // 1. Delete removed roles
      for (const id of originalIds) {
        if (!draftExistingIds.has(id)) await deleteRole(id);
      }

      // 2. level = total - positionIndex (Owner at 0 = highest)
      const total = draft.length;
      const levelFor = (i: number) => total - i;

      // 3. Create new roles
      for (let i = 0; i < draft.length; i++) {
        const r = draft[i];
        if (r.id === null) {
          await createRole({ name: r.name, level: levelFor(i), rights: [] });
        }
      }

      // 4. Update existing roles where level or name changed
      for (let i = 0; i < draft.length; i++) {
        const r = draft[i];
        if (r.id !== null) {
          const original = roles.find((ro) => ro.id === r.id);
          const newLevel = levelFor(i);
          if (original && (original.level !== newLevel || original.name !== r.name)) {
            await updateRole(r.id, { level: newLevel, name: r.name });
          }
        }
      }

      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Failed", describeApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={[m.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={m.sheetHeader}>
            <View>
              <Text style={[m.sheetTitle, { color: colors.foreground }]}>Role Hierarchy</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>
                Order defines authority. Higher position = more access.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={m.closeBtn}>
              <Text style={{ color: colors.mutedForeground, fontSize: 18, lineHeight: 22 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Node tree */}
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {draft.map((role, index) => (
              <View key={role.tempId}>
                <View
                  style={[
                    m.node,
                    {
                      borderColor: role.isOwner ? "#FCA5A5" : colors.border,
                      backgroundColor: role.isOwner ? "#FEF2F2" : colors.background,
                    },
                  ]}
                >
                  <Text
                    style={[m.nodeLabel, { color: role.isOwner ? "#DC2626" : colors.foreground }]}
                    numberOfLines={1}
                  >
                    {role.name}
                  </Text>
                  <Text style={[m.levelBadge, { color: colors.mutedForeground }]}>
                    L{draft.length - index}
                  </Text>
                  {role.isOwner ? (
                    <Text style={{ fontSize: 12, marginLeft: 4 }}>🔒</Text>
                  ) : (
                    <View style={m.nodeActions}>
                      <TouchableOpacity
                        onPress={() => moveUp(index)}
                        disabled={index <= 1}
                        style={[m.iconBtn, { opacity: index <= 1 ? 0.3 : 1 }]}
                      >
                        <Text style={{ color: colors.foreground, fontSize: 15 }}>↑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveDown(index)}
                        disabled={index >= draft.length - 1}
                        style={[m.iconBtn, { opacity: index >= draft.length - 1 ? 0.3 : 1 }]}
                      >
                        <Text style={{ color: colors.foreground, fontSize: 15 }}>↓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeRole(role.tempId, role.name)}
                        style={m.iconBtn}
                      >
                        <Text style={{ color: "#DC2626", fontSize: 15 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {index < draft.length - 1 && (
                  <View style={m.connector}>
                    <View style={[m.connectorLine, { backgroundColor: colors.border }]} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 10, lineHeight: 12 }}>▼</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Add role */}
          <View style={[m.addRow, { borderTopColor: colors.border }]}>
            <TextInput
              style={[
                m.input,
                { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background },
              ]}
              placeholder="New role name…"
              placeholderTextColor={colors.mutedForeground}
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={addRole}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={addRole}
              disabled={!newName.trim()}
              style={[m.addBtn, { backgroundColor: "#DC2626", opacity: newName.trim() ? 1 : 0.4 }]}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[m.saveBtn, { backgroundColor: "#DC2626", opacity: saving ? 0.6 : 1 }]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save Hierarchy</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    width: 420,
    maxWidth: "92%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  node: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  nodeLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  levelBadge: {
    fontSize: 12,
    fontWeight: "500",
    minWidth: 24,
    textAlign: "right",
  },
  nodeActions: {
    flexDirection: "row",
    gap: 2,
  },
  iconBtn: {
    padding: 5,
    borderRadius: 6,
  },
  connector: {
    alignItems: "center",
    paddingVertical: 2,
  },
  connectorLine: {
    width: 2,
    height: 10,
    marginBottom: 1,
  },
  addRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  addBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
});
