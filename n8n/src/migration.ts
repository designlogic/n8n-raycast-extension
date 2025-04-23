import { Cache, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { CACHE_KEY, INSTANCE_CACHE_KEY } from "./config";
import { N8nInstance, Preferences } from "./types";
import { generateInstanceId } from "./utils";

interface LegacyPreferences {
  apiKey: string;
  baseUrl: string;
}

interface MigrationState {
  migrated: boolean;
  timestamp: string;
  legacyBaseUrl?: string;
}

async function showMigrationToast(style: Toast.Style, title: string, message?: string): Promise<boolean> {
  try {
    await showToast({ style, title, message });
    return true;
  } catch (error) {
    console.error("Toast error:", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
}

export async function migrateToMultiInstance(): Promise<boolean> {
  const cache = new Cache();
  
  try {
    // Check if we're already using new preferences
    const newPrefs = getPreferenceValues<Preferences>();
    if (newPrefs?.instances) {
      return false; // Already using new format
    }

    // Attempt to get legacy preferences
    const prefs = getPreferenceValues<LegacyPreferences>();
    if (!prefs?.apiKey || !prefs?.baseUrl || !prefs.baseUrl.trim()) {
      return false;
    }

    // Show initial toast
    if (!await showMigrationToast(Toast.Style.Animated, "Migrating configuration...")) {
      return false;
    }

    // Store migration state
    const migrationState: MigrationState = {
      migrated: true,
      timestamp: new Date().toISOString(),
      legacyBaseUrl: prefs.baseUrl
    };

    try {
      await cache.set(INSTANCE_CACHE_KEY, JSON.stringify(migrationState));
    } catch (error) {
      console.error("Migration error:", error instanceof Error ? error.message : "Unknown error");
      await showMigrationToast(
        Toast.Style.Failure,
        "Migration Failed",
        "Failed to save migration state"
      );
      return false;
    }

    let success = true;
    // Clear old cache
    try {
      const oldCache = await cache.get(CACHE_KEY);
      if (oldCache) {
        await cache.remove(CACHE_KEY);
      }
    } catch (error) {
      success = false;
      console.error("Migration error:", error instanceof Error ? error.message : "Unknown error");
      await showMigrationToast(
        Toast.Style.Failure,
        "Migration Failed",
        "Failed to clear old cache"
      );
    }

    if (!success) return false;

    if (!await showMigrationToast(
      Toast.Style.Success,
      "Migration Complete",
      "Please update your instance configuration in preferences"
    )) {
      return false;
    }

    return true;

  } catch (error) {
    console.error("Migration error:", error instanceof Error ? error.message : "Unknown error");
    await showMigrationToast(
      Toast.Style.Failure,
      "Migration Failed",
      "Please configure your n8n instances manually"
    );
    return false;
  }
}

export async function checkMigrationNeeded(): Promise<boolean> {
  const cache = new Cache();
  try {
    const migrationState = await cache.get(INSTANCE_CACHE_KEY);
    if (!migrationState) {
      return true;
    }
    
    try {
      const state = JSON.parse(migrationState) as MigrationState;
      return !state.migrated;
    } catch (error) {
      console.error("Migration state parse error:", error instanceof Error ? error.message : "Unknown error");
      return true;
    }
  } catch (error) {
    console.error("Migration check error:", error instanceof Error ? error.message : "Unknown error");
    return true;
  }
}
