import fs from "node:fs";
import path from "node:path";

export function getBackupPath(filePath) {
  return `${filePath}.bak`;
}

export function readJsonWithRecovery(filePath) {
  for (const candidate of [
    { path: filePath, source: "primary" },
    { path: getBackupPath(filePath), source: "backup" }
  ]) {
    if (!fs.existsSync(candidate.path)) continue;
    try {
      return {
        data: JSON.parse(fs.readFileSync(candidate.path, "utf8")),
        source: candidate.source
      };
    } catch {
    }
  }
  return { data: null, source: "missing" };
}

export function writeJsonFileSafely(filePath, value) {
  return writeTextFileSafely(filePath, JSON.stringify(value, null, 2));
}

export function writeTextFileSafely(filePath, text) {
  const resolved = path.resolve(String(filePath || ""));
  const directory = path.dirname(resolved);
  const tempPath = `${resolved}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const backupPath = getBackupPath(resolved);

  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(tempPath, text);

  try {
    try {
      fs.renameSync(tempPath, resolved);
    } catch (error) {
      if (!["EEXIST", "EPERM", "EACCES"].includes(error?.code || "")) {
        throw error;
      }
      fs.copyFileSync(tempPath, resolved);
    }
    fs.copyFileSync(resolved, backupPath);
    return { filePath: resolved, backupPath };
  } finally {
    if (fs.existsSync(tempPath)) {
      try {
        fs.rmSync(tempPath, { force: true });
      } catch {
      }
    }
  }
}
