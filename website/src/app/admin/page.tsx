"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type AdminSummary = {
  totalUsers: number;
  completedProfiles: number;
  premiumUsers: number;
  pausedUsers: number;
  openReports: number;
  activeMatches: number;
};

type AdminUser = {
  id: string;
  createdAt: string;
  updatedAt: string;
  firstName: string | null;
  city: string | null;
  phoneNumber: string | null;
  email: string | null;
  profileCompleted: boolean;
  isPremium: boolean;
  premiumActivatedAt: string | null;
  penaltyPoints: number;
  suspendedAt: string | null;
  accountPaused: boolean;
  matchCount: number;
};

type AdminMatch = {
  id: string;
  status: string;
  scheduledFor: string;
  activatedAt: string | null;
  closedAt: string | null;
  compatibility: number | null;
  userADecision: string;
  userBDecision: string;
  userA: {
    id: string;
    firstName: string | null;
    city: string | null;
    phoneNumber: string | null;
  };
  userB: {
    id: string;
    firstName: string | null;
    city: string | null;
    phoneNumber: string | null;
  };
};

type AdminReport = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "OPEN" | "CONFIRMED" | "DISMISSED";
  reason: string;
  details: string | null;
  latestMessagePreview: string | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
  reporter: {
    id: string;
    firstName: string | null;
    phoneNumber: string | null;
  };
  reportedUser: {
    id: string;
    firstName: string | null;
    phoneNumber: string | null;
    penaltyPoints: number;
    suspendedAt: string | null;
  };
  matchId: string | null;
};

type DashboardPayload = {
  ok: true;
  summary: AdminSummary;
  users: AdminUser[];
  matches: AdminMatch[];
  reports: AdminReport[];
};

const storageKey = "choice.admin-settings";
const defaultApiUrl = process.env.NEXT_PUBLIC_ADMIN_API_URL?.trim() || "http://localhost:4000/v1";

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "alert" | "accent" }) {
  return (
    <article className={[styles.summaryCard, tone === "alert" ? styles.summaryCardAlert : "", tone === "accent" ? styles.summaryCardAccent : ""].join(" ")}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value}</strong>
    </article>
  );
}

