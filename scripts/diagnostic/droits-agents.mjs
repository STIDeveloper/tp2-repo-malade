// Pour chaque agent du depot : son mode, les outils qu'OpenCode lui donne vraiment
// (champ "tools" de `opencode debug agent`), et ses regles edit/bash propres.
import { execSync } from "node:child_process";
const names = process.argv.slice(2).length ? process.argv.slice(2) : ["architect", "planner", "finder", "explorer", "dev", "reviewer", "tester"];
const cols = ["read", "grep", "edit", "bash", "task"];
const head = "agent".padEnd(10) + "mode".padEnd(10) + cols.map((c) => c.padEnd(6)).join("") + "regles edit / bash";
console.log(head); console.log("-".repeat(head.length + 30));
for (const n of names) {
  const out = execSync(`npx -y opencode-ai@1.18.35 debug agent ${n}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const a = JSON.parse(out.slice(out.indexOf("{")));
  const t = a.tools ?? {};
  const own = a.permission.slice(a.permission.findIndex((r, i) => i > 0 && r.permission === "read" && r.pattern === "*" && a.permission[i - 1].pattern === "*.env.example") + 1);
  const rules = (p) => own.filter((r) => r.permission === p).map((r) => `${r.pattern === "*" ? "" : r.pattern + "="}${r.action}`).join(",") || "-";
  const star = own.filter((r) => r.permission === "*").map((r) => r.action).join(">");
  console.log(n.padEnd(10) + a.mode.padEnd(10) + cols.map((c) => (t[c] === false ? "NON" : "oui").padEnd(6)).join("") + `edit[${rules("edit")}] bash[${rules("bash").slice(0, 70)}]`);
}
