import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { hasLiveLinuxProcessGroup } from "./linux-process-group.mjs";

function addProcess(procRoot, pid, state, ppid, pgid, command = "test") {
  const processDir = join(procRoot, String(pid));
  mkdirSync(processDir);
  writeFileSync(
    join(processDir, "stat"),
    `${pid} (${command}) ${state} ${ppid} ${pgid} 0 0 0\n`,
  );
}

test("zombie-only Linux process groups are not alive", () => {
  const procRoot = mkdtempSync(join(tmpdir(), "verify-openhands-proc-"));
  try {
    addProcess(procRoot, 101, "Z", 1, 101, "leader ) with paren");
    addProcess(procRoot, 102, "Z", 1, 101);
    addProcess(procRoot, 103, "S", 1, 103);

    assert.equal(hasLiveLinuxProcessGroup(101, procRoot), false);
  } finally {
    rmSync(procRoot, { recursive: true, force: true });
  }
});

test("a live child keeps a Linux process group alive after its leader exits", () => {
  const procRoot = mkdtempSync(join(tmpdir(), "verify-openhands-proc-"));
  try {
    addProcess(procRoot, 201, "Z", 1, 201);
    addProcess(procRoot, 202, "S", 1, 201);

    assert.equal(hasLiveLinuxProcessGroup(201, procRoot), true);
  } finally {
    rmSync(procRoot, { recursive: true, force: true });
  }
});

test("Linux process-group liveness is unknown when /proc cannot be inspected", () => {
  const procRoot = mkdtempSync(join(tmpdir(), "verify-openhands-proc-"));
  try {
    addProcess(procRoot, 301, "Z", 1, 301);
    mkdirSync(join(procRoot, "302"));
    writeFileSync(join(procRoot, "302", "stat"), "unreadable process state");

    assert.equal(hasLiveLinuxProcessGroup(301, procRoot), null);
  } finally {
    rmSync(procRoot, { recursive: true, force: true });
  }
});
