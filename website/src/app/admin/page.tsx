"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type AdminSummary = {
  totalUsers: number;
  completedProfiles: number;
  premiumUsers: number;
  payingUsers: number;
  pausedUsers: number;
  openReports: number;
  activeMatches: number;
  upcomingMatches: number;
  nextPlannedMatches: number;
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
  bannedAt: string | null;
  accountPaused: boolean;
  accountBanned: boolean;
  matchCount: number;
  paidMatchCredits: number;
  frozenPaidMatchCredits: number;
  forfeitedPaidMatchCredits: number;
  lastPaidMatchPackageAt: string | null;
};

type AdminMatch = {
  id: string;
  status: string;
  scheduledFor: string;
  activatedAt: string | null;
  closedAt: string | null;
  compatibility: number | null;
  phaseOneStarterUserId: string | null;
  phaseOneStarterName: string | null;
  phaseTwoStage: string | null;
  phaseTwoStarterUserId: string | null;
  phaseTwoStarterName: string | null;
  phaseTwoPartnerUserId: string | null;
  phaseTwoPartnerName: string | null;
  userADecision: string;
  userBDecision: string;
  phaseThreeUserADecision: string;
  phaseThreeUserBDecision: string;
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
    bannedAt: string | null;
  };
  matchId: string | null;
};

type DashboardPayload = {
  ok: true;
  summary: AdminSummary;
  users: AdminUser[];
  matches: AdminMatch[];
  upcomingMatches: AdminMatch[];
  nextPlannedReleaseAt: string | null;
  nextPlannedMatches: AdminMatch[];
  reports: AdminReport[];
};

const storageKey = "choice.admin-settings";

function getDefaultApiUrl() {
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:4000/v1";
  }

  if (typeof window !== "undefined" && window.location.hostname.endsWith("choice-dating.app")) {
    return "https://api.choice-dating.app/v1";
  }

  return process.env.NEXT_PUBLIC_ADMIN_API_URL?.trim() || "https://api.choice-dating.app/v1";
}

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

function formatParticipantDecision(value: string) {
  if (value === "KEEP") {
    return "bleibt";
  }

  if (value === "DISCARD") {
    return "neues Match";
  }

  return "offen";
}

