"use client";

import { useEffect, useState } from "react";

type Overview = { transactions: number; alerts: number; suspicious_rate: number; network_nodes: number; risk_volume: number; model_status: string; data_status: string };
type Alert = { id: string; account: string; counterparty: string; amount: number; currency: string; risk: number; pattern: string };
type Network = { nodes: { id: string; label: string }[]; edges: { source: string; target: string; transactions: number; amount: number; suspicious: number }[] };

const fallbackOverview: Overview = { transactions: 50000, alerts: 412, suspicious_rate: 0.824, network_nodes: 5000, risk_volume: 24500000, model_status: "not_trained", data_status: "demo_data" };
const fallbackAlerts: Alert[] = [
  { id: "AML-00128", account: "ACC-8000A", counterparty: "ACC-1932F", amount: 182400, currency: "USD", risk: 94.2, pattern: "Fan-out" },
  { id: "AML-00127", account: "ACC-1932F", counterparty: "ACC-5B821", amount: 91400, currency: "EUR", risk: 91.3, pattern: "Layering" },
  { id: "AML-00126", account: "ACC-5B821", counterparty: "ACC-74D20", amount: 78200, currency: "GBP", risk: 88.7, pattern: "Cycle" },
  { id: "AML-00125", account: "ACC-74D20", counterparty: "ACC-9F221", amount: 64300, currency: "USD", risk: 84.1, pattern: "Fan-in" },
];

const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { notation: value >= 1000000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
const formatMoney = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: value >= 1000000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);

