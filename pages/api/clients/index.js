const { getServerSession } = require("next-auth/next");
const authModule = require("../auth/[...nextauth]");
const { getDb } = require("../../../lib/db");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

function normalizeEmail(v) { return String(v || "").trim().toLowerCase(); }
function asString(v) { return String(v || "").trim(); }
function asBool(v, fb = false) { if (typeof v === "boolean") return v; if (typeof v === "string") return v.toLowerCase() === "true"; return fb; }
function asEmailList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(normalizeEmail).filter(Boolean);
  return String(v).split(",").map(normalizeEmail).filter(Boolean);
}
function generatePassword(len = 16) { return crypto.randomBytes(Math.ceil(len * 0.75)).toString("base64url").slice(0, len); }
function toPublic(doc) { if (!doc) return null; const { passwordHash, ...rest } = doc; return { ...rest, _id: doc._id.toString() }; }

async function requireAdmin(req, res) {
  const session = await getServerSession(req, res, authModule.authOptions);
  if (!session) { res.status(401).json({ error: "Not authenticated" }); return null; }
  if (session.user?.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return null; }
  return session;
}

module.exports = async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  const db = await getDb();
  const col = db.collection("clients");
  try {
    if (req.method === "GET") {
      const id = asString(req.query?.id);
      if (id) {
        const c = await col.findOne({ _id: new ObjectId(id) });
        if (!c) return res.status(404).json({ error: "Not found" });
        return res.status(200).json({ client: toPublic(c) });
      }
      const clients = await col.find({}).sort({ createdAt: -1 }).toArray();
      return res.status(200).json({ clients: clients.map(toPublic) });
    }
    if (req.method === "POST") {
      const name = asString(req.body?.name);
      const contactEmail = normalizeEmail(req.body?.contactEmail);
      const loginEmail = normalizeEmail(req.body?.loginEmail || contactEmail);
      if (!name || !contactEmail || !loginEmail) return res.status(400).json({ error: "Missing fields: name, contactEmail, loginEmail" });
      const existing = await col.findOne({ loginEmail });
      if (existing) return res.status(409).json({ error: "loginEmail already exists" });
      const provided = asString(req.body?.password);
      const generated = provided ? null : generatePassword(18);
      const passwordHash = await bcrypt.hash(provided || generated, 10);
      const now = new Date();
      const doc = {
        name, contactEmail, loginEmail, passwordHash,
        reportRecipients: asEmailList(req.body?.reportRecipients || contactEmail),
        timezone: asString(req.body?.timezone || "Europe/Paris"),
        language: asString(req.body?.language || "fr"),
        active: asBool(req.body?.active, true),
        promptContext: asString(req.body?.promptContext || ""),
        kpiSnapshot: req.body?.kpiSnapshot || null,
        createdAt: now, updatedAt: now,
      };
      const result = await col.insertOne(doc);
      return res.status(201).json({ client: toPublic({ ...doc, _id: result.insertedId }), generatedPassword: generated });
    }
    if (req.method === "PUT") {
      const id = asString(req.query?.id);
      if (!id) return res.status(400).json({ error: "Missing id" });
      const updates = { updatedAt: new Date() };
      if (req.body?.name !== undefined) updates.name = asString(req.body.name);
      if (req.body?.contactEmail !== undefined) updates.contactEmail = normalizeEmail(req.body.contactEmail);
      if (req.body?.loginEmail !== undefined) updates.loginEmail = normalizeEmail(req.body.loginEmail);
      if (req.body?.timezone !== undefined) updates.timezone = asString(req.body.timezone);
      if (req.body?.language !== undefined) updates.language = asString(req.body.language);
      if (req.body?.active !== undefined) updates.active = asBool(req.body.active, true);
      if (req.body?.reportRecipients !== undefined) updates.reportRecipients = asEmailList(req.body.reportRecipients);
      if (req.body?.promptContext !== undefined) updates.promptContext = asString(req.body.promptContext);
      if (req.body?.kpiSnapshot !== undefined) updates.kpiSnapshot = req.body.kpiSnapshot;
      if (req.body?.password) updates.passwordHash = await bcrypt.hash(asString(req.body.password), 10);
      if (updates.loginEmail) {
        const existing = await col.findOne({ loginEmail: updates.loginEmail, _id: { $ne: new ObjectId(id) } });
        if (existing) return res.status(409).json({ error: "loginEmail already exists" });
      }
      const result = await col.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: updates }, { returnDocument: "after" });
      if (!result.value) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ client: toPublic(result.value) });
    }
    if (req.method === "DELETE") {
      const id = asString(req.query?.id);
      if (!id) return res.status(400).json({ error: "Missing id" });
      const result = await col.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error("clients API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
