import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

export default function Dashboard(props) {
  const { data: session, status } = useSession();
  const [page, setPage] = useState("overview");
  const [selectedClient, setSelectedClient] = useState(null);

  if (status === "loading") return <div className="loading">Chargement…</div>;

  if (!session) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">⬡</div>
          <div className="login-title">AutoReport</div>
          <div className="login-sub">Connectez-vous à votre espace</div>
          <button className="btn-login" onClick={() => signIn()}>Se connecter</button>
        </div>
      </div>
    );
  }

  const role = session.user?.role;
  const initials = (session.user?.name || session.user?.email || "?")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  function openClient(client) {
    setSelectedClient(client);
    setPage("client-detail");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">⬡</div>
          <div>
            <div className="logo-text">AutoReport</div>
            <div className="logo-badge">v1.0 MVP</div>
          </div>
        </div>

        <div className="nav-section">Navigation</div>
        <button
          className={"nav-item" + (page === "overview" ? " active" : "")}
          onClick={() => setPage("overview")}
        >
          <span className="nav-icon">◈</span>
          Vue d&apos;ensemble
        </button>

        {role === "admin" && (
          <button
            className={"nav-item" + (page === "clients" || page === "client-detail" ? " active" : "")}
            onClick={() => setPage("clients")}
          >
            <span className="nav-icon">◉</span>
            Clients
            <span className="nav-count">{props.clients ? props.clients.length : 0}</span>
          </button>
        )}

        <div className="sidebar-bottom">
          <div className="user-row">
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{session.user?.name || session.user?.email}</div>
              <div className="user-role">{role === "admin" ? "Administrateur" : "Client"}</div>
            </div>
            <button className="btn-signout" onClick={() => signOut()} title="Se déconnecter">✕</button>
          </div>
        </div>
      </aside>

      <main className="main">
        {role === "admin" ? (
          <div>
            {page === "overview" && (
              <AdminOverview
                clients={props.clients || []}
                reports={props.reports || []}
                onClientClick={openClient}
                onClientsClick={() => setPage("clients")}
              />
            )}
            {page === "clients" && (
              <ClientsList
                clients={props.clients || []}
                reports={props.reports || []}
                onClientClick={openClient}
              />
            )}
            {page === "client-detail" && selectedClient && (
              <ClientDetail
                client={selectedClient}
                reports={(props.reports || []).filter((r) => r.clientId === selectedClient._id)}
                onBack={() => setPage("clients")}
              />
            )}
          </div>
        ) : (
          <ClientPortal session={session} reports={props.reports || []} />
        )}
      </main>
    </div>
  );
}

function PdfButton({ reportId }) {
  function open(e) {
    e.stopPropagation();
    window.open("/report/view?id=" + reportId, "_blank");
  }
  return (
    <button className="btn-pdf" onClick={open}>
      ⬇ PDF
    </button>
  );
}

/* ── RAPPORT ROW (sans texte, juste header + bouton) ── */
function ReportCard({ report }) {
  return (
    <div className="report-row">
      <div className={"report-icon " + (report.status === "emailed" ? "report-icon-sent" : "report-icon-gen")}>
        {report.status === "emailed" ? "✓" : "⬡"}
      </div>
      <div className="report-info">
        <div className="report-title">{report.title}</div>
        <div className="report-meta">
          {report.periodStartISO && report.periodStartISO + " → " + report.periodEndISO}
          {report.clientName && " · " + report.clientName}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PdfButton reportId={report._id} />
        <span className={"report-status " + (report.status === "emailed" ? "status-emailed" : "status-generated")}>
          {report.status === "emailed" ? "Envoyé" : "Généré"}
        </span>
      </div>
    </div>
  );
}

