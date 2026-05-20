import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { type OrgUnit } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  const alpha = (a: OrgUnit, b: OrgUnit) => a.name.localeCompare(b.name);
  const regions = units.filter((u) => u.type === "region").sort(alpha);
  const districts = units.filter((u) => u.type === "district");
  const locations = units.filter((u) => u.type === "location");
  return regions.map((region) => ({
    region,
    districts: districts
      .filter((d) => d.parentId === region.id)
      .sort(alpha)
      .map((district) => ({
        district,
        locations: locations.filter((l) => l.parentId === district.id).sort(alpha),
      })),
  }));
}

function getSubtreeIds(orgUnits: OrgUnit[], rootId: number): Set<number> {
  const result = new Set<number>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const u of orgUnits) {
      if (u.parentId === curr) {
        result.add(u.id);
        queue.push(u.id);
      }
    }
  }
  return result;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OrgUnitSelectorProps {
  orgUnits: OrgUnit[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Non-null restricts visible units to this subtree and hides the "Tenant-wide" option */
  callerOrgUnitId: number | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrgUnitSelector({
  orgUnits,
  value,
  onChange,
  callerOrgUnitId,
}: OrgUnitSelectorProps) {
  const colors = useColors();

  const visibleUnits = useMemo(
    () =>
      callerOrgUnitId !== null
        ? orgUnits.filter((u) => getSubtreeIds(orgUnits, callerOrgUnitId).has(u.id))
        : orgUnits,
    [orgUnits, callerOrgUnitId],
  );

  const tree = useMemo(() => buildTree(visibleUnits), [visibleUnits]);

  if (tree.length === 0 && callerOrgUnitId !== null) return null;

  return (
    <>
      <Text style={[s.label, { color: colors.foreground }]}>Location</Text>

      {callerOrgUnitId === null && (
        <TouchableOpacity
          style={[
            s.tenantWideRow,
            {
              borderColor: value === null ? colors.primary : colors.border,
              backgroundColor: value === null ? colors.secondary : colors.card,
            },
          ]}
          onPress={() => onChange(null)}
        >
          <Text style={{ color: colors.foreground, flex: 1 }}>None (Tenant-wide)</Text>
          {value === null && (
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>✓</Text>
          )}
        </TouchableOpacity>
      )}

      {tree.map(({ region, districts }) => {
        const isRegionSelected = value === region.id;
        return (
          <View
            key={region.id}
            style={[
              s.regionCard,
              {
                borderColor: isRegionSelected ? colors.primary : colors.border,
                backgroundColor: isRegionSelected ? colors.primary + "12" : colors.card,
              },
            ]}
          >
            <TouchableOpacity style={s.regionHeaderRow} onPress={() => onChange(region.id)}>
              <Text style={[s.regionName, { color: colors.foreground }]}>{region.name}</Text>
              <View style={s.regionMeta}>
                <Text style={[s.typeLabel, { color: colors.mutedForeground }]}>region</Text>
                {isRegionSelected && (
                  <Text style={[s.checkmark, { color: colors.primary }]}>✓</Text>
                )}
              </View>
            </TouchableOpacity>

            {districts.map(({ district, locations }) => {
              const isDistrictSelected = value === district.id;
              return (
                <View
                  key={district.id}
                  style={[
                    s.districtSection,
                    {
                      borderColor: isDistrictSelected ? colors.primary : colors.border,
                      backgroundColor: isDistrictSelected
                        ? colors.primary + "12"
                        : colors.background,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={s.districtHeaderRow}
                    onPress={() => onChange(district.id)}
                  >
                    <Text style={[s.districtArrow, { color: colors.mutedForeground }]}>▸</Text>
                    <Text style={[s.districtName, { color: colors.foreground }]}>
                      {district.name}
                    </Text>
                    <View style={s.regionMeta}>
                      <Text style={[s.typeLabel, { color: colors.mutedForeground }]}>district</Text>
                      {isDistrictSelected && (
                        <Text style={[s.checkmark, { color: colors.primary }]}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {locations.map((loc) => {
                    const isLocSelected = value === loc.id;
                    return (
                      <TouchableOpacity
                        key={loc.id}
                        style={[
                          s.locationRow,
                          { backgroundColor: isLocSelected ? colors.secondary : "transparent" },
                        ]}
                        onPress={() => onChange(loc.id)}
                      >
                        <Text style={[s.locationPin, { color: colors.mutedForeground }]}>
                          📍
                        </Text>
                        <Text style={[s.locationName, { color: colors.foreground }]}>
                          {loc.name}
                        </Text>
                        {isLocSelected && (
                          <Text style={[s.checkmark, { color: colors.primary }]}>✓</Text>
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
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 4,
  },

  tenantWideRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },

  // Region
  regionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
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
  regionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  locationPin: {
    fontSize: 13,
    width: 20,
  },
  locationName: {
    flex: 1,
    fontSize: 14,
  },

  // Shared
  typeLabel: {
    fontSize: 11,
    textTransform: "capitalize",
  },
  checkmark: {
    fontWeight: "700",
    fontSize: 16,
  },
});
