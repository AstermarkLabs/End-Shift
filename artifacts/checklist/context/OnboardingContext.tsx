import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface District {
  id: string;
  name: string;
}

export interface Region {
  id: string;
  name: string;
  districts: District[];
}

export interface OrgLocation {
  id: string;
  name: string;
  regionId: string;
  districtId: string;
}

export interface TeamMember {
  id: string;
  email: string;
  role: string;
  scope?: string;
}

export interface OnboardingSettings {
  showRegionsStep: boolean;
  showLocationsStep: boolean;
  showTeamStep: boolean;
}

interface OnboardingState {
  completed: boolean;
  businessType: "single-unit" | "multi-unit";
  regions: Region[];
  locations: OrgLocation[];
  teamMembers: TeamMember[];
  settings: OnboardingSettings;
}

interface OnboardingContextValue {
  onboardingCompleted: boolean;
  businessType: "single-unit" | "multi-unit";
  regions: Region[];
  locations: OrgLocation[];
  teamMembers: TeamMember[];
  settings: OnboardingSettings;

  setBusinessType: (t: "single-unit" | "multi-unit") => void;

  // Regions & districts
  addRegion: (name: string) => void;
  updateRegion: (id: string, name: string) => void;
  removeRegion: (id: string) => void;
  addDistrict: (regionId: string, name: string) => void;
  updateDistrict: (regionId: string, districtId: string, name: string) => void;
  removeDistrict: (regionId: string, districtId: string) => void;

  // Locations
  addLocation: (name: string, regionId: string, districtId: string) => void;
  updateLocation: (id: string, name: string) => void;
  removeLocation: (id: string) => void;

  // Team
  addTeamMember: (email: string, role: string, scope?: string) => void;
  updateTeamMember: (id: string, updates: Partial<Omit<TeamMember, "id">>) => void;
  removeTeamMember: (id: string) => void;

  // Settings
  updateSettings: (updates: Partial<OnboardingSettings>) => void;

  // Completion
  markComplete: () => void;
  reset: () => void;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "@end_shift_onboarding";

const DEFAULT_SETTINGS: OnboardingSettings = {
  showRegionsStep: true,
  showLocationsStep: true,
  showTeamStep: true,
};

const DEFAULT_STATE: OnboardingState = {
  completed: false,
  businessType: "single-unit",
  regions: [],
  locations: [],
  teamMembers: [],
  settings: DEFAULT_SETTINGS,
};

// ─── ID generation ────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Context ──────────────────────────────────────────────────────────────────

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<OnboardingState>;
          setState((prev) => ({
            ...prev,
            ...parsed,
            settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          }));
        } catch {}
      }
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setBusinessType = useCallback((t: "single-unit" | "multi-unit") => {
    setState((prev) => ({ ...prev, businessType: t }));
  }, []);

  // ── Regions ───────────────────────────────────────────────────────────────

  const addRegion = useCallback((name: string) => {
    setState((prev) => ({
      ...prev,
      regions: [...prev.regions, { id: uid(), name, districts: [] }],
    }));
  }, []);

  const updateRegion = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      regions: prev.regions.map((r) => (r.id === id ? { ...r, name } : r)),
    }));
  }, []);

  const removeRegion = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      regions: prev.regions.filter((r) => r.id !== id),
      locations: prev.locations.filter((l) => l.regionId !== id),
    }));
  }, []);

  const addDistrict = useCallback((regionId: string, name: string) => {
    setState((prev) => ({
      ...prev,
      regions: prev.regions.map((r) =>
        r.id === regionId
          ? { ...r, districts: [...r.districts, { id: uid(), name }] }
          : r,
      ),
    }));
  }, []);

  const updateDistrict = useCallback(
    (regionId: string, districtId: string, name: string) => {
      setState((prev) => ({
        ...prev,
        regions: prev.regions.map((r) =>
          r.id === regionId
            ? {
                ...r,
                districts: r.districts.map((d) =>
                  d.id === districtId ? { ...d, name } : d,
                ),
              }
            : r,
        ),
      }));
    },
    [],
  );

  const removeDistrict = useCallback((regionId: string, districtId: string) => {
    setState((prev) => ({
      ...prev,
      regions: prev.regions.map((r) =>
        r.id === regionId
          ? { ...r, districts: r.districts.filter((d) => d.id !== districtId) }
          : r,
      ),
      locations: prev.locations.filter((l) => l.districtId !== districtId),
    }));
  }, []);

  // ── Locations ─────────────────────────────────────────────────────────────

  const addLocation = useCallback(
    (name: string, regionId: string, districtId: string) => {
      setState((prev) => ({
        ...prev,
        locations: [...prev.locations, { id: uid(), name, regionId, districtId }],
      }));
    },
    [],
  );

  const updateLocation = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      locations: prev.locations.map((l) => (l.id === id ? { ...l, name } : l)),
    }));
  }, []);

  const removeLocation = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      locations: prev.locations.filter((l) => l.id !== id),
    }));
  }, []);

  // ── Team ──────────────────────────────────────────────────────────────────

  const addTeamMember = useCallback(
    (email: string, role: string, scope?: string) => {
      setState((prev) => ({
        ...prev,
        teamMembers: [...prev.teamMembers, { id: uid(), email, role, scope }],
      }));
    },
    [],
  );

  const updateTeamMember = useCallback(
    (id: string, updates: Partial<Omit<TeamMember, "id">>) => {
      setState((prev) => ({
        ...prev,
        teamMembers: prev.teamMembers.map((m) =>
          m.id === id ? { ...m, ...updates } : m,
        ),
      }));
    },
    [],
  );

  const removeTeamMember = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.filter((m) => m.id !== id),
    }));
  }, []);

  // ── Settings ──────────────────────────────────────────────────────────────

  const updateSettings = useCallback((updates: Partial<OnboardingSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }));
  }, []);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  const markComplete = useCallback(() => {
    setState((prev) => ({ ...prev, completed: true }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...DEFAULT_STATE, settings: state.settings });
  }, [state.settings]);

  return (
    <OnboardingContext.Provider
      value={{
        onboardingCompleted: state.completed,
        businessType: state.businessType,
        regions: state.regions,
        locations: state.locations,
        teamMembers: state.teamMembers,
        settings: state.settings,
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
        updateSettings,
        markComplete,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
