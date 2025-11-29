import os, json
from dotenv import load_dotenv
from openai import OpenAI
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def compose_plan_response(plan_raw, params):
    """Dùng LLM viết lịch trình "đẹp", có gợi ý thời tiết/chi phí/di chuyển. Fallback rule-based nếu không có API."""
    # Always use fallback (offline) response, ignore OpenAI API
    lines = []
    if isinstance(plan_raw, dict):
        lines.append(f"⛅ Thời tiết: {plan_raw.get('weather','n/a')}")
        days = plan_raw.get("days", [])
    elif isinstance(plan_raw, list):
        # New format: list of days
        days = plan_raw
        # Try to get weather from first day if available
        weather = days[0].get("weather", "n/a") if days and isinstance(days[0], dict) else "n/a"
        lines.append(f"⛅ Thời tiết: {weather}")
    else:
        days = []
        lines.append("⛅ Thời tiết: n/a")
    for i, day in enumerate(days, 1):
        pois = day.get("pois") or day.get("order", []) if isinstance(day, dict) else []
        distance = day.get("distance") or day.get("distance_km", 0) if isinstance(day, dict) else 0
        names = ", ".join(p['name'] for p in pois)
        lines.append(f"Ngày {i}: {names} (≈ {distance} km)")
    return "\n".join(lines)
