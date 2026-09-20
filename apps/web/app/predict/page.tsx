"use client";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type PredictionResponse = {
  transaction: {
    transaction_id: number;
    timestamp: string;
    from_bank: number;
    account: string;
    to_bank: number;
    counterparty_account: string;
    amount_received: number;
    receiving_currency: string;
    amount_paid: number;
    payment_currency: string;
    payment_format: string;
  };
  risk: {
    risk_probability: number;
    risk_score: number;
    threshold: number;
    prediction: number;
  };
  explanation: {
    feature: string;
    value: number;
    contribution: number;
    direction: "increases_risk" | "decreases_risk" | "neutral";
  }[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function PredictContent() {
  const searchParams = useSearchParams();
  const [transactionId, setTransactionId] = useState("");
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const value = searchParams.get("transaction_id");

    if (value && /^\d+$/.test(value)) {
      setTransactionId(value);
    }
  }, [searchParams]);

  async function analyzeTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    const id = Number(transactionId);

    if (!Number.isInteger(id) || id < 0) {
      setError("Enter a valid transaction ID.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/v1/transaction/${id}/predict`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to analyze transaction.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze transaction.",
      );
    } finally {
      setLoading(false);
    }
  }

  const riskPercentage = result
    ? result.risk.risk_probability * 100
    : 0;

  const positiveSignals = result
    ? result.explanation
      .filter((item) => item.direction === "increases_risk")
      .slice(0, 4)
    : [];

  const negativeSignals = result
    ? result.explanation
      .filter((item) => item.direction === "decreases_risk")
      .slice(0, 4)
    : [];

  return (
    <main>
      <aside>
        <div className="brand">
          <div className="brandMark">A</div>
          <div>
            <strong>AML Insight</strong>
            <small>TRANSACTION INTELLIGENCE</small>
          </div>
        </div>

        <nav>
          <a href="/">Overview</a>
          <a href="/transactions">Transactions</a>
          <a href="/predict" className="active">
            Predict
          </a>
          <a href="/">Network</a>
          <a href="/">Alerts</a>
          <a href="/">Investigations</a>
          <a href="/">Models</a>
        </nav>

        <div className="sidebarBottom">
          <span>AML RISK PLATFORM</span>
          <span>MODEL: XGBOOST</span>
        </div>
      </aside>

      <section className="content">
        <header className="predictIntro">
          <div>
            <p className="eyebrow">TRANSACTION INTELLIGENCE</p>
            <h1>Transaction Risk Analysis</h1>
            <p className="subtitle">
              Analyze an individual transaction using the trained AML risk
              model.
            </p>
          </div>
        </header>

        <section className="panel">
          <div className="panelHead">
            <div>
              <p className="sectionLabel">RISK PREDICTION</p>
              <h2>Analyze Transaction</h2>
            </div>
          </div>

          <form className="predictForm" onSubmit={analyzeTransaction}>
            <div className="predictField">
              <label htmlFor="transaction-id">Transaction ID</label>
              <input
                id="transaction-id"
                type="number"
                min="0"
                value={transactionId}
                onChange={(event) => setTransactionId(event.target.value)}
                placeholder="Enter transaction ID"
              />
            </div>

            <button
              className="primary predictButton"
              type="submit"
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Analyze Transaction"}
            </button>
          </form>

          {error && <div className="predictError">{error}</div>}
        </section>

        {result && (
          <div className="predictGrid">
            <section className="panel">
              <div className="panelHead">
                <div>
                  <p className="sectionLabel">TRANSACTION</p>
                  <h2>Transaction Details</h2>
                </div>
              </div>

              <div className="detailGrid">
                <div className="detailItem">
                  <span>Transaction ID</span>
                  <strong>{result.transaction.transaction_id}</strong>
                </div>

                <div className="detailItem">
                  <span>Timestamp</span>
                  <strong>{result.transaction.timestamp}</strong>
                </div>

                <div className="detailItem">
                  <span>Account</span>
                  <strong>{result.transaction.account}</strong>
                </div>

                <div className="detailItem">
                  <span>Counterparty</span>
                  <strong>
                    {result.transaction.counterparty_account}
                  </strong>
                </div>

                <div className="detailItem">
                  <span>From Bank</span>
                  <strong>{result.transaction.from_bank}</strong>
                </div>

                <div className="detailItem">
                  <span>To Bank</span>
                  <strong>{result.transaction.to_bank}</strong>
                </div>

                <div className="detailItem">
                  <span>Amount Paid</span>
                  <strong>
                    {result.transaction.amount_paid}{" "}
                    {result.transaction.payment_currency}
                  </strong>
                </div>

                <div className="detailItem">
                  <span>Amount Received</span>
                  <strong>
                    {result.transaction.amount_received}{" "}
                    {result.transaction.receiving_currency}
                  </strong>
                </div>

                <div className="detailItem">
                  <span>Payment Format</span>
                  <strong>{result.transaction.payment_format}</strong>
                </div>
              </div>
            </section>

            <section className="panel riskPanel">
              <div className="panelHead">
                <div>
                  <p className="sectionLabel">MODEL OUTPUT</p>
                  <h2>Risk Assessment</h2>
                </div>
              </div>

              <div className="riskScore">
                <span>Risk Score</span>
                <strong>{result.risk.risk_score}</strong>
              </div>

              <div className="riskBar">
                <i style={{ width: `${riskPercentage}%` }} />
              </div>

              <div className="riskStats">
                <div className="riskStat">
                  <span>Risk Probability</span>
                  <strong>{riskPercentage.toFixed(2)}%</strong>
                </div>

                <div className="riskStat">
                  <span>Classification Threshold</span>
                  <strong>
                    {(result.risk.threshold * 100).toFixed(2)}%
                  </strong>
                </div>
              </div>

              <div
                className={`predictionBadge ${result.risk.prediction === 1 ? "suspicious" : ""
                  }`}
              >
                {result.risk.prediction === 1
                  ? "Suspicious Transaction"
                  : "Not Suspicious"}
              </div>
            </section>
            <section className="panel explanationPanel">
              <div className="panelHead">
                <div>
                  <p className="sectionLabel">MODEL EXPLANATION</p>
                  <h2>Explainable Risk Signals</h2>
                </div>
              </div>

              <p className="explanationIntro">
                These signals show which model features pushed the prediction
                upward or downward for this transaction. They describe model
                behavior and should not be interpreted as causal evidence.
              </p>

              <div className="explanationGrid">
                <div className="signalGroup">
                  <div className="signalHeader">
                    <span>INCREASES RISK</span>
                    <span>CONTRIBUTION</span>
                  </div>

                  {positiveSignals.map((item) => (
                    <div className="signalRow" key={item.feature}>
                      <div>
                        <strong>{item.feature}</strong>
                        <span>Value: {item.value.toLocaleString()}</span>
                      </div>

                      <strong className="positiveContribution">
                        +{item.contribution.toFixed(4)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="signalGroup">
                  <div className="signalHeader">
                    <span>DECREASES RISK</span>
                    <span>CONTRIBUTION</span>
                  </div>

                  {negativeSignals.map((item) => (
                    <div className="signalRow" key={item.feature}>
                      <div>
                        <strong>{item.feature}</strong>
                        <span>Value: {item.value.toLocaleString()}</span>
                      </div>

                      <strong className="negativeContribution">
                        {item.contribution.toFixed(4)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

      </section>
    </main>
  );
}
export default function PredictPage() {
  return (
    <Suspense fallback={<main />}>
      <PredictContent />
    </Suspense>
  );
}