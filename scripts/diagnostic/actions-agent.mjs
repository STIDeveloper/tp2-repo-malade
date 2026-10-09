// Extrait d'une sous-session OpenCode : les appels bash / write / edit d'un agent,
// avec leur statut, et les phrases ou l'agent explique ce qu'il fait.
import { execSync } from "node:child_process";
const [id, cwd] = process.argv.slice(2);
const o = execSync(`npx -y opencode-ai@1.18.35 export ${id}`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 });
const s = JSON.parse(o.slice(o.indexOf("{")));
const bs = String.fromCharCode(92);
for (const m of s.messages) for (const p of m.parts ?? []) {
  if (p.type === "text" && /bash|denied|hook|plugin|rm /i.test(p.text)) console.log("  >> " + p.text.replace(/\s+/g, " ").slice(0, 135));
  if (p.type !== "tool" || !["bash", "write", "edit"].includes(p.tool)) continue;
  const i = p.state?.input ?? {}; const f = (i.filePath ?? "").split(bs).join("/").replace(/^.*ex1-[a-z]+\//, "");
  const what = p.tool === "bash" ? i.command.split("\n")[0].slice(0, 60) : f;
  const extra = p.tool === "edit" && f.endsWith("checks.sh") ? `   ${JSON.stringify(i.oldString)} -> ${JSON.stringify(i.newString)}` : "";
  console.log(`${p.state.status === "error" ? "REFUSE " : "ok     "}${p.tool.padEnd(6)}${what}${extra}`);
}
