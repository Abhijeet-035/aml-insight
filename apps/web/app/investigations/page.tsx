"use client";

import { type FormEvent, useState } from "react";

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

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function InvestigationsPage() {
  const [accountId, setAccountId] = useState("80A21CFF0");
  const [account, setAccount] = useState<Account | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const investigate = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setError("");

    try {
      const encoded = encodeURIComponent(accountId.trim());

      const [accountResponse, networkResponse] =
        await Promise.all([
          fetch(`${API_URL}/api/v1/account/${encoded}`),
          fetch(`${API_URL}/api/v1/account/${encoded}/network?limit=50`),
        ]);

      if (!accountResponse.ok) {
        throw new Error("Account was not found in the current dataset.");
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
