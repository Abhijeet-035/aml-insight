"use client";

import { useEffect, useState } from "react";

type Transaction = {
  transaction_id: number;
  timestamp: string;
  account: string;
  counterparty: string;
  amount: number;
  currency: string;
  payment_format: string;
  risk: number;
  suspicious: boolean;
  pattern: string;
};

type TransactionReview = {
  transaction: {
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
  risk: {
    risk_score: number;
    threshold: number;
  };
  explanation: {
    feature: string;
    contribution: number;
  }[];
};



export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState("");
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [review, setReview] = useState<TransactionReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    const params = new URLSearchParams({
      limit: "100",
    });

    if (query.trim()) {
      params.set("query", query.trim());
    }

    if (suspiciousOnly) {
      params.set("suspicious_only", "true");
    }

    fetch(
      base +
        "/api/v1/transactions?" +
        params.toString(),
    )
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        setTransactions(Array.isArray(data) ? data : []);
      })
      .catch(() => setTransactions([]));
  }, [query, suspiciousOnly]);

  useEffect(() => {
    if (!selectedTransaction) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTransaction(null);
        setReview(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTransaction]);

  const reviewTransaction = async (item: Transaction) => {
    setSelectedTransaction(item);
    setReview(null);
    setReviewError("");
    setReviewLoading(true);

    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    try {
      const response = await fetch(
        base +
          "/api/v1/transaction/" +
          item.transaction_id +
          "/predict",
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Unable to load transaction analysis.");
      }

      const data = await response.json();

      setReview({
        transaction: data.transaction,
        risk: data.risk,
        explanation: data.explanation ?? [],
      });
    } catch (requestError) {
      setReviewError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load transaction analysis.",
      );
    } finally {
      setReviewLoading(false);
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
              {transactions.length} RESULTS
            </span>
          </div>

          <div className="transactionExplorerFilters">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search account, counterparty, transaction or currency"
            />

            <button
              className={
                "transactionFilterButton" +
                (suspiciousOnly ? " active" : "")
              }
              type="button"
              onClick={() =>
                setSuspiciousOnly((value) => !value)
              }
            >
              {suspiciousOnly
                ? "Suspicious only"
                : "All transactions"}
            </button>
          </div>

          <div className="table transactionTable">
            <div
              className="row transactionTableHeader"
              style={{
                fontWeight: 800,
                color: "var(--ink)",
              }}
            >
              <span>Transaction</span>
              <span>Account</span>
              <span>Counterparty</span>
              <span>Amount</span>
              <span>Risk</span>
              <span>Pattern</span>
              <span>Action</span>
            </div>

            {transactions.map((item) => (
              <div
                className="row transactionTableRow"
                key={item.transaction_id}
              >
                <span className="caseId" data-label="Transaction">
                  TX-{item.transaction_id}
                </span>
                <span data-label="Account">{item.account}</span>
                <span data-label="Counterparty">
                  {item.counterparty}
                </span>
                <span data-label="Amount">
                  {item.currency} {item.amount.toLocaleString()}
                </span>
                <span
                  className={
                    item.suspicious
                      ? "riskText"
                      : "transactionRiskNormal"
                  }
                  data-label="Risk"
                >
                  {item.risk.toFixed(1)}%
                </span>
                <span className="pattern" data-label="Pattern">
                  {item.pattern}
                </span>
                <button
                  className="linkButton"
                  type="button"
                  onClick={() => void reviewTransaction(item)}
                >
                  Review
                </button>
              </div>
            ))}
          </div>

          {selectedTransaction && (
            <div
              className="transactionReviewOverlay"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedTransaction(null);
                  setReview(null);
                }
              }}
            >
              <section
                className="transactionReviewModal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="transaction-review-title"
              >
                <div className="panelHead">
                  <div>
                    <span className="sectionLabel">
                      TRANSACTION REVIEW
                    </span>
                    <h2 id="transaction-review-title">
                      TX-{selectedTransaction.transaction_id}
                    </h2>
                  </div>
                  <button
                    className="alertReviewClose"
                    type="button"
                    onClick={() => {
                      setSelectedTransaction(null);
                      setReview(null);
                    }}
                  >
                    Close
                  </button>
                </div>

                {reviewLoading ? (
                  <div className="networkAccountEmpty">
                    Loading transaction analysis...
                  </div>
                ) : reviewError ? (
                  <p className="networkError">{reviewError}</p>
                ) : review ? (
                  <>
                    <div className="alertReviewSummary">
                      <div>
                        <span>Account</span>
                        <strong>
                          {review.transaction.account}
                        </strong>
                      </div>
                      <div>
                        <span>Counterparty</span>
                        <strong>
                          {review.transaction.counterparty_account}
                        </strong>
                      </div>
                      <div>
                        <span>Amount</span>
                        <strong>
                          {review.transaction.receiving_currency}{" "}
                          {review.transaction.amount_received.toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span>Risk</span>
                        <strong>
                          {review.risk.risk_score.toFixed(1)}%
                        </strong>
                      </div>
                    </div>

                    <div className="alertReviewGrid">
                      <div className="alertReviewDetails">
                        <span className="sectionLabel">
                          TRANSACTION
                        </span>
                        <dl>
                          <div>
                            <dt>Timestamp</dt>
                            <dd>{review.transaction.timestamp}</dd>
                          </div>
                          <div>
                            <dt>From bank</dt>
                            <dd>{review.transaction.from_bank}</dd>
                          </div>
                          <div>
                            <dt>To bank</dt>
                            <dd>{review.transaction.to_bank}</dd>
                          </div>
                          <div>
                            <dt>Payment format</dt>
                            <dd>
                              {review.transaction.payment_format}
                            </dd>
                          </div>
                          <div>
                            <dt>Paid amount</dt>
                            <dd>
                              {review.transaction.payment_currency}{" "}
                              {review.transaction.amount_paid.toLocaleString()}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="alertReviewDetails">
                        <span className="sectionLabel">
                          RISK SIGNALS
                        </span>
                        <div className="alertReviewRisk">
                          <strong>
                            Model risk:{" "}
                            {review.risk.risk_score.toFixed(1)}%
                          </strong>
                          <span>
                            Threshold:{" "}
                            {(review.risk.threshold * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="alertReviewSignals">
                          {review.explanation
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
                            review.transaction.account,
                          )
                        }
                      >
                        Investigate account
                      </a>
                      <span className="alertPattern">
                        {selectedTransaction.pattern}
                      </span>
                    </div>
                  </>
                ) : null}
              </section>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}