"use client";

import { FormEvent, useEffect, useState } from "react";

type AccountSummary = {
  account: string;
  transactions: number;
  suspicious_transactions: number;
  counterparties: number;
  total_volume: number;
  in_degree?: number;
  out_degree?: number;
  pagerank?: number;
};

type NetworkNode = {
  id: string;
  label: string;
};

type NetworkEdge = {
  source: string;
  target: string;
  transactions: number;
  amount: number;
  suspicious: number;
};

type NetworkResponse = {
  account: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DEFAULT_ACCOUNT = "80A21CFF0";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

function NetworkGraph({
  account,
  nodes,
  edges,
  onAccountClick,
}: {
  account: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  onAccountClick: (accountId: string) => void;
}) {
  const connectedNodes = nodes.filter((node) => node.id !== account);

  if (!connectedNodes.length) {
    return (
      <div className="investigationGraph emptyGraph">
        <strong>No connected accounts found</strong>
        <span>This account has no network relationships in the graph.</span>
      </div>
    );
  }

  const positions = [
    { x: 50, y: 50 },
    { x: 22, y: 25 },
    { x: 78, y: 25 },
    { x: 20, y: 75 },
    { x: 80, y: 75 },
    { x: 50, y: 14 },
    { x: 50, y: 86 },
    { x: 10, y: 50 },
    { x: 90, y: 50 },
  ];

  const visibleNodes = connectedNodes.slice(0, positions.length - 1);
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = edges.filter((edge) => {
    if (edge.source === account && edge.target === account) {
      return true;
    }

    const target =
      edge.source === account ? edge.target : edge.source;

    return visibleNodeIds.has(target);
  });

  return (
    <div className="investigationGraph">
      <svg
        className="networkSvg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <marker
            id="networkArrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill="#b9c9d8"
            />
          </marker>

          <marker
            id="suspiciousArrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill="var(--danger)"
            />
          </marker>
        </defs>

        {visibleEdges.map((edge, index) => {
          if (edge.source === account && edge.target === account) {
            return (
              <path
                key={`${edge.source}-${edge.target}-${index}`}
                d="M 56 44 C 72 30, 72 70, 56 56"
                className={
                  edge.suspicious > 0
                    ? "networkConnection suspiciousConnection"
                    : "networkConnection"
                }
                fill="none"
                markerEnd={
                  edge.suspicious > 0
                    ? "url(#suspiciousArrow)"
                    : "url(#networkArrow)"
                }
              />
            );
          }

          const target =
            edge.source === account ? edge.target : edge.source;

          const nodeIndex = visibleNodes.findIndex(
            (node) => node.id === target
          );

          if (nodeIndex < 0) {
            return null;
          }

          const position = positions[nodeIndex + 1];
          const isOutgoing = edge.source === account;
          const isSuspicious = edge.suspicious > 0;

          return (
            <line
              key={`${edge.source}-${edge.target}-${index}`}
              x1={isOutgoing ? "50" : position.x}
              y1={isOutgoing ? "50" : position.y}
              x2={isOutgoing ? position.x : "50"}
              y2={isOutgoing ? position.y : "50"}
              className={
                isSuspicious
                  ? "networkConnection suspiciousConnection"
                  : "networkConnection"
              }
              markerEnd={
                isOutgoing
                  ? isSuspicious
                    ? "url(#suspiciousArrow)"
                    : "url(#networkArrow)"
                  : undefined
              }
              markerStart={
                !isOutgoing
                  ? isSuspicious
                    ? "url(#suspiciousArrow)"
                    : "url(#networkArrow)"
                  : undefined
              }
            />
          );
        })}
      </svg>

      <div className="investigationNode centralNode">
        <strong>{account}</strong>
        <span>Investigated account</span>
      </div>

      {visibleNodes.map((node, index) => {
        const position = positions[index + 1];

        return (
          <button
            className="investigationNode connectedNode"
            key={node.id}
            type="button"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
            onClick={() => onAccountClick(node.id)}
          >
            <strong>{node.label}</strong>
            <span>
              {edges
                .filter(
                  (edge) =>
                    edge.source === node.id ||
                    edge.target === node.id
                )
                .reduce(
                  (total, edge) => total + edge.transactions,
                  0
                )}{" "}
              txns
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function NetworkPage() {
  const [account, setAccount] = useState(DEFAULT_ACCOUNT);
  const [searchAccount, setSearchAccount] =
    useState(DEFAULT_ACCOUNT);
  const [summary, setSummary] =
    useState<AccountSummary | null>(null);
  const [network, setNetwork] =
    useState<NetworkResponse | null>(null);
  const [selectedEdge, setSelectedEdge] =
    useState<NetworkEdge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAccount = async (accountId: string) => {
    setLoading(true);
    setError("");
    setSelectedEdge(null);
    setSearchAccount(accountId);

    try {
      const [summaryResponse, networkResponse] =
        await Promise.all([
          fetch(`${API_URL}/api/v1/account/${accountId}`),
          fetch(`${API_URL}/api/v1/account/${accountId}/network`),
        ]);

      if (!summaryResponse.ok || !networkResponse.ok) {
        throw new Error("Account could not be loaded");
      }

      const summaryData = await summaryResponse.json();
      const networkData = await networkResponse.json();

      setAccount(accountId);
      setSummary(summaryData);
      setNetwork(networkData);
    } catch {
      setSummary(null);
      setNetwork(null);
      setError(
        `Unable to load account ${accountId}. Check the account ID and API status.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount(DEFAULT_ACCOUNT);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const accountId = searchAccount.trim();

    if (!accountId) {
      return;
    }

    loadAccount(accountId);
  };

  const accountEdges =
    network?.edges.filter(
      (edge) =>
        edge.source === account || edge.target === account
    ) ?? [];

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
          <a className="active" href="/network">
            Network
          </a>
          <a>Alerts</a>
          <a>Investigations</a>
          <a>Models</a>
        </nav>

        <div className="sidebarBottom">
          <span>IBM AML Benchmark</span>
          <span>Network investigation</span>
        </div>
      </aside>

      <section className="content">
        <header>
          <div>
            <p className="eyebrow">NETWORK INVESTIGATION</p>
            <h1>Account relationship analysis</h1>
            <p className="subtitle">
              Investigate connected accounts, transaction flows,
              and suspicious relationships.
            </p>
          </div>
        </header>

        <section className="panel networkSearchPanel">
          <div className="panelHead">
            <div>
              <span className="sectionLabel">
                ACCOUNT INVESTIGATION
              </span>
              <h2>Search account network</h2>
            </div>
          </div>

          <form className="networkSearchForm" onSubmit={handleSubmit}>
            <div className="networkSearchField">
              <label htmlFor="account">
                Account ID
              </label>

              <input
                id="account"
                value={searchAccount}
                onChange={(event) =>
                  setSearchAccount(event.target.value)
                }
                placeholder="Enter account ID"
              />
            </div>

            <button
              className="primary networkSearchButton"
              type="submit"
              disabled={loading}
            >
              {loading ? "Loading..." : "Investigate"}
            </button>
          </form>

          {error && (
            <p className="networkError">
              {error}
            </p>
          )}
        </section>

        {summary && network && (
          <>
            <div className="metrics networkMetrics">
              <div className="metric">
                <span>Transactions</span>
                <strong>
                  {formatNumber(summary.transactions)}
                </strong>
                <small>Related transactions</small>
              </div>

              <div className="metric">
                <span>Suspicious</span>
                <strong>
                  {formatNumber(
                    summary.suspicious_transactions
                  )}
                </strong>
                <small>Observed laundering labels</small>
              </div>

              <div className="metric">
                <span>Counterparties</span>
                <strong>
                  {formatNumber(summary.counterparties)}
                </strong>
                <small>Connected accounts</small>
              </div>

              <div className="metric">
                <span>Total volume</span>
                <strong>
                  {formatMoney(summary.total_volume)}
                </strong>
                <small>Observed transaction volume</small>
              </div>
            </div>

            <div className="networkInvestigationGrid">
              <section className="panel networkGraphPanel">
                <div className="panelHead">
                  <div>
                    <span className="sectionLabel">
                      RELATIONSHIP GRAPH
                    </span>
                    <h2>{account}</h2>
                  </div>

                  <span className="riskBadge">
                    {accountEdges.length} CONNECTIONS
                  </span>
                </div>

                <NetworkGraph
                  account={account}
                  nodes={network.nodes}
                  edges={network.edges}
                  onAccountClick={loadAccount}
                />

                <div className="networkLegend">
                  <span>
                    <i />
                    Investigated account
                  </span>

                  <span>
                    <i className="muted" />
                    Related account
                  </span>

                  <span>
                    <i className="danger" />
                    Suspicious flow
                  </span>
                </div>
              </section>

              <section className="panel accountProfilePanel">
                <div className="panelHead">
                  <div>
                    <span className="sectionLabel">
                      ACCOUNT PROFILE
                    </span>
                    <h2>Network metrics</h2>
                  </div>
                </div>

                <div className="accountMetric">
                  <span>Incoming connections</span>
                  <strong>
                    {summary.in_degree ?? 0}
                  </strong>
                </div>

                <div className="accountMetric">
                  <span>Outgoing connections</span>
                  <strong>
                    {summary.out_degree ?? 0}
                  </strong>
                </div>

                <div className="accountMetric">
                  <span>PageRank</span>
                  <strong>
                    {summary.pagerank?.toExponential(3) ??
                      "N/A"}
                  </strong>
                </div>
              </section>
            </div>

            <section className="panel relationshipPanel">
              <div className="panelHead">
                <div>
                  <span className="sectionLabel">
                    RELATIONSHIP DETAILS
                  </span>
                  <h2>Connected accounts</h2>
                </div>
              </div>

              <div className="relationshipList">
                {accountEdges.map((edge) => {
                  const connectedAccount =
                    edge.source === account
                      ? edge.target
                      : edge.source;

                  return (
                    <button
                      className="relationshipRow"
                      key={`${edge.source}-${edge.target}`}
                      type="button"
                      onClick={() => setSelectedEdge(edge)}
                    >
                      <span className="relationshipDirection">
                        {edge.source === account
                          ? "OUT"
                          : "IN"}
                      </span>

                      <span className="relationshipAccount">
                        {connectedAccount}
                      </span>

                      <span>
                        {formatNumber(edge.transactions)} txns
                      </span>

                      <span>
                        {formatMoney(edge.amount)}
                      </span>

                      <span
                        className={
                          edge.suspicious > 0
                            ? "riskText"
                            : "safeText"
                        }
                      >
                        {formatNumber(edge.suspicious)} suspicious
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedEdge && (
                <div className="relationshipDetail">
                  <span className="sectionLabel">
                    SELECTED RELATIONSHIP
                  </span>

                  <strong>
                    {selectedEdge.source} →{" "}
                    {selectedEdge.target}
                  </strong>

                  <div className="relationshipDetailGrid">
                    <span>
                      Transactions
                      <strong>
                        {formatNumber(
                          selectedEdge.transactions
                        )}
                      </strong>
                    </span>

                    <span>
                      Total amount
                      <strong>
                        {formatMoney(selectedEdge.amount)}
                      </strong>
                    </span>

                    <span>
                      Suspicious
                      <strong>
                        {formatNumber(
                          selectedEdge.suspicious
                        )}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
