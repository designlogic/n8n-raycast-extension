import { Cache, getPreferenceValues, showToast } from "@raycast/api";
import { migrateToMultiInstance, checkMigrationNeeded } from "../migration";
import { INSTANCE_CACHE_KEY } from "../config";

// Mock @raycast/api
jest.mock("@raycast/api", () => ({
  Cache: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  })),
  getPreferenceValues: jest.fn(),
  showToast: jest.fn(),
  Toast: {
    Style: {
      Animated: "animated",
      Success: "success",
      Failure: "failure",
    },
  },
}));

describe("Migration Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkMigrationNeeded", () => {
    it("should return true when no migration state exists", async () => {
      const mockCache = new Cache();
      (mockCache.get as jest.Mock).mockResolvedValue(null);

      const result = await checkMigrationNeeded();
      expect(result).toBe(true);
    });

    it("should return false when migration is already complete", async () => {
      const mockCache = new Cache();
      (mockCache.get as jest.Mock).mockResolvedValue(JSON.stringify({
        migrated: true,
        timestamp: new Date().toISOString(),
      }));

      const result = await checkMigrationNeeded();
      expect(result).toBe(false);
    });
  });

  describe("migrateToMultiInstance", () => {
    it("should migrate legacy preferences to new format", async () => {
      const mockLegacyPrefs = {
        apiKey: "test-key",
        baseUrl: "https://n8n.test.com",
      };

      (getPreferenceValues as jest.Mock).mockReturnValue(mockLegacyPrefs);

      const result = await migrateToMultiInstance();

      expect(result).toBe(true);
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Migration Complete",
        })
      );
    });

    it("should handle missing legacy preferences", async () => {
      (getPreferenceValues as jest.Mock).mockReturnValue({});

      const result = await migrateToMultiInstance();

      expect(result).toBe(false);
      expect(showToast).not.toHaveBeenCalled();
    });

    it("should handle migration errors", async () => {
      (getPreferenceValues as jest.Mock).mockImplementation(() => {
        throw new Error("Test error");
      });

      const result = await migrateToMultiInstance();

      expect(result).toBe(false);
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Migration Failed",
        })
      );
    });
  });
});
