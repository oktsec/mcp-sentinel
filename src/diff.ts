import type { ScanResult, DiffEntry, DiffResult } from "./types.js";

export function diffScans(previous: ScanResult, current: ScanResult): DiffResult {
  const entries: DiffEntry[] = [];

  // Version change
  if (previous.server.version !== current.server.version) {
    entries.push({
      kind: "changed",
      area: "version",
      name: "server version",
      detail: `${previous.server.version} → ${current.server.version}`,
    });
  }

  // Capabilities
  for (const cap of ["tools", "resources", "prompts", "logging"] as const) {
    if (previous.capabilities[cap] !== current.capabilities[cap]) {
      entries.push({
        kind: current.capabilities[cap] ? "added" : "removed",
        area: "capability",
        name: cap,
      });
    }
  }

  // Tools
  const prevTools = new Map(previous.tools.map((t) => [t.tool.name, t]));
  const currTools = new Map(current.tools.map((t) => [t.tool.name, t]));

  for (const [name, tool] of currTools) {
    const prev = prevTools.get(name);
    if (prev === undefined) {
      entries.push({ kind: "added", area: "tool", name, detail: tool.category });
    } else {
      const changes: string[] = [];
      if (prev.category !== tool.category) {
        changes.push(`category: ${prev.category} → ${tool.category}`);
      }
      if (prev.tool.description !== tool.tool.description) {
        changes.push("description changed");
      }
      const prevParams = prev.tool.parameters.map((p) => p.name).sort().join(",");
      const currParams = tool.tool.parameters.map((p) => p.name).sort().join(",");
      if (prevParams !== currParams) {
        changes.push(`params: [${prevParams}] → [${currParams}]`);
      }
      if (changes.length > 0) {
        entries.push({ kind: "changed", area: "tool", name, detail: changes.join("; ") });
      }
    }
  }
  for (const name of prevTools.keys()) {
    if (!currTools.has(name)) {
      entries.push({ kind: "removed", area: "tool", name });
    }
  }

  // Resources
  const prevResources = new Set(previous.resources.map((r) => r.uri));
  const currResources = new Set(current.resources.map((r) => r.uri));

  for (const uri of currResources) {
    if (!prevResources.has(uri)) {
      entries.push({ kind: "added", area: "resource", name: uri });
    }
  }
  for (const uri of prevResources) {
    if (!currResources.has(uri)) {
      entries.push({ kind: "removed", area: "resource", name: uri });
    }
  }

  // Resource templates
  const prevTemplates = new Set(previous.resourceTemplates.map((r) => r.uriTemplate));
  const currTemplates = new Set(current.resourceTemplates.map((r) => r.uriTemplate));

  for (const uri of currTemplates) {
    if (!prevTemplates.has(uri)) {
      entries.push({ kind: "added", area: "resource-template", name: uri });
    }
  }
  for (const uri of prevTemplates) {
    if (!currTemplates.has(uri)) {
      entries.push({ kind: "removed", area: "resource-template", name: uri });
    }
  }

  // Prompts
  const prevPrompts = new Map(previous.prompts.map((p) => [p.name, p]));
  const currPrompts = new Map(current.prompts.map((p) => [p.name, p]));

  for (const [name, prompt] of currPrompts) {
    const prev = prevPrompts.get(name);
    if (prev === undefined) {
      entries.push({ kind: "added", area: "prompt", name });
    } else if (prev.description !== prompt.description) {
      entries.push({ kind: "changed", area: "prompt", name, detail: "description changed" });
    }
  }
  for (const name of prevPrompts.keys()) {
    if (!currPrompts.has(name)) {
      entries.push({ kind: "removed", area: "prompt", name });
    }
  }

  // Instructions
  if (previous.instructions !== current.instructions) {
    if (previous.instructions === null) {
      entries.push({ kind: "added", area: "instruction", name: "server instructions" });
    } else if (current.instructions === null) {
      entries.push({ kind: "removed", area: "instruction", name: "server instructions" });
    } else {
      entries.push({ kind: "changed", area: "instruction", name: "server instructions" });
    }
  }

  return { server: current.server.name, entries };
}
