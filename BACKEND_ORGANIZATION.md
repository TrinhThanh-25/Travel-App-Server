# Backend Organization Guide

## ✅ Organized Structure (Updated: Nov 25, 2025)

```
Backend + Database/
├── python_chatbot/          # Python chatbot backend
│   ├── api.py              # FastAPI server (port 8001)
│   ├── streamlit_app.py    # Streamlit UI (optional demo)
│   ├── requirements.txt    # Python dependencies
│   ├── .env                # API keys (OpenAI, Weather, etc.)
│   ├── README.md           # Detailed documentation
│   ├── core/               # Core chatbot logic modules
│   │   ├── intent_detector.py    # Intent classification
│   │   ├── recommender.py        # POI recommendations
│   │   ├── itinerary.py          # Trip planning
│   │   ├── llm_composer.py       # LLM response generation
│   │   ├── osm_loader.py         # OpenStreetMap data
│   │   ├── weather.py            # Weather integration
│   │   ├── routing.py            # Route optimization
│   │   ├── google_places.py      # Google Places API
│   │   ├── place_enricher.py     # POI enrichment
│   │   └── ui_plan_renderer.py   # Plan rendering
│   └── data/               # Data files and cache
│       ├── pois_hcm_food.csv
│       ├── pois_hcm_cafe.csv
│       ├── pois_hcm_entertainment.csv
│       ├── pois_hcm_shopping.csv
│       ├── pois_hcm_attraction.csv
│       ├── featured_pois.json
│       ├── intent_model.pkl
│       ├── hồ_chí_minh_graph.graphml
│       └── osmnx_cache/
│
├── controllers/            # Node.js REST controllers
├── routes/                 # Node.js API routes
├── db/                     # Database connection
├── middleware/             # Auth & validation
├── validators/             # Input validation schemas
├── scripts/                # Database scripts
├── server.js               # Node.js Express server (port 5000)
├── package.json
├── .env.example            # Environment template
└── travel_app.db          # SQLite database
```

## 🚀 Quick Start

### Python Chatbot API

```bash
# Navigate to python chatbot
cd "Backend + Database/python_chatbot"

# Install dependencies
pip install -r requirements.txt

# Start API server
python -m uvicorn api:app --host 127.0.0.1 --port 8001 --reload
```

**API Available at:** `http://127.0.0.1:8001`

### Node.js Backend (Optional)

```bash
# Navigate to backend root
cd "Backend + Database"

# Install dependencies
npm install

# Start server
npm start  # Port 5000
```

## 📡 API Endpoints

### Python Chatbot (Port 8001)

#### POST /api/chat
Main chat endpoint for user messages.

**Request:**
```json
{
  "userId": "debug_user_001",
  "message": "Gợi ý quán cafe ở quận 1",
  "context": {
    "preferences": {
      "city": "Hồ Chí Minh",
      "budget": 1500000,
      "taste": ["Vietnamese", "Cafe"]
    }
  },
  "clientMeta": {
    "appVersion": "1.0.0"
  }
}
```

**Response:**
```json
{
  "replyText": "🔎 Tìm thấy 5 địa điểm phù hợp:\n1. The Workshop...",
  "suggestions": [
    {
      "id": "s1",
      "label": "Show nearby",
      "action": {
        "type": "open_screen",
        "screen": "map",
        "payload": {}
      }
    }
  ],
  "metadata": {
    "intent": "lookup",
    "poi_count": 5
  }
}
```

#### POST /api/events
Event tracking for analytics.

#### GET /health
Health check endpoint.

### Node.js Backend (Port 5000)
- Authentication endpoints
- User management
- Challenges & rewards
- Location management
- Reviews & ratings

## 🔧 Configuration

### Flutter Frontend
Update `Frontend/lib/features/chat/config/chat_config.dart`:

```dart
class ChatConfig {
  static const String apiBaseUrl = 'http://127.0.0.1:8001';
}
```

### Environment Variables

**python_chatbot/.env:**
```env
OPENAI_API_KEY=your_openai_key
OPENWEATHER_API_KEY=your_weather_key
GOOGLE_PLACES_API_KEY=your_places_key
```

**Backend + Database/.env:**
```env
JWT_SECRET=your_jwt_secret
DATABASE_URL=./travel_app.db
CHAT_API_URL=http://127.0.0.1:8001
```

## 🎯 Features

### Python Chatbot
- ✅ Intent detection (weather, lookup, plan)
- ✅ TF-IDF based POI recommendations
- ✅ Multi-day itinerary planning
- ✅ Weather-aware suggestions
- ✅ Category-based POI filtering
- ✅ Offline mode with cached data
- ✅ Image enrichment support

### Node.js Backend
- ✅ User authentication (JWT)
- ✅ Challenge system
- ✅ Points & rewards
- ✅ Location CRUD
- ✅ Reviews & ratings

## 📦 Dependencies

### Python
- fastapi - API framework
- uvicorn - ASGI server
- pandas - Data processing
- scikit-learn - ML recommendations
- networkx - Graph algorithms
- osmnx - OpenStreetMap
- streamlit - UI demo
- openai - LLM integration

### Node.js
- express - Web framework
- sqlite3 - Database
- jsonwebtoken - Auth
- bcryptjs - Password hashing

## 🔄 Development Workflow

1. **Start Python API** (required for chat)
   ```bash
   cd python_chatbot
   python -m uvicorn api:app --reload --port 8001
   ```

2. **Start Flutter App**
   ```bash
   cd Frontend
   flutter run -d chrome
   ```

3. **Optional: Start Node Backend** (for full features)
   ```bash
   npm start
   ```

## 📝 Notes

- Python chatbot is standalone and doesn't require Node.js
- Node.js backend can proxy to Python chatbot if needed
- Flutter app connects directly to Python API (port 8001)
- All data files are in `python_chatbot/data/`
- Old `chatbot/` and `chat_api/` folders have been consolidated

## 🚧 Future Enhancements

- [ ] WebSocket streaming for real-time responses
- [ ] Redis caching for performance
- [ ] User context persistence
- [ ] Multi-language support
- [ ] Advanced personalization
- [ ] Analytics dashboard

---
Last Updated: November 25, 2025
