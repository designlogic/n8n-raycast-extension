import { filterItems, formatWorkflowData, generateInstanceId, sortAlphabetically, getCacheKeyForInstance } from "../utils";
import { WorkflowItem, N8nInstance } from "../types";

describe("sortAlphabetically", () => {
  it("should sort items by title case-insensitively", () => {
    const items: WorkflowItem[] = [
      { id: "1", title: "zebra", instanceId: "1", instanceName: "Test", subtitle: "", accessory: "", keywords: [], icon: { source: "" } },
      { id: "2", title: "Alpha", instanceId: "1", instanceName: "Test", subtitle: "", accessory: "", keywords: [], icon: { source: "" } },
      { id: "3", title: "BETA", instanceId: "1", instanceName: "Test", subtitle: "", accessory: "", keywords: [], icon: { source: "" } }
    ];

    const sorted = sortAlphabetically(items);
    expect(sorted.map(i => i.title)).toEqual(["Alpha", "BETA", "zebra"]);
  });

  it("should handle special characters and numbers", () => {
    const items: WorkflowItem[] = [
      { id: "1", title: "!Special", instanceId: "1", instanceName: "Test", subtitle: "", accessory: "", keywords: [], icon: { source: "" } },
      { id: "2", title: "@Test", instanceId: "1", instanceName: "Test", subtitle: "", accessory: "", keywords: [], icon: { source: "" } },
      { id: "3", title: "123", instanceId: "1", instanceName: "Test", subtitle: "", accessory: "", keywords: [], icon: { source: "" } }
    ];

    const sorted = sortAlphabetically(items);
    const titles = sorted.map(i => i.title);
    expect(titles.indexOf("123")).toBeGreaterThan(-1);
    expect(titles.indexOf("!Special")).toBeGreaterThan(-1);
    expect(titles.indexOf("@Test")).toBeGreaterThan(-1);
  });

  it("should handle empty array", () => {
    expect(sortAlphabetically([])).toEqual([]);
  });

  it("should handle identical titles", () => {
    const items: WorkflowItem[] = [
      { id: "1", title: "Same", instanceId: "1", instanceName: "Test", subtitle: "", accessory: "", keywords: [], icon: { source: "" } },
      { id: "2", title: "Same", instanceId: "1", instanceName: "Test", subtitle: "", accessory: "", keywords: [], icon: { source: "" } }
    ];
    const sorted = sortAlphabetically(items);
    expect(sorted).toHaveLength(2);
    expect(sorted[0].title).toBe("Same");
    expect(sorted[1].title).toBe("Same");
  });
});

describe("generateInstanceId", () => {
  it("should handle various URL formats", () => {
    expect(generateInstanceId("https://n8n.example.com")).toBe("n8n_example_com");
    expect(generateInstanceId("http://localhost:5678")).toBe("localhost_5678");
    expect(generateInstanceId("n8n.internal:8080")).toBe("n8n_internal_8080");
    expect(generateInstanceId("https://n8n.example.com/path/to/n8n")).toBe("n8n_example_com_path_to_n8n");
  });

  it("should handle special characters", () => {
    expect(generateInstanceId("https://n8n!@#$%^&*()company.com")).toBe("n8n_company_com");
    expect(generateInstanceId("https://n8n_test-server.com")).toBe("n8n_test_server_com");
    expect(generateInstanceId("https://n8n.company.internal.local")).toBe("n8n_company_internal_local");
  });

  it("should handle edge cases", () => {
    expect(generateInstanceId("")).toBe("");
    expect(generateInstanceId(" ")).toBe("");
    expect(generateInstanceId("https://")).toBe("");
    expect(generateInstanceId("   https://example.com   ")).toBe("example_com");
  });
});

