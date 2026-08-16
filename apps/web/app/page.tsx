const metrics = [
  ["Transactions", "5.08M", "Processed in benchmark"],
  ["Alerts", "5,128", "Priority investigations"],
  ["Risk volume", "$2.84B", "Flagged transaction value"],
  ["Network nodes", "515K", "Accounts in graph"],
];

const alerts = [
  ["AML-00128", "ACC-8000A", "94.2%", "Fan-out", "Open"],
  ["AML-00127", "ACC-1932F", "91.3%", "Layering", "Under Review"],
  ["AML-00126", "ACC-5B821", "88.7%", "Cycle", "Open"],
  ["AML-00125", "ACC-74D20", "84.1%", "Fan-in", "Escalated"],
];

function Network() {
  return <div className="network"><div className="node center">ACC-8000A<span>94.2%</span></div><div className="node n1">ACC-1932F</div><div className="node n2">ACC-5B821</div><div className="node n3">ACC-74D20</div><div className="node n4">ACC-9F221</div><div className="edge e1"/><div className="edge e2"/><div className="edge e3"/><div className="edge e4"/></div>;
}

export default function Home() {
  return <main>
    <aside><div className="brand"><div className="brandMark">A</div><div><strong>AML Insight</strong><small>Transaction Intelligence</small></div></div><nav><a className="active">Overview</a><a>Transactions</a><a>Network</a><a>Alerts</a><a>Investigations</a><a>Models</a></nav><div className="sidebarBottom"><span>IBM AML Benchmark</span><span>HI-Small</span></div></aside>
    <section className="content">
      <header><div><p className="eyebrow">ANTI-MONEY LAUNDERING</p><h1>Investigation command center</h1><p className="subtitle">Detect suspicious transaction behavior across connected financial networks.</p></div><div className="headerActions"><button>Export</button><button className="primary">New investigation</button></div></header>
      <div className="metrics">{metrics.map(([label, value, detail]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div>
      <div className="grid">
        <section className="panel networkPanel"><div className="panelHead"><div><span className="sectionLabel">NETWORK INTELLIGENCE</span><h2>Suspicious relationship map</h2></div><span className="riskBadge">HIGH RISK</span></div><Network/><div className="networkLegend"><span><i/>Account</span><span><i className="danger"/>Suspicious flow</span><span><i className="muted"/>Related account</span></div></section>
        <section className="panel riskPanel"><div className="panelHead"><div><span className="sectionLabel">RISK SIGNALS</span><h2>Why this network matters</h2></div></div><div className="signal"><div><strong>Transaction velocity</strong><span>22%</span></div><div className="bar"><i style={{width:"88%"}}/></div></div><div className="signal"><div><strong>Counterparty diversity</strong><span>19%</span></div><div className="bar"><i style={{width:"76%"}}/></div></div><div className="signal"><div><strong>Graph centrality</strong><span>17%</span></div><div className="bar"><i style={{width:"68%"}}/></div></div><div className="signal"><div><strong>Amount anomaly</strong><span>15%</span></div><div className="bar"><i style={{width:"60%"}}/></div></div><div className="modelScore"><span>Combined risk score</span><strong>91.7%</strong></div></section>
      </div>
      <section className="panel alertsPanel"><div className="panelHead"><div><span className="sectionLabel">PRIORITY QUEUE</span><h2>Recent investigations</h2></div><button className="linkButton">View all alerts →</button></div><div className="table">{alerts.map(([id, account, risk, pattern, status]) => <div className="row" key={id}><span className="caseId">{id}</span><span>{account}</span><span className="riskText">{risk}</span><span className="pattern">{pattern}</span><span className={`status ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span><span>→</span></div>)}</div></section>
    </section>
  </main>;
}