function Network({ data }: { data: Network | null }) {
  const edges = data?.edges ?? [];
  const nodes = data?.nodes ?? [];

  if (!nodes.length || !edges.length) {
    return (
      <div className="network networkGraph networkGraphEmpty">
        <div className="networkEmptyState">
          <strong>Network pending</strong>
          <span>Load processed data</span>
        </div>
      </div>
    );
  }

  const connectionCounts = new Map<string, number>();

  edges.forEach((edge) => {
    connectionCounts.set(
      edge.source,
      (connectionCounts.get(edge.source) ?? 0) + 1,
    );

    connectionCounts.set(
      edge.target,
      (connectionCounts.get(edge.target) ?? 0) + 1,
    );
  });

  const focusNode = [...connectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .at(0)?.[0] ?? nodes[0].id;

  const relatedEdges = edges
    .filter(
      (edge) =>
        edge.source === focusNode ||
        edge.target === focusNode,
    )
    .filter((edge) => edge.source !== edge.target)
    .sort(
      (a, b) =>
        b.suspicious - a.suspicious ||
        b.transactions - a.transactions,
    )
    .slice(0, 4);

  const neighborIds = [
    ...new Set(
      relatedEdges.flatMap((edge) => [
        edge.source,
        edge.target,
      ]),
    ),
  ]
    .filter((id) => id !== focusNode)
    .slice(0, 4);

  const positions = [
    { x: 135, y: 72 },
    { x: 485, y: 72 },
    { x: 135, y: 228 },
    { x: 485, y: 228 },
  ];

  const graphNodes = [
    {
      id: focusNode,
      x: 310,
      y: 150,
      central: true,
    },
    ...neighborIds.map((id, index) => ({
      id,
      x: positions[index].x,
      y: positions[index].y,
      central: false,
    })),
  ];

  const getNode = (id: string) =>
    graphNodes.find((node) => node.id === id);

  const suspiciousCount = relatedEdges.reduce(
    (total, edge) => total + edge.suspicious,
    0,
  );

  const transactionCount = relatedEdges.reduce(
    (total, edge) => total + edge.transactions,
    0,
  );

  return (
    <div className="network networkGraph">
      <svg
        className="networkSvg"
        viewBox="0 0 620 300"
        role="img"
        aria-label="Suspicious transaction relationship map"
      >
        <defs>
          <marker
            id="networkArrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              className="networkArrow"
            />
          </marker>

          <marker
            id="networkSuspiciousArrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              className="networkSuspiciousArrow"
            />
          </marker>
        </defs>

        {relatedEdges.map((edge) => {
          const source = getNode(edge.source);
          const target = getNode(edge.target);

          if (!source || !target) {
            return null;
          }

          const strokeWidth = Math.min(
            5,
            1.5 + Math.log10(edge.transactions + 1),
          );

          const suspicious = edge.suspicious > 0;

          return (
            <line
              key={`${edge.source}-${edge.target}`}
              className={
                suspicious
                  ? "networkEdge suspicious"
                  : "networkEdge"
              }
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              strokeWidth={strokeWidth}
              markerEnd={
                suspicious
                  ? "url(#networkSuspiciousArrow)"
                  : "url(#networkArrow)"
              }
            />
          );
        })}

        {graphNodes.map((node) => {
          const nodeEdges = relatedEdges.filter(
            (edge) =>
              edge.source === node.id ||
              edge.target === node.id,
          );

          const nodeTransactions = nodeEdges.reduce(
            (total, edge) =>
              total + edge.transactions,
            0,
          );

          const nodeSuspicious = nodeEdges.reduce(
            (total, edge) =>
              total + edge.suspicious,
            0,
          );

          return (
            <g
              key={node.id}
              className={
                node.central
                  ? "networkSvgNode central"
                  : "networkSvgNode"
              }
            >
              <rect
                x={node.x - 66}
                y={node.y - 23}
                width="132"
                height="46"
                rx="9"
              />

              <text
                x={node.x}
                y={node.y - 3}
                textAnchor="middle"
                className="networkNodeLabel"
              >
                {node.id}
              </text>

              <text
                x={node.x}
                y={node.y + 12}
                textAnchor="middle"
                className="networkNodeMeta"
              >
                {node.central
                  ? `${nodeSuspicious} suspicious`
                  : `${nodeTransactions} transactions`}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="networkGraphSummary">
        <span>
          <strong>{focusNode}</strong>
          <small>Focus account</small>
        </span>

        <span>
          <strong>{suspiciousCount}</strong>
          <small>Suspicious transactions</small>
        </span>

        <span>
          <strong>{transactionCount}</strong>
          <small>Transactions</small>
        </span>
      </div>
    </div>
  );
}
export default function Home() {
  const [overview, setOverview] = useState<Overview>(fallbackOverview);
  const [alerts, setAlerts] = useState<Alert[]>(fallbackAlerts);
  const [network, setNetwork] = useState<Network | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    Promise.all([fetch(`${base}/api/v1/overview`), fetch(`${base}/api/v1/alerts?limit=4`), fetch(`${base}/api/v1/network?limit=100`)]).then(async ([overviewResponse, alertsResponse, networkResponse]) => {
      if (overviewResponse.ok) setOverview(await overviewResponse.json());
      if (alertsResponse.ok) {
        const data = await alertsResponse.json();
        if (data.length) setAlerts(data);
      }
      if (networkResponse.ok) setNetwork(await networkResponse.json());
    }).catch(() => undefined);
  }, []);

  const metrics = [["Transactions", formatNumber(overview.transactions), overview.data_status === "processed_dataset" ? "Processed dataset" : "Local demo dataset"], ["Alerts", formatNumber(overview.alerts), "Observed laundering labels"], ["Risk volume", formatMoney(overview.risk_volume), "Observed suspicious volume"], ["Network nodes", formatNumber(overview.network_nodes), "Accounts in transaction graph"]];

  return <main>
    <aside><div className="brand"><div className="brandMark">A</div><div><strong>AML Insight</strong><small>Transaction Intelligence</small></div></div><nav><a className="active">Overview</a><a href="/transactions">Transactions</a><a href="/predict">Predict</a><a>Network</a><a>Alerts</a><a>Investigations</a><a>Models</a></nav><div className="sidebarBottom"><span>IBM AML Benchmark</span><span>{overview.data_status === "processed_dataset" ? "HI-Small loaded" : "Demo mode"}</span></div></aside>
    <section className="content">
      <header><div><p className="eyebrow">ANTI-MONEY LAUNDERING</p><h1>Investigation command center</h1><p className="subtitle">Detect suspicious transaction behavior across connected financial networks.</p></div><div className="headerActions"><button>Export</button><button className="primary">New investigation</button></div></header>
      <div className="metrics">{metrics.map(([label, value, detail]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div>
      <div className="grid">
        <section className="panel networkPanel"><div className="panelHead"><div><span className="sectionLabel">NETWORK INTELLIGENCE</span><h2>Suspicious relationship map</h2></div><span className="riskBadge">{overview.alerts ? "RISK SIGNALS" : "NO DATA"}</span></div><Network data={network} /><div className="networkLegend"><span><i />Account</span><span><i className="danger" />Suspicious flow</span><span><i className="muted" />Related account</span></div></section>
        <section className="panel riskPanel"><div className="panelHead"><div><span className="sectionLabel">MODEL STATUS</span><h2>Risk intelligence</h2></div></div><div className="signal"><div><strong>Suspicious rate</strong><span>{overview.suspicious_rate.toFixed(2)}%</span></div><div className="bar"><i style={{ width: `${Math.min(100, overview.suspicious_rate * 10)}%` }} /></div></div><div className="signal"><div><strong>Model state</strong><span>{overview.model_status.replaceAll("_", " ")}</span></div><div className="bar"><i style={{ width: overview.model_status === "trained" ? "100%" : "18%" }} /></div></div><div className="signal"><div><strong>Data state</strong><span>{overview.data_status.replaceAll("_", " ")}</span></div><div className="bar"><i style={{ width: overview.data_status === "processed_dataset" ? "100%" : "35%" }} /></div></div><div className="modelScore"><span>Current benchmark mode</span><strong>{overview.data_status === "processed_dataset" ? "LIVE" : "DEMO"}</strong></div></section>
      </div>
      <section className="panel alertsPanel"><div className="panelHead"><div><span className="sectionLabel">PRIORITY QUEUE</span><h2>Recent suspicious transactions</h2></div><a className="linkButton" href="/transactions">Open explorer →</a></div><div className="table">{alerts.map((item) => <div className="row" key={item.id}><span className="caseId">{item.id}</span><span>{item.account}</span><span className="riskText">{item.risk.toFixed(1)}%</span><span className="pattern">{item.pattern}</span><span>{item.currency} {item.amount.toLocaleString()}</span><span>→</span></div>)}</div></section>
    </section>
  </main>;
}
