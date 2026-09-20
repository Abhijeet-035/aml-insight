"use client";

import { useEffect, useState } from "react";

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

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/alerts?limit=100`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load alerts");
        }

        setAlerts(await response.json());
      })
      .catch(() => {
        setAlerts([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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
          <a className="active" href="/alerts">Alerts</a>
          <a href="/investigations">Investigations</a>
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
            <p className="eyebrow">RISK MONITORING</p>
            <h1>Alert queue</h1>
            <p className="subtitle">
              Review suspicious transactions and the signals associated with
              them.
            </p>
          </div>
        </header>

        <section className="panel alertsPanel">
          <div className="panelHead">
            <div>
              <span className="sectionLabel">SUSPICIOUS ACTIVITY</span>
              <h2>Recent alerts</h2>
            </div>
            <span className="riskBadge">{alerts.length} ALERTS</span>
          </div>

          {loading ? (
            <div className="networkAccountEmpty">
              Loading alerts...
            </div>
          ) : alerts.length ? (
            <div className="table">
              {alerts.map((alert) => (
                <div className="row" key={alert.id}>
                  <span className="caseId">{alert.id}</span>
                  <span>{alert.account}</span>
                  <span className="riskText">
                    {alert.risk.toFixed(1)}%
                  </span>
                  <span className="pattern">{alert.pattern}</span>
                  <span>
                    {alert.currency} {formatMoney(alert.amount)}
                  </span>
                  <span>{alert.counterparty}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="networkAccountEmpty">
              No alerts are available for the current dataset.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
