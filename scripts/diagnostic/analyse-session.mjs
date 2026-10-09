// Analyse d'une session OpenCode (et de ses sous-sessions) : qui a travaille,
// avec quels outils, quels fichiers ont ete ecrits, quels appels ont echoue,
// et combien de tokens chaque agent a consommes.
import { execSync } from "node:child_process";
const [root, cwd] = [process.argv[2], process.argv[3] ?? "."];
const exp = (id) => { const o = execSync(`npx -y opencode-ai@1.18.35 export ${id}`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }); return JSON.parse(o.slice(o.indexOf("{"))); };
const rows = []; const queue = [[root, "architect"]]; const seen = new Set();
while (queue.length) {
  const [id, agent] = queue.shift(); if (seen.has(id)) continue; seen.add(id);
  const s = exp(id); const r = { agent, tools: {}, writes: new Set(), errors: [], bash: [], tokIn: 0, tokOut: 0, calls: 0 };
  for (const m of s.messages) {
    const t = m.info?.tokens; if (t) { r.tokIn += (t.input ?? 0) + (t.cache?.read ?? 0); r.tokOut += t.output ?? 0; }
    for (const p of m.parts ?? []) {
      if (p.type !== "tool") continue; r.calls++;
      r.tools[p.tool] = (r.tools[p.tool] ?? 0) + 1;
      const inp = p.state?.input ?? {};
      if (["write", "edit"].includes(p.tool) && inp.filePath) r.writes.add(inp.filePath.split(String.fromCharCode(92)).join("/").replace(/^.*?(ex1-[a-z]+)\//, ""));
      if (p.tool === "bash") r.bash.push(String(inp.command).split("\n")[0].slice(0, 70));
      if (p.state?.status === "error") r.errors.push(`${p.tool}: ${String(p.state.error).split("\n")[0].slice(0, 90)}`);
      if (p.tool === "task" && p.state?.metadata?.sessionId) queue.push([p.state.metadata.sessionId, inp.subagent_type]);
    }
  }
  rows.push(r);
}
const all = ["architect", "planner", "finder", "explorer", "dev", "reviewer", "tester"];
console.log("agent      appels  tokens lus  outils");
for (const r of rows) console.log(r.agent.padEnd(10), String(r.calls).padStart(6), String(r.tokIn).padStart(11), " ", Object.entries(r.tools).map(([k, v]) => `${k}x${v}`).join(" "));
console.log("\njamais appeles :", all.filter((a) => !rows.some((r) => r.agent === a)).join(", ") || "aucun");
for (const r of rows) {
  if (r.writes.size) console.log(`\n${r.agent} a ecrit :`, [...r.writes].join(", "));
  if (r.errors.length) console.log(`${r.agent} - appels refuses/en erreur :\n  ` + r.errors.join("\n  "));
}
