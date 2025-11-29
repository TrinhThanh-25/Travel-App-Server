# Minimal FastAPI wrapper around ChatbotForTravel core to support frontend contract.
# To run: `uvicorn api:app --host 127.0.0.1 --port 8001 --reload`

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import time
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import sys
import os

# Add current directory to sys.path for core imports
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from core.intent_detector import detect_intent  # type: ignore
from core.osm_loader import ensure_poi_dataset  # type: ignore
from core.weather import get_weather  # type: ignore
from core.recommender import recommend_pois  # type: ignore
from core.itinerary import build_itinerary  # type: ignore
from core.llm_composer import compose_plan_response  # type: ignore

app = FastAPI(title="Tripiz Chat API")

# Enable CORS for Flutter frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging to show debug messages during runs
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("tripiz")


# Log incoming requests and timing for easier debugging in VS Code
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    try:
        body = await request.body()
    except Exception:
        body = b""
    logger.debug(f"Incoming request: {request.method} {request.url.path} body={body.decode(errors='ignore')}")
    response = await call_next(request)
    duration = (time.time() - start_time) * 1000
    logger.debug(f"Completed {request.method} {request.url.path} -> {response.status_code} in {duration:.1f}ms")
    return response

@app.get('/health')
async def health():
    return {'status': 'ok', 'service': 'Tripiz Chat API'}

class Suggestion(BaseModel):
    id: str
    label: str
    action: Optional[Dict[str, Any]] = None

class ChatRequest(BaseModel):
    userId: str
    message: str
    context: Optional[Dict[str, Any]] = None
    clientMeta: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    replyText: str
    replyChunks: Optional[List[str]] = None
    suggestions: Optional[List[Suggestion]] = None
    metadata: Optional[Dict[str, Any]] = None

@app.post('/api/chat', response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        # Derive city preference or fallback
        city = 'Hồ Chí Minh'
        ctx = req.context or {}
        prefs = ctx.get('preferences') or {}
        if isinstance(prefs, dict) and 'city' in prefs:
            city = str(prefs['city'])

        # Load data and detect intent (force offline: use CSV cache only)
        logger.debug(f"Loading POI dataset for city={city} (force_offline=True)")
        poi_df = ensure_poi_dataset(city, force_offline=True)
        logger.debug(f"POI dataset loaded: {getattr(poi_df, 'shape', 'unknown')} rows")
        weather = get_weather(city)
        intent = detect_intent(req.message)
        logger.debug(f"Detected intent={intent} for message='{req.message}'")

        if intent == 'weather':
            reply = f"⛅ Thời tiết {city}: {weather['description']}, {weather['temp']}°C"
            return ChatResponse(replyText=reply, suggestions=[], metadata={'intent': intent})
        elif intent == 'lookup':
            pois = recommend_pois(
                city=city,
                poi_df=poi_df,
                user_query=req.message,
                taste_tags=prefs.get('taste', []),
                activity_tags=prefs.get('interests', []),
                budget_per_day=prefs.get('budget', 1_500_000),
                walk_tolerance_km=prefs.get('walk_tolerance_km', 5.0),
            )
            # Build a reply with actual POI names and include image URLs in metadata
            pois_out = []
            if pois is not None and len(pois) > 0:
                count = len(pois)
                reply = f"🔎 Tìm thấy {count} địa điểm phù hợp:\n\n"
                display_count = min(count, 10)
                for i in range(display_count):
                    poi = pois[i]
                    name = str(poi.get('name', 'Unnamed'))
                    category = str(poi.get('category', 'N/A'))
                    reply += f"{i+1}. {name} ({category})\n"
                    # Add image URLs for frontend rendering
                    pois_out.append({
                        'name': name,
                        'category': category,
                        'image_url1': poi.get('image_url1'),
                        'image_url2': poi.get('image_url2'),
                        'address': poi.get('address'),
                        'avg_cost': poi.get('avg_cost'),
                        'description': poi.get('description'),
                        'lat': poi.get('lat'),
                        'lon': poi.get('lon'),
                        'rating': poi.get('rating'),
                    })
                if count > 10:
                    reply += f"\n...và {count - 10} địa điểm khác"
            else:
                count = 0
                reply = "🔎 Không tìm thấy địa điểm phù hợp. Thử tìm kiếm khác nhé!"
            suggestions = [Suggestion(id='s1', label='Show nearby', action={'type': 'open_screen', 'screen': 'map', 'payload': {}})]
            return ChatResponse(replyText=reply, suggestions=suggestions, metadata={'intent': intent, 'poi_count': count, 'pois': pois_out})
        elif intent == 'plan':
            params = {
                'city': city,
                'days': prefs.get('days', 2),
                'taste_tags': prefs.get('taste', []),
                'activity_tags': prefs.get('interests', []),
                'budget_vnd': prefs.get('budget', 1_500_000),
                'walk_tolerance_km': prefs.get('walk_tolerance_km', 5.0),
                'transport': prefs.get('transport', 'xe máy/ô tô'),
            }
            plan_raw = build_itinerary(params, poi_df, weather)
            # Collect POI images for each day
            pois_days = []
            for day in plan_raw:
                pois_out = []
                for poi in day.get('pois', []):
                    pois_out.append({
                        'name': poi.get('name', 'Unnamed'),
                        'category': poi.get('category', 'N/A'),
                        'image_url1': poi.get('image_url1'),
                        'image_url2': poi.get('image_url2'),
                        'address': poi.get('address'),
                        'avg_cost': poi.get('avg_cost'),
                        'description': poi.get('description'),
                        'lat': poi.get('lat'),
                        'lon': poi.get('lon'),
                        'rating': poi.get('rating'),
                    })
                pois_days.append(pois_out)
            plan_text = compose_plan_response(plan_raw, params)
            return ChatResponse(replyText=plan_text, suggestions=[], metadata={'intent': intent, 'plan_pois': pois_days})
        else:
            return ChatResponse(replyText='Bạn có thể yêu cầu: gợi ý địa điểm, xem thời tiết, hoặc lên lịch trình.', suggestions=[], metadata={'intent': 'general'})
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"ERROR in chat endpoint: {error_detail}")
        return ChatResponse(
            replyText=f"Đã xảy ra lỗi: {str(e)}\nVui lòng thử lại.",
            suggestions=[],
            metadata={'error': str(e)}
        )

@app.post('/api/events')
async def events(payload: Dict[str, Any]):
    # Placeholder: accept and ignore
    return { 'status': 'ok' }

@app.get('/api/context/{user_id}')
async def context(user_id: str):
    return { 'userId': user_id, 'preferences': { 'price': 'medium' }, 'recentActions': [], 'conversationSummary': '' }
