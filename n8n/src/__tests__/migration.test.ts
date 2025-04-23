import { Cache, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { migrateToMultiInstance, checkMigrationNeeded } from "../migration";
import { INSTANCE_CACHE_KEY, CACHE_KEY } from "../config";

// Mock console.error to avoid test output pollution
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe("Migration Utilities", () => {
  let mockCache: jest.Mocked<Cache>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    } as any;

    (Cache as jest.Mock).mockImplementation(() => mockCache);
    (showToast as jest.Mock).mockImplementation(() => Promise.resolve());
  });

  describe("checkMigrationNeeded", () => {
    it("should return true when no migration state exists", async () => {
      mockCache.get.mockResolvedValue(null);
      const result = await checkMigrationNeeded();
      expect(result).toBe(true);
    });

    it("should return false when migration is already complete", async () => {
      mockCache.get.mockResolvedValue(JSON.stringify({
        migrated: true,
        timestamp: new Date().toISOString(),
      }));
      const result = await checkMigrationNeeded();
      expect(result).toBe(false);
    });

    it("should handle invalid JSON in cache", async () => {
      mockCache.get.mockResolvedValue("invalid-json-data");
      const result = await checkMigrationNeeded();
      expect(result).toBe(true);
      expect(console.error).toHaveBeenCalledWith(
        "Migration state parse error:",
        expect.any(String)
      );
    });

    it("should handle cache read errors", async () => {
      mockCache.get.mockRejectedValue(new Error("Cache read error"));
      const result = await checkMigrationNeeded();
      expect(result).toBe(true);
      expect(console.error).toHaveBeenCalledWith(
        "Migration check error:",
        "Cache read error"
      );
    });
  });

  describe("migrateToMultiInstance", () => {
    const mockLegacyPrefs = {
      apiKey: "test-key",
      baseUrl: "https://n8n.test.com",
    };

    beforeEach(() => {
      (getPreferenceValues as jest.Mock).mockReturnValue(mockLegacyPrefs);
      mockCache.get.mockResolvedValue(null);
    });

    it("should migrate legacy preferences successfully", async () => {
      const result = await migrateToMultiInstance();
      expect(result).toBe(true);
      
      // Verify toast sequence
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          style: Toast.Style.Animated,
          title: "Migrating configuration...",
        })
      );
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          style: Toast.Style.Success,
          title: "Migration Complete",
        })
      );

      // Verify cache operations
      expect(mockCache.set).toHaveBeenCalledWith(
        INSTANCE_CACHE_KEY,
        expect.stringContaining(mockLegacyPrefs.baseUrl)
      );
      expect(mockCache.get).toHaveBeenCalledWith(CACHE_KEY);
    });

    it("should handle already migrated preferences", async () => {
      (getPreferenceValues as jest.Mock)
        .mockReturnValueOnce({ instances: [] }) // new prefs check
        .mockReturnValueOnce(mockLegacyPrefs);  // legacy prefs check

      const result = await migrateToMultiInstance();
      expect(result).toBe(false);
      expect(showToast).not.toHaveBeenCalled();
    });

    it("should handle missing or invalid legacy preferences", async () => {
      const invalidPrefs = [
        {},
        { apiKey: "key" },
        { baseUrl: "url" },
        { apiKey: "", baseUrl: "" },
        { apiKey: "key", baseUrl: "" },
        { apiKey: "key", baseUrl: "   " },
      ];

      for (const prefs of invalidPrefs) {
        (getPreferenceValues as jest.Mock)
          .mockReturnValueOnce(undefined) // new prefs check
          .mockReturnValueOnce(prefs);    // legacy prefs check

        const result = await migrateToMultiInstance();
        expect(result).toBe(false);
      }
    });

    it("should handle cache set errors", async () => {
      mockCache.set.mockRejectedValue(new Error("Cache write error"));
      const result = await migrateToMultiInstance();
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "Migration error:",
        "Cache write error"
      );
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          style: Toast.Style.Failure,
          title: "Migration Failed",
        })
      );
    });

    it("should handle toast errors gracefully", async () => {
      (showToast as jest.Mock).mockRejectedValue(new Error("Toast error"));
      const result = await migrateToMultiInstance();
      
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "Toast error:",
        "Toast error"
      );
    });

    it("should clear old cache after successful migration", async () => {
      mockCache.get.mockResolvedValue("old-cache-data");
      await migrateToMultiInstance();
      
      expect(mockCache.remove).toHaveBeenCalledWith(CACHE_KEY);
    });

    it("should handle cache remove errors gracefully", async () => {
      mockCache.get.mockResolvedValue("old-cache-data");
      mockCache.remove.mockRejectedValue(new Error("Remove error"));
      
      const result = await migrateToMultiInstance();
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "Migration error:",
        "Remove error"
      );
    });
  });
});
