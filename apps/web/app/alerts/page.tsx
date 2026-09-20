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

type TransactionDetails = {
  transaction_id: number;
  timestamp: string;
  from_bank: string;
  account: string;
  to_bank: string;
  counterparty_account: string;
  amount_received: number;
  receiving_currency: string;
  amount_paid: number;
  payment_currency: string;
  payment_format: string;
};

type RiskExplanation = {
  feature: string;
  value: number;
  contribution: number;
  direction: string;
};

type AlertReview = {
  transaction: TransactionDetails;
  risk: {
    risk_probability: number;
    risk_score: number;
    threshold: number;
    prediction: number;
  } | null;
  explanation: RiskExplanation[];
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
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alertReview, setAlertReview] = useState<AlertReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    if (!selectedAlert) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeReview();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedAlert]);

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

  const reviewAlert = async (alert: Alert) => {
    setSelectedAlert(alert);
    setAlertReview(null);
    setReviewError("");
    setReviewLoading(true);

    try {
      const transactionResponse = await fetch(
        API_URL +
          "/api/v1/transaction/" +
          encodeURIComponent(String(alert.transaction_id)),
      );

      if (!transactionResponse.ok) {
        throw new Error("Unable to load transaction details.");
      }

      const transaction = await transactionResponse.json();
      let risk = null;
      let explanation: RiskExplanation[] = [];

      try {
        const predictionResponse = await fetch(
          API_URL +
            "/api/v1/transaction/" +
            encodeURIComponent(String(alert.transaction_id)) +
            "/predict",
          {
            method: "POST",
          },
        );

        if (predictionResponse.ok) {
          const prediction = await predictionResponse.json();
          risk = prediction.risk;
          explanation = prediction.explanation ?? [];
        }
      } catch {
        risk = null;
      }

      setAlertReview({
        transaction,
        risk,
        explanation,
      });
    } catch (requestError) {
      setReviewError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load alert details.",
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const closeReview = () => {
    setSelectedAlert(null);
    setAlertReview(null);
    setReviewError("");
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
                  <button
                    className="alertReviewButton"
                    type="button"
                    onClick={() => void reviewAlert(alert)}
                  >
                    Review
                  </button>
                  <a
                    className="analyzeLink"
                    href={
                      "/investigations?account=" +
                      encodeURIComponent(alert.account)
                    }
                  >
                    Investigate
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="networkAccountEmpty">
              No alerts are available for the current dataset.
            </div>
          )}
        </section>

        {selectedAlert && (
          <div
            className="alertReviewOverlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeReview();
              }
            }}
          >
            <section
              className="alertReviewModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="alert-review-title"
            >
              <div className="panelHead">
                <div>
                  <span className="sectionLabel">ALERT REVIEW</span>
                  <h2 id="alert-review-title">{selectedAlert.id}</h2>
                </div>
                <button
                  className="alertReviewClose"
                  type="button"
                  aria-label="Close alert review"
                  onClick={closeReview}
                >
                  Close
                </button>
              </div>

              {reviewLoading ? (
                <div className="networkAccountEmpty">
                  Loading alert details...
                </div>
              ) : reviewError ? (
                <p className="networkError">{reviewError}</p>
              ) : alertReview ? (
                <>
                  <div className="alertReviewSummary">
                    <div>
                      <span>Account</span>
                      <strong>
                        {selectedAlert.account ||
                          alertReview.transaction.account ||
                          "Unavailable"}
                      </strong>
                    </div>
                    <div>
                      <span>Counterparty</span>
                      <strong>
                        {selectedAlert.counterparty ||
                          alertReview.transaction.counterparty_account ||
                          "Unavailable"}
                      </strong>
                    </div>
                    <div>
                      <span>Amount</span>
                      <strong>
                        {alertReview.transaction.receiving_currency}{" "}
                        {formatMoney(
                          alertReview.transaction.amount_received,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Alert risk</span>
                      <strong>{selectedAlert.risk.toFixed(1)}%</strong>
                    </div>
                  </div>

                  <div className="alertReviewGrid">
                    <div className="alertReviewDetails">
                      <span className="sectionLabel">TRANSACTION</span>
                      <dl>
                        <div>
                          <dt>Timestamp</dt>
                          <dd>{alertReview.transaction.timestamp}</dd>
                        </div>
                        <div>
                          <dt>From bank</dt>
                          <dd>{alertReview.transaction.from_bank}</dd>
                        </div>
                        <div>
                          <dt>To bank</dt>
                          <dd>{alertReview.transaction.to_bank}</dd>
                        </div>
                        <div>
                          <dt>Payment format</dt>
                          <dd>
                            {alertReview.transaction.payment_format}
                          </dd>
                        </div>
                        <div>
                          <dt>Paid amount</dt>
                          <dd>
                            {alertReview.transaction.payment_currency}{" "}
                            {formatMoney(
                              alertReview.transaction.amount_paid,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="alertReviewDetails">
                      <span className="sectionLabel">RISK SIGNALS</span>
                      {alertReview.risk ? (
                        <div className="alertReviewRisk">
                          <strong>
                            Model risk:{" "}
                            {alertReview.risk.risk_score.toFixed(1)}%
                          </strong>
                          <span>
                            Threshold:{" "}
                            {(
                              alertReview.risk.threshold * 100
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                      ) : (
                        <p className="networkAccountEmpty">
                          Model explanation is unavailable. The alert
                          typology remains available for review.
                        </p>
                      )}

                      <div className="alertReviewSignals">
                        {alertReview.explanation
                          .slice(0, 5)
                          .map((item) => (
                            <div key={item.feature}>
                              <span>{item.feature}</span>
                              <strong>
                                {item.contribution >= 0 ? "+" : ""}
                                {item.contribution.toFixed(3)}
                              </strong>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div className="alertReviewActions">
                    <a
                      className="primary"
                      href={
                        "/investigations?account=" +
                        encodeURIComponent(
                          alertReview.transaction.account,
                        )
                      }
                    >
                      Investigate account
                    </a>
                    <span className="alertPattern">
                      {selectedAlert.pattern}
                    </span>
                  </div>
                </>
              ) : null}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
