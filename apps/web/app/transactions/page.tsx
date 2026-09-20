"use client";

import { useEffect, useMemo, useState } from "react";

type Alert = {
  id: string;
  transaction_id: number;
  account: string;
  counterparty: string;
  amount: number;
  currency: string;
  risk: number;
  pattern: string;
};

const fallback: Alert[] = [
  {
    id: "AML-00128",
    transaction_id: 128,
    account: "ACC-8000A",
    counterparty: "ACC-1932F",
    amount: 182400,
    currency: "USD",
    risk: 94.2,
    pattern: "Fan-out",
  },
  {
    id: "AML-00127",
    transaction_id: 127,
    account: "ACC-1932F",
    counterparty: "ACC-5B821",
    amount: 91400,
    currency: "EUR",
    risk: 91.3,
    pattern: "Layering",
  },
  {
    id: "AML-00126",
    transaction_id: 126,
    account: "ACC-5B821",
    counterparty: "ACC-74D20",
    amount: 78200,
    currency: "GBP",
    risk: 88.7,
    pattern: "Cycle",
  },
  {
    id: "AML-00125",
    transaction_id: 125,
    account: "ACC-74D20",
    counterparty: "ACC-9F221",
    amount: 64300,
    currency: "USD",
    risk: 84.1,
    pattern: "Fan-in",
  },
];

export default function TransactionsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(fallback);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    fetch(`${base}/api/v1/alerts`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length) {
          setAlerts(data);
        }
      })
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return alerts;
    }

    return alerts.filter((item) =>
      Object.values(item).some((field) =>
        String(field).toLowerCase().includes(value)
      )
    );
  }, [alerts, query]);

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
          <a className="active" href="/transactions">Transactions</a>
          <a href="/predict">Predict</a>
          <a href="/network">Network</a>
          <a href="/alerts">Alerts</a>
          <a href="/investigations">Investigations</a>
          <a href="/models">Models</a>
        </nav>

        <div className="sidebarBottom">
          <span>IBM AML Benchmark</span>
          <span>HI-Small</span>
        </div>
      </aside>

      <section className="content">
        <header>
          <div>
            <p className="eyebrow">TRANSACTION INTELLIGENCE</p>

            <h1>Transaction explorer</h1>

            <p className="subtitle">
              Search suspicious flows and inspect the transaction-level
              evidence behind an alert.
            </p>
          </div>

          <div className="headerActions">
            <button className="primary">
              Export results
            </button>
          </div>
        </header>

        <section className="panel">
          <div className="panelHead">
            <div>
              <span className="sectionLabel">SEARCH</span>
              <h2>Transactions and alerts</h2>
            </div>

            <span className="riskBadge">
              {filtered.length} RESULTS
            </span>
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search account, counterparty, case, currency or pattern"
            style={{
              width: "100%",
              marginTop: 18,
              padding: "12px 14px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
              outline: "none",
            }}
          />

          <div className="table transactionTable">
            <div
              className="row transactionTableHeader"
              style={{
                fontWeight: 800,
                color: "var(--ink)",
              }}
            >
              <span>Case</span>
              <span>Account</span>
              <span>Counterparty</span>
              <span>Amount</span>
              <span>Risk</span>
              <span>Pattern</span>
              <span>Action</span>
            </div>

            {filtered.map((item) => (
              <div
                className="row transactionTableRow"
                key={item.id}
              >
                <span
                  className="caseId"
                  data-label="Case"
                >
                  {item.id}
                </span>

                <span data-label="Account">
                  {item.account}
                </span>

                <span data-label="Counterparty">
                  {item.counterparty}
                </span>

                <span data-label="Amount">
                  {item.currency}{" "}
                  {item.amount.toLocaleString()}
                </span>

                <span
                  className="riskText"
                  data-label="Risk"
                >
                  {item.risk.toFixed(1)}%
                </span>

                <span
                  className="pattern"
                  data-label="Pattern"
                >
                  {item.pattern}
                </span>

                <a
                  href={`/predict?transaction_id=${item.transaction_id}`}
                  className="linkButton"
                  data-label="Action"
                >
                  Analyze
                </a>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}