function formatPhaseTwoStage(value: string | null) {
  if (value === "STARTER") {
    return "Starter antwortet";
  }

  if (value === "PARTNER") {
    return "Partner antwortet";
  }

  if (value === "RESULT") {
    return "Ergebnis da";
  }

  return "—";
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
  const [apiUrl, setApiUrl] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const fallbackApiUrl = getDefaultApiUrl();
    setApiUrl(fallbackApiUrl);

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
        const shouldPreferLocalApi =
          window.location.hostname === "localhost"
          && parsed.apiUrl.includes("choice-api.onrender.com");

        setApiUrl(shouldPreferLocalApi ? fallbackApiUrl : parsed.apiUrl);
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
    let response: Response;

    try {
      response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "x-admin-phone": phoneNumber.trim(),
          "x-admin-key": accessKey.trim(),
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      throw new Error("API nicht erreichbar. Prüfe die API-URL oder ob der Server läuft.");
    }

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

  async function updateUser(
    userId: string,
    payload: { isPremium?: boolean; penaltyPoints?: number; suspended?: boolean; banned?: boolean },
    successText: string,
  ) {
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

  async function manageMatchAccess(
    userId: string,
    action: "grant_pack" | "freeze_paid" | "restore_frozen" | "forfeit_paid" | "ban_account",
    successText: string,
  ) {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await adminFetch(`/admin/users/${userId}/match-access`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setNotice(successText);
      await loadDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Match-Paket-Aktion fehlgeschlagen.");
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
              <SummaryCard label="Bezahlt" value={data.summary.payingUsers} tone="accent" />
              <SummaryCard label="Aktive Matches" value={data.summary.activeMatches} />
              <SummaryCard label="Kommende Matches" value={data.summary.upcomingMatches} />
              <SummaryCard label="Nächster Slot" value={data.summary.nextPlannedMatches} />
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
                        {report.reportedUser.bannedAt ? (
                          <p>
                            <strong>Status:</strong> dauerhaft gesperrt
                          </p>
                        ) : null}
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
                  <p className={styles.sectionEyebrow}>Als Nächstes</p>
                  <h2 className={styles.sectionTitle}>Was als Nächstes geplant ist</h2>
                </div>
              </div>

              {data.nextPlannedMatches.length ? (
                <>
                  <p className={styles.sectionHint}>
                    Nächste Freigabe: {formatDate(data.nextPlannedReleaseAt)}
                  </p>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Match</th>
                          <th>Startperson</th>
                          <th>Phase 1</th>
                          <th>Phase 3</th>
                          <th>Phase 2</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.nextPlannedMatches.map((match) => (
                          <tr key={`planned-${match.id}`}>
                            <td>{match.status}</td>
                            <td>
                              {(match.userA.firstName || match.userA.phoneNumber || "User A")} ×{" "}
                              {(match.userB.firstName || match.userB.phoneNumber || "User B")}
                              <div className={styles.cellSubline}>{formatDate(match.scheduledFor)}</div>
                            </td>
                            <td>{match.phaseOneStarterName ?? "—"}</td>
                            <td>
                              <div>{match.userA.firstName || "User A"}: {formatParticipantDecision(match.userADecision)}</div>
                              <div className={styles.cellSubline}>{match.userB.firstName || "User B"}: {formatParticipantDecision(match.userBDecision)}</div>
                            </td>
                            <td>
                              <div>{match.userA.firstName || "User A"}: {formatParticipantDecision(match.phaseThreeUserADecision)}</div>
                              <div className={styles.cellSubline}>{match.userB.firstName || "User B"}: {formatParticipantDecision(match.phaseThreeUserBDecision)}</div>
                            </td>
                            <td>
                              {formatPhaseTwoStage(match.phaseTwoStage)}
                              {match.phaseTwoStage ? (
                                <div className={styles.cellSubline}>
                                  {match.phaseTwoStarterName ?? "—"} → {match.phaseTwoPartnerName ?? "—"}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className={styles.emptyState}>Aktuell ist noch kein kommender Match-Slot vorbereitet.</p>
              )}
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
                      <th>Startperson</th>
                      <th>Phase 1</th>
                      <th>Phase 3</th>
                      <th>Phase 2</th>
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
                          {match.phaseOneStarterName ?? "—"}
                        </td>
                        <td>
                          <div>{match.userA.firstName || "User A"}: {formatParticipantDecision(match.userADecision)}</div>
                          <div className={styles.cellSubline}>{match.userB.firstName || "User B"}: {formatParticipantDecision(match.userBDecision)}</div>
                        </td>
                        <td>
                          <div>{match.userA.firstName || "User A"}: {formatParticipantDecision(match.phaseThreeUserADecision)}</div>
                          <div className={styles.cellSubline}>{match.userB.firstName || "User B"}: {formatParticipantDecision(match.phaseThreeUserBDecision)}</div>
                        </td>
                        <td>
                          {formatPhaseTwoStage(match.phaseTwoStage)}
                          {match.phaseTwoStage ? (
                            <div className={styles.cellSubline}>
                              {match.phaseTwoStarterName ?? "—"} → {match.phaseTwoPartnerName ?? "—"}
                            </div>
                          ) : null}
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
                      <th>Gekaufte Matches</th>
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
                          <td>{user.accountBanned ? "Gesperrt" : user.accountPaused ? "Pausiert" : "Aktiv"}</td>
                          <td>{user.isPremium ? "Ja" : "Nein"}</td>
                          <td>{user.penaltyPoints}/3</td>
                          <td>
                            {user.paidMatchCredits} aktiv
                            <div className={styles.cellSubline}>
                              {user.frozenPaidMatchCredits} eingefroren · {user.forfeitedPaidMatchCredits} verfallen
                            </div>
                          </td>
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
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => void manageMatchAccess(user.id, "grant_pack", `${label} hat 8 gekaufte Matches erhalten.`)}
                                disabled={isSaving}
                              >
                                +8 Matches
                              </button>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => void manageMatchAccess(user.id, "freeze_paid", `${label} hat jetzt eingefrorene Match-Pakete.`)}
                                disabled={isSaving}
                              >
                                Paket einfrieren
                              </button>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => void manageMatchAccess(user.id, "restore_frozen", `${label} kann eingefrorene Matches wieder nutzen.`)}
                                disabled={isSaving}
                              >
                                Paket freigeben
                              </button>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => void manageMatchAccess(user.id, "forfeit_paid", `${label} hat verbleibende gekaufte Matches verloren.`)}
                                disabled={isSaving}
                              >
                                Paket verfallen
                              </button>
                              <button
                                type="button"
                                className={styles.dangerButton}
                                onClick={() => void manageMatchAccess(user.id, "ban_account", `${label} wurde dauerhaft gesperrt.`)}
                                disabled={isSaving}
                              >
                                Dauerhaft sperren
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
