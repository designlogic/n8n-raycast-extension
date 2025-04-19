import { Cache, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { CACHE_KEY, INSTANCE_CACHE_KEY } from "./config";
import { N8nInstance, Preferences } from "./types";
import { generateInstanceId } from "./utils";

interface LegacyPreferences {
  apiKey: string;
  baseUrl: string;
}

export async function migrateToMultiInstance(): Promise<boolean> {
  const cache = new Cache();
  
  try {
    // Attempt to get legacy preferences
    const prefs = getPreferenceValues<LegacyPreferences>();
    
    if (prefs.apiKey && prefs.baseUrl) {
      // User has legacy configuration
      await showToast({
        style: Toast.Style.Animated,
        title: "Migrating configuration...",
      });

      // Create new instance from legacy config
      const defaultInstance: N8nInstance = {
        id: generateInstanceId(prefs.baseUrl),
        name: "Default",
        baseUrl: prefs.baseUrl,
        apiKey: prefs.apiKey,
        color: "#FF6B6B" // Default color
      };

      // Clear old cache
      const oldCache = await cache.get(CACHE_KEY);
      if (oldCache) {
        await cache.remove(CACHE_KEY);
      }

      // Store migration state
      await cache.set(INSTANCE_CACHE_KEY, JSON.stringify({
        migrated: true,
        timestamp: new Date().toISOString(),
        legacyBaseUrl: prefs.baseUrl
      }));

      await showToast({
        style: Toast.Style.Success,
        title: "Migration Complete",
        message: "Please update your instance configuration in preferences"
      });

      return true;
    }

    // Check if we're already using new preferences
    const newPrefs = getPreferenceValues<Preferences>();
    if (newPrefs.instances) {
      return false; // Already using new format
    }

  } catch (error) {
    console.error("Migration error:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Migration Failed",
      message: "Please configure your n8n instances manually"
    });
  }

  return false;
}

export async function checkMigrationNeeded(): Promise<boolean> {
  const cache = new Cache();
  const migrationState = await cache.get(INSTANCE_CACHE_KEY);
  
  if (migrationState) {
    const state = JSON.parse(migrationState);
    return !state.migrated;
  }
  
  return true;
}
