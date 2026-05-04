const { loadEnv, getRequiredEnv, getOptionalEnv, parseArgs, getPreviousWeekRangeISO, extractClaudeText } = require("./utils");
loadEnv();

async function main() {
  const args = parseArgs();
  const dryRun = args["dry-run"] === true;
  const force = args["force"] === true;
  const onlyClientId = args["clientId"] ? String(args["clientId"]) : null;

  getRequiredEnv("MONGODB_URI");
  getRequiredEnv("ANTHROPIC_API_KEY");
  const model = getOptionalEnv("CLAUDE_MODEL", "claude-opus-4-6");
  const defaultTimezone = getOptionalEnv("DEFAULT_TIMEZONE", "Europe/Paris");
  const maxTokens = Number(getOptionalEnv("CLAUDE_MAX_TOKENS", "1800"));

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { getDb } = require("../lib/db");
  const { ObjectId } = require("mongodb");

  const db = await getDb();
  const clientsCol = db.collection("clients");
  const reportsCol = db.collection("reports");

  const filter = { active: true };
  if (onlyClientId) filter._id = new ObjectId(onlyClientId);
  const clients = await clientsCol.find(filter).sort({ createdAt: 1 }).toArray();

  console.log(`[generateReports] clients: ${clients.length} | model=${model} | dryRun=${dryRun} | force=${force}`);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let ok = 0, skipped = 0, failed = 0;

  for (const client of clients) {
    const tz = client.timezone || defaultTimezone;
    const { periodStartISO, periodEndISO, label } = getPreviousWeekRangeISO(tz);
    const existing = await reportsCol.findOne({ clientId: client._id, periodStartISO });
    if (existing && !force) { skipped++; console.log(`[generateReports] SKIP ${client.name} (déjà existant)`); continue; }

    const title = `Rapport hebdomadaire – ${client.name} – ${label}`;
    const dataBlock = client.kpiSnapshot ? JSON.stringify(client.kpiSnapshot, null, 2) : "null";

    const prompt = [
      `Tu es un analyste marketing senior. Tu écris en français.`,
      `Contrainte critique: Ne JAMAIS inventer de chiffres. Si une donnée n'est pas fournie, écris "N/A".`,
      `Client: ${client.name}`,
      `Période: ${periodStartISO} → ${periodEndISO} (timezone ${tz})`,
      `Contexte: ${client.promptContext || "(aucun contexte fourni)"}`,
      `Données KPIs (JSON): ${dataBlock}`,
      `Format de sortie: Markdown avec sections:`,
      `# Résumé exécutif (5-7 lignes)`,
      `## KPIs (tableau si possible)`,
      `## Ce qui a bougé cette semaine`,
      `## Opportunités (quick wins)`,
      `## Plan d'action (5 actions triées par impact)`,
      `## Risques / points d'attention`,
    ].join("\n");

    if (dryRun) { console.log(`[generateReports] DRY RUN prompt for ${client.name}:\n${prompt}\n`); ok++; continue; }

    try {
      const msg = await anthropic.messages.create({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] });
      const markdown = extractClaudeText(msg);
      if (!markdown) throw new Error("Empty markdown from Claude");

      const now = new Date();
      await reportsCol.updateOne(
        { clientId: client._id, periodStartISO },
        { $setOnInsert: { createdAt: now }, $set: { clientId: client._id, periodStartISO, periodEndISO, title, markdown, model, usage: msg.usage || null, status: "generated", generatedAt: now, updatedAt: now }, $unset: { emailedAt: "", emailTo: "", emailMessageId: "" } },
        { upsert: true }
      );
      ok++;
      console.log(`[generateReports] OK ${client.name} tokens=${msg?.usage?.input_tokens}/${msg?.usage?.output_tokens}`);
    } catch (err) {
      failed++;
      console.error(`[generateReports] FAIL ${client.name}`, err?.message || err);
    }
  }

  console.log(`[generateReports] done: ok=${ok}, skipped=${skipped}, failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => { console.error("[generateReports] fatal:", err); process.exit(1); });
