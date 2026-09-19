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
  if (!nodes.length) return <div className="network"><div className="node center">Network pending<span>Load processed data</span></div></div>;
  const positions = ["n1", "n2", "n3", "n4"];
  return <div className="network"><div className="node center">{nodes[0].label}<span>{edges[0]?.suspicious ?? 0} suspicious</span></div>{nodes.slice(1, 5).map((node, index) => <div className={`node ${positions[index]}`} key={node.id}>{node.label}</div>)}{edges.slice(0, 4).map((edge, index) => <div className={`edge e${index + 1}`} key={`${edge.source}-${edge.target}`} />)}</div>;
}

export default function Home() {
  const [overview, setOverview] = useState<Overview>(fallbackOverview);
  const [alerts, setAlerts] = useState<Alert[]>(fallbackAlerts);
  const [network, setNetwork] = useState<Network | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    Promise.all([fetch(`${base}/api/v1/overview`), fetch(`${base}/api/v1/alerts?limit=4`), fetch(`${base}/api/v1/network?limit=8`)]).then(async ([overviewResponse, alertsResponse, networkResponse]) => {
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
        <section className="panel networkPanel"><div className="panelHead"><div><span className="sectionLabel">NETWORK INTELLIGENCE</span><h2>Suspicious relationship map</h2></div><span className="riskBadge">{overview.alerts ? "RISK SIGNALS" : "NO DATA"}</span></div><Network data={network}/><div className="networkLegend"><span><i/>Account</span><span><i className="danger"/>Suspicious flow</span><span><i className="muted"/>Related account</span></div></section>
        <section className="panel riskPanel"><div className="panelHead"><div><span className="sectionLabel">MODEL STATUS</span><h2>Risk intelligence</h2></div></div><div className="signal"><div><strong>Suspicious rate</strong><span>{overview.suspicious_rate.toFixed(2)}%</span></div><div className="bar"><i style={{width:`${Math.min(100, overview.suspicious_rate * 10)}%`}}/></div></div><div className="signal"><div><strong>Model state</strong><span>{overview.model_status.replaceAll("_", " ")}</span></div><div className="bar"><i style={{width:overview.model_status === "trained" ? "100%" : "18%"}}/></div></div><div className="signal"><div><strong>Data state</strong><span>{overview.data_status.replaceAll("_", " ")}</span></div><div className="bar"><i style={{width:overview.data_status === "processed_dataset" ? "100%" : "35%"}}/></div></div><div className="modelScore"><span>Current benchmark mode</span><strong>{overview.data_status === "processed_dataset" ? "LIVE" : "DEMO"}</strong></div></section>
      </div>
      <section className="panel alertsPanel"><div className="panelHead"><div><span className="sectionLabel">PRIORITY QUEUE</span><h2>Recent suspicious transactions</h2></div><a className="linkButton" href="/transactions">Open explorer →</a></div><div className="table">{alerts.map((item) => <div className="row" key={item.id}><span className="caseId">{item.id}</span><span>{item.account}</span><span className="riskText">{item.risk.toFixed(1)}%</span><span className="pattern">{item.pattern}</span><span>{item.currency} {item.amount.toLocaleString()}</span><span>→</span></div>)}</div></section>
    </section>
  </main>;
}
