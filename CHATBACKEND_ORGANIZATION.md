# Chat Backend Integration & Organization Guide

This document explains how to organize and wire the existing Node.js backend with the Python `ChatbotForTravel` logic for future scalable integration.

## Goal
Provide a stable contract for the Flutter frontend (`/api/chat`, `/api/events`) while the heavier NLP / itinerary / POI logic lives in a separate Python service.

## Current State
- Node server (`server.js`) now proxies `POST /api/chat` to a Python service at `CHAT_API_URL` (default `http://127.0.0.1:8001`).
- `POST /api/events` returns a simple `{ status: 'ok' }` and can later forward analytics/events for personalization.
- Python app (`ChatbotForTravel-main/app.py`) is a Streamlit interactive application (UI-centric) and not a pure API server yet.

## Recommended Python Extraction
Convert key intent handling logic into an API layer (FastAPI or Flask) separate from Streamlit UI:

```
chatbot_python/
  core/                # existing logic modules (intent_detector, recommender, etc.)
  api/
    __init__.py
    server.py          # FastAPI/Flask endpoints
  requirements.txt
  scripts/
    warm_cache.py      # Preload POI datasets
```

### Suggested API Endpoints
- `POST /api/chat`
  Request body as defined in frontend contract:
  {
    "userId": "string",
    "message": "string",
    "context": { "screen": "string", "recentActions": ["string"], "preferences": {"price": "low"} },
    "clientMeta": { "locale": "vi-VN", "appVersion": "1.2.3" }
  }
  Response:
  {
    "replyText": "string",
    "replyChunks": ["string"],
    "suggestions": [ { "id": "s1", "label": "Show nearby", "action": { "type": "open_screen", "screen": "map", "payload": {} } } ],
    "metadata": { "intent": "find_restaurant", "confidence": 0.87 }
  }

- `POST /api/events` (optional future use)
  { "userId": "string", "events": [ { "type": "view_item", ... } ] }

- `GET /api/context/:userId`
  Provide personalization snapshot (preferences, recentActions summary).

## FastAPI Skeleton Example (server.py)
```python
from fastapi import FastAPI
from pydantic import BaseModel
from core.intent_detector import detect_intent
from core.llm_composer import compose_plan_response
from core.recommender import recommend_pois
from core.itinerary import build_itinerary
from core.osm_loader import ensure_poi_dataset
from core.weather import get_weather

app = FastAPI()

class ChatRequest(BaseModel):
    userId: str
    message: str
    context: dict | None = None
    clientMeta: dict | None = None

@app.post('/api/chat')
async def chat(req: ChatRequest):
    city = (req.context or {}).get('preferences', {}).get('city', 'Hồ Chí Minh')
    poi_df = ensure_poi_dataset(city)
    weather = get_weather(city)
    intent = detect_intent(req.message)

    if intent == 'weather':
        reply = f"Thời tiết {city}: {weather['description']} {weather['temp']}°C"
        return { 'replyText': reply, 'replyChunks': None, 'suggestions': [], 'metadata': {'intent': intent} }
    elif intent == 'lookup':
        pois = recommend_pois(city=city, poi_df=poi_df, user_query=req.message, taste_tags=[], activity_tags=[], budget_per_day=1_500_000, walk_tolerance_km=5.0)
        reply = f"Gợi ý {len(pois)} địa điểm phù hợp." if pois else 'Không tìm thấy địa điểm phù hợp.'
        suggestions = [{ 'id': 's1', 'label': 'Show nearby', 'action': { 'type': 'open_screen', 'screen': 'map', 'payload': {} } }]
        return { 'replyText': reply, 'replyChunks': None, 'suggestions': suggestions, 'metadata': {'intent': intent} }
    elif intent == 'plan':
        params = { 'city': city, 'days': 2 }
        plan_raw = build_itinerary(params, poi_df, weather)
        plan_text = compose_plan_response(plan_raw, params)
        return { 'replyText': plan_text, 'replyChunks': None, 'suggestions': [], 'metadata': {'intent': intent} }
    else:
        return { 'replyText': 'Bạn có thể yêu cầu: gợi ý địa điểm, xem thời tiết, hoặc lên lịch trình.', 'replyChunks': None, 'suggestions': [], 'metadata': {'intent': 'general'} }

@app.post('/api/events')
async def events(payload: dict):
    # future: persist events for personalization
    return { 'status': 'ok' }

@app.get('/api/context/{user_id}')
async def context(user_id: str):
    # Return stub personalization data
    return { 'userId': user_id, 'preferences': { 'price': 'medium' }, 'recentActions': [], 'conversationSummary': '' }
```

## Node Environment Variables
Add to `.env`:
```
CHAT_API_URL=http://127.0.0.1:8001
CORS_ORIGIN=http://localhost:8081
```
Optionally add rate-limiting later.

## Frontend Wiring Notes
- `HttpAdapter(baseUrl: 'http://127.0.0.1:5000')` now maps to Node. Node proxies `/api/chat` to Python.
- To switch directly to Python (bypassing Node), set adapter baseUrl to `http://127.0.0.1:8001` once API server implemented.

## Development Workflow
1. Start Python API (FastAPI) on port 8001.
2. Start Node backend on port 5000 (`npm start`).
3. Run Flutter frontend on web or emulator (origin `http://localhost:8081`).
4. Test chat interactions; verify Node logs proxy hits and Python responds.

## Future Enhancements
- Add WebSocket streaming endpoint (`/api/chat/stream`) for token-level partial responses.
- Implement persistent user context store (SQLite/Postgres) synchronized with events.
- Add authentication middleware to chat endpoints using existing JWT logic.
- Introduce rate limiting and caching of POI datasets across requests.

## Directory Reorganization (Proposed)
```
Backend + Database/
  node/
    server.js
    routes/...
    db/...
  python_chat/
    core/...
    api/server.py
    requirements.txt
  scripts/
    setup-db.sh
  .env.example
```
Gradually move Python-specific logic from `ChatbotForTravel-main` into `python_chat/core` preserving import paths.

---
Generated: 2025-11-10
