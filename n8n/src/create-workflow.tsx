import { showToast, Toast, openCommandPreferences, open, Cache, Form, ActionPanel, Action, Icon } from "@raycast/api";
import fetch from "node-fetch";
import React, { useState } from "react";
import { N8nInstance } from "./types";
import { getApiEndpoints, CACHE_KEY } from "./config";
import { InstanceSelector } from "./components";

interface StoredInstance extends N8nInstance {
  id: string;
}

interface FormValues {
  name: string;
}

// Export a Command component directly as required by Raycast
export default function Command() {
  const [selectedInstance, setSelectedInstance] = useState<StoredInstance | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [nameFieldTouched, setNameFieldTouched] = useState<boolean>(false);
  const [values, setValues] = useState<FormValues>({ name: "" });

  const handleSubmit = async (values: FormValues) => {
    // Use name from form values
    const name = values.name.trim();
    const cache = new Cache();
    
    setIsCreating(true);

    try {
      // Name validation is handled by form error display, but double check
      if (!name) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Name is required",
        });
        setIsCreating(false);
        return;
      }

      if (!selectedInstance) {
        await showToast({
          style: Toast.Style.Failure,
          title: "No Instance Selected",
          message: "Please select an n8n instance"
        });
        setIsCreating(false);
        return;
      }
      const API_ENDPOINTS = getApiEndpoints(selectedInstance);
      
      // Create toast object before entering try/catch to ensure it's in scope
      let toast = await showToast({
        style: Toast.Style.Animated,
        title: `Creating workflow in ${selectedInstance.name}...`,
        message: `Creating workflow named "${name}"`
      });
      const requestBody = {
        name,
        nodes: [],
        connections: {
          main: []
        },
        settings: {
          saveExecutionProgress: true,
          saveManualExecutions: true,
          saveDataErrorExecution: "all",
          saveDataSuccessExecution: "all",
          executionTimeout: 3600
        },
        staticData: {}
      };

      const response = await fetch(API_ENDPOINTS.workflows, {
        method: "POST",
        headers: {
          "X-N8N-API-KEY": selectedInstance.apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? `Invalid API key for instance ${selectedInstance.name}. Please check your API key in instance settings.`
            : `Failed to create workflow: ${response.statusText}`
        );
      }

      const data = JSON.parse(responseText) as { id: string };

      // Clear the cache so the new workflow shows up in search
      await cache.remove(CACHE_KEY);

      toast.style = Toast.Style.Success;
      toast.title = "Workflow created";
      toast.message = `Opening ${name} in ${selectedInstance.name}`;

      await new Promise((resolve) => setTimeout(resolve, 1000));
      const url = API_ENDPOINTS.workflowUrl(data.id);
      await open(url);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to create workflow";
      toast.message = error instanceof Error ? error.message : "Unknown error occurred";

      if (error instanceof Error && error.message.includes("API key")) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await openCommandPreferences();
      }
    } finally {
      setIsCreating(false);
    }
  };

  const openManageInstances = async () => {
    // This will open the Manage n8n Instances command
    await open("raycast://extensions/devops/n8n/manage-instances");
  };

  return (
    <Form
      isLoading={isCreating}
      actions={
        <ActionPanel>
          <Action.SubmitForm 
            title="Create Workflow" 
            onSubmit={handleSubmit} 
            icon={Icon.Plus}
          />
          <Action 
            title="Manage n8n Instances" 
            icon={Icon.Gear}
            onAction={openManageInstances}
            shortcut={{ modifiers: ["cmd"], key: "m" }}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Create n8n Workflow"
        text={`Create a new empty workflow in your n8n instance.

A workflow in n8n allows you to automate processes by connecting different nodes together. 
This command creates an empty workflow that you can then customize in the n8n editor.

The workflow will be created with:
- The name you specify
- No nodes (empty canvas)
- Default execution settings
- Automatically opened in your browser

You'll need to have an n8n instance configured with a valid API key to use this feature.`}
      />

      <InstanceSelector
        onInstanceSelect={setSelectedInstance}
        selectedInstanceId={selectedInstance?.id}
      />

      <Form.TextField
        id="name"
        name="name"
        title="Workflow Name"
        placeholder="Enter workflow name"
        error={nameFieldTouched && !isCreating && !values?.name?.trim() ? "Workflow name is required" : undefined}
        info="This name will be used to identify your workflow in n8n"
        enableMarkdown
        autoFocus
        onChange={(value) => {
          // Mark the field as touched when user interacts with it
          if (!nameFieldTouched) {
            setNameFieldTouched(true);
          }
          
          // Validate as user types
          if (value.trim().length > 0) {
            // Reset error state when field has a valid value
            setNameFieldTouched(false);
          }
        }}
        onBlur={(event) => {
          // Mark as touched when the field loses focus
          const value = event.target.value || "";
          if (value.trim().length === 0) {
            setNameFieldTouched(true);
          }
        }}
      />
    </Form>
  );
}