describe("formatWorkflowData", () => {
  const mockInstance: N8nInstance = {
    id: "test_instance",
    name: "Test Instance",
    baseUrl: "https://test.n8n.com",
    apiKey: "test-key",
    color: "#FF0000"
  };

  it("should handle workflows with various tag combinations", () => {
    const workflows = [
      {
        id: "1",
        name: "Test 1",
        active: true,
        tags: [{ name: "tag1" }, { name: "tag2" }]
      },
      {
        id: "2",
        name: "Test 2",
        active: false,
        tags: []
      },
      {
        id: "3",
        name: "Test 3",
        active: true,
        tags: [{ name: "" }]
      },
      {
        id: "4",
        name: "Test 4",
        active: true,
        tags: [{ name: "  " }]
      },
      {
        id: "5",
        name: "Test 5",
        active: true,
        tags: [{ name: "tag1" }, { name: "  " }, { name: "tag2" }]
      }
    ];

    const formatted = workflows.map(w => formatWorkflowData(w, mockInstance));
    expect(formatted[0].accessory).toBe("tag1, tag2");
    expect(formatted[1].accessory).toBe("No Tags");
    expect(formatted[2].accessory).toBe("No Tags");
    expect(formatted[3].accessory).toBe("No Tags");
    expect(formatted[4].accessory).toBe("tag1, tag2");
  });

  it("should handle special characters in workflow names and tags", () => {
    const workflow = {
      id: "123",
      name: "Test!@#$%^&*()",
      active: true,
      tags: [{ name: "tag!@#" }, { name: "tag$%^" }]
    };

    const formatted = formatWorkflowData(workflow, mockInstance);
    expect(formatted.title).toBe("Test!@#$%^&*()");
    expect(formatted.keywords).toContain("tag!@#");
    expect(formatted.keywords).toContain("tag$%^");
  });

  it("should handle undefined tags", () => {
    const workflow = {
      id: "123",
      name: "Test",
      active: true,
      tags: undefined
    };

    const formatted = formatWorkflowData(workflow, mockInstance);
    expect(formatted.accessory).toBe("No Tags");
    expect(formatted.keywords).toEqual([mockInstance.name]);
  });

  it("should handle null tags", () => {
    const workflow = {
      id: "123",
      name: "Test",
      active: true,
      tags: null as any
    };

    const formatted = formatWorkflowData(workflow, mockInstance);
    expect(formatted.accessory).toBe("No Tags");
    expect(formatted.keywords).toEqual([mockInstance.name]);
  });
});

describe("filterItems", () => {
  const mockItems: WorkflowItem[] = [
    {
      id: "1",
      instanceId: "instance1",
      instanceName: "Instance 1",
      title: "Workflow !@#$",
      subtitle: "Active",
      accessory: "tag!@#",
      keywords: ["Instance 1", "tag!@#", "special"],
      icon: { source: "icon.svg" }
    },
    {
      id: "2",
      instanceId: "instance2",
      instanceName: "Instance 2",
      title: "123 Workflow",
      subtitle: "Active",
      accessory: "tag123",
      keywords: ["Instance 2", "tag123", "numbers"],
      icon: { source: "icon.svg" }
    }
  ];

  it("should handle special characters in search", () => {
    const filtered = filterItems(mockItems, "!@#", null, null);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("should handle numeric search terms", () => {
    const filtered = filterItems(mockItems, "123", null, null);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("2");
  });

  it("should handle empty search with filters", () => {
    const filtered = filterItems(mockItems, "", "special", "instance1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("should handle no matches", () => {
    const filtered = filterItems(mockItems, "nonexistent", null, null);
    expect(filtered).toHaveLength(0);
  });

  it("should handle case insensitive search", () => {
    const filtered = filterItems(mockItems, "WORKFLOW", null, null);
    expect(filtered).toHaveLength(2);
  });

  it("should handle whitespace in search", () => {
    const filtered = filterItems(mockItems, "  Workflow  ", null, null);
    expect(filtered).toHaveLength(2);
  });

  it("should handle all filters simultaneously", () => {
    const filtered = filterItems(mockItems, "Workflow", "special", "instance1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("should handle no filters", () => {
    const filtered = filterItems(mockItems, "", null, null);
    expect(filtered).toHaveLength(2);
  });

  it("should handle empty keywords array", () => {
    const itemsWithEmptyKeywords = [{
      ...mockItems[0],
      keywords: []
    }];
    const filtered = filterItems(itemsWithEmptyKeywords, "special", null, null);
    expect(filtered).toHaveLength(0);
  });
});

describe("getCacheKeyForInstance", () => {
  it("should handle various instance ID formats", () => {
    expect(getCacheKeyForInstance("test-instance")).toBe("designLogicSolutions.n8n.workflows.test-instance.v1");
    expect(getCacheKeyForInstance("UPPERCASE")).toBe("designLogicSolutions.n8n.workflows.UPPERCASE.v1");
    expect(getCacheKeyForInstance("special!@#$%^&*()")).toBe("designLogicSolutions.n8n.workflows.special!@#$%^&*().v1");
    expect(getCacheKeyForInstance("")).toBe("designLogicSolutions.n8n.workflows..v1");
  });

  it("should maintain consistent format", () => {
    const key = getCacheKeyForInstance("test");
    expect(key).toMatch(/^designLogicSolutions\.n8n\.workflows\.[^.]+\.v1$/);
  });
});
