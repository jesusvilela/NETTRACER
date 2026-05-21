import fs from "node:fs";

const dashboardPath = new URL("./dashboard.html", import.meta.url);
const dashboardV2Path = new URL("./dashboard-v2.html", import.meta.url);
const dosboxPath = new URL("./dosbox.html", import.meta.url);
const archiveVizPath = new URL("./archive-viz.html", import.meta.url);

export function renderDashboard() {
  console.log("Rendering Dashboard V1");
  return fs.readFileSync(dashboardPath, "utf8");
}

export function renderDashboardV2() {
  console.log("Rendering Dashboard V2");
  return fs.readFileSync(dashboardV2Path, "utf8");
}

export function renderDosbox() {
  console.log("Rendering Dosbox");
  return fs.readFileSync(dosboxPath, "utf8");
}

export function renderArchiveViz() {
  console.log("Rendering Archive Viz");
  return fs.readFileSync(archiveVizPath, "utf8");
}