/* ── ADMIN OVERVIEW ── */
function AdminOverview({ clients, reports, onClientClick, onClientsClick }) {
  var sent = reports.filter(function(r) { return r.status === "emailed"; }).length;
  var generated = reports.filter(function(r) { return r.status === "generated"; }).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Vue d&apos;ensemble</div>
          <div className="page-sub">Tableau de bord général AutoReport</div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card" style={{ cursor: "pointer" }} onClick={onClientsClick}>
          <div className="stat-label">◉ Clients actifs</div>
          <div className="stat-val">{clients.filter(function(c) { return c.active; }).length}</div>
          <div className="stat-sub">{clients.length} au total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">◈ Rapports envoyés</div>
          <div className="stat-val">{sent}</div>
          <div className="stat-sub" style={{ color: "var(--green)" }}>✓ emails délivrés</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">⬡ En attente</div>
          <div className="stat-val">{generated}</div>
          <div className="stat-sub">prêts à envoyer</div>
        </div>
      </div>

      <div className="section-title">Clients récents</div>
      <div className="clients-grid">
        {clients.slice(0, 4).map(function(c) {
          return <ClientCard key={c._id} client={c} onClick={function() { onClientClick(c); }} />;
        })}
        {clients.length > 4 && (
          <button className="see-all-card" onClick={onClientsClick}>
            Voir tous les clients ({clients.length}) →
          </button>
        )}
        {clients.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">◉</div>
            <div className="empty-text">Aucun client enregistré.</div>
          </div>
        )}
      </div>

      <div className="section-title">Derniers rapports</div>
      <div className="reports-list">
        {reports.length > 0 ? reports.slice(0, 8).map(function(r) {
          return <ReportCard key={r._id} report={r} />;
        }) : (
          <div className="empty-state">
            <div className="empty-icon">⬡</div>
            <div className="empty-text">Aucun rapport. Lancez node scripts/generateReports.js</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── CLIENTS LIST ── */
function ClientsList({ clients, reports, onClientClick }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Clients</div>
          <div className="page-sub">{clients.length} client{clients.length !== 1 ? "s" : ""} enregistré{clients.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
      {clients.length > 0 ? (
        <div className="clients-grid">
          {clients.map(function(c) {
            var clientReports = reports.filter(function(r) { return r.clientId === c._id; });
            return (
              <ClientCard
                key={c._id}
                client={c}
                reportCount={clientReports.length}
                lastReport={clientReports[0]}
                onClick={function() { onClientClick(c); }}
              />
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">◉</div>
          <div className="empty-text">Aucun client. Créez-en un via POST /api/clients</div>
        </div>
      )}
    </div>
  );
}

/* ── CLIENT DETAIL ── */
function ClientDetail({ client, reports, onBack }) {
  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn-back" onClick={onBack}>← Retour</button>
          <div>
            <div className="page-title">{client.name}</div>
            <div className="page-sub">{client.loginEmail}</div>
          </div>
        </div>
        <span className={"pill " + (client.active ? "pill-green" : "pill-amber")}>
          <span className="pill-dot"></span>
          {client.active ? "Actif" : "Inactif"}
        </span>
      </div>

      <div className="stats-row" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">📧 Email contact</div>
          <div style={{ fontSize: 13, fontFamily: "var(--mono)", marginTop: 8, color: "var(--text2)" }}>
            {client.contactEmail}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">◈ Rapports générés</div>
          <div className="stat-val">{reports.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">✓ Rapports envoyés</div>
          <div className="stat-val" style={{ color: "var(--green)" }}>
            {reports.filter(function(r) { return r.status === "emailed"; }).length}
          </div>
        </div>
      </div>

      {client.promptContext ? (
        <div>
          <div className="section-title">Contexte client</div>
          <div className="context-box">{client.promptContext}</div>
        </div>
      ) : null}

      <div className="section-title">Rapports ({reports.length})</div>
      {reports.length > 0 ? (
        <div className="reports-list">
          {reports.map(function(r) {
            return <ReportCard key={r._id} report={r} />;
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">⬡</div>
          <div className="empty-text">Aucun rapport pour ce client.</div>
        </div>
      )}
    </div>
  );
}

/* ── CLIENT PORTAL ── */
function ClientPortal({ session, reports }) {
  var sent = reports.filter(function(r) { return r.status === "emailed"; }).length;
  return (
    <div>
      <div className="client-hero">
        <div className="client-hero-title">Bonjour {session.user?.name || "👋"}</div>
        <div className="client-hero-sub">Vos rapports hebdomadaires générés automatiquement chaque lundi matin.</div>
        <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
          <div style={{ fontSize: 13, color: "var(--text2)" }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", display: "block" }}>{reports.length}</span>
            Rapports au total
          </div>
          <div style={{ fontSize: 13, color: "var(--text2)" }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: "var(--green)", display: "block" }}>{sent}</span>
            Reçus par email
          </div>
        </div>
      </div>

      <div className="section-title">Vos rapports ({reports.length})</div>
      {reports.length > 0 ? (
        <div className="reports-list">
          {reports.map(function(r) {
            return <ReportCard key={r._id} report={r} />;
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">⬡</div>
          <div className="empty-text">Votre premier rapport arrivera lundi prochain.</div>
        </div>
      )}
    </div>
  );
}

/* ── CLIENT CARD ── */
function ClientCard({ client, reportCount, lastReport, onClick }) {
  return (
    <div className="client-card" onClick={onClick}>
      <div className="client-head">
        <div className="client-avatar">{client.name.slice(0, 2).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="client-name">{client.name}</div>
          <div className="client-email">{client.loginEmail}</div>
        </div>
        <span className={"pill " + (client.active ? "pill-green" : "pill-amber")}>
          <span className="pill-dot"></span>
          {client.active ? "Actif" : "Inactif"}
        </span>
      </div>
      <div className="client-footer">
        <span>{reportCount !== undefined ? reportCount + " rapport" + (reportCount !== 1 ? "s" : "") : client.contactEmail}</span>
        {lastReport && (
          <span className={"pill " + (lastReport.status === "emailed" ? "pill-green" : "")} style={{ fontSize: 10 }}>
            {lastReport.status === "emailed" ? "✓ Envoyé" : "En attente"}
          </span>
        )}
        <span style={{ color: "var(--accent2)" }}>→</span>
      </div>
    </div>
  );
}

/* ── DATA ── */
export async function getServerSideProps(context) {
  const { req, res } = context;
  const { getServerSession } = require("next-auth/next");
  const authModule = require("./api/auth/[...nextauth]");
  const { getDb } = require("../lib/db");
  const { ObjectId } = require("mongodb");

  const session = await getServerSession(req, res, authModule.authOptions);
  if (!session) return { redirect: { destination: "/api/auth/signin", permanent: false } };

  const db = await getDb();

  if (session.user?.role === "admin") {
    const clients = await db.collection("clients").find({}).sort({ createdAt: -1 }).toArray();
    const reports = await db.collection("reports").find({}).sort({ createdAt: -1 }).limit(50).toArray();
    const clientMap = new Map(clients.map((c) => [c._id.toString(), c.name]));
    return {
      props: {
        clients: clients.map((c) => ({
          _id: c._id.toString(),
          name: c.name || "",
          loginEmail: c.loginEmail || "",
          contactEmail: c.contactEmail || "",
          promptContext: c.promptContext || "",
          active: !!c.active,
        })),
        reports: reports.map((r) => ({
          _id: r._id.toString(),
          title: r.title || "",
          status: r.status || "",
          clientId: r.clientId ? r.clientId.toString() : "",
          clientName: clientMap.get(r.clientId ? r.clientId.toString() : "") || null,
          periodStartISO: r.periodStartISO || "",
          periodEndISO: r.periodEndISO || "",
        })),
      },
    };
  }

  const clientId = session.user?.clientId;
  if (!clientId) return { props: { reports: [] } };

  const reports = await db
    .collection("reports")
    .find({ clientId: new ObjectId(clientId) })
    .sort({ createdAt: -1 })
    .limit(12)
    .toArray();

  return {
    props: {
      reports: reports.map((r) => ({
        _id: r._id.toString(),
        title: r.title || "",
        periodStartISO: r.periodStartISO || "",
        periodEndISO: r.periodEndISO || "",
        status: r.status || "",
      })),
    },
  };
}