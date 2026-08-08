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
import { Button, Card, Chip, IconButton, RadioButton, TextInput as PaperTextInput } from "react-native-paper";

import { completeOnboarding, createOrgUnit, register as apiRegister } from "@workspace/api-client-react";

import { describeApiError, useAuth } from "@/context/AuthContext";
import { PASSWORD_RULES, validatePassword } from "@/utils/passwordValidation";
import { useChecklist } from "@/context/ChecklistContext";
import { saveStorageMode } from "@/utils/localChecklistStore";
import {
  useOnboarding,
  type District,
  type OrgLocation,
  type Region,
  type TeamMember,
} from "@/context/OnboardingContext";
import shape from "@/constants/shape";
import { typeStyle } from "@/constants/typography";
import { useMd } from "@/theme/useMd";

// ─── Step definitions ─────────────────────────────────────────────────────────

type Step = "account-type" | "personal-account-name" | "personal-account" | "personal-account-form" | "account" | "regions" | "locations" | "team" | "confirm";

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
  const colors = useMd();
  return (
    <View style={sh.stepHeader}>
      <View style={sh.stepTopRow}>
        {onBack ? (
          <Button
            mode="text"
            icon="chevron-left"
            onPress={onBack}
            compact
            labelStyle={[sh.backBtn, { color: colors.onSurfaceVariant }]}
            style={sh.backBtnWrap}
          >
            Back
          </Button>
        ) : (
          <View style={sh.backPlaceholder} />
        )}
        <Text style={[sh.stepLabel, typeStyle("labelSmall"), { color: colors.onSurfaceVariant, flex: 1, textAlign: "center" }]}>
          STEP {step} OF {total}
        </Text>
        <View style={sh.backPlaceholder} />
      </View>
      <Text style={[sh.stepTitle, typeStyle("headlineSmall"), { color: colors.onSurface }]}>{title}</Text>
      {subtitle ? (
        <Text style={[sh.stepSubtitle, typeStyle("bodyMedium"), { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
      ) : null}

      {/* Stepper progress dots */}
      <View style={sh.stepDotsRow}>
        {Array.from({ length: total }).map((_, i) => {
          const idx = i + 1;
          const done = idx < step;
          const active = idx === step;
          return (
            <View
              key={idx}
              style={[
                sh.stepDot,
                {
                  backgroundColor: done || active ? colors.primary : colors.outlineVariant,
                  width: active ? 20 : 6,
                  borderRadius: shape.full,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

function FieldLabel({ label, colors }: { label: string; colors: ReturnType<typeof useMd> }) {
  return <Text style={[sh.label, typeStyle("labelLarge"), { color: colors.onSurface }]}>{label}</Text>;
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
  colors: ReturnType<typeof useMd>;
  disabled?: boolean;
}) {
  return (
    <Button
      mode="contained"
      onPress={onPress}
      loading={busy}
      disabled={busy || disabled}
      style={[sh.primaryBtn, { borderRadius: shape.md }]}
      contentStyle={sh.primaryBtnContent}
      labelStyle={[sh.primaryBtnText, typeStyle("titleMedium")]}
    >
      {label}
    </Button>
  );
}

function SkipButton({
  onPress,
  colors,
}: {
  onPress: () => void;
  colors: ReturnType<typeof useMd>;
}) {
  return (
    <Button
      mode="text"
      onPress={onPress}
      style={sh.skipBtn}
      labelStyle={[sh.skipBtnText, typeStyle("labelLarge"), { color: colors.onSurfaceVariant }]}
    >
      Skip for now
    </Button>
  );
}

function ErrorBox({ message, colors }: { message: string; colors: ReturnType<typeof useMd> }) {
  return (
    <View
      style={[sh.errorBox, { backgroundColor: colors.errorContainer, borderColor: colors.error, borderRadius: shape.sm }]}
    >
      <Text style={[sh.errorText, typeStyle("bodyMedium"), { color: colors.onErrorContainer }]}>{message}</Text>
    </View>
  );
}

// ─── Step 0 — Account Type ────────────────────────────────────────────────────

function SizeCard({
  icon,
  title,
  description,
  selected,
  onPress,
  colors,
  variant = "radio",
}: {
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useMd>;
  /** "radio" for a real selectable option (business size); "nav" for a navigational
   * choice card that always moves forward, where a permanently-unchecked radio would
   * be misleading — shows a chevron affordance instead. */
  variant?: "radio" | "nav";
}) {
  return (
    <Card
      mode="outlined"
      onPress={onPress}
      style={[
        sh.typeOption,
        {
          borderColor: selected ? colors.primary : colors.outlineVariant,
          backgroundColor: selected ? colors.primaryContainer : colors.surface,
          borderRadius: shape.md,
        },
      ]}
    >
      <Card.Content style={sh.typeOptionContent}>
        <View
          style={[
            sh.typeOptionIconTile,
            {
              backgroundColor: selected ? colors.primary : colors.surfaceContainerHighest,
              borderRadius: shape.sm,
            },
          ]}
        >
          <Text style={sh.typeOptionIconText}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              sh.typeOptionTitle,
              typeStyle("titleMedium"),
              { color: selected ? colors.onPrimaryContainer : colors.onSurface },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              sh.typeOptionDesc,
              typeStyle("bodySmall"),
              { color: selected ? colors.onPrimaryContainer : colors.onSurfaceVariant },
            ]}
          >
            {description}
          </Text>
        </View>
        {variant === "radio" ? (
          <RadioButton
            value={title}
            status={selected ? "checked" : "unchecked"}
            onPress={onPress}
            color={colors.primary}
          />
        ) : (
          <IconButton
            icon="chevron-right"
            size={20}
            iconColor={colors.onSurfaceVariant}
            onPress={onPress}
          />
        )}
      </Card.Content>
    </Card>
  );
}

function StepAccountType({
  onChoose,
}: {
  onChoose: (kind: "personal" | "business") => void;
}) {
  const colors = useMd();
  const router = useRouter();

  return (
    <ScrollView
      contentContainerStyle={sh.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={sh.stepHeader}>
        <View style={sh.stepTopRow}>
          <Button
            mode="text"
            icon="chevron-left"
            onPress={() => router.back()}
            compact
            labelStyle={[sh.backBtn, { color: colors.onSurfaceVariant }]}
            style={sh.backBtnWrap}
          >
            Back
          </Button>
          <Text style={[sh.stepLabel, typeStyle("labelSmall"), { color: colors.onSurfaceVariant, flex: 1, textAlign: "center" }]}>GET STARTED</Text>
          <View style={sh.backPlaceholder} />
        </View>
        <Text style={[sh.stepTitle, typeStyle("headlineSmall"), { color: colors.onSurface }]}>How will you use{"\n"}End Shift?</Text>
        <Text style={[sh.stepSubtitle, typeStyle("bodyMedium"), { color: colors.onSurfaceVariant }]}>
          Choose the option that fits you best. You can always upgrade later.
        </Text>
      </View>

      <SizeCard
        icon="👤"
        title="Personal"
        description="Just for you. Checklists live on this device — no account required. Great for solo routines."
        selected={false}
        onPress={() => onChoose("personal")}
        colors={colors}
        variant="nav"
      />

      <SizeCard
        icon="🏢"
        title="Business"
        description="For a team or multiple locations. Cloud-synced, collaborative, with roles and reporting."
        selected={false}
        onPress={() => onChoose("business")}
        colors={colors}
        variant="nav"
      />
    </ScrollView>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function toAppTitle(name: string): string {
  const n = name.trim();
  if (!n) return "My Day";
  return n.endsWith("s") ? `${n}' Day` : `${n}'s Day`;
}

// ─── Step 1 (Personal) — Name ─────────────────────────────────────────────────

function StepPersonalAccountName({
  displayName,
  onChange,
  onContinue,
}: {
  displayName: string;
  onChange: (v: string) => void;
  onContinue: () => void;
}) {
  const colors = useMd();
  const preview = toAppTitle(displayName);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[sh.scrollContent, { justifyContent: "center", flex: 1 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[sh.confirmCheck, { backgroundColor: colors.primary, alignSelf: "center", marginBottom: 20, borderRadius: shape.full }]}>
          <Text style={[sh.confirmCheckText, { color: colors.onPrimary }]}>✏️</Text>
        </View>
        <Text style={[sh.confirmTitle, { color: colors.onSurface, textAlign: "center" }]}>
          What should we call you?
        </Text>
        <Text style={[sh.confirmSubtitle, { color: colors.onSurfaceVariant, textAlign: "center", marginBottom: 24 }]}>
          {displayName.trim()
            ? `Your app will be called "${preview}"`
            : "Your name becomes your app title."}
        </Text>

        <PaperTextInput
          mode="outlined"
          value={displayName}
          onChangeText={onChange}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onContinue}
          style={{ fontSize: 20, textAlign: "center" }}
          placeholder="Your name"
        />

        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          colors={colors}
          disabled={!displayName.trim()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 2 (Personal) — Account prompt ──────────────────────────────────────

function StepPersonalAccount({
  onCreateAccount,
  onSkip,
}: {
  onCreateAccount: () => void;
  onSkip: () => void;
}) {
  const colors = useMd();

  return (
    <View style={[sh.confirmContainer, { paddingHorizontal: 28 }]}>
      <View style={[sh.confirmCheck, { backgroundColor: colors.primary, borderRadius: shape.full }]}>
        <Text style={[sh.confirmCheckText, { color: colors.onPrimary }]}>🔒</Text>
      </View>
      <Text style={[sh.confirmTitle, { color: colors.onSurface }]}>
        Password protect your checklists?
      </Text>
      <Text style={[sh.confirmSubtitle, { color: colors.onSurfaceVariant }]}>
        Creating an account lets you sign in with a password. You can always add one later in Settings.
      </Text>

      <Button
        mode="contained"
        onPress={onCreateAccount}
        style={[sh.primaryBtn, { marginTop: 32, width: "100%", borderRadius: shape.md }]}
        contentStyle={sh.primaryBtnContent}
      >
        Yes, create an account
      </Button>

      <Button
        mode="contained-tonal"
        onPress={onSkip}
        style={[sh.primaryBtn, { marginTop: 12, width: "100%", borderRadius: shape.md }]}
        contentStyle={sh.primaryBtnContent}
      >
        No thanks, skip for now
      </Button>
    </View>
  );
}

// ─── Step 1 (Personal) — Credentials form ────────────────────────────────────

function StepPersonalAccountForm({
  stepNum,
  totalSteps,
  displayName,
  onBack,
  onDone,
}: {
  stepNum: number;
  totalSteps: number;
  displayName: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const colors = useMd();
  const { signIn, setNoAuthMode } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    setError(null);
    if (!username.trim()) { setError("Username is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) { setError(pwCheck.errors[0]!); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setBusy(true);
    try {
      await apiRegister({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        businessName: toAppTitle(displayName),
        businessType: "single-unit",
      });
      await saveStorageMode("local");
      setNoAuthMode(false);
      await signIn(username.trim().toLowerCase(), password);
      onDone();
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
          title="Create your account"
          subtitle="Your checklists will be saved on this device."
          onBack={onBack}
        />

        {error ? <ErrorBox message={error} colors={colors} /> : null}

        <FieldLabel label="Username" colors={colors} />
        <Text style={[sh.fieldHint, { color: colors.onSurfaceVariant }]}>
          This is how you'll sign in. Keep it short and memorable.
        </Text>
        <PaperTextInput
          mode="outlined"
          value={username}
          onChangeText={(v) => { setUsername(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          placeholder="yourname"
          style={sh.paperInput}
        />

        <FieldLabel label="Email" colors={colors} />
        <Text style={[sh.fieldHint, { color: colors.onSurfaceVariant }]}>
          Used for account recovery only.
        </Text>
        <PaperTextInput
          mode="outlined"
          value={email}
          onChangeText={(v) => { setEmail(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!busy}
          placeholder="you@example.com"
          style={sh.paperInput}
        />

        <FieldLabel label="Password" colors={colors} />
        <PaperTextInput
          mode="outlined"
          value={password}
          onChangeText={(v) => { setPassword(v); setError(null); }}
          secureTextEntry={!showPassword}
          editable={!busy}
          placeholder="••••••••••••"
          style={sh.paperInput}
          right={
            <PaperTextInput.Icon
              icon={showPassword ? "eye-off" : "eye"}
              onPress={() => setShowPassword((s) => !s)}
              forceTextInputFocus={false}
            />
          }
        />
        {password.length > 0 && (
          <View style={sh.rulesBox}>
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <Text
                  key={rule.label}
                  style={[sh.ruleText, { color: met ? colors.primary : colors.onSurfaceVariant }]}
                >
                  {met ? "✓" : "○"} {rule.label}
                </Text>
              );
            })}
          </View>
        )}

        <FieldLabel label="Confirm password" colors={colors} />
        <PaperTextInput
          mode="outlined"
          value={confirmPassword}
          onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
          secureTextEntry={!showPassword}
          editable={!busy}
          error={!!confirmPassword && confirmPassword !== password}
          placeholder="••••••••••••"
          style={sh.paperInput}
        />

        <PrimaryButton label="Continue" onPress={onContinue} busy={busy} colors={colors} />

        <Text style={[sh.legalText, { color: colors.onSurfaceVariant }]}>
          By continuing you agree to the Terms and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 1 (Business) — Account ──────────────────────────────────────────────

function StepBusinessAccount({
  stepNum,
  totalSteps,
  onBack,
  onDone,
}: {
  stepNum: number;
  totalSteps: number;
  onBack: () => void;
  onDone: (businessName: string, businessType: "single-unit" | "multi-unit") => void;
}) {
  const colors = useMd();
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
          title="Set up your business"
          onBack={onBack}
        />

        {error ? <ErrorBox message={error} colors={colors} /> : null}

        <FieldLabel label="Username" colors={colors} />
        <Text style={[sh.fieldHint, { color: colors.onSurfaceVariant }]}>
          This is how you'll sign in. Choose something short and easy to remember.
        </Text>
        <PaperTextInput
          mode="outlined"
          value={username}
          onChangeText={(v) => { setUsername(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          placeholder="yourname"
          style={sh.paperInput}
        />

        <FieldLabel label="Work email" colors={colors} />
        <Text style={[sh.fieldHint, { color: colors.onSurfaceVariant }]}>
          Used for billing and account recovery only.
        </Text>
        <PaperTextInput
          mode="outlined"
          value={email}
          onChangeText={(v) => { setEmail(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!busy}
          placeholder="you@business.com"
          style={sh.paperInput}
        />

        <FieldLabel label="Password" colors={colors} />
        <PaperTextInput
          mode="outlined"
          value={password}
          onChangeText={(v) => { setPassword(v); setError(null); }}
          secureTextEntry={!showPassword}
          editable={!busy}
          placeholder="••••••••••••"
          style={sh.paperInput}
          right={
            <PaperTextInput.Icon
              icon={showPassword ? "eye-off" : "eye"}
              onPress={() => setShowPassword((s) => !s)}
              forceTextInputFocus={false}
            />
          }
        />
        {password.length > 0 && (
          <View style={sh.rulesBox}>
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <Text
                  key={rule.label}
                  style={[sh.ruleText, { color: met ? colors.primary : colors.onSurfaceVariant }]}
                >
                  {met ? "✓" : "○"} {rule.label}
                </Text>
              );
            })}
          </View>
        )}

        <FieldLabel label="Confirm password" colors={colors} />
        <PaperTextInput
          mode="outlined"
          value={confirmPassword}
          onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
          secureTextEntry={!showPassword}
          editable={!busy}
          error={!!confirmPassword && confirmPassword !== password}
          placeholder="••••••••••••"
          style={sh.paperInput}
        />

        <FieldLabel label="Business name" colors={colors} />
        <PaperTextInput
          mode="outlined"
          value={businessName}
          onChangeText={(v) => { setBusinessName(v); setError(null); }}
          editable={!busy}
          placeholder="Rosa's Diner Group"
          style={sh.paperInput}
        />
        <Text style={[sh.fieldHint, { color: colors.onSurfaceVariant }]}>
          Shown to your team at the top of the app.
        </Text>

        <FieldLabel label="Business size" colors={colors} />
        <SizeCard
          icon="🏪"
          title="Single-unit"
          description="One location. Skip the setup — you'll be done in a minute."
          selected={businessType === "single-unit"}
          onPress={() => setLocalBusinessType("single-unit")}
          colors={colors}
        />

        <SizeCard
          icon="🏢"
          title="Multi-unit"
          description="More than one location. Group them by region and invite managers."
          selected={businessType === "multi-unit"}
          onPress={() => setLocalBusinessType("multi-unit")}
          colors={colors}
        />

        <PrimaryButton label="Continue" onPress={onContinue} busy={busy} colors={colors} />

        <Text style={[sh.legalText, { color: colors.onSurfaceVariant }]}>
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
  const colors = useMd();
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
        <Card
          key={region.id}
          mode="outlined"
          style={[sh.regionCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md }]}
        >
          <Card.Content>
            <View style={sh.regionHeaderRow}>
              <View style={[sh.regionNumChip, { backgroundColor: colors.primaryContainer, borderRadius: shape.full }]}>
                <Text style={[sh.regionNum, { color: colors.onPrimaryContainer }]}>{idx + 1}</Text>
              </View>
              <PaperTextInput
                mode="outlined"
                dense
                value={region.name}
                onChangeText={(v) => updateRegion(region.id, v)}
                style={sh.regionNameInput}
                placeholder="Region name"
              />
              <IconButton
                icon="delete-outline"
                size={20}
                iconColor={colors.error}
                onPress={() => removeRegion(region.id)}
              />
            </View>

            <View style={sh.districtChipsRow}>
              {region.districts.map((d: District) => (
                <View
                  key={d.id}
                  style={[sh.districtChip, { backgroundColor: colors.surfaceContainerHighest, borderRadius: shape.full }]}
                >
                  {/* Deviation from "district chips -> Paper Chip": Paper's Chip renders
                     children inside a Text node and can't host an editable field, and
                     district names are inline-editable here. Kept a plain RN TextInput,
                     restyled to read as an M3 input chip (pill radius, tonal surface). */}
                  <TextInput
                    value={d.name}
                    onChangeText={(v) => updateDistrict(region.id, d.id, v)}
                    style={[sh.districtChipInput, { color: colors.onSurface }]}
                    placeholder="District name"
                    placeholderTextColor={colors.onSurfaceVariant}
                  />
                  <TouchableOpacity
                    onPress={() => removeDistrict(region.id, d.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[sh.removeX, { color: colors.onSurfaceVariant }]}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={sh.addDistrictRow}>
              <PaperTextInput
                mode="outlined"
                dense
                value={districtInputs[region.id] ?? ""}
                onChangeText={(v) =>
                  setDistrictInputs((prev) => ({ ...prev, [region.id]: v }))
                }
                onSubmitEditing={() => handleAddDistrict(region.id)}
                style={sh.addDistrictInput}
                placeholder="Add district"
                returnKeyType="done"
                right={
                  <PaperTextInput.Icon
                    icon="plus"
                    onPress={() => handleAddDistrict(region.id)}
                    forceTextInputFocus={false}
                  />
                }
              />
            </View>
          </Card.Content>
        </Card>
      ))}

      <View style={sh.addRegionRow}>
        <PaperTextInput
          mode="outlined"
          dense
          value={newRegionName}
          onChangeText={setNewRegionName}
          onSubmitEditing={handleAddRegion}
          style={sh.addRegionInput}
          placeholder="Add region"
          returnKeyType="done"
          right={
            <PaperTextInput.Icon icon="plus" onPress={handleAddRegion} forceTextInputFocus={false} />
          }
        />
      </View>

      {regions.length > 0 && (
        <Text style={[sh.countLabel, { color: colors.onSurfaceVariant }]}>
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
  const colors = useMd();
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
          <Text style={[sh.regionSectionLabel, { color: colors.onSurfaceVariant }]}>
            {region.name.toUpperCase()}
          </Text>
          {region.districts.map((district) => {
            const key = `${region.id}:${district.id}`;
            const districtLocations = locations.filter(
              (l) => l.regionId === region.id && l.districtId === district.id,
            );
            return (
              <Card
                key={district.id}
                mode="outlined"
                style={[sh.districtCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surface, borderRadius: shape.md }]}
              >
                <Card.Content>
                  <Text style={[sh.districtCardTitle, { color: colors.onSurface }]}>
                    {district.name}
                  </Text>
                  {districtLocations.map((loc) => (
                    <View key={loc.id} style={sh.locationRow}>
                      <Text style={[sh.locationPin, { color: colors.onSurfaceVariant }]}>📍</Text>
                      <PaperTextInput
                        mode="outlined"
                        dense
                        value={loc.name}
                        onChangeText={(v) => updateLocation(loc.id, v)}
                        style={sh.locationInput}
                        placeholder="Location name"
                      />
                      <TouchableOpacity
                        onPress={() => removeLocation(loc.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={[sh.removeX, { color: colors.onSurfaceVariant }]}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={sh.addLocationRow}>
                    <PaperTextInput
                      mode="outlined"
                      dense
                      value={locationInputs[key] ?? ""}
                      onChangeText={(v) =>
                        setLocationInputs((prev) => ({ ...prev, [key]: v }))
                      }
                      onSubmitEditing={() => handleAdd(region.id, district.id)}
                      style={sh.addLocationInput}
                      placeholder="Add location"
                      returnKeyType="done"
                      right={
                        <PaperTextInput.Icon
                          icon="plus"
                          onPress={() => handleAdd(region.id, district.id)}
                          forceTextInputFocus={false}
                        />
                      }
                    />
                  </View>
                </Card.Content>
              </Card>
            );
          })}
        </View>
      ))}

      {regions.length === 0 && (
        <View
          style={[
            sh.emptyState,
            { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md },
          ]}
        >
          <Text style={sh.emptyStateIcon}>🗺️</Text>
          <Text style={[sh.emptyStateTitle, { color: colors.onSurface }]}>No regions yet</Text>
          <Text style={[sh.emptyStateText, { color: colors.onSurfaceVariant }]}>
            No regions or districts set up yet. Go back to add them first.
          </Text>
        </View>
      )}

      {totalLocations > 0 && (
        <Text style={[sh.countLabel, { color: colors.onSurfaceVariant }]}>
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
  const colors = useMd();
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

      <Text style={[sh.teamHint, { color: colors.onSurfaceVariant }]}>
        Heads up: Teammates will get an email with a passkey invite. They can sign in without a password.
      </Text>

      {teamMembers.length === 0 ? (
        <View
          style={[
            sh.teamEmptyState,
            { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md },
          ]}
        >
          <Text style={sh.teamEmptyIcon}>👥</Text>
          <Text style={[sh.teamEmptyTitle, { color: colors.onSurface }]}>No teammates yet</Text>
          <Text style={[sh.teamEmptySubtitle, { color: colors.onSurfaceVariant }]}>
            Invite people below to give them access.
          </Text>
        </View>
      ) : (
        teamMembers.map((member) => (
          <Card
            key={member.id}
            mode="outlined"
            style={[sh.memberCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surface, borderRadius: shape.md }]}
          >
            <Card.Content style={sh.memberCardContent}>
              <View style={[sh.memberAvatar, { backgroundColor: colors.secondaryContainer, borderRadius: shape.full }]}>
                <Text style={[sh.memberAvatarText, { color: colors.onSecondaryContainer }]}>
                  {member.email[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[sh.memberRole, { color: colors.onSurface }]}>{member.role}</Text>
                <Text style={[sh.memberEmail, { color: colors.onSurfaceVariant }]}>{member.email}</Text>
                {member.scope ? (
                  <Text style={[sh.memberScope, { color: colors.onSurfaceVariant }]}>{member.scope}</Text>
                ) : null}
              </View>
              <IconButton
                icon="close"
                size={18}
                iconColor={colors.onSurfaceVariant}
                onPress={() => removeTeamMember(member.id)}
              />
            </Card.Content>
          </Card>
        ))
      )}

      <Card
        mode="outlined"
        style={[sh.addMemberCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md }]}
      >
        <Card.Content>
          <Text style={[sh.addMemberLabel, { color: colors.onSurfaceVariant }]}>EMAIL</Text>
          <PaperTextInput
            mode="outlined"
            dense
            value={newEmail}
            onChangeText={setNewEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            placeholder="teammate@business.com"
            style={sh.paperInput}
          />
          <Text style={[sh.addMemberLabel, { color: colors.onSurfaceVariant }]}>ROLE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sh.roleChips}
          >
            {ROLE_OPTIONS.map((r) => (
              <Chip
                key={r}
                selected={newRole === r}
                onPress={() => setNewRole(r)}
                mode={newRole === r ? "flat" : "outlined"}
                style={[
                  sh.roleChip,
                  {
                    backgroundColor: newRole === r ? colors.primary : colors.surfaceContainerHighest,
                    borderColor: newRole === r ? colors.primary : colors.outlineVariant,
                  },
                ]}
                textStyle={{ color: newRole === r ? colors.onPrimary : colors.onSurface }}
              >
                {r}
              </Chip>
            ))}
          </ScrollView>
          <Text style={[sh.addMemberLabel, { color: colors.onSurfaceVariant }]}>SCOPE (OPTIONAL)</Text>
          <PaperTextInput
            mode="outlined"
            dense
            value={newScope}
            onChangeText={setNewScope}
            placeholder="e.g. West Coast"
            style={sh.paperInput}
          />
          <Button
            mode="outlined"
            onPress={handleAdd}
            style={[sh.addMemberBtn, { borderRadius: shape.sm, borderColor: colors.primary }]}
          >
            ＋ Invite another
          </Button>
        </Card.Content>
      </Card>

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
  accountKind,
  businessName,
  businessType,
  regions,
  locations,
  teamMembers,
  isFinishing,
  finishError,
  onOpen,
}: {
  accountKind: "personal" | "business";
  businessName: string;
  businessType: "single-unit" | "multi-unit";
  regions: Region[];
  locations: OrgLocation[];
  teamMembers: TeamMember[];
  isFinishing: boolean;
  finishError: string | null;
  onOpen: () => void;
}) {
  const colors = useMd();

  if (accountKind === "personal") {
    return (
      <View style={sh.confirmContainer}>
        <View style={[sh.confirmCheck, { backgroundColor: colors.primary, borderRadius: shape.full }]}>
          <Text style={[sh.confirmCheckText, { color: colors.onPrimary }]}>✓</Text>
        </View>
        <Text style={[sh.confirmTitle, { color: colors.onSurface }]}>You're all set</Text>
        <Text style={[sh.confirmSubtitle, { color: colors.onSurfaceVariant }]}>
          Your checklists are saved on this device. You can enable cloud sync anytime from Settings.
        </Text>
        <Button
          mode="contained"
          onPress={onOpen}
          style={[sh.primaryBtn, { marginTop: 32, width: "100%", borderRadius: shape.md }]}
          contentStyle={sh.primaryBtnContent}
        >
          Open End Shift
        </Button>
      </View>
    );
  }

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
      <View style={[sh.confirmCheck, { backgroundColor: colors.primary, borderRadius: shape.full }]}>
        <Text style={[sh.confirmCheckText, { color: colors.onPrimary }]}>✓</Text>
      </View>

      <Text style={[sh.confirmTitle, { color: colors.onSurface }]}>You're all set</Text>
      <Text style={[sh.confirmSubtitle, { color: colors.onSurfaceVariant }]}>
        {businessName} is ready to run its first shift.
      </Text>

      {visibleItems.length > 0 && (
        <Card
          mode="outlined"
          style={[sh.confirmList, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md }]}
        >
          <Card.Content>
            <Text style={[sh.confirmListHeader, { color: colors.onSurfaceVariant }]}>WHAT WE SET UP</Text>
            {visibleItems.map((item) => (
              <View key={item.label} style={sh.confirmListRow}>
                <Text style={[sh.confirmListCheck, { color: colors.primary }]}>✓</Text>
                <Text style={[sh.confirmListText, { color: colors.onSurface }]}>{item.label}</Text>
              </View>
            ))}
            {businessType === "single-unit" && visibleItems.length === 0 && (
              <Text style={[sh.confirmListText, { color: colors.onSurfaceVariant }]}>Single-unit setup</Text>
            )}
          </Card.Content>
        </Card>
      )}

      {finishError && (
        <Text style={[sh.errorText, { color: colors.error }]}>{finishError}</Text>
      )}

      <Button
        mode="contained"
        onPress={onOpen}
        loading={isFinishing}
        disabled={isFinishing}
        style={[sh.primaryBtn, { marginTop: 32, width: "100%", borderRadius: shape.md }]}
        contentStyle={sh.primaryBtnContent}
      >
        Open End Shift
      </Button>
    </View>
  );
}

// ─── Root Onboarding Screen ───────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useMd();
  const { updateAppConfig } = useChecklist();
  const { setNoAuthMode } = useAuth();
  const {
    accountKind,
    businessType,
    regions,
    locations,
    teamMembers,
    settings,
    setAccountKind,
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

  const [step, setStep] = useState<Step>("account-type");
  const [businessName, setBusinessName] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [wantsAccount, setWantsAccount] = useState(false);
  const [displayName, setDisplayName] = useState("");

  // Build the ordered list of steps based on account kind + business type + settings
  const buildSteps = useCallback(
    (aKind: "personal" | "business", bType: "single-unit" | "multi-unit", withForm: boolean): Step[] => {
      const steps: Step[] = ["account-type"];
      if (aKind === "personal") {
        steps.push("personal-account-name");
        steps.push("personal-account");
        if (withForm) steps.push("personal-account-form");
      } else {
        steps.push("account");
        if (bType === "multi-unit") {
          if (settings.showRegionsStep) steps.push("regions");
          if (settings.showLocationsStep) steps.push("locations");
        }
        if (settings.showTeamStep) steps.push("team");
      }
      steps.push("confirm");
      return steps;
    },
    [settings],
  );

  const steps = buildSteps(accountKind, businessType, wantsAccount);
  const currentIdx = steps.indexOf(step);
  // Step numbers displayed to user exclude the "account-type" selector screen
  const displayIdx = currentIdx; // 0-based from account-type
  const stepNum = currentIdx; // account-type=0 so the next step starts at 1
  const totalSteps = steps.length - 1; // exclude account-type from total

  const goNext = useCallback(() => {
    const next = steps[currentIdx + 1];
    if (next) setStep(next);
  }, [steps, currentIdx]);

  const goBack = useCallback(() => {
    const prev = steps[currentIdx - 1];
    if (prev) setStep(prev);
    else router.back();
  }, [steps, currentIdx, router]);

  const handleAccountTypeChosen = useCallback(
    (kind: "personal" | "business") => {
      setAccountKind(kind);
      const nextSteps = buildSteps(kind, businessType, false);
      const next = nextSteps[1];
      if (next) setStep(next);
    },
    [setAccountKind, buildSteps, businessType],
  );

  const handlePersonalAccountNameDone = useCallback(() => {
    updateAppConfig({ name: toAppTitle(displayName) });
    setStep("personal-account");
  }, [displayName, updateAppConfig]);

  const handlePersonalAccountCreateAccount = useCallback(() => {
    setWantsAccount(true);
    setStep("personal-account-form");
  }, []);

  const handlePersonalAccountSkip = useCallback(async () => {
    await saveStorageMode("local-no-auth");
    setNoAuthMode(true);
    setStep("confirm");
  }, [setNoAuthMode]);

  const handlePersonalAccountFormDone = useCallback(() => {
    setStep("confirm");
  }, []);

  const handleBusinessAccountDone = useCallback(
    (bName: string, bType: "single-unit" | "multi-unit") => {
      setBusinessName(bName);
      setBusinessType(bType);
      updateAppConfig({ name: bName });
      const nextSteps = buildSteps("business", bType, false);
      const accountIdx = nextSteps.indexOf("account");
      const next = nextSteps[accountIdx + 1];
      if (next) setStep(next);
    },
    [setBusinessType, updateAppConfig, buildSteps],
  );

  const handleFinish = useCallback(async () => {
    // Personal accounts: no server-side org setup needed
    if (accountKind === "personal") {
      markComplete();
      router.replace("/");
      return;
    }

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
  }, [accountKind, regions, locations, teamMembers, markComplete, router]);

  return (
    <View
      style={[
        sh.container,
        { backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {step === "account-type" && (
        <StepAccountType onChoose={handleAccountTypeChosen} />
      )}
      {step === "personal-account-name" && (
        <StepPersonalAccountName
          displayName={displayName}
          onChange={setDisplayName}
          onContinue={handlePersonalAccountNameDone}
        />
      )}
      {step === "personal-account" && (
        <StepPersonalAccount
          onCreateAccount={handlePersonalAccountCreateAccount}
          onSkip={handlePersonalAccountSkip}
        />
      )}
      {step === "personal-account-form" && (
        <StepPersonalAccountForm
          stepNum={stepNum}
          totalSteps={totalSteps}
          displayName={displayName}
          onBack={goBack}
          onDone={handlePersonalAccountFormDone}
        />
      )}
      {step === "account" && (
        <StepBusinessAccount
          stepNum={stepNum}
          totalSteps={totalSteps}
          onBack={goBack}
          onDone={handleBusinessAccountDone}
        />
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
          accountKind={accountKind}
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
  backBtn: { ...typeStyle("labelLarge") },
  backPlaceholder: { width: 60 },
  stepLabel: { ...typeStyle("labelSmall"), textTransform: "uppercase" },
  stepTitle: { ...typeStyle("headlineSmall"), marginBottom: 6 },
  stepSubtitle: { ...typeStyle("bodyMedium") },

  // Fields
  label: { ...typeStyle("labelLarge"), marginTop: 16, marginBottom: 4 },
  fieldHint: { ...typeStyle("bodySmall"), marginBottom: 4, marginTop: 2 },
  input: { ...typeStyle("bodyLarge"), borderWidth: 1, borderRadius: shape.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 2 },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  passwordInput: { flex: 1 },
  showToggle: { paddingVertical: 12, paddingHorizontal: 4 },
  showToggleText: { ...typeStyle("labelLarge") },
  rulesBox: { gap: 3, marginTop: 6, marginBottom: 2 },
  ruleText: { ...typeStyle("bodySmall") },

  // Account / business type options
  typeOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  typeOptionLarge: {
    paddingVertical: 18,
    marginTop: 14,
  },
  typeOptionIcon: { fontSize: 22, marginTop: 2 },
  typeOptionTitle: { ...typeStyle("titleMedium"), marginBottom: 2 },
  typeOptionDesc: { ...typeStyle("bodySmall") },
  typeOptionCheck: { ...typeStyle("titleMedium"), fontFamily: "Inter_700Bold", marginTop: 2 },
  typeOptionArrow: { fontSize: 20, alignSelf: "center" },

  // Buttons
  primaryBtn: { marginTop: 24, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { ...typeStyle("titleMedium") },
  backBtnWrap: { marginLeft: -8 },
  skipBtn: { marginTop: 12, alignItems: "center" },
  skipBtnText: { ...typeStyle("labelLarge") },
  legalText: { ...typeStyle("bodySmall"), textAlign: "center", marginTop: 16 },

  // Error
  errorBox: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  errorText: { ...typeStyle("bodyMedium") },

  // Regions step
  regionCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 12 },
  regionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  regionNum: { ...typeStyle("labelLarge"), width: 20, textAlign: "center" },
  regionNameInput: { flex: 1, marginBottom: -8 },
  deleteBtn: { fontSize: 18 },
  districtRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4, paddingLeft: 28 },
  districtArrow: { fontSize: 13, width: 16 },
  districtInput: { ...typeStyle("bodyMedium"), flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 3 },
  removeX: { fontSize: 20, paddingHorizontal: 4 },
  addDistrictRow: { paddingLeft: 28, marginTop: 6 },
  addDistrictInput: { flex: 1 },
  addRegionRow: { marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  addRegionInput: { flex: 1 },
  countLabel: { ...typeStyle("bodySmall"), textAlign: "center", marginTop: 4, marginBottom: 4 },
  regionSectionLabel: { ...typeStyle("labelSmall"), marginTop: 16, marginBottom: 8 },

  // Locations step
  districtCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 10 },
  districtCardTitle: { ...typeStyle("titleSmall"), marginBottom: 8 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 3 },
  locationPin: { fontSize: 14 },
  locationInput: { flex: 1, marginBottom: -8 },
  addLocationRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  addLocationInput: { flex: 1, marginLeft: 22 },
  emptyState: { borderWidth: 1, padding: 24, alignItems: "center", gap: 6, marginBottom: 16 },
  emptyStateIcon: { fontSize: 32, marginBottom: 4 },
  emptyStateTitle: { ...typeStyle("titleMedium") },
  emptyStateText: { ...typeStyle("bodySmall"), textAlign: "center" },

  // Team step
  teamHint: { ...typeStyle("bodySmall"), marginBottom: 16, fontStyle: "italic" },
  memberCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 8 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  memberAvatarText: { ...typeStyle("titleMedium"), fontFamily: "Inter_700Bold" },
  memberRole: { ...typeStyle("titleSmall") },
  memberEmail: { ...typeStyle("bodySmall"), marginTop: 1 },
  memberScope: { ...typeStyle("bodySmall"), fontStyle: "italic" },
  addMemberCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 8 },
  addMemberLabel: { ...typeStyle("labelSmall"), marginBottom: 6, marginTop: 10 },
  addMemberInput: { ...typeStyle("bodyMedium"), borderWidth: 1, borderRadius: shape.sm, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  roleChips: { gap: 8, paddingVertical: 4 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  roleChipText: { ...typeStyle("labelLarge") },
  addMemberBtn: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  addMemberBtnText: { ...typeStyle("titleSmall") },

  // Confirm step
  confirmContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  confirmCheck: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  confirmCheckText: { fontSize: 32, fontFamily: "Inter_700Bold" },
  confirmTitle: { ...typeStyle("headlineSmall"), marginBottom: 8, textAlign: "center" },
  confirmSubtitle: { ...typeStyle("bodyLarge"), textAlign: "center", marginBottom: 24 },
  confirmList: { width: "100%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16 },
  confirmListHeader: { ...typeStyle("labelSmall"), marginBottom: 10 },
  confirmListRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  confirmListCheck: { ...typeStyle("bodyLarge"), fontFamily: "Inter_700Bold" },
  confirmListText: { ...typeStyle("bodyLarge") },

  // MD3 restyle additions
  stepDotsRow: { flexDirection: "row", gap: 6, marginTop: 16, alignItems: "center" },
  stepDot: { height: 6 },
  primaryBtnContent: { height: 52 },
  typeOptionContent: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  typeOptionIconTile: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  typeOptionIconText: { fontSize: 22 },
  paperInput: { marginBottom: 2 },
  regionNumChip: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  districtChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 28, marginTop: 4 },
  districtChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4 },
  districtChipInput: { ...typeStyle("labelLarge"), minWidth: 40, padding: 0 },
  teamEmptyState: { borderWidth: 1, padding: 24, alignItems: "center", gap: 6 },
  teamEmptyIcon: { fontSize: 32, marginBottom: 4 },
  teamEmptyTitle: { ...typeStyle("titleMedium") },
  teamEmptySubtitle: { ...typeStyle("bodySmall"), textAlign: "center" },
  memberCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
});
