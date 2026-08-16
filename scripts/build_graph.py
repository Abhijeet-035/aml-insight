from pathlib import Path
import pandas as pd
import networkx as nx

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "processed" / "transactions.csv"
OUTPUT = ROOT / "data" / "processed"


def main() -> None:
    frame = pd.read_csv(DATA, usecols=["account", "counterparty_account", "amount_received", "is_laundering"])
    grouped = frame.groupby(["account", "counterparty_account"], as_index=False).agg(
        transaction_count=("amount_received", "size"),
        total_amount=("amount_received", "sum"),
        suspicious_count=("is_laundering", "sum"),
    )
    graph = nx.from_pandas_edgelist(
        grouped,
        source="account",
        target="counterparty_account",
        edge_attr=["transaction_count", "total_amount", "suspicious_count"],
        create_using=nx.DiGraph,
    )
    metrics = pd.DataFrame({
        "account": list(graph.nodes),
        "in_degree": [graph.in_degree(node) for node in graph.nodes],
        "out_degree": [graph.out_degree(node) for node in graph.nodes],
        "pagerank": list(nx.pagerank(graph, alpha=0.85).values()),
    })
    OUTPUT.mkdir(parents=True, exist_ok=True)
    grouped.to_csv(OUTPUT / "edges.csv", index=False)
    metrics.to_csv(OUTPUT / "account_graph_features.csv", index=False)
    print(f"nodes={graph.number_of_nodes():,} edges={graph.number_of_edges():,}")


if __name__ == "__main__":
    main()
