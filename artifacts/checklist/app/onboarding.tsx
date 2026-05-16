import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { completeOnboarding, createOrgUnit, register as apiRegister } from "@workspace/api-client-react";

import { describeApiError, useAuth } from "@/context/AuthContext";
import { PASSWORD_RULES, validatePassword } from "@/utils/passwordValidation";
import { useChecklist } from "@/context/ChecklistContext";
import {
  useOnboarding,
  type District,
  type OrgLocation,
  type Region,
  type TeamMember,
} from "@/context/OnboardingContext";
import { useColors } from "@/hooks/useColors";

// ─── Step definitions ─────────────────────────────────────────────────────────

type Step = "account" | "regions" | "locations" | "team" | "confirm";

// ─── Reusable primitives ──────────────────────────────────────────────────────

function StepHeader({
  step,
  total,
  title,
  subtitle,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={sh.stepHeader}>
      <View style={sh.stepTopRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[sh.backBtn, { color: colors.mutedForeground }]}>‹ Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={sh.backPlaceholder} />
        )}
        <Text style={[sh.stepLabel, { color: colors.mutedForeground }]}>
          STEP {step} OF {total}
        </Text>
        <View style={sh.backPlaceholder} />
      </View>
      <Text style={[sh.stepTitle, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[sh.stepSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function FieldLabel({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return <Text style={[sh.label, { color: colors.foreground }]}>{label}</Text>;
}

function PrimaryButton({
  label,
  onPress,
  busy,
  colors,
  disabled,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  colors: ReturnType<typeof useColors>;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[sh.primaryBtn, { backgroundColor: colors.primary, opacity: busy || disabled ? 0.6 : 1 }]}
      onPress={onPress}
      disabled={busy || disabled}
    >
      {busy ? (
        <ActivityIndicator color={colors.primaryForeground} />
      ) : (
        <Text style={[sh.primaryBtnText, { color: colors.primaryForeground }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function SkipButton({
  onPress,
  colors,
}: {
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity style={sh.skipBtn} onPress={onPress}>
      <Text style={[sh.skipBtnText, { color: colors.mutedForeground }]}>Skip for now</Text>
    </TouchableOpacity>
  );
}

function ErrorBox({ message, colors }: { message: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View
      style={[sh.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive }]}
    >
      <Text style={[sh.errorText, { color: colors.destructive }]}>{message}</Text>
    </View>
  );
}

// ─── Step 1 — Account ─────────────────────────────────────────────────────────

function StepAccount({
  stepNum,
  totalSteps,
  onDone,
}: {
  stepNum: number;
  totalSteps: number;
  onDone: (businessName: string, businessType: "single-unit" | "multi-unit") => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const { signIn } = useAuth();
  const { setBusinessType } = useOnboarding();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setLocalBusinessType] = useState<"single-unit" | "multi-unit">("single-unit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    setError(null);
    if (!username.trim()) { setError("Username is required."); return; }
    if (!email.trim()) { setError("Work email is required."); return; }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) { setError(pwCheck.errors[0]!); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!businessName.trim()) { setError("Business name is required."); return; }

    setBusy(true);
    try {
      await apiRegister({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        businessName: businessName.trim(),
        businessType,
      });
      // Sign in with the new credentials so AuthContext is hydrated
      await signIn(username.trim().toLowerCase(), password);
      setBusinessType(businessType);
      onDone(businessName.trim(), businessType);
    } catch (e) {
      setError(describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={sh.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepHeader
          step={stepNum}
          total={totalSteps}
          title="Set up your account"
          onBack={() => router.back()}
        />

        {error ? <ErrorBox message={error} colors={colors} /> : null}

        <FieldLabel label="Username" colors={colors} />
        <Text style={[sh.fieldHint, { color: colors.mutedForeground }]}>
          This is how you'll sign in. Choose something short and easy to remember.
        </Text>
        <TextInput
          value={username}
          onChangeText={(v) => { setUsername(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          style={[sh.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder="yourname"
          placeholderTextColor={colors.mutedForeground}
        />

        <FieldLabel label="Work email" colors={colors} />
        <Text style={[sh.fieldHint, { color: colors.mutedForeground }]}>
          Used for billing and account recovery only.
        </Text>
        <TextInput
          value={email}
          onChangeText={(v) => { setEmail(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!busy}
          style={[sh.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder="you@business.com"
          placeholderTextColor={colors.mutedForeground}
        />

        <FieldLabel label="Password" colors={colors} />
        <View style={sh.passwordRow}>
          <TextInput
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            secureTextEntry={!showPassword}
            editable={!busy}
            style={[sh.input, sh.passwordInput, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
            placeholder="••••••••••••"
            placeholderTextColor={colors.mutedForeground}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((s) => !s)}
            style={sh.showToggle}
          >
            <Text style={[sh.showToggleText, { color: colors.primary }]}>
              {showPassword ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>
        {password.length > 0 && (
          <View style={sh.rulesBox}>
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <Text
                  key={rule.label}
                  style={[sh.ruleText, { color: met ? colors.primary : colors.mutedForeground }]}
                >
                  {met ? "✓" : "○"} {rule.label}
                </Text>
              );
            })}
          </View>
        )}

        <FieldLabel label="Confirm password" colors={colors} />
        <TextInput
          value={confirmPassword}
          onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
          secureTextEntry={!showPassword}
          editable={!busy}
          style={[sh.input, { borderColor: confirmPassword && confirmPassword !== password ? colors.destructive : colors.input, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder="••••••••••••"
          placeholderTextColor={colors.mutedForeground}
        />

        <FieldLabel label="Business name" colors={colors} />
        <TextInput
          value={businessName}
          onChangeText={(v) => { setBusinessName(v); setError(null); }}
          editable={!busy}
          style={[sh.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder="Rosa's Diner Group"
          placeholderTextColor={colors.mutedForeground}
        />
        <Text style={[sh.fieldHint, { color: colors.mutedForeground }]}>
          Shown to your team at the top of the app.
        </Text>

        <FieldLabel label="Business size" colors={colors} />
        <TouchableOpacity
          onPress={() => setLocalBusinessType("single-unit")}
          style={[
            sh.typeOption,
            {
              borderColor: businessType === "single-unit" ? colors.primary : colors.border,
              backgroundColor: businessType === "single-unit" ? colors.secondary : colors.card,
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={sh.typeOptionIcon}>🏪</Text>
          <View style={{ flex: 1 }}>
            <Text style={[sh.typeOptionTitle, { color: colors.foreground }]}>Single-unit</Text>
            <Text style={[sh.typeOptionDesc, { color: colors.mutedForeground }]}>
              One location. Skip the setup — you'll be done in a minute.
            </Text>
          </View>
          {businessType === "single-unit" && (
            <Text style={[sh.typeOptionCheck, { color: colors.primary }]}>✓</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setLocalBusinessType("multi-unit")}
          style={[
            sh.typeOption,
            {
              borderColor: businessType === "multi-unit" ? colors.primary : colors.border,
              backgroundColor: businessType === "multi-unit" ? colors.secondary : colors.card,
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={sh.typeOptionIcon}>🏢</Text>
          <View style={{ flex: 1 }}>
            <Text style={[sh.typeOptionTitle, { color: colors.foreground }]}>Multi-unit</Text>
            <Text style={[sh.typeOptionDesc, { color: colors.mutedForeground }]}>
              More than one location. Group them by region and invite managers.
            </Text>
          </View>
          {businessType === "multi-unit" && (
            <Text style={[sh.typeOptionCheck, { color: colors.primary }]}>✓</Text>
          )}
        </TouchableOpacity>

        <PrimaryButton label="Continue" onPress={onContinue} busy={busy} colors={colors} />

        <Text style={[sh.legalText, { color: colors.mutedForeground }]}>
          By continuing you agree to the Terms and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 2 — Regions & Districts ─────────────────────────────────────────────

function StepRegions({
  stepNum,
  totalSteps,
  regions,
  onBack,
  onSkip,
  onContinue,
  addRegion,
  updateRegion,
  removeRegion,
  addDistrict,
  updateDistrict,
  removeDistrict,
}: {
  stepNum: number;
  totalSteps: number;
  regions: Region[];
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  addRegion: (name: string) => void;
  updateRegion: (id: string, name: string) => void;
  removeRegion: (id: string) => void;
  addDistrict: (regionId: string, name: string) => void;
  updateDistrict: (regionId: string, districtId: string, name: string) => void;
  removeDistrict: (regionId: string, districtId: string) => void;
}) {
  const colors = useColors();
  const [newRegionName, setNewRegionName] = useState("");
  const [districtInputs, setDistrictInputs] = useState<Record<string, string>>({});

  const totalDistricts = regions.reduce((acc, r) => acc + r.districts.length, 0);

  const handleAddRegion = () => {
    const name = newRegionName.trim();
    if (!name) return;
    addRegion(name);
    setNewRegionName("");
  };

  const handleAddDistrict = (regionId: string) => {
    const name = (districtInputs[regionId] ?? "").trim();
    if (!name) return;
    addDistrict(regionId, name);
    setDistrictInputs((prev) => ({ ...prev, [regionId]: "" }));
  };

  return (
    <ScrollView
      contentContainerStyle={sh.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        step={stepNum}
        total={totalSteps}
        title="Group your operation"
        subtitle="Optional. Create regions, then add districts inside each one. You can rename or restructure anything later in Settings."
        onBack={onBack}
      />

      {regions.map((region, idx) => (
        <View
          key={region.id}
          style={[sh.regionCard, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          {/* Region header */}
          <View style={sh.regionHeaderRow}>
            <Text style={[sh.regionNum, { color: colors.mutedForeground }]}>{idx + 1}</Text>
            <TextInput
              value={region.name}
              onChangeText={(v) => updateRegion(region.id, v)}
              style={[sh.regionNameInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="Region name"
              placeholderTextColor={colors.mutedForeground}
            />
            <TouchableOpacity onPress={() => removeRegion(region.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[sh.deleteBtn, { color: colors.destructive }]}>🗑️</Text>
            </TouchableOpacity>
          </View>

          {/* Districts */}
          {region.districts.map((d: District) => (
            <View key={d.id} style={sh.districtRow}>
              <Text style={[sh.districtArrow, { color: colors.mutedForeground }]}>▸</Text>
              <TextInput
                value={d.name}
                onChangeText={(v) => updateDistrict(region.id, d.id, v)}
                style={[sh.districtInput, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="District name"
                placeholderTextColor={colors.mutedForeground}
              />
              <TouchableOpacity
                onPress={() => removeDistrict(region.id, d.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[sh.removeX, { color: colors.mutedForeground }]}>×</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add district row */}
          <View style={sh.addDistrictRow}>
            <TextInput
              value={districtInputs[region.id] ?? ""}
              onChangeText={(v) =>
                setDistrictInputs((prev) => ({ ...prev, [region.id]: v }))
              }
              onSubmitEditing={() => handleAddDistrict(region.id)}
              style={[sh.addDistrictInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="＋ Add district"
              placeholderTextColor={colors.primary}
              returnKeyType="done"
            />
          </View>
        </View>
      ))}

      {/* Add region */}
      <View style={sh.addRegionRow}>
        <TextInput
          value={newRegionName}
          onChangeText={setNewRegionName}
          onSubmitEditing={handleAddRegion}
          style={[sh.addRegionInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="＋ Add region"
          placeholderTextColor={colors.primary}
          returnKeyType="done"
        />
      </View>

      {regions.length > 0 && (
        <Text style={[sh.countLabel, { color: colors.mutedForeground }]}>
          {regions.length} {regions.length === 1 ? "region" : "regions"} · {totalDistricts}{" "}
          {totalDistricts === 1 ? "district" : "districts"}
        </Text>
      )}

      <PrimaryButton
        label="Continue"
        onPress={onContinue}
        colors={colors}
        disabled={regions.length === 0}
      />
      <SkipButton onPress={onSkip} colors={colors} />
    </ScrollView>
  );
}

// ─── Step 3 — Locations ───────────────────────────────────────────────────────

function StepLocations({
  stepNum,
  totalSteps,
  regions,
  locations,
  onBack,
  onSkip,
  onContinue,
  addLocation,
  updateLocation,
  removeLocation,
}: {
  stepNum: number;
  totalSteps: number;
  regions: Region[];
  locations: OrgLocation[];
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  addLocation: (name: string, regionId: string, districtId: string) => void;
  updateLocation: (id: string, name: string) => void;
  removeLocation: (id: string) => void;
}) {
  const colors = useColors();
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});

  const handleAdd = (regionId: string, districtId: string) => {
    const key = `${regionId}:${districtId}`;
    const name = (locationInputs[key] ?? "").trim();
    if (!name) return;
    addLocation(name, regionId, districtId);
    setLocationInputs((prev) => ({ ...prev, [key]: "" }));
  };

  const totalLocations = locations.length;

  return (
    <ScrollView
      contentContainerStyle={sh.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        step={stepNum}
        total={totalSteps}
        title="Add your locations"
        subtitle="Optional. Add the stores or sites in each district. You can add more later in Settings."
        onBack={onBack}
      />

      {regions.map((region) => (
        <View key={region.id}>
          <Text style={[sh.regionSectionLabel, { color: colors.mutedForeground }]}>
            {region.name.toUpperCase()}
          </Text>
          {region.districts.map((district) => {
            const key = `${region.id}:${district.id}`;
            const districtLocations = locations.filter(
              (l) => l.regionId === region.id && l.districtId === district.id,
            );
            return (
              <View
                key={district.id}
                style={[sh.districtCard, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <Text style={[sh.districtCardTitle, { color: colors.foreground }]}>
                  {district.name}
                </Text>
                {districtLocations.map((loc) => (
                  <View key={loc.id} style={sh.locationRow}>
                    <Text style={[sh.locationPin, { color: colors.mutedForeground }]}>📍</Text>
                    <TextInput
                      value={loc.name}
                      onChangeText={(v) => updateLocation(loc.id, v)}
                      style={[sh.locationInput, { color: colors.foreground, borderColor: colors.border }]}
                      placeholder="Location name"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <TouchableOpacity
                      onPress={() => removeLocation(loc.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[sh.removeX, { color: colors.mutedForeground }]}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={sh.addLocationRow}>
                  <TextInput
                    value={locationInputs[key] ?? ""}
                    onChangeText={(v) =>
                      setLocationInputs((prev) => ({ ...prev, [key]: v }))
                    }
                    onSubmitEditing={() => handleAdd(region.id, district.id)}
                    style={[sh.addLocationInput, { color: colors.foreground, borderColor: colors.border }]}
                    placeholder="＋ Add location"
                    placeholderTextColor={colors.primary}
                    returnKeyType="done"
                  />
                </View>
              </View>
            );
          })}
        </View>
      ))}

      {regions.length === 0 && (
        <View style={[sh.emptyState, { borderColor: colors.border }]}>
          <Text style={[sh.emptyStateText, { color: colors.mutedForeground }]}>
            No regions or districts set up yet. Go back to add them first.
          </Text>
        </View>
      )}

      {totalLocations > 0 && (
        <Text style={[sh.countLabel, { color: colors.mutedForeground }]}>
          {totalLocations} {totalLocations === 1 ? "location" : "locations"}
        </Text>
      )}

      <PrimaryButton
        label="Continue"
        onPress={onContinue}
        colors={colors}
        disabled={totalLocations === 0}
      />
      <SkipButton onPress={onSkip} colors={colors} />
    </ScrollView>
  );
}

// ─── Step 4 — Team ────────────────────────────────────────────────────────────

const ROLE_OPTIONS = ["Admin", "Regional Manager", "District Manager", "Location Manager", "Staff"];

function StepTeam({
  stepNum,
  totalSteps,
  teamMembers,
  onBack,
  onSkip,
  onSend,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
}: {
  stepNum: number;
  totalSteps: number;
  teamMembers: TeamMember[];
  onBack: () => void;
  onSkip: () => void;
  onSend: () => void;
  addTeamMember: (email: string, role: string, scope?: string) => void;
  updateTeamMember: (id: string, updates: Partial<Omit<TeamMember, "id">>) => void;
  removeTeamMember: (id: string) => void;
}) {
  const colors = useColors();
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("Staff");
  const [newScope, setNewScope] = useState("");

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    addTeamMember(email, newRole, newScope.trim() || undefined);
    setNewEmail("");
    setNewScope("");
  };

  return (
    <ScrollView
      contentContainerStyle={sh.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        step={stepNum}
        total={totalSteps}
        title="Add your team"
        subtitle="Optional. Invite people now or do it later from Settings. You can always change roles."
        onBack={onBack}
      />

      <Text style={[sh.teamHint, { color: colors.mutedForeground }]}>
        Heads up: Teammates will get an email with a passkey invite. They can sign in without a password.
      </Text>

      {/* Existing members */}
      {teamMembers.map((member) => (
        <View
          key={member.id}
          style={[sh.memberCard, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <View style={[sh.memberAvatar, { backgroundColor: colors.secondary }]}>
            <Text style={[sh.memberAvatarText, { color: colors.primary }]}>
              {member.email[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[sh.memberRole, { color: colors.foreground }]}>{member.role}</Text>
            <Text style={[sh.memberEmail, { color: colors.mutedForeground }]}>{member.email}</Text>
            {member.scope ? (
              <Text style={[sh.memberScope, { color: colors.mutedForeground }]}>{member.scope}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => removeTeamMember(member.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[sh.removeX, { color: colors.mutedForeground }]}>×</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Add member form */}
      <View style={[sh.addMemberCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[sh.addMemberLabel, { color: colors.mutedForeground }]}>EMAIL</Text>
        <TextInput
          value={newEmail}
          onChangeText={setNewEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          style={[sh.addMemberInput, { color: colors.foreground, borderColor: colors.border }]}
          placeholder="teammate@business.com"
          placeholderTextColor={colors.mutedForeground}
        />
        <Text style={[sh.addMemberLabel, { color: colors.mutedForeground }]}>ROLE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={sh.roleChips}
        >
          {ROLE_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setNewRole(r)}
              style={[
                sh.roleChip,
                {
                  backgroundColor: newRole === r ? colors.primary : colors.muted,
                  borderColor: newRole === r ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[sh.roleChipText, { color: newRole === r ? colors.primaryForeground : colors.foreground }]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[sh.addMemberLabel, { color: colors.mutedForeground }]}>SCOPE (OPTIONAL)</Text>
        <TextInput
          value={newScope}
          onChangeText={setNewScope}
          style={[sh.addMemberInput, { color: colors.foreground, borderColor: colors.border }]}
          placeholder="e.g. West Coast"
          placeholderTextColor={colors.mutedForeground}
        />
        <TouchableOpacity
          onPress={handleAdd}
          style={[sh.addMemberBtn, { borderColor: colors.primary }]}
        >
          <Text style={[sh.addMemberBtnText, { color: colors.primary }]}>＋ Invite another</Text>
        </TouchableOpacity>
      </View>

      <PrimaryButton
        label={teamMembers.length > 0 ? `Send ${teamMembers.length} invite${teamMembers.length !== 1 ? "s" : ""}` : "Send invites"}
        onPress={onSend}
        colors={colors}
        disabled={teamMembers.length === 0}
      />
      <SkipButton onPress={onSkip} colors={colors} />
    </ScrollView>
  );
}

// ─── Step 5 — Confirm ─────────────────────────────────────────────────────────

function StepConfirm({
  businessName,
  businessType,
  regions,
  locations,
  teamMembers,
  isFinishing,
  finishError,
  onOpen,
}: {
  businessName: string;
  businessType: "single-unit" | "multi-unit";
  regions: Region[];
  locations: OrgLocation[];
  teamMembers: TeamMember[];
  isFinishing: boolean;
  finishError: string | null;
  onOpen: () => void;
}) {
  const colors = useColors();
  const totalDistricts = regions.reduce((acc, r) => acc + r.districts.length, 0);

  const items: { label: string; show: boolean }[] = [
    { label: `${regions.length} region${regions.length !== 1 ? "s" : ""}`, show: regions.length > 0 },
    { label: `${totalDistricts} district${totalDistricts !== 1 ? "s" : ""}`, show: totalDistricts > 0 },
    { label: `${locations.length} location${locations.length !== 1 ? "s" : ""}`, show: locations.length > 0 },
    { label: `${teamMembers.length} teammate${teamMembers.length !== 1 ? "s" : ""}`, show: teamMembers.length > 0 },
  ];
  const visibleItems = items.filter((i) => i.show);

  return (
    <View style={sh.confirmContainer}>
      <View style={[sh.confirmCheck, { backgroundColor: colors.primary }]}>
        <Text style={sh.confirmCheckText}>✓</Text>
      </View>

      <Text style={[sh.confirmTitle, { color: colors.foreground }]}>You're all set</Text>
      <Text style={[sh.confirmSubtitle, { color: colors.mutedForeground }]}>
        {businessName} is ready to run its first shift.
      </Text>

      {visibleItems.length > 0 && (
        <View style={[sh.confirmList, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[sh.confirmListHeader, { color: colors.mutedForeground }]}>WHAT WE SET UP</Text>
          {visibleItems.map((item) => (
            <View key={item.label} style={sh.confirmListRow}>
              <Text style={[sh.confirmListCheck, { color: colors.primary }]}>✓</Text>
              <Text style={[sh.confirmListText, { color: colors.foreground }]}>{item.label}</Text>
            </View>
          ))}
          {businessType === "single-unit" && visibleItems.length === 0 && (
            <Text style={[sh.confirmListText, { color: colors.mutedForeground }]}>Single-unit setup</Text>
          )}
        </View>
      )}

      {finishError && (
        <Text style={[sh.errorText, { color: colors.destructive ?? "#ef4444" }]}>{finishError}</Text>
      )}

      <TouchableOpacity
        style={[sh.primaryBtn, { backgroundColor: colors.primary, marginTop: 32, opacity: isFinishing ? 0.7 : 1 }]}
        onPress={onOpen}
        disabled={isFinishing}
      >
        {isFinishing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[sh.primaryBtnText, { color: colors.primaryForeground }]}>Open End Shift</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Root Onboarding Screen ───────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { updateAppConfig } = useChecklist();
  const {
    businessType,
    regions,
    locations,
    teamMembers,
    settings,
    setBusinessType,
    addRegion,
    updateRegion,
    removeRegion,
    addDistrict,
    updateDistrict,
    removeDistrict,
    addLocation,
    updateLocation,
    removeLocation,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    markComplete,
  } = useOnboarding();

  const [step, setStep] = useState<Step>("account");
  const [businessName, setBusinessName] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  // Build the ordered list of steps based on business type + settings
  const buildSteps = useCallback(
    (bType: "single-unit" | "multi-unit"): Step[] => {
      const steps: Step[] = ["account"];
      if (bType === "multi-unit") {
        if (settings.showRegionsStep) steps.push("regions");
        if (settings.showLocationsStep) steps.push("locations");
      }
      if (settings.showTeamStep) steps.push("team");
      steps.push("confirm");
      return steps;
    },
    [settings],
  );

  const steps = buildSteps(businessType);
  const currentIdx = steps.indexOf(step);
  const stepNum = currentIdx + 1;
  const totalSteps = steps.length;

  const goNext = useCallback(() => {
    const next = steps[currentIdx + 1];
    if (next) setStep(next);
  }, [steps, currentIdx]);

  const goBack = useCallback(() => {
    const prev = steps[currentIdx - 1];
    if (prev) setStep(prev);
    else router.back();
  }, [steps, currentIdx, router]);

  const handleAccountDone = useCallback(
    (bName: string, bType: "single-unit" | "multi-unit") => {
      setBusinessName(bName);
      setBusinessType(bType);
      updateAppConfig({ name: bName });
      const nextSteps = buildSteps(bType);
      const nextStep = nextSteps[1];
      if (nextStep) setStep(nextStep);
    },
    [setBusinessType, updateAppConfig, buildSteps],
  );

  const handleFinish = useCallback(async () => {
    setIsFinishing(true);
    setFinishError(null);
    try {
      // 1. Create regions and map local IDs → DB IDs
      const regionIdMap = new Map<string, number>();
      for (const region of regions) {
        const created = await createOrgUnit({ name: region.name, type: "region" });
        regionIdMap.set(region.id, created.id);
      }

      // 2. Create districts under their regions
      const districtIdMap = new Map<string, number>();
      for (const region of regions) {
        const regionDbId = regionIdMap.get(region.id);
        for (const district of region.districts) {
          const created = await createOrgUnit({
            name: district.name,
            type: "district",
            parentId: regionDbId,
          });
          districtIdMap.set(district.id, created.id);
        }
      }

      // 3. Create locations under their districts
      for (const loc of locations) {
        const districtDbId = districtIdMap.get(loc.districtId);
        await createOrgUnit({
          name: loc.name,
          type: "location",
          parentId: districtDbId,
        });
      }

      // 4. Invite team members
      if (teamMembers.length > 0) {
        const result = await completeOnboarding({
          teamMembers: teamMembers.map((m) => ({
            email: m.email,
            role: m.role,
            ...(m.scope ? { scope: m.scope } : {}),
          })),
        });
        if (result.failed.length > 0) {
          setFinishError(
            `${result.failed.length} invite(s) could not be created: ${result.failed.map((f) => f.email).join(", ")}`,
          );
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }
    } catch (e) {
      setFinishError(describeApiError(e));
      await new Promise((resolve) => setTimeout(resolve, 2500));
    } finally {
      setIsFinishing(false);
      markComplete();
      router.replace("/");
    }
  }, [regions, locations, teamMembers, markComplete, router]);

  return (
    <View
      style={[
        sh.container,
        { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {step === "account" && (
        <StepAccount stepNum={stepNum} totalSteps={totalSteps} onDone={handleAccountDone} />
      )}
      {step === "regions" && (
        <StepRegions
          stepNum={stepNum}
          totalSteps={totalSteps}
          regions={regions}
          onBack={goBack}
          onSkip={goNext}
          onContinue={goNext}
          addRegion={addRegion}
          updateRegion={updateRegion}
          removeRegion={removeRegion}
          addDistrict={addDistrict}
          updateDistrict={updateDistrict}
          removeDistrict={removeDistrict}
        />
      )}
      {step === "locations" && (
        <StepLocations
          stepNum={stepNum}
          totalSteps={totalSteps}
          regions={regions}
          locations={locations}
          onBack={goBack}
          onSkip={goNext}
          onContinue={goNext}
          addLocation={addLocation}
          updateLocation={updateLocation}
          removeLocation={removeLocation}
        />
      )}
      {step === "team" && (
        <StepTeam
          stepNum={stepNum}
          totalSteps={totalSteps}
          teamMembers={teamMembers}
          onBack={goBack}
          onSkip={goNext}
          onSend={goNext}
          addTeamMember={addTeamMember}
          updateTeamMember={updateTeamMember}
          removeTeamMember={removeTeamMember}
        />
      )}
      {step === "confirm" && (
        <StepConfirm
          businessName={businessName}
          businessType={businessType}
          regions={regions}
          locations={locations}
          teamMembers={teamMembers}
          isFinishing={isFinishing}
          finishError={finishError}
          onOpen={handleFinish}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sh = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 560, width: "100%", alignSelf: "center" },

  // Step header
  stepHeader: { marginBottom: 24, marginTop: 8 },
  stepTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  backBtn: { fontSize: 16, fontWeight: "500" },
  backPlaceholder: { width: 60 },
  stepLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  stepTitle: { fontSize: 26, fontWeight: "700", marginBottom: 6 },
  stepSubtitle: { fontSize: 14, lineHeight: 20 },

  // Fields
  label: { fontSize: 14, fontWeight: "600", marginTop: 16, marginBottom: 4 },
  fieldHint: { fontSize: 12, marginBottom: 4, marginTop: 2 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 2 },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  passwordInput: { flex: 1 },
  showToggle: { paddingVertical: 12, paddingHorizontal: 4 },
  showToggleText: { fontSize: 14, fontWeight: "500" },
  rulesBox: { gap: 3, marginTop: 6, marginBottom: 2 },
  ruleText: { fontSize: 12 },

  // Business type
  typeOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  typeOptionIcon: { fontSize: 22, marginTop: 2 },
  typeOptionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  typeOptionDesc: { fontSize: 13, lineHeight: 18 },
  typeOptionCheck: { fontSize: 18, fontWeight: "700", marginTop: 2 },

  // Buttons
  primaryBtn: { marginTop: 24, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 16, fontWeight: "600" },
  skipBtn: { marginTop: 12, alignItems: "center", paddingVertical: 8 },
  skipBtnText: { fontSize: 15 },
  legalText: { fontSize: 12, textAlign: "center", marginTop: 16 },

  // Error
  errorBox: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  errorText: { fontSize: 14, fontWeight: "500" },

  // Regions step
  regionCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 12 },
  regionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  regionNum: { fontSize: 13, fontWeight: "600", width: 20 },
  regionNameInput: { flex: 1, fontSize: 15, fontWeight: "600", borderBottomWidth: 1, paddingBottom: 4 },
  deleteBtn: { fontSize: 18 },
  districtRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4, paddingLeft: 28 },
  districtArrow: { fontSize: 13, width: 16 },
  districtInput: { flex: 1, fontSize: 14, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 3 },
  removeX: { fontSize: 20, fontWeight: "300", paddingHorizontal: 4 },
  addDistrictRow: { paddingLeft: 44, marginTop: 6 },
  addDistrictInput: { fontSize: 14, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 4 },
  addRegionRow: { marginBottom: 8 },
  addRegionInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  countLabel: { fontSize: 13, textAlign: "center", marginTop: 4, marginBottom: 4 },
  regionSectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },

  // Locations step
  districtCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 10 },
  districtCardTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 3 },
  locationPin: { fontSize: 14 },
  locationInput: { flex: 1, fontSize: 14, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 3 },
  addLocationRow: { marginTop: 6 },
  addLocationInput: { fontSize: 14, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 4 },
  emptyState: { borderWidth: 1, borderRadius: 12, padding: 20, alignItems: "center", marginBottom: 16 },
  emptyStateText: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  // Team step
  teamHint: { fontSize: 13, lineHeight: 18, marginBottom: 16, fontStyle: "italic" },
  memberCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 8 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  memberAvatarText: { fontSize: 15, fontWeight: "700" },
  memberRole: { fontSize: 14, fontWeight: "600" },
  memberEmail: { fontSize: 12, marginTop: 1 },
  memberScope: { fontSize: 12, fontStyle: "italic" },
  addMemberCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 8 },
  addMemberLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 6, marginTop: 10 },
  addMemberInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 4 },
  roleChips: { gap: 8, paddingVertical: 4 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  roleChipText: { fontSize: 13, fontWeight: "500" },
  addMemberBtn: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  addMemberBtnText: { fontSize: 14, fontWeight: "600" },

  // Confirm step
  confirmContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  confirmCheck: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  confirmCheckText: { fontSize: 32, color: "#fff", fontWeight: "700" },
  confirmTitle: { fontSize: 28, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  confirmSubtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  confirmList: { width: "100%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16 },
  confirmListHeader: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 10 },
  confirmListRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  confirmListCheck: { fontSize: 15, fontWeight: "700" },
  confirmListText: { fontSize: 15 },
});
