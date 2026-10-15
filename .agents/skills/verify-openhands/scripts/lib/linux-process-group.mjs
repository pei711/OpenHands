import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Linux keeps exited children visible in /proc until their parent reaps them.
// `kill(-pgid, 0)` therefore proves only that a group exists, not that it can
// still execute. Return null when /proc cannot establish the group's state so
// callers can conservatively treat it as alive.
export function hasLiveLinuxProcessGroup(pgid, procRoot = "/proc") {
  if (!Number.isSafeInteger(pgid) || pgid <= 0) return null;

  let foundMember = false;
  let entries;
  try {
    entries = readdirSync(procRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;

    let stat;
    try {
      stat = readFileSync(join(procRoot, entry.name, "stat"), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      return null;
    }

    const closingParen = stat.lastIndexOf(")");
    if (closingParen < 0) return null;
    const fields = stat
      .slice(closingParen + 1)
      .trim()
      .split(/\s+/);
    const state = fields[0];
    const processGroupId = Number(fields[2]);
    if (!state || !Number.isSafeInteger(processGroupId)) return null;
    if (processGroupId !== pgid) continue;

    foundMember = true;
    if (state !== "Z" && state !== "X" && state !== "x") return true;
  }

  return foundMember ? false : null;
}
