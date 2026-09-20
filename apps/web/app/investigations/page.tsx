"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

type Account = {
  account: string;
  transactions: number;
  suspicious_transactions: number;
  counterparties: number;
  total_volume: number;
  in_degree?: number;
  out_degree?: number;
  pagerank?: number;
  typology_risk?: number;
  typology_reasons?: string;
};

type Relationship = {
  source: string;
  target: string;
  transactions: number;
  amount: number;
  suspicious: number;
};

type Investigation = {
  id: string;
  account_id: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type InvestigationListItem = Investigation;

type InvestigationTimelineEvent = {
  id: number;
  investigation_id: string;
  event_type: string;
  title: string;
  details: string;
  created_at: string;
};

type InvestigationEvidence = {
  id: number;
  investigation_id: string;
  evidence_type: string;
  title: string;
  details: string;
  created_at: string;
};

const statusOptions = [
  "Open",
  "In Review",
  "Escalated",
  "Closed",
];

const evidenceTypes = [
  "Analyst finding",
  "Transaction activity",
  "Network relationship",
  "Risk signal",
  "Other",
];

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function InvestigationsPage() {
  const [accountId, setAccountId] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [investigations, setInvestigations] = useState<
    InvestigationListItem[]
  >([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [caseSearch, setCaseSearch] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState("All");
  const [caseStatusMenuOpen, setCaseStatusMenuOpen] = useState(false);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [investigation, setInvestigation] =
    useState<Investigation | null>(null);
  const [status, setStatus] = useState("Open");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [timeline, setTimeline] = useState<InvestigationTimelineEvent[]>([]);
  const [evidence, setEvidence] = useState<InvestigationEvidence[]>([]);
  const [evidenceType, setEvidenceType] = useState("Analyst finding");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceDetails, setEvidenceDetails] = useState("");
  const [evidenceSaving, setEvidenceSaving] = useState(false);

  const loadCaseActivity = useCallback(async (investigationId: string) => {
    const encodedId = encodeURIComponent(investigationId);

    const [timelineResponse, evidenceResponse] = await Promise.all([
      fetch(
        API_URL +
          "/api/v1/investigations/" +
          encodedId +
          "/timeline",
      ),
      fetch(
        API_URL +
          "/api/v1/investigations/" +
          encodedId +
          "/evidence",
      ),
    ]);

    if (!timelineResponse.ok || !evidenceResponse.ok) {
      throw new Error("Unable to load investigation activity.");
    }

    const [timelineData, evidenceData] = await Promise.all([
      timelineResponse.json(),
      evidenceResponse.json(),
    ]);

    setTimeline(timelineData);
    setEvidence(evidenceData);
  }, []);

  const filteredInvestigations = investigations.filter((item) => {
    const query = caseSearch.trim().toLowerCase();

    const matchesSearch =
      !query ||
      item.id.toLowerCase().includes(query) ||
      item.account_id.toLowerCase().includes(query);

    const matchesStatus =
      caseStatusFilter === "All" ||
      item.status === caseStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const loadInvestigations = useCallback(async () => {
    setCasesLoading(true);

    try {
      const response = await fetch(
        API_URL + "/api/v1/investigations",
      );

      if (!response.ok) {
        throw new Error("Unable to load investigation cases.");
      }

      const data = await response.json();
      setInvestigations(data);
    } catch {
      setInvestigations([]);
    } finally {
      setCasesLoading(false);
    }
  }, []);

  const loadAccount = useCallback(async (value: string) => {
    const trimmedAccountId = value.trim();

    if (!trimmedAccountId) {
      setError("Enter an account ID to investigate.");
      return;
    }

    setLoading(true);
    setError("");
    setSaveMessage("");

    try {
      const encoded = encodeURIComponent(trimmedAccountId);

      const [accountResponse, networkResponse, investigationsResponse] =
        await Promise.all([
          fetch(
            API_URL + "/api/v1/account/" + encoded,
          ),
          fetch(
            API_URL +
              "/api/v1/account/" +
              encoded +
              "/network?limit=50",
          ),
          fetch(
            API_URL +
              "/api/v1/investigations?account_id=" +
              encoded,
          ),
        ]);

      if (!accountResponse.ok) {
        throw new Error(
          "Account was not found in the current dataset.",
        );
      }

      const accountData = await accountResponse.json();
      const networkData = networkResponse.ok
        ? await networkResponse.json()
        : { edges: [] };
      const investigationsData = investigationsResponse.ok
        ? await investigationsResponse.json()
        : [];

      const latestInvestigation = investigationsData[0] ?? null;

      setAccount(accountData);
      setRelationships(networkData.edges ?? []);
      setInvestigation(latestInvestigation);
      setStatus(latestInvestigation?.status ?? "Open");
      setNotes(latestInvestigation?.notes ?? "");
      setTimeline([]);
      setEvidence([]);

      window.localStorage.setItem(
        "aml-insight-last-investigation-account",
        trimmedAccountId,
      );

      if (latestInvestigation) {
        await loadCaseActivity(latestInvestigation.id);
      }
    } catch (requestError) {
      setAccount(null);
      setRelationships([]);
      setInvestigation(null);
      setTimeline([]);
      setEvidence([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to investigate this account.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadCaseActivity]);

  const investigate = async (event?: FormEvent) => {
    event?.preventDefault();
    await loadAccount(accountId);
  };

  useEffect(() => {
    void loadInvestigations();
  }, [loadInvestigations]);

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    );
    const queryAccount = params.get("account");
    const savedAccount = window.localStorage.getItem(
      "aml-insight-last-investigation-account",
    );
    const initialAccount = queryAccount ?? savedAccount;

    if (initialAccount) {
      setAccountId(initialAccount);
      void loadAccount(initialAccount);
    }
  }, [loadAccount]);

  const createInvestigation = async () => {
    if (!account) {
      setError(
        "Investigate an account before creating a case.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setSaveMessage("");

    try {
      const response = await fetch(
        API_URL + "/api/v1/investigations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            account_id: account.account,
            notes,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ?? "Unable to create investigation.",
        );
      }

      setInvestigation(data);
      setSelectedCaseId(data.id);
      setStatus(data.status);
      setNotes(data.notes);
      await loadCaseActivity(data.id);
      await loadInvestigations();
      setSaveMessage(
        data.id + " created successfully.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create investigation.",
      );
    } finally {
      setSaving(false);
    }
  };

  const addEvidence = async () => {
    if (!investigation) {
      setError("Create the investigation before adding evidence.");
      return;
    }

    if (!evidenceTitle.trim() || !evidenceDetails.trim()) {
      setError("Enter an evidence title and details.");
      return;
    }

    setEvidenceSaving(true);
    setError("");
    setSaveMessage("");

    try {
      const response = await fetch(
        API_URL +
          "/api/v1/investigations/" +
          encodeURIComponent(investigation.id) +
          "/evidence",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            evidence_type: evidenceType,
            title: evidenceTitle,
            details: evidenceDetails,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ?? "Unable to add evidence.",
        );
      }

      setEvidence((current) => [data, ...current]);
      setEvidenceTitle("");
      setEvidenceDetails("");
      setSaveMessage("Evidence added successfully.");
      await loadCaseActivity(investigation.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to add evidence.",
      );
    } finally {
      setEvidenceSaving(false);
    }
  };

  const openInvestigation = async (caseId: string) => {
    setSelectedCaseId(caseId);
    setError("");
    setSaveMessage("");

    try {
      const response = await fetch(
        API_URL +
          "/api/v1/investigations/" +
          encodeURIComponent(caseId),
      );

      if (!response.ok) {
        throw new Error("Unable to load the selected investigation.");
      }

      const data = await response.json();

      setAccountId(data.account_id);
      await loadAccount(data.account_id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load the selected investigation.",
      );
    }
  };

  const startNewInvestigation = () => {
    setSelectedCaseId("");
    setInvestigation(null);
    setStatus("Open");
    setNotes("");
    setTimeline([]);
    setEvidence([]);
    setSaveMessage("");
    setError("");
  };

  const saveInvestigation = async () => {
    if (!investigation) {
      await createInvestigation();
      return;
    }

    setSaving(true);
    setError("");
    setSaveMessage("");

    try {
      const response = await fetch(
        API_URL +
          "/api/v1/investigations/" +
          encodeURIComponent(investigation.id),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            notes,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ?? "Unable to save investigation.",
        );
      }

      setInvestigation(data);
      setStatus(data.status);
      setNotes(data.notes);
      await loadCaseActivity(data.id);
      setSaveMessage(
        data.id + " updated successfully.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save investigation.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <aside>
        <div className="brand">
          <div className="brandMark">A</div>
          <div>
            <strong>AML Insight</strong>
            <small>Transaction Intelligence</small>
          </div>
        </div>

        <nav>
          <a href="/">Overview</a>
          <a href="/transactions">Transactions</a>
          <a href="/predict">Predict</a>
          <a href="/network">Network</a>
          <a href="/alerts">Alerts</a>
          <a className="active" href="/investigations">
            Investigations
          </a>
          <a href="/models">Models</a>
        </nav>

        <div className="sidebarBottom">
          <span>IBM AML Benchmark</span>
          <span>Model loaded</span>
        </div>
      </aside>

      <section className="content">
        <header>
          <div>
            <p className="eyebrow">CASE WORKSPACE</p>
            <h1>Account investigation</h1>
            <p className="subtitle">
              Inspect account activity, network relationships, and risk
              signals.
            </p>
          </div>
        </header>

        <section className="panel investigationCaseListPanel">
          <div className="panelHead">
            <div>
              <span className="sectionLabel">CASE MANAGEMENT</span>
              <h2>Investigation cases</h2>
            </div>
            <span className="riskBadge">
              {investigations.length} CASES
            </span>
          </div>

          {!casesLoading && investigations.length > 0 && (
            <div className="investigationCaseFilters">
              <input
                value={caseSearch}
                onChange={(event) => setCaseSearch(event.target.value)}
                placeholder="Search case ID or account"
                aria-label="Search investigation cases"
              />

              <div className="investigationCaseStatusFilter">
                <button
                  className="investigationCaseStatusButton"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={caseStatusMenuOpen}
                  onClick={() =>
                    setCaseStatusMenuOpen((open) => !open)
                  }
                >
                  <span>
                    {caseStatusFilter === "All"
                      ? "All statuses"
                      : caseStatusFilter}
                  </span>
                  <span aria-hidden="true">▾</span>
                </button>

                {caseStatusMenuOpen && (
                  <div
                    className="investigationCaseStatusMenu"
                    role="listbox"
                    aria-label="Filter investigation cases by status"
                  >
                    {["All", ...statusOptions].map((option) => (
                      <button
                        className={
                          "investigationCaseStatusOption" +
                          (caseStatusFilter === option
                            ? " selected"
                            : "")
                        }
                        key={option}
                        type="button"
                        role="option"
                        aria-selected={caseStatusFilter === option}
                        onClick={() => {
                          setCaseStatusFilter(option);
                          setCaseStatusMenuOpen(false);
                        }}
                      >
                        {option === "All"
                          ? "All statuses"
                          : option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {casesLoading ? (
            <div className="networkAccountEmpty">
              Loading investigation cases...
            </div>
          ) : investigations.length ? (
            filteredInvestigations.length ? (
              <div className="investigationCaseList">
                {filteredInvestigations.map((item) => (
                <button
                  className={
                    "investigationCaseListItem" +
                    (selectedCaseId === item.id ? " selected" : "")
                  }
                  key={item.id}
                  type="button"
                  onClick={() => void openInvestigation(item.id)}
                >
                  <span>
                    <strong>{item.id}</strong>
                    <small>{item.account_id}</small>
                  </span>
                  <span className="investigationCaseListStatus">
                    {item.status}
                  </span>
                  <span className="investigationCaseListDate">
                    {new Date(item.updated_at).toLocaleString()}
                  </span>
                </button>
                ))}
              </div>
            ) : (
              <div className="networkAccountEmpty">
                No cases match the current search or status filter.
              </div>
            )
          ) : (
            <div className="networkAccountEmpty">
              No investigation cases have been created yet.
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panelHead">
            <div>
              <span className="sectionLabel">ACCOUNT SEARCH</span>
              <h2>Investigate an account</h2>
            </div>
          </div>

          <form className="networkSearchForm" onSubmit={investigate}>
            <div className="networkSearchField">
              <label htmlFor="investigation-account">Account ID</label>
              <input
                id="investigation-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                placeholder="Enter account ID"
              />
            </div>

            <button className="networkSearchButton primary" type="submit">
              {loading ? "Investigating..." : "Investigate"}
            </button>
          </form>

          {error && <p className="networkError">{error}</p>}
        </section>

        {account && (
          <>
            <section className="panel">
              <div className="panelHead">
                <div>
                  <span className="sectionLabel">
                    CASE WORKSPACE
                  </span>
                  <h2>
                    {investigation
                      ? investigation.id
                      : "New investigation"}
                  </h2>
                </div>
                <span className="riskBadge">
                  {investigation?.status ?? "NOT SAVED"}
                </span>
              </div>

              <div className="investigationCaseGrid">
                <div>
                  <label htmlFor="investigation-status">
                    Case status
                  </label>
                  <select
                    id="investigation-status"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value)
                    }
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="investigation-account-value">
                    Account
                  </label>
                  <input
                    id="investigation-account-value"
                    value={account.account}
                    readOnly
                  />
                </div>
              </div>

              <div className="investigationNotes">
                <label htmlFor="investigation-notes">
                  Investigator notes
                </label>
                <textarea
                  id="investigation-notes"
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  placeholder="Record findings, rationale, and follow-up actions."
                  rows={5}
                />
              </div>

              <div className="investigationCaseActions">
                {investigation && (
                  <button
                    className="investigationNewCaseButton"
                    type="button"
                    onClick={startNewInvestigation}
                  >
                    New investigation
                  </button>
                )}

                <button
                  className="primary"
                  type="button"
                  onClick={saveInvestigation}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : investigation
                      ? "Save investigation"
                      : "Create investigation"}
                </button>

                {saveMessage && (
                  <span className="investigationSaveMessage">
                    {saveMessage}
                  </span>
                )}
              </div>
            </section>

            {investigation && (
              <div className="investigationEvidenceGrid">
                <section className="panel">
                  <div className="panelHead">
                    <div>
                      <span className="sectionLabel">CASE EVIDENCE</span>
                      <h2>Evidence and findings</h2>
                    </div>
                    <span className="riskBadge">
                      {evidence.length} ITEMS
                    </span>
                  </div>

                  <div className="investigationEvidenceForm">
                    <select
                      value={evidenceType}
                      onChange={(event) =>
                        setEvidenceType(event.target.value)
                      }
                    >
                      {evidenceTypes.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>

                    <input
                      value={evidenceTitle}
                      onChange={(event) =>
                        setEvidenceTitle(event.target.value)
                      }
                      placeholder="Evidence title"
                    />

                    <textarea
                      value={evidenceDetails}
                      onChange={(event) =>
                        setEvidenceDetails(event.target.value)
                      }
                      placeholder="Describe the evidence or finding."
                      rows={4}
                    />

                    <button
                      className="primary"
                      type="button"
                      onClick={addEvidence}
                      disabled={evidenceSaving}
                    >
                      {evidenceSaving ? "Adding..." : "Add evidence"}
                    </button>
                  </div>

                  <div className="investigationEvidenceList">
                    {evidence.length ? (
                      evidence.map((item) => (
                        <article
                          className="investigationEvidenceItem"
                          key={item.id}
                        >
                          <div className="investigationEvidenceMeta">
                            <span>{item.evidence_type}</span>
                            <time>
                              {new Date(item.created_at).toLocaleString()}
                            </time>
                          </div>
                          <strong>{item.title}</strong>
                          <p>{item.details}</p>
                        </article>
                      ))
                    ) : (
                      <div className="networkAccountEmpty">
                        No evidence has been added yet.
                      </div>
                    )}
                  </div>
                </section>

                <section className="panel">
                  <div className="panelHead">
                    <div>
                      <span className="sectionLabel">CASE TIMELINE</span>
                      <h2>Investigation activity</h2>
                    </div>
                    <span className="riskBadge">
                      {timeline.length} EVENTS
                    </span>
                  </div>

                  <div className="investigationTimeline">
                    {timeline.length ? (
                      timeline.map((event) => (
                        <article
                          className="investigationTimelineItem"
                          key={event.id}
                        >
                          <span className="investigationTimelineDot" />
                          <div>
                            <div className="investigationTimelineMeta">
                              <strong>{event.title}</strong>
                              <time>
                                {new Date(event.created_at).toLocaleString()}
                              </time>
                            </div>
                            <p>{event.details}</p>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="networkAccountEmpty">
                        No timeline events yet.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            <div className="metrics">
              {[
                ["Transactions", account.transactions],
                ["Suspicious", account.suspicious_transactions],
                ["Counterparties", account.counterparties],
                ["Total volume", account.total_volume.toLocaleString()],
              ].map(([label, value]) => (
                <div className="metric" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>

            <section className="panel">
              <div className="panelHead">
                <div>
                  <span className="sectionLabel">ACCOUNT PROFILE</span>
                  <h2>{account.account}</h2>
                </div>
                <a className="linkButton" href={`/network?account=${encodeURIComponent(account.account)}`}>
                  Open network →
                </a>
              </div>

              <div className="detailGrid">
                <div>
                  <span>Incoming connections</span>
                  <strong>{account.in_degree ?? 0}</strong>
                </div>
                <div>
                  <span>Outgoing connections</span>
                  <strong>{account.out_degree ?? 0}</strong>
                </div>
                <div>
                  <span>PageRank</span>
                  <strong>{(account.pagerank ?? 0).toExponential(2)}</strong>
                </div>
                <div>
                  <span>Typology risk</span>
                  <strong>{(account.typology_risk ?? 0).toFixed(1)}</strong>
                </div>
              </div>

              <div className="relationshipDetail">
                <strong>Typology signal</strong>
                <span>{account.typology_reasons ?? "No typology signal"}</span>
              </div>
            </section>

            <section className="panel relationshipPanel">
              <div className="panelHead">
                <div>
                  <span className="sectionLabel">NETWORK RELATIONSHIPS</span>
                  <h2>Connected accounts</h2>
                </div>
                <span className="riskBadge">
                  {relationships.length} RELATIONSHIPS
                </span>
              </div>

              {relationships.length ? (
                <div className="relationshipList">
                  {relationships.map((relationship, index) => {
                    const connectedAccount =
                      relationship.source === account.account
                        ? relationship.target
                        : relationship.source;

                    return (
                      <a
                        className="relationshipRow"
                        href={
                          "/investigations?account=" +
                          encodeURIComponent(connectedAccount)
                        }
                        key={`RELATIONSHIP-${index}-${relationship.source}-${relationship.target}`}
                        aria-label={
                          "Investigate connected account " +
                          connectedAccount
                        }
                      >
                        <span className="relationshipDirection">
                          {relationship.source === account.account
                            ? "OUT"
                            : "IN"}
                        </span>
                        <span className="relationshipAccount">
                          {connectedAccount}
                        </span>
                        <span>{relationship.transactions} txns</span>
                        <span>{relationship.amount.toLocaleString()}</span>
                        <span
                          className={
                            relationship.suspicious
                              ? "riskText"
                              : "safeText"
                          }
                        >
                          {relationship.suspicious} suspicious
                        </span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="networkAccountEmpty">
                  No network relationships were found.
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
