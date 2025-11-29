import os, re, pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB

MODEL = os.path.join("data","intent_model.pkl")

SEED = [
    # Weather queries
    ("Thời tiết Đà Lạt", "weather"),
    ("Hà Nội hôm nay mưa không", "weather"),
    ("What's the weather in Ho Chi Minh City", "weather"),
    ("How's the weather today", "weather"),
    ("Tell me the temperature", "weather"),
    # Lookup queries
    ("Gợi ý địa điểm tham quan ở Huế", "lookup"),
    ("Tìm quán cà phê yên tĩnh", "lookup"),
    ("Đề xuất khách sạn trung tâm", "lookup"),
    ("Show me restaurants near Ben Thanh Market", "lookup"),
    ("Find cafes in District 1", "lookup"),
    ("Where can I eat good pho", "lookup"),
    # Plan queries
    ("Lên lịch trình 3 ngày ở Đà Nẵng", "plan"),
    ("Tạo route tham quan 1 ngày ở Sài Gòn", "plan"),
    ("Plan a 2-day trip to Hanoi", "plan"),
    ("Create an itinerary for my vacation", "plan"),
]

def _train():
    X, y = zip(*SEED)
    vec = TfidfVectorizer()
    Xv = vec.fit_transform(X)
    clf = MultinomialNB().fit(Xv, y)
    with open(MODEL, "wb") as f: pickle.dump((vec, clf), f)

def _local(text: str) -> str:
    if not os.path.exists(MODEL): _train()
    vec, clf = pickle.load(open(MODEL, "rb"))
    return clf.predict(vec.transform([text]))[0]

def _rule(t: str):
    t = t.lower()
    # Weather intent - CHECK FIRST (most specific)
    if re.search(r"\b(weather|thời tiết|temperature|nhiệt độ|rain|mưa|sunny|nắng|climate|gió|forecast)\b", t): 
        return "weather"
    # Plan/Itinerary intent - CHECK SECOND
    if re.search(r"\b(plan|lịch trình|trip|kế hoạch|itinerary|route|tuyến|schedule)\b", t): 
        return "plan"
    # Lookup/Search intent - CHECK LAST (most general)
    if re.search(r"\b(show|find|search|where|restaurant|cafe|hotel|place|địa điểm|tham quan|quán|cà phê|nhà hàng|khách sạn|đi đâu|gợi ý)\b", t): 
        return "lookup"
    return None

def detect_intent(text: str) -> str:
    rule = _rule(text)
    if rule: return rule
    try:
        return _local(text)
    except Exception:
        return "lookup"
