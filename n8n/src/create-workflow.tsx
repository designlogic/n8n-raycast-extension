import { showToast, Toast, getPreferenceValues, openCommandPreferences, open, Form, ActionPanel, Action } from "@raycast/api";
import { useState } from "react";
import fetch from "node-fetch";
import { Preferences } from "./types";
import { getApiEndpoints } from "./config";

interface CreateWorkflowArguments {
  name?: string;
}

export default function Command(props: { arguments: CreateWorkflowArguments }) {
  const preferences = getPreferenceValues<Preferences>();
  const API_ENDPOINTS = getApiEndpoints(preferences.baseUrl);

  async function handleSubmit(values: { name: string }) {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Creating workflow...",
    });

    try {
      const requestBody = {
        name: values.name,
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
          "X-N8N-API-KEY": preferences.apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Invalid API key. Please check your n8n API key in extension preferences."
            : `Failed to create workflow: ${response.statusText}`
        );
      }

      const data = JSON.parse(responseText) as { id: string };

      toast.style = Toast.Style.Success;
      toast.title = "Workflow created";
      toast.message = `Opening ${values.name} in browser`;

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
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="Enter workflow name"
        defaultValue={props.arguments.name}
        autoFocus
      />
    </Form>
  );
} 