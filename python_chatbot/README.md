# Python Chatbot Backend

This directory contains the Python-based chatbot backend for the Travel Application.

## Structure

```
python_chatbot/
├── api.py                  # FastAPI server for chat endpoints
├── streamlit_app.py        # Streamlit interactive UI (optional)
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (API keys)
├── core/                   # Core chatbot logic modules
│   ├── intent_detector.py  # Intent classification
│   ├── recommender.py      # POI recommendation engine
│   ├── itinerary.py        # Itinerary planning
│   ├── llm_composer.py     # LLM response composition
│   ├── osm_loader.py       # OpenStreetMap data loader
│   ├── weather.py          # Weather API integration
│   ├── routing.py          # Route optimization
│   └── ...                 # Other modules
└── data/                   # Data files and cache
    ├── pois_hcm_*.csv      # POI datasets by category
    ├── featured_pois.json  # Featured locations
    ├── intent_model.pkl    # Intent classification model
    └── osmnx_cache/        # Cached OSM data
```

## Quick Start

### 1. Install Dependencies
```bash
cd "Backend + Database/python_chatbot"
pip install -r requirements.txt
```

### 2. Configure Environment
Copy `.env` and add your API keys:
- `OPENAI_API_KEY` - For LLM composition
- `OPENWEATHER_API_KEY` - For weather data
- `GOOGLE_PLACES_API_KEY` - For place enrichment

### 3. Run API Server
```bash
# From python_chatbot directory
python -m uvicorn api:app --host 127.0.0.1 --port 8001 --reload
```

The API will be available at `http://127.0.0.1:8001`

### 4. Run Streamlit UI (Optional)
```bash
streamlit run streamlit_app.py
```

## API Endpoints

### POST /api/chat
Main chat endpoint for processing user messages.

**Request:**
```json
{
  "userId": "user123",
  "message": "Gợi ý quán cafe",
  "context": {
    "preferences": {
      "city": "Hồ Chí Minh",
      "budget": 1500000,
      "taste": ["Vietnamese", "Cafe"]
    }
  }
}
```

**Response:**
```json
{
  "replyText": "🔎 Tìm thấy 5 địa điểm phù hợp...",
  "suggestions": [
    {
      "id": "s1",
      "label": "Show nearby",
      "action": {
        "type": "open_screen",
        "screen": "map"
      }
    }
  ],
  "metadata": {
    "intent": "lookup",
    "poi_count": 5
  }
}
```

### POST /api/events
Track user events for analytics.

### GET /health
Health check endpoint.

## Features

- **Intent Detection**: Classifies user queries (weather, lookup, plan)
- **POI Recommendation**: TF-IDF based recommendation with personalization
- **Itinerary Planning**: Multi-day route optimization
- **Weather Integration**: Real-time weather consideration
- **Offline Mode**: Works with cached data when offline

## Development

### Adding New Intents
1. Update `core/intent_detector.py`
2. Add handler logic in `api.py`
3. Test with new queries

### Data Updates
- POI data: Update CSV files in `data/`
- Cache: Delete cache files to force refresh

## Deployment

For production:
1. Set `--reload` to `False`
2. Use production-grade server (gunicorn + uvicorn workers)
3. Set up proper logging and monitoring
4. Secure API keys in environment variables
5. Enable CORS for specific origins only
