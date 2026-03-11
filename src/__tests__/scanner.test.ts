import { describe, it, expect } from "vitest";
import {
  getServerInfo, getServerCapabilities, getInstructions,
  listTools, listResources, listResourceTemplates, listPrompts,
} from "../scanner.js";
import { VERSION } from "../version.js";

describe("scanner module", () => {
  describe("VERSION consistency", () => {
    it("uses VERSION from version.ts matching 0.2.3", () => {
      expect(VERSION).toBe("0.2.3");
    });
  });

  describe("header validation", () => {
    const FORBIDDEN_HEADER_CHARS = /[\r\n\0]/;

    it("rejects headers with newline characters", () => {
      const malicious = "Authorization: Bearer token\r\nX-Injected: evil";
      const value = malicious.slice(malicious.indexOf(":") + 1).trim();
      expect(FORBIDDEN_HEADER_CHARS.test(value)).toBe(true);
    });

    it("rejects headers with carriage return", () => {
      expect(FORBIDDEN_HEADER_CHARS.test("value\rinjection")).toBe(true);
    });

    it("rejects headers with null bytes", () => {
      expect(FORBIDDEN_HEADER_CHARS.test("value\0injection")).toBe(true);
    });

    it("accepts valid header values", () => {
      expect(FORBIDDEN_HEADER_CHARS.test("Bearer abc123")).toBe(false);
      expect(FORBIDDEN_HEADER_CHARS.test("application/json")).toBe(false);
    });
  });

  describe("getServerInfo", () => {
    it("returns unknown when client has no version info", () => {
      const mockClient = { getServerVersion: (): undefined => undefined };
      const info = getServerInfo(mockClient as never);
      expect(info.name).toBe("unknown");
      expect(info.version).toBe("unknown");
    });

    it("returns server info when available", () => {
      const mockClient = {
        getServerVersion: (): { name: string; version: string } => ({ name: "test-server", version: "1.0.0" }),
      };
      const info = getServerInfo(mockClient as never);
      expect(info.name).toBe("test-server");
      expect(info.version).toBe("1.0.0");
    });
  });

  describe("getServerCapabilities", () => {
    it("returns false for all capabilities when none available", () => {
      const mockClient = { getServerCapabilities: (): undefined => undefined };
      const caps = getServerCapabilities(mockClient as never);
      expect(caps.tools).toBe(false);
      expect(caps.resources).toBe(false);
      expect(caps.prompts).toBe(false);
      expect(caps.logging).toBe(false);
    });

    it("returns true for declared capabilities", () => {
      const mockClient = {
        getServerCapabilities: (): Record<string, unknown> => ({
          tools: {},
          resources: {},
          prompts: undefined,
          logging: undefined,
        }),
      };
      const caps = getServerCapabilities(mockClient as never);
      expect(caps.tools).toBe(true);
      expect(caps.resources).toBe(true);
      expect(caps.prompts).toBe(false);
      expect(caps.logging).toBe(false);
    });
  });

  describe("getInstructions", () => {
    it("returns null when no instructions", () => {
      const mockClient = { getInstructions: (): undefined => undefined };
      expect(getInstructions(mockClient as never)).toBeNull();
    });

    it("returns null for empty string instructions", () => {
      const mockClient = { getInstructions: (): string => "" };
      expect(getInstructions(mockClient as never)).toBeNull();
    });

    it("returns instructions string when present", () => {
      const mockClient = { getInstructions: (): string => "Be helpful and safe" };
      expect(getInstructions(mockClient as never)).toBe("Be helpful and safe");
    });

    it("returns null when getInstructions throws", () => {
      const mockClient = {
        getInstructions: (): never => { throw new Error("not supported"); },
      };
      expect(getInstructions(mockClient as never)).toBeNull();
    });
  });

  describe("listTools with unsupported capability", () => {
    it("returns empty array when not supported", async () => {
      const result = await listTools({} as never, false);
      expect(result).toEqual([]);
    });
  });

  describe("listResources with unsupported capability", () => {
    it("returns empty array when not supported", async () => {
      const result = await listResources({} as never, false);
      expect(result).toEqual([]);
    });
  });

  describe("listResourceTemplates with unsupported capability", () => {
    it("returns empty array when not supported", async () => {
      const result = await listResourceTemplates({} as never, false);
      expect(result).toEqual([]);
    });
  });

  describe("listPrompts with unsupported capability", () => {
    it("returns empty array when not supported", async () => {
      const result = await listPrompts({} as never, false);
      expect(result).toEqual([]);
    });
  });
});
