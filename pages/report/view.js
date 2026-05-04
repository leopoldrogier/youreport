/**
 * pages/report/view.js
 * Page d'impression du rapport
 * URL : /report/view?id=REPORT_ID
 */
export default function ReportView({ report, clientName, error }) {
  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial", color: "#cc0000" }}>
        Erreur : {error}
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #1a1a1a; background: #fff; }
        .no-print { position: fixed; top: 16px; right: 16px; z-index: 100; }
        .btn-print {
          background: #6C63FF; color: white; border: none;
          padding: 10px 20px; border-radius: 8px; font-size: 14px;
          cursor: pointer; font-family: Arial;
          box-shadow: 0 2px 8px rgba(108,99,255,0.4);
        }
        .btn-print:hover { background: #5a52d5; }
        .wrap { max-width: 750px; margin: 0 auto; padding: 40px 32px; }
        .header-bar {
          background: #6C63FF; color: white;
          padding: 20px 24px; border-radius: 10px; margin-bottom: 28px;
        }
        .header-bar h1 { font-size: 18px; margin-bottom: 6px; }
        .header-bar .meta { font-size: 12px; opacity: 0.85; }
        h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; color: #333; }
        h3 { font-size: 13px; margin: 16px 0 6px; color: #444; }
        p { margin-bottom: 10px; }
        ul, ol { margin: 8px 0 8px 22px; }
        li { margin-bottom: 4px; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 11px; }
        th { background: #f0efff; color: #3d35a8; }
        th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: left; }
        pre { background: #f6f8fa; padding: 12px; white-space: pre-wrap; font-size: 11px; border-radius: 4px; }
        code { font-family: monospace; font-size: 11px; background: #f6f8fa; padding: 1px 4px; border-radius: 3px; }
        strong { font-weight: 600; }
        .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; color: #aaa; font-size: 10px; text-align: center; }
        @media print {
          .no-print { display: none !important; }
          .wrap { padding: 0; }
          .header-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print">
        <button className="btn-print" onClick={() => window.print()}>
          ⬇ Télécharger en PDF
        </button>
      </div>

      <div className="wrap">
        <div className="header-bar">
          <h1>{report.title}</h1>
          <div className="meta">
            Client : <strong>{clientName}</strong>
            &nbsp;·&nbsp;
            Période : {report.periodStartISO} → {report.periodEndISO}
          </div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: report.contentHtml }} />
        <div className="footer">
          Généré automatiquement par AutoReport · {new Date().toLocaleDateString("fr-FR")}
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  const { req, res, query } = context;
  const { getServerSession } = require("next-auth/next");
  const authModule = require("../api/auth/[...nextauth]");
  const { getDb } = require("../../lib/db");
  const { ObjectId } = require("mongodb");

  const session = await getServerSession(req, res, authModule.authOptions);
  if (!session) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const reportId = query?.id;
  if (!reportId) return { props: { error: "ID manquant" } };

  let report;
  try {
    const db = await getDb();
    report = await db.collection("reports").findOne({ _id: new ObjectId(reportId) });

    if (!report) return { props: { error: "Rapport introuvable" } };

    if (session.user.role !== "admin") {
      if (report.clientId?.toString() !== session.user.clientId) {
        return { props: { error: "Accès refusé" } };
      }
    }

    const client = await db.collection("clients").findOne({ _id: report.clientId });
    const { marked } = await import("marked");
    const contentHtml = marked.parse(report.markdown || "");

    return {
      props: {
        clientName: client?.name || "Client",
        report: {
          title: report.title || "",
          periodStartISO: report.periodStartISO || "",
          periodEndISO: report.periodEndISO || "",
          contentHtml,
        },
      },
    };
  } catch (err) {
    return { props: { error: "Erreur : " + err.message } };
  }
}
