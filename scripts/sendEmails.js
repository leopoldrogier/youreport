const { loadEnv, getRequiredEnv, getOptionalEnv, parseArgs, parseEmailList } = require("./utils");
loadEnv();

async function main() {
  const args = parseArgs();
  const dryRun = args["dry-run"] === true;
  const onlyClientId = args["clientId"] ? String(args["clientId"]) : null;

  getRequiredEnv("MONGODB_URI");
  getRequiredEnv("SMTP_HOST");
  getRequiredEnv("SMTP_PORT");
  getRequiredEnv("SMTP_USER");
  getRequiredEnv("SMTP_PASS");
  getRequiredEnv("EMAIL_FROM");

  const batchLimit = Number(getOptionalEnv("EMAIL_BATCH_LIMIT", "200"));
  const { getDb } = require("../lib/db");
  const { ObjectId } = require("mongodb");
  const nodemailer = require("nodemailer");
  const puppeteer = require("puppeteer");
  const markedMod = await import("marked");
  const marked = markedMod.marked || markedMod.default || markedMod;

  const renderer = new marked.Renderer();
  renderer.html = () => "";
  renderer.image = () => "";
  renderer.link = (href, title, text) => {
    const safe = typeof href === "string" && (href.startsWith("https://") || href.startsWith("http://"));
    if (!safe) return text;
    return `<a href="${href}" rel="noreferrer noopener">${text}</a>`;
  };
  marked.setOptions({ renderer, mangle: false, headerIds: false });

  const db = await getDb();
  const reportsCol = db.collection("reports");
  const clientsCol = db.collection("clients");

  const reportFilter = { status: "generated", emailedAt: { $exists: false } };
  if (onlyClientId) reportFilter.clientId = new ObjectId(onlyClientId);
  const reports = await reportsCol.find(reportFilter).sort({ createdAt: 1 }).limit(batchLimit).toArray();

  console.log(`[sendEmails] pending: ${reports.length} | dryRun=${dryRun}`);
  if (reports.length === 0) return;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  let ok = 0, skipped = 0, failed = 0;

  try {
    for (const r of reports) {
      const client = await clientsCol.findOne({ _id: r.clientId });
      if (!client) { skipped++; console.log(`[sendEmails] SKIP report=${r._id} (client missing)`); continue; }

      const recipients = (client.reportRecipients?.length) ? client.reportRecipients : [client.contactEmail].filter(Boolean);
      const to = recipients.join(", ");
      if (!to) { skipped++; continue; }

      const subject = `AutoReport – ${client.name} – ${r.periodStartISO} → ${r.periodEndISO}`;
      const htmlBody = buildHtml({ title: r.title, clientName: client.name, periodStartISO: r.periodStartISO, periodEndISO: r.periodEndISO, markdown: r.markdown, marked });

      if (dryRun) { console.log(`[sendEmails] DRY RUN to=${to} subject="${subject}"`); ok++; continue; }

      try {
        const pdfBuffer = await renderPdf({ browser, html: htmlBody });
        const info = await transporter.sendMail({
          from: process.env.EMAIL_FROM, to, subject,
          text: `Bonjour,\n\nVeuillez trouver en pièce jointe votre rapport AutoReport (${r.periodStartISO} → ${r.periodEndISO}).\n\n— AutoReport`,
          attachments: [{ filename: `AutoReport-${client.name}-${r.periodStartISO}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
        });
        await reportsCol.updateOne({ _id: r._id }, { $set: { status: "emailed", emailedAt: new Date(), emailTo: recipients, emailMessageId: info.messageId || null, updatedAt: new Date() } });
        ok++;
        console.log(`[sendEmails] OK ${client.name} to=${to}`);
      } catch (err) { failed++; console.error(`[sendEmails] FAIL ${client.name}`, err?.message || err); }
    }
  } finally { await browser.close(); }

  console.log(`[sendEmails] done: ok=${ok}, skipped=${skipped}, failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

function buildHtml({ title, clientName, periodStartISO, periodEndISO, markdown, marked }) {
  const contentHtml = marked.parse(markdown || "");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;line-height:1.5;padding:24px}h1{font-size:20px}h2{font-size:16px}h3{font-size:14px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px;text-align:left}pre{background:#f6f8fa;padding:12px;border-radius:6px;white-space:pre-wrap}.meta{color:#555;margin-bottom:16px}.footer{margin-top:24px;color:#777;font-size:11px}</style>
  </head><body>
  <h1>${esc(title)}</h1>
  <div class="meta">Client: <strong>${esc(clientName)}</strong><br/>Période: <strong>${esc(periodStartISO)} → ${esc(periodEndISO)}</strong></div>
  <div>${contentHtml}</div>
  <div class="footer">Généré automatiquement par AutoReport.</div>
  </body></html>`;
}

async function renderPdf({ browser, html }) {
  const page = await browser.newPage();
  await page.emulateMediaType("screen");
  await page.setContent(html, { waitUntil: "load" });
  const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" } });
  await page.close();
  return pdf;
}

function esc(s) { return String(s || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

main().catch((err) => { console.error("[sendEmails] fatal:", err); process.exit(1); });
