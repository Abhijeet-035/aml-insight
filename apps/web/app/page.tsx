"use client";

import { type PointerEvent, type WheelEvent, useEffect, useRef, useState } from "react";

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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedAccount, setSelectedAccount] = useState("");
  const [accountDetails, setAccountDetails] = useState<Record<string, unknown> | null>(null);
  const [accountNetwork, setAccountNetwork] = useState<Network | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });

  const edges = data?.edges ?? [];
  const nodes = data?.nodes ?? [];

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

  const focusNode =
    [...connectionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .at(0)?.[0] ?? nodes[0]?.id ?? "";

  useEffect(() => {
    if (!selectedAccount && focusNode) {
      setSelectedAccount(focusNode);
    }
  }, [focusNode, selectedAccount]);

  useEffect(() => {
    if (!selectedAccount) {
      return;
    }

    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    setAccountLoading(true);

    Promise.all([
      fetch(`${base}/api/v1/account/${encodeURIComponent(selectedAccount)}`),
      fetch(
        `${base}/api/v1/account/${encodeURIComponent(selectedAccount)}/network?limit=20`,
      ),
    ])
      .then(async ([accountResponse, networkResponse]) => {
        if (accountResponse.ok) {
          setAccountDetails(await accountResponse.json());
        } else {
          setAccountDetails(null);
        }

        if (networkResponse.ok) {
          setAccountNetwork(await networkResponse.json());
        } else {
          setAccountNetwork(null);
        }
      })
      .catch(() => {
        setAccountDetails(null);
        setAccountNetwork(null);
      })
      .finally(() => {
        setAccountLoading(false);
      });
  }, [selectedAccount]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement === viewportRef.current,
      );
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange,
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

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

  const clampPan = (value: number, nextZoom = zoom) => {
    const maxPan = Math.max(0, (nextZoom - 1) * 310 + 90);

    return Math.max(-maxPan, Math.min(maxPan, value));
  };

  const updateZoom = (nextZoom: number) => {
    const value = Math.max(0.6, Math.min(2.5, nextZoom));

    setZoom(Number(value.toFixed(2)));
    setPan((current) => ({
      x: clampPan(current.x, value),
      y: clampPan(current.y, value),
    }));
  };

  const zoomIn = () => {
    updateZoom(zoom + 0.1);
  };

  const zoomOut = () => {
    updateZoom(zoom - 0.1);
  };

  const resetGraph = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleGraphWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.deltaY < 0) {
      updateZoom(zoom + 0.1);
    } else {
      updateZoom(zoom - 0.1);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || !viewportRef.current) {
      return;
    }

    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragRef.current.moved = true;
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const scaleX = 620 / Math.max(rect.width, 1) / zoom;
    const scaleY = 300 / Math.max(rect.height, 1) / zoom;

    setPan({
      x: clampPan(
        dragRef.current.panX + deltaX * scaleX,
      ),
      y: clampPan(
        dragRef.current.panY + deltaY * scaleY,
      ),
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) {
      return;
    }

    dragRef.current.active = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleNodeClick = (accountId: string) => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }

    setSelectedAccount(accountId);
  };

  const toggleFullscreen = async () => {
    if (!viewportRef.current) {
      return;
    }

    if (document.fullscreenElement === viewportRef.current) {
      await document.exitFullscreen();
      return;
    }

    await viewportRef.current.requestFullscreen();
  };

  const accountValue = (key: string) =>
    accountDetails?.[key] as number | string | undefined;

  const accountTransactions =
    Number(accountValue("transactions")) || 0;

  const accountSuspicious =
    Number(accountValue("suspicious_transactions")) || 0;

  const accountCounterparties =
    Number(accountValue("counterparties")) || 0;

  const accountVolume =
    Number(accountValue("total_volume")) || 0;

  const accountInDegree =
    Number(accountValue("in_degree")) || 0;

  const accountOutDegree =
    Number(accountValue("out_degree")) || 0;

  const accountPagerank =
    Number(accountValue("pagerank")) || 0;

  const accountTypologyRisk =
    Number(accountValue("typology_risk")) || 0;

  const accountTypologyReasons =
    String(accountValue("typology_reasons") ?? "No typology signal");

  return (
    <div className="network networkGraph">
      <div
        ref={viewportRef}
        className={[
          "networkGraphViewport",
          isFullscreen ? "fullscreen" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onWheel={handleGraphWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="networkGraphControls"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onWheel={(event) => {
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={zoomOut}
            aria-label="Zoom out"
          >
            −
          </button>

          <button
            type="button"
            onClick={resetGraph}
            className="networkZoomValue"
            aria-label="Reset graph zoom and position"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={zoomIn}
            aria-label="Zoom in"
          >
            +
          </button>

          <span className="networkGraphControlDivider" />

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={
              isFullscreen
                ? "Exit fullscreen"
                : "Open graph in fullscreen"
            }
          >
            {isFullscreen ? "×" : "⛶"}
          </button>
        </div>

        <svg
          className="networkSvg"
          viewBox="0 0 620 300"
          role="img"
          aria-label="Interactive suspicious transaction relationship map"
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

          <g
            transform={`translate(${pan.x} ${pan.y}) translate(310 150) scale(${zoom}) translate(-310 -150)`}
          >
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

              const selected =
                node.id === selectedAccount;

              return (
                <g
                  key={node.id}
                  className={[
                    "networkSvgNode",
                    node.central ? "central" : "",
                    selected ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select account ${node.id}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={() => handleNodeClick(node.id)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      handleNodeClick(node.id);
                    }
                  }}
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
          </g>
        </svg>

        <div className="networkGraphHint">
          <span>Click a node to inspect the account.</span>
          <span>Drag to move · Scroll to zoom</span>
        </div>
      </div>

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

      <div className="networkAccountDetails">
        <div className="networkAccountDetailsHead">
          <div>
            <span className="sectionLabel">
              SELECTED ACCOUNT
            </span>
            <h3>{selectedAccount}</h3>
          </div>

          {accountLoading && (
            <span className="networkAccountLoading">
              Loading account data...
            </span>
          )}
        </div>

        {accountDetails && !accountLoading ? (
          <>
            <div className="networkAccountMetrics">
              <span>
                <strong>
                  {accountTransactions.toLocaleString()}
                </strong>
                <small>Transactions</small>
              </span>

              <span>
                <strong>
                  {accountSuspicious.toLocaleString()}
                </strong>
                <small>Suspicious</small>
              </span>

              <span>
                <strong>
                  {accountCounterparties.toLocaleString()}
                </strong>
                <small>Counterparties</small>
              </span>

              <span>
                <strong>
                  {accountVolume.toLocaleString()}
                </strong>
                <small>Total volume</small>
              </span>

              <span>
                <strong>
                  {accountInDegree.toLocaleString()}
                </strong>
                <small>Incoming</small>
              </span>

              <span>
                <strong>
                  {accountOutDegree.toLocaleString()}
                </strong>
                <small>Outgoing</small>
              </span>

              <span>
                <strong>
                  {accountPagerank.toExponential(2)}
                </strong>
                <small>PageRank</small>
              </span>

              <span>
                <strong>
                  {accountTypologyRisk.toFixed(1)}
                </strong>
                <small>Typology risk</small>
              </span>
            </div>

            <div className="networkAccountSignals">
              <span>
                <strong>Typology signal</strong>
                <small>{accountTypologyReasons}</small>
              </span>

              <span>
                <strong>Connected relationships</strong>
                <small>
                  {accountNetwork?.edges.length ?? 0} relationships loaded
                </small>
              </span>
            </div>
          </>
        ) : !accountLoading ? (
          <div className="networkAccountEmpty">
            Account details are not available.
          </div>
        ) : null}
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
    <aside><div className="brand"><div className="brandMark">A</div><div><strong>AML Insight</strong><small>Transaction Intelligence</small></div></div><nav>
          <a className="active" href="/">Overview</a>
        </nav><div className="sidebarBottom"><span>IBM AML Benchmark</span><span>{overview.data_status === "processed_dataset" ? "HI-Small loaded" : "Demo mode"}</span></div></aside>
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
