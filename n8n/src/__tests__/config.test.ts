import { getApiEndpoints, getDefaultInstanceColor, DEFAULT_INSTANCE_COLORS, CACHE_KEY, INSTANCE_CACHE_KEY, TAGS_CACHE_KEY } from "../config";
import { N8nInstance } from "../types";

describe("Configuration utilities", () => {
  describe("getApiEndpoints", () => {
    const mockInstance: N8nInstance = {
      id: "test",
      name: "Test Instance",
      baseUrl: "https://n8n.example.com",
      apiKey: "test-key"
    };

    it("should generate correct API endpoints", () => {
      const endpoints = getApiEndpoints(mockInstance);
      expect(endpoints.workflows).toBe("https://n8n.example.com/api/v1/workflows");
      expect(endpoints.tags).toBe("https://n8n.example.com/api/v1/tags");
      expect(endpoints.workflowUrl("123")).toBe("https://n8n.example.com/workflow/123");
    });

    it("should handle URLs with trailing slashes", () => {
      const instanceWithSlash = {
        ...mockInstance,
        baseUrl: "https://n8n.example.com/"
      };
      const endpoints = getApiEndpoints(instanceWithSlash);
      expect(endpoints.workflows).toBe("https://n8n.example.com/api/v1/workflows");
    });

    it("should handle URLs with multiple trailing slashes", () => {
      const instanceWithSlashes = {
        ...mockInstance,
        baseUrl: "https://n8n.example.com////"
      };
      const endpoints = getApiEndpoints(instanceWithSlashes);
      expect(endpoints.workflows).toBe("https://n8n.example.com/api/v1/workflows");
    });

    it("should handle URLs without protocol", () => {
      const instanceNoProtocol = {
        ...mockInstance,
        baseUrl: "n8n.example.com"
      };
      const endpoints = getApiEndpoints(instanceNoProtocol);
      expect(endpoints.workflows).toBe("n8n.example.com/api/v1/workflows");
    });

    it("should handle URLs with ports", () => {
      const instanceWithPort = {
        ...mockInstance,
        baseUrl: "http://localhost:5678/"
      };
      const endpoints = getApiEndpoints(instanceWithPort);
      expect(endpoints.workflows).toBe("http://localhost:5678/api/v1/workflows");
    });

    it("should handle URLs with paths", () => {
      const instanceWithPath = {
        ...mockInstance,
        baseUrl: "https://example.com/n8n/"
      };
      const endpoints = getApiEndpoints(instanceWithPath);
      expect(endpoints.workflows).toBe("https://example.com/n8n/api/v1/workflows");
    });

    it("should handle special characters in workflow IDs", () => {
      const endpoints = getApiEndpoints(mockInstance);
      expect(endpoints.workflowUrl("123-456")).toBe("https://n8n.example.com/workflow/123-456");
      expect(endpoints.workflowUrl("test_workflow")).toBe("https://n8n.example.com/workflow/test_workflow");
      expect(endpoints.workflowUrl("workflow@123")).toBe("https://n8n.example.com/workflow/workflow@123");
    });
  });

  describe("getDefaultInstanceColor", () => {
    it("should return colors in sequence", () => {
      expect(getDefaultInstanceColor(0)).toBe(DEFAULT_INSTANCE_COLORS[0]);
      expect(getDefaultInstanceColor(1)).toBe(DEFAULT_INSTANCE_COLORS[1]);
    });

    it("should wrap around when index exceeds color array length", () => {
      const colorCount = DEFAULT_INSTANCE_COLORS.length;
      expect(getDefaultInstanceColor(colorCount)).toBe(DEFAULT_INSTANCE_COLORS[0]);
      expect(getDefaultInstanceColor(colorCount + 1)).toBe(DEFAULT_INSTANCE_COLORS[1]);
    });

    it("should handle negative indices", () => {
      const lastColor = DEFAULT_INSTANCE_COLORS[DEFAULT_INSTANCE_COLORS.length - 1];
      expect(getDefaultInstanceColor(-1)).toBe(lastColor);
      expect(getDefaultInstanceColor(-DEFAULT_INSTANCE_COLORS.length)).toBe(DEFAULT_INSTANCE_COLORS[0]);
      expect(getDefaultInstanceColor(-DEFAULT_INSTANCE_COLORS.length - 1)).toBe(lastColor);
    });

    it("should handle large numbers", () => {
      const largeNumber = 1000000;
      const expectedIndex = largeNumber % DEFAULT_INSTANCE_COLORS.length;
      expect(getDefaultInstanceColor(largeNumber)).toBe(DEFAULT_INSTANCE_COLORS[expectedIndex]);
    });

    it("should handle Number.MAX_SAFE_INTEGER", () => {
      expect(() => getDefaultInstanceColor(Number.MAX_SAFE_INTEGER)).not.toThrow();
    });
  });

  describe("Cache Keys", () => {
    it("should have correct format", () => {
      expect(CACHE_KEY).toMatch(/^designLogicSolutions\.n8n\./);
      expect(INSTANCE_CACHE_KEY).toMatch(/^designLogicSolutions\.n8n\./);
      expect(TAGS_CACHE_KEY).toMatch(/^designLogicSolutions\.n8n\./);
    });

    it("should have version numbers", () => {
      expect(CACHE_KEY).toMatch(/v\d+$/);
      expect(INSTANCE_CACHE_KEY).toMatch(/v\d+$/);
      expect(TAGS_CACHE_KEY).toMatch(/v\d+$/);
    });

    it("should be unique", () => {
      const keys = new Set([CACHE_KEY, INSTANCE_CACHE_KEY, TAGS_CACHE_KEY]);
      expect(keys.size).toBe(3);
    });
  });
});
