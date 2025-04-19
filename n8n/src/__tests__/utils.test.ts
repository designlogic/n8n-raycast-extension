import { filterItems, formatWorkflowData, generateInstanceId } from "../utils";
import { WorkflowItem, N8nInstance } from "../types";

describe("generateInstanceId", () => {
  it("should generate consistent IDs for URLs", () => {
    expect(generateInstanceId("https://n8n.example.com")).toBe("https_n8n_example_com");
    expect(generateInstanceId("http://localhost:5678")).toBe("http_localhost_5678");
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

  it("should format workflow data correctly", () => {
    const workflow = {
      id: "123",
      name: "Test Workflow",
      active: true,
      tags: [{ name: "tag1" }, { name: "tag2" }]
    };

    const formatted = formatWorkflowData(workflow, mockInstance);

    expect(formatted).toEqual({
      id: "123",
      instanceId: "test_instance",
      instanceName: "Test Instance",
      instanceColor: "#FF0000",
      icon: { source: "list-icon.svg" },
      title: "Test Workflow",
      subtitle: "Test Instance • Active",
      accessory: "tag1, tag2",
      keywords: ["Test Instance", "tag1", "tag2"]
    });
  });
});

describe("filterItems", () => {
  const mockItems: WorkflowItem[] = [
    {
      id: "1",
      instanceId: "instance1",
      instanceName: "Instance 1",
      title: "Workflow 1",
      subtitle: "Active",
      accessory: "tag1",
      keywords: ["Instance 1", "tag1"],
      icon: { source: "icon.svg" }
    },
    {
      id: "2",
      instanceId: "instance2",
      instanceName: "Instance 2",
      title: "Workflow 2",
      subtitle: "Active",
      accessory: "tag2",
      keywords: ["Instance 2", "tag2"],
      icon: { source: "icon.svg" }
    }
  ];

  it("should filter by search text", () => {
    const filtered = filterItems(mockItems, "Workflow 1", null, null);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("should filter by tag", () => {
    const filtered = filterItems(mockItems, "", "tag2", null);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("2");
  });

  it("should filter by instance", () => {
    const filtered = filterItems(mockItems, "", null, "instance1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].instanceId).toBe("instance1");
  });
});
