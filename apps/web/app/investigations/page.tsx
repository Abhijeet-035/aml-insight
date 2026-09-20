"use client";

import {
  type FormEvent,
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

const statusOptions = [
  "Open",
  "In Review",
  "Escalated",
  "Closed",
];

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function InvestigationsPage() {
  const [accountId, setAccountId] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [investigation, setInvestigation] =
    useState<Investigation | null>(null);
  const [status, setStatus] = useState("Open");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const loadAccount = async (value: string) => {
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

      const [accountResponse, networkResponse] =
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

      setAccount(accountData);
      setRelationships(networkData.edges ?? []);
    } catch (requestError) {
      setAccount(null);
      setRelationships([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to investigate this account.",
      );
    } finally {
      setLoading(false);
    }
  };

  const investigate = async (event?: FormEvent) => {
    event?.preventDefault();
    await loadAccount(accountId);
  };

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    );
    const queryAccount = params.get("account");

    if (queryAccount) {
      setAccountId(queryAccount);
      void loadAccount(queryAccount);
    }
  }, []);

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
      setStatus(data.status);
      setNotes(data.notes);
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
                  {relationships.map((relationship, index) => (
                    <div
                      className="relationshipRow"
                      key={`${relationship.source}-${relationship.target}-${index}`}
                    >
                      <span className="relationshipDirection">
                        {relationship.source === account.account
                          ? "OUT"
                          : "IN"}
                      </span>
                      <span className="relationshipAccount">
                        {relationship.source === account.account
                          ? relationship.target
                          : relationship.source}
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
                    </div>
                  ))}
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
