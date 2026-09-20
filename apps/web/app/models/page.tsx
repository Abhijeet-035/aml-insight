"use client";

import { useEffect, useState } from "react";

type ModelResponse = {
  status: string;
  metrics: Record<string, unknown> | null;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const formatMetric = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toFixed(4);
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value === null || value === undefined) {
    return "—";
  }

  return String(value);
};

export default function ModelsPage() {
  const [model, setModel] = useState<ModelResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/model`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load model status");
        }

        setModel(await response.json());
      })
      .catch(() => {
        setModel(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const metrics = model?.metrics
    ? Object.entries(model.metrics)
    : [];

  const selectedThreshold =
    typeof model?.metrics?.selected_threshold === "number"
      ? Number(model.metrics.selected_threshold)
      : null;

  const performanceMetrics = metrics.filter(
    ([key]) =>
      ![
        "selected_threshold",
        "threshold",
        "feature_count",
        "training_rows",
        "test_rows",
      ].includes(key),
  );

  const formatLabel = (key: string) =>
    key
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

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
          <a href="/investigations">Investigations</a>
          <a className="active" href="/models">Models</a>
        </nav>

        <div className="sidebarBottom">
          <span>IBM AML Benchmark</span>
          <span>Model loaded</span>
        </div>
      </aside>

      <section className="content">
        <header>
          <div>
            <p className="eyebrow">MODEL GOVERNANCE</p>
            <h1>Risk model</h1>
            <p className="subtitle">
              Review the current model state and evaluation metrics.
            </p>
          </div>
        </header>

        {loading ? (
          <section className="panel">
            <div className="networkAccountEmpty">
              Loading model status...
            </div>
          </section>
        ) : model ? (
          <>
            <div className="metrics">
              <div className="metric">
                <span>Model state</span>
                <strong>{model.status.replaceAll("_", " ")}</strong>
              </div>

              <div className="metric">
                <span>Model source</span>
                <strong>XGBoost</strong>
              </div>

              <div className="metric">
                <span>Evaluation metrics</span>
                <strong>{performanceMetrics.length}</strong>
              </div>

              <div className="metric">
                <span>Decision threshold</span>
                <strong>
                  {selectedThreshold !== null
                    ? (selectedThreshold * 100).toFixed(2) + "%"
                    : "—"}
                </strong>
              </div>
            </div>

            <section className="panel modelGovernancePanel">
              <div className="panelHead">
                <div>
                  <span className="sectionLabel">MODEL GOVERNANCE</span>
                  <h2>Current decision configuration</h2>
                </div>
                <span className="riskBadge">
                  {model.status.toUpperCase()}
                </span>
              </div>

              <div className="modelGovernanceGrid">
                <div>
                  <span>Model family</span>
                  <strong>XGBoost</strong>
                </div>

                <div>
                  <span>Artifact state</span>
                  <strong>
                    {model.status === "trained"
                      ? "Loaded"
                      : "Unavailable"}
                  </strong>
                </div>

                <div>
                  <span>Decision threshold</span>
                  <strong>
                    {selectedThreshold !== null
                      ? (selectedThreshold * 100).toFixed(2) + "%"
                      : "Not available"}
                  </strong>
                </div>

                <div>
                  <span>Evaluation status</span>
                  <strong>
                    {model.metrics ? "Available" : "Pending"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panelHead">
                <div>
                  <span className="sectionLabel">EVALUATION</span>
                  <h2>Model metrics</h2>
                </div>
                <span className="riskBadge">
                  {model.status.toUpperCase()}
                </span>
              </div>

              {performanceMetrics.length ? (
                <div className="detailGrid modelMetricGrid">
                  {metrics.map(([key, value]) => (
                    <div key={key}>
                      <span>{formatLabel(key)}</span>
                      <strong>{formatMetric(value)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="networkAccountEmpty">
                  No evaluation metrics are available.
                </div>
              )}
            </section>

            <section className="panel modelWorkflowPanel">
              <div className="panelHead">
                <div>
                  <span className="sectionLabel">ANALYST WORKFLOW</span>
                  <h2>Use the model</h2>
                </div>
              </div>

              <p>
                Select a transaction to review its model score and
                explainable risk signals.
              </p>

              <div className="modelWorkflowActions">
                <a className="primary" href="/transactions">
                  Open transactions
                </a>
                <a className="secondaryButton" href="/predict">
                  Run prediction
                </a>
              </div>
            </section>
          </>
        ) : (
          <section className="panel">
            <div className="networkAccountEmpty">
              Model status is not available.
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
