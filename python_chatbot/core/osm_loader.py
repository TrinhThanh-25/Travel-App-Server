import os
import pandas as pd

# Disable OSMnx downloading to prevent timeout issues
# Only use cached data
FORCE_OFFLINE = True  # Set to False to allow OSM downloads

# Only import osmnx if we need to download
if not FORCE_OFFLINE:
    import osmnx as ox
    ox.settings.use_cache = True
    ox.settings.cache_folder = "data/osmnx_cache"
    ox.settings.log_console = True


def _download_osm_pois(city: str) -> pd.DataFrame:
    if FORCE_OFFLINE:
        raise RuntimeError("OSM download is disabled. Set FORCE_OFFLINE=False to enable.")
    
    import osmnx as ox
    tags = {
        "amenity": ["restaurant", "cafe", "bar", "fast_food"],
        "tourism": ["attraction", "museum", "hotel", "guest_house", "hostel", "gallery"],
        "leisure": ["park", "garden"],
    }

    bbox_by_city = {
        "ho chi minh": (10.85, 10.70, 106.83, 106.63),
        "đà lạt": (11.97, 11.90, 108.47, 108.40),
        "hà nội": (21.08, 20.95, 105.90, 105.75),
        "đà nẵng": (16.10, 15.90, 108.30, 108.10),
        "huế": (16.50, 16.42, 107.63, 107.52),
        "nha trang": (12.28, 12.18, 109.22, 109.12),
    }

    city_key = city.lower().strip()
    if city_key in bbox_by_city:
        north, south, east, west = bbox_by_city[city_key]
        gdf = ox.features_from_bbox(
            north=north,
            south=south,
            east=east,
            west=west,
            tags=tags
        )
    else:
        gdf = ox.features_from_place(city + ", Vietnam", tags)

    if gdf.empty:
        raise ValueError(f"Không tìm thấy POI cho {city}")

    gdf = gdf.to_crs(epsg=4326)
    gdf["lat"] = gdf.geometry.centroid.y
    gdf["lon"] = gdf.geometry.centroid.x

    def detect_category(row):
        for key in ["amenity", "tourism", "leisure"]:
            if key in row and pd.notna(row[key]):
                return str(row[key])
        return "other"

    gdf["category"] = gdf.apply(detect_category, axis=1)
    df = gdf[["name", "category", "lat", "lon"]].dropna(subset=["name"])
    df["city"] = city
    df["avg_cost"] = 100000
    df["description"] = df["category"].map({
        "restaurant": "Nhà hàng nổi tiếng với ẩm thực địa phương.",
        "cafe": "Quán cà phê yên tĩnh, thích hợp để thư giãn.",
        "hotel": "Khách sạn thuận tiện cho du khách.",
        "park": "Không gian xanh mát, lý tưởng để đi dạo.",
        "museum": "Nơi lưu giữ nhiều giá trị văn hóa, lịch sử.",
    }).fillna("Địa điểm du lịch được yêu thích.")

    return df


def ensure_poi_dataset(city: str, force_offline: bool = True) -> pd.DataFrame:
    """
    Tự động cache dataset POI theo thành phố.
    Load from categorized CSV files if available.
    
    Args:
        city: Tên thành phố
        force_offline: Nếu True, chỉ dùng cache, không download (default: True)
    """
    os.makedirs("data", exist_ok=True)
    
    # Try to load from categorized CSV files first (new format)
    city_normalized = city.lower().replace(' ', '_')
    if "minh" in city_normalized or "hcm" in city_normalized:
        # Load all HCM category files
        category_files = [
            "data/pois_hcm_food.csv",
            "data/pois_hcm_cafe.csv", 
            "data/pois_hcm_entertainment.csv",
            "data/pois_hcm_shopping.csv",
            "data/pois_hcm_attraction.csv"
        ]
        
        existing_files = [f for f in category_files if os.path.exists(f)]
        if existing_files:
            print(f"⚡ Loading POI data from {len(existing_files)} category files")
            dfs = []
            for file in existing_files:
                df = pd.read_csv(file)
                dfs.append(df)
            combined_df = pd.concat(dfs, ignore_index=True)
            print(f"✅ Loaded {len(combined_df)} POIs from categorized files")
            return combined_df
    
    # Fallback: try single cache file
    cache_path = f"data/pois_cache_{city_normalized}.csv"
    if os.path.exists(cache_path):
        print(f"⚡ Đang load dữ liệu POI từ cache: {cache_path}")
        return pd.read_csv(cache_path)
    
    # Nếu force_offline và không có cache, raise error
    if force_offline:
        raise FileNotFoundError(
            f"❌ Cache không tồn tại tại {cache_path} và force_offline=True. "
            f"Vui lòng đặt force_offline=False để download từ OSM."
        )
    
    # Download từ OSM (chỉ khi force_offline=False)
    print(f"📡 Đang download dữ liệu POI từ OpenStreetMap cho {city}...")
    df = _download_osm_pois(city)
    df.to_csv(cache_path, index=False)
    print(f"💾 Đã lưu cache POI: {cache_path}")
    return df
