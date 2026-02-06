# Distributed AR Application - Simplified Edge Server Architecture

## Overview
A prototype AR application using React Native/Expo with edge-based processing for location-specific AR decorations. This approach eliminates complex computer vision for faster development and deployment.

## Architecture Principles
- **Edge-first processing**: Distribute load across regional edge servers
- **SQLite-based content storage**: Each edge server manages its regional AR content
- **Sensor-based positioning**: Use device sensors instead of computer vision
- **Simple overlay system**: Fixed-position AR decorations with meter-level accuracy

## Technology Stack

### Device Side (React Native/Expo)
- **Camera**: `react-native-vision-camera`
- **AR Rendering**: `three.js` or `react-three-fiber`
- **Geolocation**: Native GPS APIs
- **Sensors**: Device compass, accelerometer, gyroscope
- **Communication**: WebSocket connections to edge servers

### Edge Server Side
- **Database**: SQLite instances for regional content storage
- **API**: REST/WebSocket endpoints for device communication
- **Asset Serving**: Local caching of AR assets (3D models, textures)
- **Load Balancing**: Simple request routing between edge nodes

## Database Schema (SQLite per Edge Server)

```sql
-- AR decoration zones
CREATE TABLE ar_zones (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    lat REAL NOT NULL,        -- Zone center latitude
    lng REAL NOT NULL,        -- Zone center longitude
    radius REAL NOT NULL,     -- Zone radius in meters
    decor_type TEXT NOT NULL, -- Type of AR decoration
    asset_url TEXT,           -- 3D model/image URL
    height_offset REAL,       -- Height from ground level
    active BOOLEAN DEFAULT 1, -- Is this decoration currently active
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Regional configuration
CREATE TABLE edge_config (
    region TEXT PRIMARY KEY,
    backup_edge_url TEXT,
    max_devices INTEGER DEFAULT 100,
    service_radius_km REAL DEFAULT 5.0
);

-- Asset metadata
CREATE TABLE ar_assets (
    id INTEGER PRIMARY KEY,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'model', 'texture', 'audio'
    file_size INTEGER,
    local_path TEXT,
    remote_url TEXT,
    cached_at TIMESTAMP
);

-- Device tracking (optional)
CREATE TABLE device_connections (
    device_id TEXT,
    connected_at TIMESTAMP,
    last_ping TIMESTAMP,
    zone_id INTEGER,
    FOREIGN KEY (zone_id) REFERENCES ar_zones(id)
);
```

## Simplified Processing Flow

```
1. Device Startup
   └── Get GPS location
   └── Find nearest edge server
   └── Establish WebSocket connection

2. Location Update
   └── Send current GPS + sensor data to edge server
   └── Edge queries SQLite for nearby AR zones
   └── Return list of available decorations

3. AR Rendering
   └── Device receives decoration data
   └── Calculate relative positions using sensors
   └── Render overlays at calculated positions
   └-- No computer vision needed
```

## API Endpoints

### Edge Server REST API
- `GET /api/zones/nearby?lat={lat}&lng={lng}&radius={radius}`
- `GET /api/assets/{asset_id}`
- `POST /api/devices/register`
- `GET /api/edge/status`

### WebSocket Events
- `device:location_update` - Device sends GPS/sensor data
- `server:decorations_update` - Server sends available decorations
- `device:interaction` - User interacts with AR object

## Edge Server Distribution Strategy

### Geographic Partitioning
- Divide service area into ~5km radius zones
- Each edge server serves one or more zones
- Overlap zones for seamless transitions

### Load Management
- Track connected devices per edge server
- Redirect to backup edge servers when overloaded
- Simple round-robin for load distribution

### Content Synchronization
- Each edge server has region-specific content only
- Periodic sync of decoration updates between edges
- Asset caching on local storage for faster delivery

## Benefits of This Approach
- **Low complexity**: No computer vision or ML processing
- **Fast deployment**: SQLite is lightweight and easy to manage
- **Regional isolation**: Content is naturally segmented by location
- **Scalable**: Easy to add more edge servers as needed
- **Offline capable**: Devices can cache decorations for short periods

## Known Limitations
- Fixed positioning (no surface detection)
- Lower accuracy than CV-based solutions
- Can't adapt to real environment changes
- Dependent on GPS/sensor accuracy

## Next Steps for Implementation
1. Set up basic React Native app with camera view
2. Implement sensor-based positioning system
3. Create edge server with SQLite database
4. Build API for zone discovery and asset serving
5. Integrate WebSocket communication
6. Add AR overlay rendering system