export default function AdminPage() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<{
        apiUrl: string;
        phoneNumber: string;
        accessKey: string;
      }>;

      if (parsed.apiUrl) {
        setApiUrl(parsed.apiUrl);
      }

      if (parsed.phoneNumber) {
        setPhoneNumber(parsed.phoneNumber);
      }

      if (parsed.accessKey) {
        setAccessKey(parsed.accessKey);
      }
    } catch {
      // Ignore corrupted local storage values.
    }
  }, []);

  const hasCredentials = useMemo(
    () => Boolean(apiUrl.trim() && phoneNumber.trim() && accessKey.trim()),
    [accessKey, apiUrl, phoneNumber],
  );

  async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-admin-phone": phoneNumber.trim(),
        "x-admin-key": accessKey.trim(),
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "ADMIN_REQUEST_FAILED");
    }

    return payload;
  }

  async function loadDashboard() {
    if (!hasCredentials) {
      setError("Bitte API-URL, Telefonnummer und Admin-Key eintragen.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await adminFetch<DashboardPayload>("/admin/overview");
      setData(payload);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            apiUrl,
            phoneNumber,
            accessKey,
          }),
        );
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Dashboard konnte nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }

  async function updateUser(userId: string, payload: { isPremium?: boolean; penaltyPoints?: number; suspended?: boolean }, successText: string) {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await adminFetch(`/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setNotice(successText);
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Account-Aktion fehlgeschlagen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function resolveReport(reportId: string, decision: "confirmed" | "dismissed") {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await adminFetch(`/admin/reports/${reportId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setNotice(decision === "confirmed" ? "Meldung bestätigt und Strafpunkt vergeben." : "Meldung als kein Verstoß markiert.");
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Meldung konnte nicht verarbeitet werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteUser(userId: string, label: string) {
    if (typeof window !== "undefined" && !window.confirm(`Willst du ${label} wirklich löschen?`)) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await adminFetch(`/admin/users/${userId}`, {
        method: "DELETE",
      });
      setNotice(`${label} wurde gelöscht.`);
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Account konnte nicht gelöscht werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Choice Admin</p>
            <h1 className={styles.title}>Übersicht über Matches, Meldungen und Accounts.</h1>
            <p className={styles.lead}>
              Hier siehst du, wer gerade mit wem gematcht ist, welche Meldungen offen sind, wer Premium hat und welche
              Accounts pausiert oder gelöscht werden sollen.
            </p>
          </div>
          <Link href="/" className={styles.backLink}>
            Zur Website
          </Link>
        </header>

        <section className={styles.authCard}>
          <div className={styles.authGrid}>
            <label className={styles.field}>
              <span>API-URL</span>
              <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="http://localhost:4000/v1" />
            </label>
            <label className={styles.field}>
              <span>Admin-Telefonnummer</span>
              <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="0175..." />
            </label>
            <label className={styles.field}>
              <span>Admin-Key</span>
              <input
                type="password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                placeholder="Dein Admin-Key"
              />
            </label>
          </div>

          <div className={styles.authActions}>
            <button type="button" className={styles.primaryButton} onClick={() => void loadDashboard()} disabled={isLoading || !hasCredentials}>
              {isLoading ? "Lädt..." : "Dashboard laden"}
            </button>
            <p className={styles.authHint}>Für lokalen Test kannst du hier auch deine lokale API-IP eintragen.</p>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {notice ? <p className={styles.notice}>{notice}</p> : null}
        </section>

        {data ? (
          <>
            <section className={styles.summaryGrid}>
              <SummaryCard label="Accounts" value={data.summary.totalUsers} />
              <SummaryCard label="Komplette Profile" value={data.summary.completedProfiles} />
              <SummaryCard label="Premium" value={data.summary.premiumUsers} tone="accent" />
              <SummaryCard label="Aktive Matches" value={data.summary.activeMatches} />
              <SummaryCard label="Offene Meldungen" value={data.summary.openReports} tone="alert" />
              <SummaryCard label="Pausierte Konten" value={data.summary.pausedUsers} tone="alert" />
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>Meldungen</p>
                  <h2 className={styles.sectionTitle}>Offene und bearbeitete Reports</h2>
                </div>
              </div>

              <div className={styles.reportList}>
                {data.reports.length ? (
                  data.reports.map((report) => (
                    <article key={report.id} className={styles.reportCard}>
                      <div className={styles.reportTop}>
                        <div>
                          <span className={styles.reportBadge}>{report.status}</span>
                          <h3 className={styles.reportTitle}>
                            {report.reportedUser.firstName || report.reportedUser.phoneNumber || report.reportedUser.id} wurde von{" "}
                            {report.reporter.firstName || report.reporter.phoneNumber || report.reporter.id} gemeldet
                          </h3>
                        </div>
                        <span className={styles.reportMeta}>{formatDate(report.createdAt)}</span>
                      </div>

                      <div className={styles.reportContent}>
                        <p>
                          <strong>Grund:</strong> {report.reason}
                        </p>
                        {report.details ? (
                          <p>
                            <strong>Details:</strong> {report.details}
                          </p>
                        ) : null}
                        {report.latestMessagePreview ? (
                          <p>
                            <strong>Letzte Nachricht:</strong> “{report.latestMessagePreview}”
                          </p>
                        ) : null}
                        <p>
                          <strong>Aktuelle Strafpunkte:</strong> {report.reportedUser.penaltyPoints}/3
                        </p>
                      </div>

                      {report.status === "OPEN" ? (
                        <div className={styles.inlineActions}>
                          <button type="button" className={styles.secondaryButton} onClick={() => void resolveReport(report.id, "dismissed")} disabled={isSaving}>
                            Kein Verstoß
                          </button>
                          <button type="button" className={styles.primaryButton} onClick={() => void resolveReport(report.id, "confirmed")} disabled={isSaving}>
                            Strafpunkt geben
                          </button>
                        </div>
                      ) : (
                        <p className={styles.resolutionText}>
                          {report.status === "CONFIRMED" ? "Bestätigt" : "Abgelehnt"}
                          {report.reviewedAt ? ` · ${formatDate(report.reviewedAt)}` : ""}
                        </p>
                      )}
                    </article>
                  ))
                ) : (
                  <p className={styles.emptyState}>Noch keine Meldungen vorhanden.</p>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>Matches</p>
                  <h2 className={styles.sectionTitle}>Wer gerade mit wem gematcht ist</h2>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Match</th>
                      <th>Geplant</th>
                      <th>Kompatibilität</th>
                      <th>Entscheidung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.matches.map((match) => (
                      <tr key={match.id}>
                        <td>{match.status}</td>
                        <td>
                          {(match.userA.firstName || match.userA.phoneNumber || "User A")} ×{" "}
                          {(match.userB.firstName || match.userB.phoneNumber || "User B")}
                        </td>
                        <td>{formatDate(match.scheduledFor)}</td>
                        <td>{match.compatibility !== null ? `${Math.round(match.compatibility)}%` : "—"}</td>
                        <td>
                          {match.userADecision}/{match.userBDecision}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>Accounts</p>
                  <h2 className={styles.sectionTitle}>Premium, Pausen und Löschungen</h2>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Kontakt</th>
                      <th>Status</th>
                      <th>Premium</th>
                      <th>Strafpunkte</th>
                      <th>Matches</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => {
                      const label = user.firstName || user.phoneNumber || user.email || user.id;

                      return (
                        <tr key={user.id}>
                          <td>
                            <strong>{label}</strong>
                            <div className={styles.cellSubline}>{user.city || "Ohne Stadt"}</div>
                          </td>
                          <td>
                            {user.phoneNumber || "—"}
                            <div className={styles.cellSubline}>{user.email || "Keine E-Mail"}</div>
                          </td>
                          <td>{user.accountPaused ? "Pausiert" : "Aktiv"}</td>
                          <td>{user.isPremium ? "Ja" : "Nein"}</td>
                          <td>{user.penaltyPoints}/3</td>
                          <td>{user.matchCount}</td>
                          <td>
                            <div className={styles.inlineActions}>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => void updateUser(user.id, { isPremium: !user.isPremium }, user.isPremium ? `${label} ist nicht mehr Premium.` : `${label} ist jetzt Premium.`)}
                                disabled={isSaving}
                              >
                                {user.isPremium ? "Premium aus" : "Premium an"}
                              </button>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() =>
                                  void updateUser(
                                    user.id,
                                    {
                                      penaltyPoints: Math.min(user.penaltyPoints + 1, 3),
                                      suspended: user.penaltyPoints + 1 >= 3,
                                    },
                                    `${label} hat jetzt ${Math.min(user.penaltyPoints + 1, 3)} Strafpunkte.`,
                                  )
                                }
                                disabled={isSaving}
                              >
                                +1 Punkt
                              </button>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => void updateUser(user.id, { penaltyPoints: 0, suspended: false }, `${label} wurde entsperrt.`)}
                                disabled={isSaving}
                              >
                                Entsperren
                              </button>
                              <button type="button" className={styles.dangerButton} onClick={() => void deleteUser(user.id, label)} disabled={isSaving}>
                                Löschen
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
