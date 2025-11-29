import math
import networkx as nx
from typing import List, Dict, Tuple, Optional
from .geo_graph import road_graph_for_city, shortest_distance_km

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate haversine distance in km between two lat/lon points."""
    R = 6371  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def pairwise_distance_matrix(city: str, pois: List[Dict]) -> Tuple[list, list, Optional[any]]:
    """Tạo ma trận khoảng cách (km) giữa các POI theo mạng đường (Dijkstra) hoặc haversine."""
    coords = [(p["lat"], p["lon"]) for p in pois]
    n = len(pois)
    dist = [[0.0]*n for _ in range(n)]
    
    # Try to use road network graph (cached)
    try:
        G = road_graph_for_city(city)
        print(f"✅ Using road network graph for {city}")
        for i in range(n):
            for j in range(i+1, n):
                d = shortest_distance_km(G, coords[i], coords[j])
                dist[i][j] = dist[j][i] = d
        return dist, coords, G
    except (FileNotFoundError, RuntimeError) as e:
        # Fallback to haversine distance (straight-line)
        print(f"⚠️ Road graph not available, using haversine distance: {e}")
        for i in range(n):
            for j in range(i+1, n):
                d = haversine_km(coords[i][0], coords[i][1], coords[j][0], coords[j][1])
                dist[i][j] = dist[j][i] = d
        return dist, coords, None

def mst_order(dist: list) -> list:
    """Trích đường đi dựa trên MST (Prim) + DFS order để có chu trình nhẹ."""
    n = len(dist)
    # xây đồ thị vô hướng đơn giản với trọng số dist
    G = nx.Graph()
    for i in range(n):
        for j in range(i+1, n):
            w = dist[i][j] if math.isfinite(dist[i][j]) else 1e9
            G.add_edge(i, j, weight=w)
    T = nx.minimum_spanning_tree(G, weight="weight")
    # DFS từ 0 -> lấy thứ tự thăm
    order = list(nx.dfs_preorder_nodes(T, source=0))
    return order

def greedy_path(dist: list) -> list:
    """Heuristic tham lam: luôn đi tới điểm gần nhất chưa thăm (Nearest Neighbor)."""
    n = len(dist)
    unvisited = set(range(1, n))
    path = [0]
    cur = 0
    while unvisited:
        nxt = min(unvisited, key=lambda j: dist[cur][j])
        path.append(nxt); unvisited.remove(nxt); cur = nxt
    return path

def total_distance(dist: list, order: list) -> float:
    s = 0.0
    for i in range(len(order)-1):
        s += dist[order[i]][order[i+1]]
    return s
