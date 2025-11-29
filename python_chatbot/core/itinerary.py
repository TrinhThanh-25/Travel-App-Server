from typing import Dict, List
from .route_optimizer import pairwise_distance_matrix, mst_order, greedy_path, total_distance
from .recommender import recommend_pois

def _penalize_by_weather(pois: List[Dict], weather_desc: str):
    if not weather_desc:
        return pois

    w = weather_desc.lower()
    if "mưa" in w or "rain" in w or "storm" in w:
        # giảm điểm các địa điểm ngoài trời
        for p in pois:
            cat = str(p.get("tag", "")).lower()
            if cat in {"park", "garden", "viewpoint", "attraction"}:
                p["final"] = p.get("final", 1) * 0.85
    return pois


def _select_pois_for_days(pois: List[Dict], days: int, max_per_day: int = 6):
    pois = sorted(pois, key=lambda x: x.get("final", 0), reverse=True)
    k = min(len(pois), days * max_per_day)
    chosen = pois[:k]
    per_day = []
    for d in range(days):
        per_day.append(chosen[d::days][:max_per_day])
    return per_day


def build_itinerary(params: Dict, poi_df, weather_now: Dict):
    """
    Sinh lịch trình tối ưu hoá theo ngày.
    Returns: list of days with optimized POI ordering
    """
    city   = params["city"]
    days   = int(params.get("days", 2))
    budget = int(params.get("budget_vnd", 1_500_000))
    taste  = params.get("taste_tags", [])
    acts   = params.get("activity_tags", [])
    walk_km = float(params.get("walk_tolerance_km", 5.0))
    weather_desc = weather_now.get("description", "")

    # 1️⃣ Get recommendations for all categories
    all_pois = []
    categories = ["food", "cafe", "entertainment", "shopping", "attraction"]
    
    for category in categories:
        try:
            pois = recommend_pois(
                city=city,
                category=category,
                user_query="",
                taste_tags=taste,
                activity_tags=acts,
                budget_per_day=budget,
                walk_tolerance_km=walk_km,
                weather_desc=weather_desc
            )
            if pois:
                all_pois.extend(pois)
        except Exception as e:
            print(f"⚠️ Error loading {category}: {e}")
            continue
    
    if not all_pois:
        return []
    
    # Apply weather penalty
    all_pois = _penalize_by_weather(all_pois, weather_desc)

    # 2️⃣ Chia địa điểm theo ngày (mỗi ngày ~5-6 điểm)
    days_pois = _select_pois_for_days(all_pois, days, max_per_day=6)

    # 3️⃣ Tối ưu thứ tự cho từng ngày
    out_days = []
    for day_idx, dpois in enumerate(days_pois):
        if len(dpois) < 2:
            out_days.append({
                "title": f"Ngày {day_idx + 1}",
                "pois": dpois,
                "distance": 0.0,
                "weather": weather_desc
            })
            continue

        try:
            dist, coords, G = pairwise_distance_matrix(city, dpois)
            order = mst_order(dist)
            ordered_pois = [dpois[i] for i in order]
            total_km = total_distance(dist, order)

            out_days.append({
                "title": f"Ngày {day_idx + 1}",
                "pois": ordered_pois,
                "distance": round(total_km, 2),
                "weather": weather_desc
            })
        except Exception as e:
            print(f"⚠️ Error optimizing route for day {day_idx + 1}: {e}")
            out_days.append({
                "title": f"Ngày {day_idx + 1}",
                "pois": dpois,
                "distance": 0.0,
                "weather": weather_desc
            })

    return out_days
