import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { installInstructions, registerSchema, reportSchema } from "@/lib/agent";

describe("VPS agent", () => {
  it("builds the install command and cloud-init script from APP_URL", () => {
    process.env.APP_URL = "https://idea2app.example.com/";
    const result = installInstructions("i2a_reg_abc", new Date("2030-01-01T00:00:00Z"));
    expect(result.command).toBe(
      "curl -fsSL https://idea2app.example.com/agent/install.sh | sudo IDEA2APP_URL=https://idea2app.example.com IDEA2APP_TOKEN=i2a_reg_abc bash",
    );
    expect(result.cloudInit.startsWith("#!/bin/bash\n")).toBe(true);
    expect(result.cloudInit).toContain("IDEA2APP_TOKEN=i2a_reg_abc");
  });

  it("accepts only ed25519 public keys at registration", () => {
    const base = { token: "i2a_reg_0123456789", hostname: "srv", ip: "1.2.3.4" };
    expect(registerSchema.safeParse({ ...base, publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB idea2app@srv" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, publicKey: "ssh-rsa AAAAB3Nza" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, publicKey: "ssh-ed25519 AAAA\nmalicious" }).success).toBe(false);
  });

  it("parses heartbeats and deploy reports", () => {
    expect(reportSchema.parse({ status: "online", url: "https://1-2-3-4.sslip.io" }).heartbeat).toBe(false);
    expect(reportSchema.safeParse({ status: "rebooting" }).success).toBe(false);
  });

  it("ships shell scripts with valid syntax", () => {
    for (const script of ["public/agent/install.sh", "public/agent/idea2app"]) {
      expect(() => execFileSync("bash", ["-n", script])).not.toThrow();
    }
  });
});
