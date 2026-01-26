export const DEFAULT_LVR_THRESHOLDS = [80, 60, 40, 20] as const;
export const DEFAULT_EQUITY_THRESHOLDS = [100000, 250000, 500000, 1000000] as const;

export interface ThresholdConfig {
  lvrThresholds: number[];
  equityThresholds: number[];
  enabled: boolean;
}

export interface GlobalPrefs {
  lvrThresholds: number[];
  equityThresholds: number[];
  enabled: boolean;
}

export interface PropertyOverride {
  lvrThresholds: number[] | null;
  equityThresholds: number[] | null;
  enabled: boolean | null;
}

export function resolveThresholds(
  globalPrefs: GlobalPrefs | null,
  propertyOverride: PropertyOverride | null
): ThresholdConfig {
  // Start with system defaults
  let config: ThresholdConfig = {
    lvrThresholds: [...DEFAULT_LVR_THRESHOLDS],
    equityThresholds: [...DEFAULT_EQUITY_THRESHOLDS],
    enabled: true,
  };

  // Apply global preferences
  if (globalPrefs) {
    config = {
      lvrThresholds: globalPrefs.lvrThresholds,
      equityThresholds: globalPrefs.equityThresholds,
      enabled: globalPrefs.enabled,
    };
  }

  // Apply property overrides (null means inherit)
  if (propertyOverride) {
    if (propertyOverride.lvrThresholds !== null) {
      config.lvrThresholds = propertyOverride.lvrThresholds;
    }
    if (propertyOverride.equityThresholds !== null) {
      config.equityThresholds = propertyOverride.equityThresholds;
    }
    if (propertyOverride.enabled !== null) {
      config.enabled = propertyOverride.enabled;
    }
  }

  return config;
}
