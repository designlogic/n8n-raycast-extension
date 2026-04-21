import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";
import { execSync, exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { userInfo } from "os";
import React, { useEffect, useState } from "react";

const execAsync = promisify(exec);

// Get the actual username from the system (more reliable than process.env.USER in sandboxed environments)
const getUsername = () => {
  try {
    return userInfo().username;
  } catch {
    return process.env.USER || "unknown";
  }
};

type YabaiSpace = {
  index: number;
  label?: string;
  type?: string;
  focused?: number;
};

type YabaiWindow = {
  id: number;
  app: string;
  space: number;
  title?: string;
};

// Find yabai binary across common installation locations
function findYabaiBinary(): string {
  const commonPaths = [
    "/opt/homebrew/bin/yabai", // Apple Silicon
    "/usr/local/bin/yabai",    // Intel Mac
  ];

  for (const path of commonPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Try to find in PATH
  try {
    const result = execSync("which yabai", { encoding: "utf8" }).trim();
    if (result && existsSync(result)) {
      return result;
    }
  } catch {
    // which command failed, continue to fallback
  }

  // Fallback to most common location
  return "/opt/homebrew/bin/yabai";
}

const YABAI_BIN = findYabaiBinary();

function runYabai(args: string): string {
  return execSync(`${YABAI_BIN} ${args}`, {
    encoding: "utf8",
    env: { ...process.env, USER: getUsername() },
  });
}

async function runYabaiAsync(args: string): Promise<string> {
  const { stdout } = await execAsync(`${YABAI_BIN} ${args}`, {
    env: { ...process.env, USER: getUsername() },
  });
  return stdout;
}

export default function SearchCursorSpaces() {
  const [spaces, setSpaces] = useState<YabaiSpace[] | null>(null);
  const [windows, setWindows] = useState<YabaiWindow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const spacesJson = runYabai("-m query --spaces");
      const windowsJson = runYabai("-m query --windows");

      const spaceList: YabaiSpace[] = JSON.parse(spacesJson);
      const windowList: YabaiWindow[] = JSON.parse(windowsJson);

      setSpaces(spaceList);
      setWindows(windowList);
    } catch (error) {
      console.error("Failed to query yabai:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to query yabai",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (isLoading || !spaces || !windows) {
    return <List isLoading searchBarPlaceholder="Loading Cursor spaces…" />;
  }

  // All windows whose app is Cursor
  const cursorWindows = windows.filter((w) => w.app === "Cursor");

  // Helper to extract project name from window title
  const getProjectName = (space: YabaiSpace): string => {
    const windowsInSpace = cursorWindows.filter((w) => w.space === space.index);
    if (windowsInSpace.length === 0 || !windowsInSpace[0]?.title) {
      return `Space ${space.index}`;
    }

    const title = windowsInSpace[0].title;
    // Extract project name from "filename — project-name" format
    const parts = title.split(" — ");
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }

    // Fallback: use last path segment
    const pathParts = title.split("/").filter((p) => p.length > 0);
    return pathParts.length > 0 ? pathParts[pathParts.length - 1] : `Space ${space.index}`;
  };

  // Space indices that contain Cursor windows
  const cursorSpaceIndices = new Set(cursorWindows.map((w) => w.space));

  // Filter spaces to just those indices and sort alphabetically by project name
  const cursorSpaces = spaces
    .filter((s) => cursorSpaceIndices.has(s.index))
    .sort((a, b) => {
      const nameA = getProjectName(a).toLowerCase();
      const nameB = getProjectName(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });

  if (cursorSpaces.length === 0) {
    return (
      <List>
        <List.EmptyView
          title="No Cursor Spaces"
          description="Put Cursor full-screen in a few spaces and try again."
        />
      </List>
    );
  }

  // Convert kebab-case to Title Case (e.g., "my-project" -> "My Project")
  const toTitleCase = (str: string) => {
    return str
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getTitle = (space: YabaiSpace) => {
    const windowsInSpace = cursorWindows.filter((w) => w.space === space.index);

    if (windowsInSpace.length === 0) {
      return `Space ${space.index}`;
    }

    const firstWindow = windowsInSpace[0];

    if (firstWindow?.title) {
      // Cursor window titles are in format: "filename — project-name"
      // Extract the project name (part after " — ")
      const parts = firstWindow.title.split(" — ");
      if (parts.length > 1) {
        const projectName = parts[parts.length - 1];
        return toTitleCase(projectName);
      }

      // Fallback: use last path segment
      const pathParts = firstWindow.title.split("/").filter((p) => p.length > 0);
      if (pathParts.length > 0) {
        return toTitleCase(pathParts[pathParts.length - 1]);
      }
    }

    return `Space ${space.index}`;
  };

  const getSubtitle = (space: YabaiSpace) => {
    return `Space ${space.index}`;
  };

  return (
    <List searchBarPlaceholder="Jump to a Cursor space…">
      {cursorSpaces.map((space) => (
        <List.Item
          key={space.index}
          title={getTitle(space)}
          subtitle={getSubtitle(space)}
          icon={Icon.AppWindow}
          accessories={
            space.focused === 1
              ? [{ icon: Icon.Checkmark, tooltip: "Current Space" }]
              : []
          }
          actions={
            <ActionPanel>
              <Action
                title="Focus This Space"
                icon={Icon.ArrowRight}
                onAction={async () => {
                  try {
                    // Focus the first Cursor window in this space. Using window --focus
                    // (rather than space --focus) avoids yabai's scripting-addition requirement
                    // and is resilient to native-fullscreen space indices being renumbered by macOS.
                    const target = cursorWindows.find((w) => w.space === space.index);
                    if (!target) {
                      throw new Error(`No Cursor window found in space ${space.index}`);
                    }

                    await runYabaiAsync(`-m window --focus ${target.id}`);
                  } catch (error) {
                    console.error("Failed to focus space:", error);
                    await showToast({
                      style: Toast.Style.Failure,
                      title: "Failed to focus space",
                      message: String(error),
                    });
                  }
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}