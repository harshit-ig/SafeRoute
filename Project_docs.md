# SafeRoute - Complete Project Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Architecture Overview](#3-architecture-overview)
4. [Backend API Documentation](#4-backend-api-documentation)
5. [Frontend (Android) Documentation](#5-frontend-android-documentation)
   - 5.1 [Package Structure](#51-package-structure)
   - 5.2 [Build Configuration](#52-build-configuration)
   - 5.3 [Application Entry Points](#53-application-entry-points)
6. [Data Models (Complete Field Reference)](#6-data-models-complete-field-reference)
7. [Room Database & DAOs](#7-room-database--daos)
8. [Network Layer](#8-network-layer)
9. [Repositories](#9-repositories)
10. [ViewModels (State Machines)](#10-viewmodels-state-machines)
11. [Navigation & Routing](#11-navigation--routing)
12. [Screen-by-Screen Breakdown](#12-screen-by-screen-breakdown)
13. [UI Components & Theme](#13-ui-components--theme)
14. [Services & Background Tasks](#14-services--background-tasks)
15. [Dependency Injection (Hilt Modules)](#15-dependency-injection-hilt-modules)
16. [Utilities](#16-utilities)
17. [Preferences & Local Storage](#17-preferences--local-storage)
18. [Complete User Flows](#18-complete-user-flows)
19. [Real-Time Features](#19-real-time-features)
20. [Database Schemas](#20-database-schemas)
21. [Third-Party Integrations](#21-third-party-integrations)
22. [Known Placeholders & Incomplete Features](#22-known-placeholders--incomplete-features)

---

## 1. Project Overview

**SafeRoute** is a personal safety and trip monitoring Android application designed to keep users safe during travel. It allows users to:

- Plan and monitor trips with real-time location tracking
- Create predefined routes with multiple valid paths and waypoints
- Form "Safe Circles" — groups of trusted contacts who receive alerts
- Send automatic alerts (SOS, route deviation, unexpected stops) to circle members via SMS/WhatsApp
- View trip history and daily safety summaries
- Track active trips on a Google Map with safe corridor visualization

The app follows a client-server architecture with an Android (Kotlin/Jetpack Compose) frontend and a Node.js/Express backend with MongoDB.

---

## 2. Tech Stack & Dependencies

### Frontend (Android)

| Technology | Version | Purpose |
|---|---|---|
| **Kotlin** | — | Primary language |
| **Jetpack Compose** | BOM-managed | UI framework (Material 3) |
| **Hilt** | 2.48 | Dependency injection |
| **Room** | 2.6.0 | Local SQLite database |
| **Retrofit** | 2.9.0 | HTTP client for REST API |
| **OkHttp Logging Interceptor** | 4.11.0 | HTTP request/response logging |
| **Coroutines & Flow** | — | Async operations and reactive streams |
| **Google Maps SDK** | 18.1.0 | Map display, markers, polylines |
| **Google Maps Compose** | 2.11.4 | Compose wrappers for Google Maps |
| **Google Maps Utils** | 3.4.0 / KTX 5.0.0 | PolyUtil for polyline encoding/decoding |
| **Google Places API** | 3.0.0 | Place search and autocomplete |
| **Google Maps Services (Java)** | 2.1.0 | Directions API via GeoApiContext |
| **Google Location Services** | 21.0.1 | FusedLocationProviderClient |
| **Navigation Compose** | 2.7.5 | Screen navigation |
| **WorkManager** | 2.8.1 | Background sync tasks |
| **Coil** | 2.4.0 | Image loading (declared but not actively used; Base64 used instead) |
| **Material Icons Extended** | 1.6.0 | Extended icon set |
| **SLF4J Simple** | 1.7.32 | Logging for google-maps-services |
| **SharedPreferences** | — | User session persistence |
| **Gson** | (via Retrofit converter) | JSON serialization/deserialization |

**Build Config:**
- `compileSdk = 34`, `minSdk = 24`, `targetSdk = 34`
- `jvmTarget = 17`, `kotlinCompilerExtensionVersion = 1.5.3`
- `buildConfig = true` (exposes `MAPS_API_KEY` and `BACKEND_URL` from `local.properties`)

### Backend (Node.js)

| Technology | Purpose |
|---|---|
| **Node.js + Express** | REST API server |
| **MongoDB + Mongoose** | Database and ODM |
| **Socket.IO** | Real-time WebSocket communication |
| **JWT (jsonwebtoken)** | Authentication tokens |
| **bcrypt/bcryptjs** | Password hashing |
| **Twilio** | SMS and WhatsApp messaging |
| **node-cron** | Scheduled daily summary generation |
| **CORS** | Cross-origin resource sharing |
| **dotenv** | Environment variable management |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Android App (Frontend)                     │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Screens  │→│  ViewModels   │→│   Repositories      │    │
│  │ (Compose) │  │ (Hilt DI)    │  │ (Data Layer)        │    │
│  └──────────┘  └──────────────┘  └──────┬─────────────┘    │
│                                         │                    │
│                        ┌────────────────┼────────────────┐  │
│                        ▼                ▼                │  │
│                  ┌──────────┐    ┌──────────────┐        │  │
│                  │ Room DB  │    │ Retrofit API │        │  │
│                  │ (Local)  │    │  (Network)   │        │  │
│                  └──────────┘    └──────┬───────┘        │  │
│                                         │                │  │
│  ┌──────────────────┐  ┌───────────────┐│                │  │
│  │LocationTracking  │  │ WorkManager   ││                │  │
│  │   Service        │  │ (Bg Sync)     ││                │  │
│  └──────────────────┘  └───────────────┘│                │  │
└─────────────────────────────────────────┼────────────────┘  │
                                          │                    │
                                          ▼                    │
                               ┌──────────────────┐           │
                               │  Express Server   │           │
                               │  (Node.js API)    │           │
                               │  ┌─────────────┐  │           │
                               │  │ Socket.IO   │  │◄── Real-time
                               │  └─────────────┘  │    location
                               │  ┌─────────────┐  │    updates
                               │  │  MongoDB     │  │           │
                               │  └─────────────┘  │           │
                               │  ┌─────────────┐  │           │
                               │  │   Twilio     │  │── SMS/WhatsApp
                               │  └─────────────┘  │           │
                               │  ┌─────────────┐  │           │
                               │  │  node-cron   │  │── Daily summaries
                               │  └─────────────┘  │   at 9 PM
                               └──────────────────┘           │
```

### Layered Architecture (Android)

1. **UI Layer** — Jetpack Compose screens + ViewModels (MVVM)
2. **Domain Layer** — Repositories that mediate between network and local DB (offline-first)
3. **Data Layer** — Room database (local), Retrofit API service (remote), SharedPreferences
4. **Services Layer** — Foreground location tracking service, WorkManager sync, SyncManager

---

## 4. Backend API Documentation

**Base URL:** `http://<server>:<PORT>/api`

### 4.1 User Routes (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/register` | Public | Register a new user with name, phone, email, password |
| `POST` | `/login` | Public | Login with phone number and password, returns JWT |
| `GET` | `/me` | Protected | Get current authenticated user's profile |
| `GET` | `/:userId` | Protected | Get a user by their custom ID |
| `PUT` | `/:userId` | Protected | Update user name/email |
| `PUT` | `/:userId/group` | Protected | Update user's group code |
| `PUT` | `/:userId/photo` | Protected | Upload profile photo (Base64) |
| `GET` | `/:userId/photo` | Protected | Get profile photo (Base64) |

**Register Request Body:**
```json
{
  "id": "unique-uuid",
  "name": "John Doe",
  "phone": "+1234567890",
  "email": "john@example.com",
  "password": "securePassword"
}
```

**Login Request Body:**
```json
{
  "phone": "+1234567890",
  "password": "securePassword"
}
```

**Response (Login/Register):**
```json
{
  "id": "user-uuid",
  "name": "John Doe",
  "phone": "+1234567890",
  "email": "john@example.com",
  "groupCode": "ABC123",
  "token": "jwt-token-string"
}
```

### 4.2 Trip Routes (`/api/trips`)

All routes are **protected** (require JWT Bearer token).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/start` | Start a new trip with source/destination coordinates, addresses, and route polyline |
| `POST` | `/:tripId/complete` | Mark a trip as completed (sets endTime, status=COMPLETED) |
| `POST` | `/:tripId/cancel` | Cancel a trip (sets status=CANCELLED) |
| `GET` | `/user/:userId` | Get all trips for a user (supports `?limit=` and `?status=` query params) |
| `GET` | `/user/:userId/active` | Get the user's currently active trip |
| `GET` | `/:tripId` | Get a specific trip by ID |

**Start Trip Request Body:**
```json
{
  "id": "trip-uuid",
  "userId": "user-uuid",
  "sourceLatitude": 28.6139,
  "sourceLongitude": 77.2090,
  "destinationLatitude": 28.7041,
  "destinationLongitude": 77.1025,
  "sourceAddress": "Connaught Place, New Delhi",
  "destinationAddress": "India Gate, New Delhi",
  "routePolyline": "encoded-polyline-string",
  "startTime": "2026-02-18T10:00:00Z"
}
```

### 4.3 Alert Routes (`/api/alerts`)

All routes are **protected**.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/` | Create a new alert. Sends SMS/WhatsApp + WebSocket notification |
| `POST` | `/:alertId/cancel` | Cancel an SOS alert. Sends "all clear" message |
| `POST` | `/:alertId/acknowledge` | Mark an alert as acknowledged |
| `GET` | `/trip/:tripId` | Get all alerts for a specific trip |
| `GET` | `/user/:userId` | Get recent alerts for a user (supports `?limit=`) |
| `POST` | `/summaries/generate` | Manually trigger daily summary generation for all users |
| `POST` | `/summaries/user/:userId` | Manually trigger daily summary for a specific user |

**Create Alert Request Body:**
```json
{
  "id": "alert-uuid",
  "tripId": "trip-uuid",
  "userId": "user-uuid",
  "type": "SOS",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "timestamp": "2026-02-18T10:30:00Z",
  "description": "Emergency assistance needed!"
}
```

**Alert Types (Backend):**
- `DEVIATION` — User deviated from planned route (increments trip's deviationCount)
- `STOP` — Unexpected stop for 90+ seconds (increments trip's stopCount)
- `SOS` — Emergency alert triggered by user (can be cancelled)
- `TRIP_COMPLETE` — Trip completed successfully

### 4.4 Group/Safe Circle Routes (`/api/groups`)

All routes are **protected**.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/create` | Create a new Safe Circle (generates unique 6-char code, adds creator as member) |
| `POST` | `/join` | Join an existing circle using group code |
| `POST` | `/leave` | Leave a circle. If creator leaves, ownership transfers. If last member, circle deleted |
| `GET` | `/:groupCode/members` | Get all members of a circle with user details |
| `GET` | `/:groupCode` | Get circle details (name, description, member count, creator) |

### 4.5 Route Routes (`/api/routes`)

All routes are **protected**.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/user/:userId` | Get all routes for a user |
| `POST` | `/sync/:userId` | Efficient sync: receives local route IDs, returns only new server routes |
| `GET` | `/:routeId` | Get a specific route by ID |
| `POST` | `/` | Create a new route with paths and waypoints |
| `PUT` | `/:routeId` | Update an existing route |
| `DELETE` | `/:routeId` | Delete a route |

### 4.6 WebSocket Events (Socket.IO)

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_group` | Client → Server | Join a group room for receiving alerts |
| `location_update` | Client → Server → Group | Broadcast real-time location |
| `alert` | Server → Group | Broadcast alert notification |
| `alert_cancelled` | Server → Group | Broadcast alert cancellation |

### 4.7 Authentication

- **Method:** JWT Bearer Token
- **Token Lifetime:** 30 days
- **Header Format:** `Authorization: Bearer <jwt-token>`
- **Auth Middleware:** Verifies token, attaches `req.user` with full user object

### 4.8 Scheduled Tasks

| Schedule | Task | Description |
|----------|------|-------------|
| Daily at 9:00 PM | `generateAllDailySummaries` | Generates daily stats and sends summaries to circle members |

---

## 5. Frontend (Android) Documentation

### 5.1 Package Structure

```
com.example.saferoute/
├── MainActivity.kt                    # Entry point, start destination logic
├── SafeRouteApplication.kt           # @HiltAndroidApp, Maps init, sync setup
├── data/
│   ├── database/
│   │   ├── AppDatabase.kt            # Room DB v4, 7 entities, destructive migration
│   │   ├── Converters.kt             # Type converters for Room (Date, enum, JSON)
│   │   ├── AlertDao.kt               # Alert CRUD + queries by user/trip/type/date
│   │   ├── CircleMemberDao.kt        # Circle membership CRUD
│   │   ├── PathDao.kt                # Path CRUD within routes
│   │   ├── PathPointDao.kt           # PathPoint CRUD ordered by `order`
│   │   ├── RouteDao.kt               # Route CRUD + active/inactive management
│   │   ├── SafeCircleDao.kt          # SafeCircle CRUD
│   │   ├── TripDao.kt                # Trip CRUD + active trip queries
│   │   └── UserDao.kt                # User CRUD + group queries
│   ├── models/
│   │   ├── Alert.kt                  # @Entity: alert records with geo, type, flags
│   │   ├── AlertType.kt              # Enum: 10 alert types
│   │   ├── CircleMember.kt           # @Entity: composite PK (userId, groupCode)
│   │   ├── Path.kt                   # @Entity: route path with @Ignore points list
│   │   ├── PathPoint.kt              # @Entity: GPS point with source/dest/waypoint flags
│   │   ├── Place.kt                  # Data class: search result (id, name, address, LatLng?)
│   │   ├── Route.kt                  # @Entity: route with @Ignore paths list
│   │   ├── SafeCircle.kt             # @Entity: circle with name, code, creator
│   │   ├── SyncStatus.kt             # Enum: SYNCED, PENDING_SYNC, SYNC_FAILED, SYNCING
│   │   ├── Trip.kt                   # @Entity: trip with location updates, helper methods
│   │   ├── TripStatus.kt             # Enum: 6 statuses
│   │   └── User.kt                   # @Entity: user with profilePhoto, computed phone
│   ├── network/
│   │   ├── ApiService.kt             # Retrofit interface + request/response classes
│   │   ├── AuthInterceptor.kt        # OkHttp interceptor: adds Bearer token
│   │   ├── RouteApiService.kt        # Separate Retrofit interface for route sync
│   │   └── RouteSyncModels.kt        # RouteSyncRequest/Response data classes
│   ├── preferences/
│   │   └── UserPreferenceManager.kt  # SharedPreferences wrapper for session data
│   └── repositories/
│       ├── AlertRepository.kt        # @Singleton: alert CRUD, SOS management
│       ├── RouteRepository.kt        # @Singleton: route CRUD, sync, path management (887 lines)
│       ├── SafeCircleRepository.kt   # @Singleton: circle CRUD, server sync
│       ├── TripRepository.kt         # @Singleton: trip lifecycle, Directions API
│       └── UserRepository.kt         # @Singleton: auth, profile, StateFlow<User?>
├── di/
│   ├── AppModule.kt                  # Provides Geocoder
│   ├── DatabaseModule.kt             # Provides AppDatabase + 7 DAOs
│   ├── NetworkModule.kt              # Provides OkHttpClient, Retrofit, ApiService, Gson
│   ├── PlacesModule.kt               # Provides PlacesClient, GeoApiContext
│   └── WorkManagerModule.kt          # Provides SafeRouteWorkerFactory
├── services/
│   ├── LocationTrackingService.kt    # Foreground service: GPS, deviation, stops
│   ├── NetworkSyncWorker.kt          # WorkManager: route sync with custom Factory
│   ├── SafeRouteWorkerFactory.kt     # Hilt-compatible WorkerFactory
│   └── SyncManager.kt                # Schedules periodic + on-demand sync
├── ui/
│   ├── components/
│   │   └── BottomNavigationBar.kt    # 5-tab bottom nav with smart selection
│   ├── navigation/
│   │   ├── NavigationGraph.kt        # NavHost with all composable routes
│   │   └── Screen.kt                 # 20 sealed class route definitions
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.kt        # Phone + password login
│   │   │   └── RegisterScreen.kt     # Registration with 5 fields
│   │   ├── home/
│   │   │   ├── HomeScreen.kt         # Dashboard with quick actions
│   │   │   └── HomeViewModel.kt      # HomeUiState, alert mapping
│   │   ├── permissions/
│   │   │   └── PermissionsScreen.kt  # Runtime permission requests
│   │   ├── profile/
│   │   │   ├── CreateProfileScreen.kt # Initial profile setup (placeholder)
│   │   │   ├── EditProfileScreen.kt   # Edit name/email/photo
│   │   │   └── ProfileScreen.kt       # View profile + logout
│   │   ├── routes/
│   │   │   ├── CreateRouteScreen.kt   # Map-based route creation (1333 lines)
│   │   │   ├── RouteDetailsScreen.kt  # Route view + start trip
│   │   │   ├── RouteDetailsViewModel.kt # Directions caching VM
│   │   │   ├── RouteViewModel.kt      # Route creation VM
│   │   │   └── RoutesScreen.kt        # Route list
│   │   ├── safecircle/
│   │   │   ├── CreateCircleScreen.kt  # Create new circle
│   │   │   ├── JoinCircleScreen.kt    # Join by code
│   │   │   ├── SafeCircleScreen.kt    # Circle details + members (762 lines)
│   │   │   └── SafeCircleViewModel.kt # Circle state management
│   │   └── trips/
│   │       ├── ActiveTripScreen.kt    # Live trip monitoring (777 lines)
│   │       ├── TripHistoryScreen.kt   # Past trips list
│   │       ├── TripHistoryViewModel.kt
│   │       ├── TripViewModel.kt       # Trip planning + alerts
│   │       └── TripsScreen.kt         # PLACEHOLDER ("Coming Soon")
│   ├── theme/
│   │   ├── Color.kt                   # Purple80/40, PurpleGrey, Pink
│   │   ├── Theme.kt                   # SafeRouteTheme with dynamic color
│   │   └── Type.kt                    # Default Typography
│   └── viewmodels/
│       ├── AuthViewModel.kt           # Login/Register/Profile states
│       └── RoutesViewModel.kt         # Simple route list VM
└── utils/
    ├── AlertManager.kt                # SMS alert formatting + sending
    ├── DateTypeAdapter.kt             # Gson Long adapter (ISO-8601 ↔ Long)
    ├── DateTypeAdapterFactory.kt      # TypeAdapterFactory for Long date fields
    ├── FormatUtils.kt                 # EMPTY FILE (no implementation)
    ├── LocationPermissionHelper.kt    # Permission check + map property helpers
    ├── NetworkUtils.kt                # Network availability + callbackFlow
    ├── PermissionUtils.kt             # Required permissions list + helpers
    └── Result.kt                      # Custom sealed class: Success/Error
```

### 5.2 Build Configuration

**File:** `app/build.gradle.kts`

```kotlin
android {
    namespace = "com.example.saferoute"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.example.saferoute"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        // API keys from local.properties
        buildConfigField("String", "MAPS_API_KEY", "\"${localProperties.getProperty("MAPS_API_KEY", "")}\"")
        buildConfigField("String", "BACKEND_URL", "\"${localProperties.getProperty("BACKEND_URL", "")}\"")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}
```

### 5.3 Application Entry Points

#### `SafeRouteApplication.kt`

**Annotations:** `@HiltAndroidApp`  
**Implements:** `Configuration.Provider` (for custom WorkManager)

**Initialization sequence:**
1. Initializes Google Maps SDK using `MAPS_API_KEY` from BuildConfig
2. Sets up periodic route sync via `SyncManager.schedulePeriodicSync()`
3. Monitors network state via `NetworkUtils.observeNetworkState()` — triggers immediate sync when connectivity restored
4. Restores user from SharedPreferences on startup:
   - Reads saved user JSON from `UserPreferenceManager`
   - If found, inserts into Room DB and sets as current user in `UserRepository`
   - Logs errors but does not crash on failure

#### `MainActivity.kt`

**Annotations:** `@AndroidEntryPoint`  
**Injects:** `UserRepository`

**Start destination logic:**
```
1. Check PermissionUtils.areAllPermissionsGranted(context)
   ├── NO → startDestination = Screen.Permissions.route
   └── YES ↓
2. Check userRepository.currentUser.value != null
   ├── YES → startDestination = Screen.Home.route
   └── NO ↓
3. Check SharedPreferences for saved user data
   ├── Found → Create basic User from prefs, set in repository → Screen.Home.route
   └── Not found → startDestination = Screen.Login.route
```

**Compose setup:**
- Applies `SafeRouteTheme`
- Creates `NavHostController`
- Obtains `AuthViewModel` via `hiltViewModel()`
- Renders `NavigationGraph` with computed `startDestination`

---

## 6. Data Models (Complete Field Reference)

### 6.1 `User.kt` — `@Entity(tableName = "users")`

| Field | Type | Annotations | Description |
|-------|------|-------------|-------------|
| `id` | `String` | `@PrimaryKey` | UUID generated client-side |
| `name` | `String` | — | Display name |
| `phoneNumber` | `String` | — | Login identifier |
| `email` | `String?` | — | Optional email |
| `password` | `String?` | — | Stored locally for offline login |
| `profilePicUrl` | `String?` | — | URL for profile picture |
| `profilePhoto` | `String?` | — | Base64-encoded profile image |
| `groupCode` | `String?` | — | Safe Circle membership code |

**Computed property:**
- `phone: String` — alias for `phoneNumber` (getter returns `phoneNumber`)

---

### 6.2 `Trip.kt` — `@Entity(tableName = "trips")`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `String` | `@PrimaryKey` | UUID |
| `userId` | `String` | — | Owner user ID |
| `sourceLat` | `Double` | — | Source latitude |
| `sourceLng` | `Double` | — | Source longitude |
| `destinationLat` | `Double` | — | Destination latitude |
| `destinationLng` | `Double` | — | Destination longitude |
| `sourceAddress` | `String` | — | Human-readable source |
| `destinationAddress` | `String` | — | Human-readable destination |
| `routePolyline` | `String` | `""` | Encoded polyline of planned route |
| `status` | `TripStatus` | `TripStatus.PLANNED` | Current trip status |
| `startTime` | `Long` | `System.currentTimeMillis()` | Trip start timestamp (ms) |
| `endTime` | `Long?` | `null` | Trip end timestamp (ms) |
| `deviationCount` | `Int` | `0` | Number of route deviations |
| `stopCount` | `Int` | `0` | Number of unexpected stops |
| `alertCount` | `Int` | `0` | Total alerts triggered |
| `routeId` | `String?` | `null` | Reference to saved Route |
| `estimatedDuration` | `Long?` | `null` | Estimated duration in **minutes** |
| `estimatedDistance` | `Double?` | `null` | Estimated distance in **kilometers** |
| `sharedWithUsers` | `List<String>` | `emptyList()` | User IDs trip is shared with |
| `locationUpdates` | `List<Pair<Double, Double>>` | `emptyList()` | Recorded GPS positions |

**Computed property:**
- `isActive: Boolean` — `status == TripStatus.STARTED || status == TripStatus.PLANNED`

**Helper methods:**
- `getSourceLatLng(): LatLng` — Returns LatLng from sourceLat/sourceLng
- `getDestinationLatLng(): LatLng` — Returns LatLng from destinationLat/destinationLng
- `getRoutePoints(): List<LatLng>` — Decodes `routePolyline` using `PolyUtil.decode()`
- `isOnRoute(latitude, longitude, thresholdMeters = 100.0): Boolean` — Haversine distance check against decoded route points (returns `true` if no route polyline)

---

### 6.3 `Alert.kt` — `@Entity(tableName = "alerts")`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `String` | `@PrimaryKey` | UUID |
| `tripId` | `String` | — | Associated trip ID |
| `userId` | `String` | — | User who triggered alert |
| `type` | `AlertType` | — | Alert category |
| `latitude` | `Double` | — | Alert location latitude |
| `longitude` | `Double` | — | Alert location longitude |
| `timestamp` | `Long` | `System.currentTimeMillis()` | When alert was created |
| `description` | `String` | `""` | Human-readable description |
| `isSent` | `Boolean` | `false` | Whether sent to backend/contacts |
| `isAcknowledged` | `Boolean` | `false` | Whether acknowledged by user/recipient |
| `isCancelled` | `Boolean` | `false` | Whether cancelled (SOS only) |

---

### 6.4 `AlertType.kt` — `enum class`

```kotlin
enum class AlertType {
    DEVIATION,           // Automatic: route deviation detected
    STOP,                // Automatic: unexpected stop detected
    SOS,                 // Manual: user-triggered emergency
    TRIP_COMPLETE,       // Automatic: trip completed
    ROUTE_DEVIATION,     // Alternative route deviation label
    TRIP_OVERDUE,        // Trip exceeded expected duration
    EMERGENCY,           // General emergency (distinct from SOS)
    SAFETY_CHECK,        // Safety check-in reminder
    DESTINATION_REACHED, // Arrived at destination
    TRIP_STARTED         // Trip has begun
}
```

**Note:** The backend only uses 4 types (DEVIATION, STOP, SOS, TRIP_COMPLETE). The additional 6 types are defined in the Android enum for future use or local-only alerts.

---

### 6.5 `TripStatus.kt` — `enum class`

```kotlin
enum class TripStatus {
    PLANNED,    // Trip created but not started
    STARTED,    // Currently active
    COMPLETED,  // Successfully finished
    CANCELLED,  // User cancelled
    DELAYED,    // Trip behind schedule
    EMERGENCY   // Emergency state active
}
```

---

### 6.6 `SyncStatus.kt` — `enum class`

```kotlin
enum class SyncStatus {
    SYNCED,        // Fully synced with server
    PENDING_SYNC,  // Waiting to be synced
    SYNC_FAILED,   // Sync attempt failed
    SYNCING        // Currently being synced
}
```

**Note:** Used conceptually in route sync logic. Not stored as a Room column.

---

### 6.7 `Route.kt` — `@Entity(tableName = "routes")`

| Field | Type | Annotations | Description |
|-------|------|-------------|-------------|
| `id` | `String` | `@PrimaryKey` | UUID |
| `userId` | `String` | — | Owner user ID |
| `name` | `String` | — | Route display name |
| `description` | `String` | `""` | Optional description |
| `sourceLat` | `Double` | — | Source latitude |
| `sourceLng` | `Double` | — | Source longitude |
| `destinationLat` | `Double` | — | Destination latitude |
| `destinationLng` | `Double` | — | Destination longitude |
| `sourceAddress` | `String` | `""` | Human-readable source |
| `destinationAddress` | `String` | `""` | Human-readable destination |
| `isActive` | `Boolean` | `true` | Whether route is active |
| `createdAt` | `Long` | `System.currentTimeMillis()` | Creation timestamp |
| `paths` | `List<Path>` | `@Ignore`, `emptyList()` | Child paths (not stored in routes table) |

**Helper methods:**
- `getSourceLatLng(): LatLng`
- `getDestinationLatLng(): LatLng`
- `isOnRoute(lat, lng, thresholdMeters): Boolean` — checks all paths via `Path.isOnPath()`

**Secondary constructor:** Creates Route without paths field (for Room compatibility)

---

### 6.8 `Path.kt` — `@Entity(tableName = "paths", foreignKeys = [Route])`

| Field | Type | Annotations | Description |
|-------|------|-------------|-------------|
| `id` | `String` | `@PrimaryKey` | UUID |
| `routeId` | `String` | `@ForeignKey(Route, CASCADE)` | Parent route ID |
| `name` | `String` | `""` | Path display name |
| `description` | `String` | `""` | Optional description |
| `isActive` | `Boolean` | `true` | Whether this path is the active one |
| `points` | `List<PathPoint>` | `@Ignore`, `emptyList()` | Child points (not in paths table) |

**Helper methods:**
- `isOnPath(lat, lng, thresholdMeters = 100.0): Boolean` — Haversine distance check against all points
- **Companion:** `encodePolyline(points: List<PathPoint>): String` — Uses `PolyUtil.encode()`

---

### 6.9 `PathPoint.kt` — `@Entity(tableName = "path_points", foreignKeys = [Path])`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `String` | `@PrimaryKey` | UUID |
| `pathId` | `String` | `@ForeignKey(Path, CASCADE)` | Parent path ID |
| `latitude` | `Double` | — | GPS latitude |
| `longitude` | `Double` | — | GPS longitude |
| `isSource` | `Boolean` | `false` | Is this the source point? |
| `isDestination` | `Boolean` | `false` | Is this the destination point? |
| `isWaypoint` | `Boolean` | `false` | Is this an intermediate waypoint? |
| `order` | `Int` | `0` | Ordering index within path |

**Methods:**
- `toLatLng(): LatLng` — Converts to Google Maps LatLng
- **Companion:** `fromLatLng(pathId, latLng, order, isSource, isDestination, isWaypoint): PathPoint`

---

### 6.10 `SafeCircle.kt` — `@Entity(tableName = "safe_circles")`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` | `@PrimaryKey`, UUID |
| `name` | `String` | Circle display name |
| `groupCode` | `String` | Unique 6-character join code |
| `creatorId` | `String` | User ID of creator |
| `description` | `String?` | Optional description |
| `memberCount` | `Int` | Number of members |

---

### 6.11 `CircleMember.kt` — `@Entity(tableName = "circle_members")`

| Field | Type | Description |
|-------|------|-------------|
| `userId` | `String` | `@PrimaryKey` part 1, `@ForeignKey(User, CASCADE)` |
| `groupCode` | `String` | `@PrimaryKey` part 2 |
| `joinedAt` | `Long` | Join timestamp |

**Note:** Has composite primary key `(userId, groupCode)`. Foreign key to User with CASCADE delete. Despite having `@Entity` annotation, `CircleMember` is **NOT listed in AppDatabase entities** (see §7.1).

---

### 6.12 `Place.kt` — Data class (not an Entity)

```kotlin
data class Place(
    val id: String,
    val name: String,
    val address: String,
    val location: LatLng? = null
)
```

Used for Google Places autocomplete results in route/trip creation.

---

## 7. Room Database & DAOs

### 7.1 `AppDatabase.kt`

```kotlin
@Database(
    entities = [User::class, Route::class, Path::class, PathPoint::class,
                SafeCircle::class, Trip::class, Alert::class],
    version = 4
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase()
```

**Key details:**
- **Version:** 4
- **Entities (7):** User, Route, Path, PathPoint, SafeCircle, Trip, Alert
- **NOT included:** `CircleMember` (despite having `@Entity` annotation, it is omitted from the `entities` array)
- **Migration strategy:** `fallbackToDestructiveMigration()` — wipes DB on version change

**Provides abstract DAOs:** `userDao()`, `tripDao()`, `alertDao()`, `safeCircleDao()`, `routeDao()`, `pathDao()`, `pathPointDao()`

---

### 7.2 `Converters.kt`

Type converters registered with Room:

| Conversion | Method | Details |
|---|---|---|
| `Date? ↔ Long?` | `fromTimestamp` / `dateToTimestamp` | Nullable Date conversion |
| `TripStatus ↔ String` | `statusToString` / `stringToStatus` | Enum name serialization |
| `AlertType ↔ String` | `alertTypeToString` / `stringToAlertType` | Enum name serialization |
| `List<String> ↔ String` | `fromStringList` / `toStringList` | Gson JSON array |
| `List<Pair<Double,Double>> ↔ String` | `fromPairList` / `toPairList` | Gson with `TypeToken` |
| `List<Path> ↔ String` | `fromPathList` / `toPathList` | Gson JSON |
| `List<PathPoint> ↔ String` | `fromPathPointList` / `toPathPointList` | Gson JSON |
| `List<Double> ↔ String` | `fromDoubleList` / `toDoubleList` | Gson JSON |

---

### 7.3 DAO Methods (Complete Reference)

#### `UserDao`

| Method | Return Type | Query |
|--------|-------------|-------|
| `insertUser(user)` | `Unit` | `@Insert(REPLACE)` |
| `updateUser(user)` | `Unit` | `@Update` |
| `deleteUser(user)` | `Unit` | `@Delete` |
| `getUserById(userId)` | `Flow<User?>` | `SELECT * FROM users WHERE id = :userId` |
| `getUserByIdSync(userId)` | `User?` | Same query, `suspend` |
| `getUserByIdDirect(userId)` | `User?` | Same query, synchronous (no suspend) |
| `getByPhoneNumber(phone)` | `User?` | `SELECT * FROM users WHERE phoneNumber = :phone LIMIT 1` |
| `updateUserGroup(userId, groupCode)` | `Unit` | `UPDATE users SET groupCode = :groupCode WHERE id = :userId` |
| `getUsersByGroupCode(groupCode)` | `List<User>` | `SELECT * FROM users WHERE groupCode = :groupCode` |

#### `TripDao`

| Method | Return Type | Query |
|--------|-------------|-------|
| `insertTrip(trip)` | `Unit` | `@Insert(REPLACE)` |
| `updateTrip(trip)` | `Unit` | `@Update` |
| `deleteTrip(trip)` | `Unit` | `@Delete` |
| `getTripById(tripId)` | `Trip?` | `suspend` |
| `getActiveTrip(userId)` | `Trip?` | `WHERE userId = :userId AND status = 'STARTED' LIMIT 1` |
| `getTripHistory(userId)` | `List<Trip>` | `WHERE userId = :userId ORDER BY startTime DESC` |
| `endTrip(tripId, endTime, status)` | `Unit` | `UPDATE trips SET endTime, status` |
| `updateTripStatus(tripId, status)` | `Unit` | `UPDATE trips SET status` |
| `incrementDeviationCount(tripId)` | `Unit` | `UPDATE trips SET deviationCount = deviationCount + 1` |
| `incrementStopCount(tripId)` | `Unit` | `UPDATE trips SET stopCount = stopCount + 1` |
| `incrementAlertCount(tripId)` | `Unit` | `UPDATE trips SET alertCount = alertCount + 1` |

#### `AlertDao`

| Method | Return Type | Description |
|--------|-------------|-------------|
| `getAllAlerts()` | `LiveData<List<Alert>>` | All alerts |
| `getAlertsByUser(userId)` | `LiveData<List<Alert>>` | Alerts for user |
| `getAlertsByTrip(tripId)` | `LiveData<List<Alert>>` | Alerts for trip |
| `getAlertsByType(type)` | `LiveData<List<Alert>>` | Alerts by type |
| `getAlertsByDateRange(start, end)` | `LiveData<List<Alert>>` | Alerts in date range |
| `insertAlert(alert)` | `Unit` | `@Insert(REPLACE)` |
| `updateAlert(alert)` | `Unit` | `@Update` |
| `deleteAlert(alert)` | `Unit` | `@Delete` |
| `getTripAlerts(tripId)` | `Flow<List<Alert>>` | Flow of trip alerts, ordered by timestamp DESC |
| `getUserRecentAlerts(userId, limit)` | `Flow<List<Alert>>` | Flow of recent user alerts |
| `getUnsentAlerts()` | `List<Alert>` | `WHERE isSent = 0` |
| `markAsSent(alertId)` | `Unit` | `UPDATE alerts SET isSent = 1` |
| `acknowledgeAlert(alertId)` | `Unit` | `UPDATE alerts SET isAcknowledged = 1` |
| `cancelAlert(alertId)` | `Unit` | `UPDATE alerts SET isCancelled = 1` |
| `countAlertsByType(tripId, type)` | `Int` | `SELECT COUNT(*)` |
| `getLatestActiveSOS(userId)` | `Alert?` | `WHERE type = 'SOS' AND isCancelled = 0 ORDER BY timestamp DESC LIMIT 1` |

#### `RouteDao`

| Method | Return Type | Description |
|--------|-------------|-------------|
| `insertRoute(route)` | `Unit` | `@Insert(REPLACE)` |
| `updateRoute(route)` | `Unit` | `@Update` |
| `deleteRoute(routeId)` | `Unit` | `DELETE FROM routes WHERE id = :routeId` |
| `deleteRoute(route)` | `Unit` | `@Delete` (entity-based) |
| `getRouteById(routeId)` | `Route?` | `suspend` |
| `getAllRoutes()` | `Flow<List<Route>>` | All routes as Flow |
| `getAllRoutesSync()` | `List<Route>` | All routes synchronously |
| `getActiveRoutes()` | `Flow<List<Route>>` | `WHERE isActive = 1` |
| `deactivateRoute(routeId)` | `Unit` | `UPDATE routes SET isActive = 0` |
| `activateRoute(routeId)` | `Unit` | `UPDATE routes SET isActive = 1` |

#### `PathDao`

| Method | Return Type | Description |
|--------|-------------|-------------|
| `insertPath(path)` | `Unit` | `@Insert(REPLACE)` |
| `updatePath(path)` | `Unit` | `@Update` |
| `deletePath(path)` | `Unit` | `@Delete` |
| `getPathsForRoute(routeId)` | `List<Path>` | All paths for a route |
| `deletePathsForRoute(routeId)` | `Unit` | Bulk delete by route |
| `deactivateAllPathsForRoute(routeId)` | `Unit` | Set all paths inactive |
| `setPathActive(pathId)` | `Unit` | Set single path active |

#### `PathPointDao`

| Method | Return Type | Description |
|--------|-------------|-------------|
| `insertPoint(point)` | `Unit` | `@Insert(REPLACE)` |
| `insertPoints(points)` | `Unit` | Bulk insert |
| `updatePoint(point)` | `Unit` | `@Update` |
| `deletePoint(point)` | `Unit` | `@Delete` |
| `getPointsForPath(pathId)` | `List<PathPoint>` | `ORDER BY \`order\` ASC` |
| `deletePointsForPath(pathId)` | `Unit` | Bulk delete by path |

#### `SafeCircleDao`

| Method | Return Type | Description |
|--------|-------------|-------------|
| `insertCircle(circle)` | `Unit` | `@Insert(REPLACE)` |
| `updateCircle(circle)` | `Unit` | `@Update` |
| `deleteCircle(circle)` | `Unit` | `@Delete` |
| `getCircleByCode(groupCode)` | `SafeCircle?` | `suspend` |
| `getCirclesByCreator(creatorId)` | `List<SafeCircle>` | `suspend` |
| `getAllCircles()` | `List<SafeCircle>` | `suspend` |

#### `CircleMemberDao`

| Method | Return Type | Description |
|--------|-------------|-------------|
| `insertMember(member)` | `Unit` | `@Insert(REPLACE)` |
| `deleteMember(member)` | `Unit` | `@Delete` |
| `getMembersByGroupCode(groupCode)` | `LiveData<List<CircleMember>>` | Members in a circle |
| `getMembershipsByUserId(userId)` | `List<CircleMember>` | Circles user belongs to |
| `deleteAllGroupMembers(groupCode)` | `Unit` | Remove all members from circle |
| `deleteAllUserMemberships(userId)` | `Unit` | Remove user from all circles |

---

## 8. Network Layer

### 8.1 `ApiService.kt` — Retrofit Interface

**Embedded data classes:**

```kotlin
// Request classes
data class RegisterRequest(id, name, phone, email?, password)
data class LoginRequest(phone, password)
data class UpdateProfileRequest(name, email?)
data class UpdateProfilePhotoRequest(profilePhoto: String)  // Base64
data class StartTripRequest(id, userId, sourceLatitude, sourceLongitude, destinationLatitude,
    destinationLongitude, sourceAddress, destinationAddress, routePolyline, startTime)
data class CompleteTripRequest(endTime, status)
data class CreateAlertRequest(id, tripId, userId, type, latitude, longitude, timestamp, description)
data class CreateGroupRequest(name, creatorId, description?)
data class JoinGroupRequest(groupCode, userId)
data class LeaveGroupRequest(groupCode, userId)

// Response classes
data class UserResponse(id, name, phone, email?, groupCode?, profilePhoto?, token?)
data class TripResponse(id, userId, sourceLatitude, sourceLongitude, destinationLatitude,
    destinationLongitude, sourceAddress, destinationAddress, routePolyline?, status, startTime, endTime?)
data class AlertResponse(id, tripId, userId, type, latitude, longitude, timestamp, description, isSent)
data class GroupResponse(groupCode, name, description?, creatorId, members: List<UserResponse>?)
data class StatusResponse(success, message)
data class ProfilePhotoResponse(profilePhoto: String)  // Base64
```

**API Endpoints:**

| Method | Path | Return |
|--------|------|--------|
| `POST /users/register` | `RegisterRequest` → `UserResponse` |
| `POST /users/login` | `LoginRequest` → `UserResponse` |
| `GET /users/me` | → `UserResponse` |
| `GET /users/{userId}` | → `UserResponse` |
| `PUT /users/{userId}` | `UpdateProfileRequest` → `UserResponse` |
| `PUT /users/{userId}/photo` | `UpdateProfilePhotoRequest` → `UserResponse` |
| `GET /users/{userId}/photo` | → `ProfilePhotoResponse` |
| `POST /trips/start` | `StartTripRequest` → `TripResponse` |
| `POST /trips/{tripId}/complete` | `CompleteTripRequest` → `TripResponse` |
| `PUT /trips/{tripId}/status` | `CompleteTripRequest` → `TripResponse` |
| `GET /trips/user/{userId}` | → `List<TripResponse>` |
| `GET /trips/user/{userId}/active` | → `TripResponse` |
| `GET /trips/{tripId}` | → `TripResponse` |
| `POST /alerts` | `CreateAlertRequest` → `AlertResponse` |
| `POST /alerts/{alertId}/cancel` | → `StatusResponse` |
| `GET /alerts/trip/{tripId}` | → `List<AlertResponse>` |
| `GET /alerts/user/{userId}` | → `List<AlertResponse>` |
| `POST /groups/create` | `CreateGroupRequest` → `GroupResponse` |
| `POST /groups/join` | `JoinGroupRequest` → `GroupResponse` |
| `POST /groups/leave` | `LeaveGroupRequest` → `StatusResponse` |
| `GET /groups/{groupCode}/members` | → `GroupResponse` |
| `GET /groups/{groupCode}` | → `GroupResponse` |
| `GET /routes/user/{userId}` | → `List of routes` |
| `POST /routes` | Route body → Response |
| `PUT /routes/{routeId}` | Route body → Response |
| `DELETE /routes/{routeId}` | → `Unit` |

### 8.2 `RouteApiService.kt`

Separate Retrofit interface for route operations:

| Method | Path | Description |
|--------|------|-------------|
| `POST /routes/sync/{userId}` | `RouteSyncRequest` → `RouteSyncResponse` | Efficient route sync |

### 8.3 `AuthInterceptor.kt`

OkHttp interceptor that adds `Authorization: Bearer <token>` to all requests **except** those whose URL path contains `/login` or `/register`. Reads token from `UserPreferenceManager.getSessionToken()`.

### 8.4 `RouteSyncModels.kt`

```kotlin
data class RouteSyncRequest(val localRouteIds: List<String>)
data class RouteSyncResponse(val totalRoutes: Int, val newRoutes: List<Any>)
```

---

## 9. Repositories

### 9.1 `UserRepository.kt` — `@Singleton`

**Injected:** `UserDao`, `ApiService`, `UserPreferenceManager`

**State:**
- `_currentUser: MutableStateFlow<User?>` (internal)
- `currentUser: StateFlow<User?>` (public, read-only)

**Initialization:** Loads user from `UserPreferenceManager.getUserData()` on construction.

| Method | Description |
|--------|-------------|
| `registerUser(name, phone, email?, password)` | API register → save token + user to prefs → insert to Room → set currentUser |
| `register(name, phone, password, email?)` | Alternative register (different param order) |
| `login(phone, password)` | API login → save to prefs/Room. **Offline fallback:** if network fails, checks Room DB for matching phone + verifies stored password + requires existing session token |
| `updateUser(user)` | Update Room DB |
| `updateProfile(userId, name, email)` | API `updateUserProfile` → refresh from server |
| `updateUserEmail(userId, email)` | Separate API call for email update |
| `updateProfilePhoto(userId, photoBase64)` | API `updateProfilePhoto` → update Room + currentUser |
| `getProfilePhoto(userId)` | API `getProfilePhoto` → returns Base64 string |
| `getUserById(id)` | Room DAO with suspend |
| `getUserByIdFlow(id)` | Room DAO as Flow |
| `getUsersByGroupCode(code)` | Room DAO |
| `updateUserGroup(userId, code)` | Room DAO |
| `logout()` | Clear prefs, clear Room user, set currentUser to null |
| `isLoggedIn()` | Check prefs `IS_LOGGED_IN` flag |
| `checkLoginStatus()` | Prefs → Room → API refresh chain |
| `refreshCurrentUser()` | Reload from Room DB |
| `refreshCurrentUserFromServer(userId)` | API `getUserProfile` → update Room + prefs |

---

### 9.2 `TripRepository.kt` — `@Singleton`

**Injected:** `TripDao`, `ApiService`, `UserPreferenceManager`, `GeoApiContext`

| Method | Description |
|--------|-------------|
| `getUserTrips(userId)` | Room `getTripHistory()` |
| `getActiveTrip(userId)` | Room `getActiveTrip()` |
| `planTrip(userId, source, destination, srcAddr, destAddr, routeId?)` | Creates Trip with UUID, calls Google Directions API (DRIVING mode) for distance/duration, saves to Room |
| `startTrip(trip)` | Updates status to STARTED in Room, notifies backend via API, starts `LocationTrackingService` |
| `endTrip(tripId)` | Updates status to COMPLETED with endTime in Room, notifies backend, stops LocationTrackingService |

---

### 9.3 `AlertRepository.kt` — `@Singleton`

**Injected:** `AlertDao`, `ApiService`, `UserPreferenceManager`

| Method | Description |
|--------|-------------|
| `createAlert(alert)` | Insert to Room + POST to API |
| `createSosAlert(tripId, userId, lat, lng, desc)` | Checks for existing active SOS first → creates SOS alert |
| `cancelSosAlert(alertId)` | Marks as cancelled in Room + API cancel |
| `cancelLastSOSAlert(tripId)` | Finds latest active SOS for trip → cancels it |
| `getTripAlerts(tripId)` | Room Flow |
| `getUserRecentAlerts(userId, limit=10)` | Room Flow |
| `retryUnsentAlerts()` | Gets unsent alerts → POST each to API → mark as sent |
| `acknowledgeAlert(alertId)` | Room DAO |
| `countTripAlertsByType(tripId, type)` | Room DAO |

---

### 9.4 `SafeCircleRepository.kt` — `@Singleton`

**Injected:** `SafeCircleDao`, `CircleMemberDao`, `UserDao`, `ApiService`, `UserPreferenceManager`

| Method | Description |
|--------|-------------|
| `createSafeCircle(name, description)` | API create → save circle to Room → update user groupCode |
| `joinSafeCircle(groupCode)` | API join → save circle to Room → add membership → update groupCode |
| `leaveSafeCircle(groupCode)` | API leave → delete local circle + memberships → clear groupCode |
| `getAllCircles()` | Room DAO |
| `getCircleByCode(code)` | Room DAO |
| `syncUserCircleMembership()` | If user has groupCode, fetches from server. 404 → clears local groupCode |

---

### 9.5 `RouteRepository.kt` — `@Singleton` (887 lines, most complex)

**Injected:** `RouteDao`, `PathDao`, `PathPointDao`, `ApiService`, `RouteApiService`, `UserPreferenceManager`

**Internal enum:**
```kotlin
enum class RouteSyncStatus { SYNCED, PENDING, FAILED }
```

| Method | Description |
|--------|-------------|
| `getAllRoutes()` | Room Flow, loads paths + points for each route |
| `getActiveRoutes()` | Room Flow, filtered to active |
| `getRouteById(routeId)` | Room, loads paths + points |
| `saveRoute(route)` | Inserts route + paths + points to Room, then POSTs to API |
| `createRoute(name, desc, ..., pathLatLngs, waypointsList)` | Creates Route + Path + PathPoint entities from LatLng lists, saves locally + syncs to backend |
| `createRoute(name, desc, ..., paths: List<Path>)` | Alternative: saves pre-built Path objects |
| `deleteRoute(routeId)` | Deletes points → paths → route from Room + API DELETE |
| `setActivePath(pathId)` | Deactivates all paths for that route, activates the selected one |
| `syncPendingRoutes()` | Gets routes from pending sync queue in prefs → POSTs each to API |
| `syncRoutesFromServer()` | Efficient sync: sends local route IDs → gets only new routes. Falls back to full sync on failure |
| `isLocationOnAnyRoute(lat, lng)` | Checks all routes for proximity |
| `getPathsForRoute(routeId)` | Room DAO with loaded points |
| `getPointsForPath(pathId)` | Room DAO |
| `createTripFromRoute(routeId)` | Loads route → creates Trip with routeId reference |
| `startTrip(trip)` | Inserts to Room + API start |
| `calculatePathDistance(points)` | Haversine distance calculation |
| `addToSyncQueue(routeId)` | Adds to pending sync set in SharedPreferences |

---

## 10. ViewModels (State Machines)

### 10.1 `AuthViewModel.kt` — `@HiltViewModel`

**Injected:** `UserRepository`

**State classes:**
```kotlin
sealed class LoginState {
    object Idle, Loading
    data class Success(val user: User)
    data class Error(val message: String)
}

sealed class RegisterState {
    object Idle, Loading
    data class Success(val user: User)
    data class Error(val message: String)
}

sealed class UpdateProfileState {
    object Idle, Loading
    data class Success(val user: User)
    data class Error(val message: String)
}

sealed class ProfilePhotoState {
    object Idle, Loading
    data class Success(val user: User)
    data class PhotoLoaded(val photoBase64: String)
    data class Error(val message: String)
}
```

**Exposed StateFlows:**
- `loginState`, `registerState`, `updateProfileState`, `profilePhotoState`
- `currentUser: StateFlow<User?>` (from repository)

| Method | Description |
|--------|-------------|
| `login(phone, password)` | Sets Loading → calls repo → Success/Error |
| `register(name, phone, password, email?)` | Sets Loading → calls repo → Success/Error |
| `updateProfile(name, email)` | Updates name first, then email separately via two API calls |
| `updateProfilePhoto(base64)` | Uploads photo to server |
| `getProfilePhoto(userId?)` | Fetches photo from server |
| `logout()` | Calls repo logout |
| `resetState()` | Resets all states to Idle |
| `refreshLoginStatus()` | Calls repo `checkLoginStatus()` |
| `testEmailUpdate(userId, email)` | Debug method for testing email update |

---

### 10.2 `HomeViewModel.kt` — `@HiltViewModel`

**Injected:** `UserRepository`, `TripRepository`, `AlertRepository`, `SafeCircleRepository`

**State:**
```kotlin
data class HomeUiState(
    val userName: String = "Traveler",
    val activeTrip: Trip? = null,
    val userCircle: SafeCircle? = null,
    val memberCount: Int = 0,
    val recentAlerts: List<AlertItem> = emptyList()
)

data class AlertItem(val title: String, val description: String, val time: String, val type: String)
```

**Data loading:** Observes `currentUser` changes via `collectLatest` → loads active trip, circles, recent alerts. Maps `AlertType` to human-readable titles:
- SOS → "Emergency SOS Alert"
- DEVIATION → "Route Deviation"
- STOP → "Unexpected Stop"
- TRIP_COMPLETE → "Trip Completed"
- Default → type name

---

### 10.3 `TripViewModel.kt` — `@HiltViewModel`

**Injected:** `TripRepository`, `AlertRepository`, `UserRepository`, `PlacesClient`, `GeoApiContext`, `Geocoder`

**State:**
```kotlin
sealed class TripState {
    object Idle, Loading
    data class Success(val trip: Trip)
    object TripEnded
    data class Error(val message: String)
}

data class PlaceSuggestion(val id: String, val name: String, val address: String)
```

**Exposed StateFlows:**
- `tripState`, `placeSuggestions`, `currentTrip`

| Method | Description |
|--------|-------------|
| `searchPlaces(query)` | 300ms debounced Google Places Autocomplete with `AutocompleteSessionToken` |
| `getPlaceLocation(placeId, callback)` | Fetches place details (LAT_LNG, NAME, ADDRESS) → returns `Place` |
| `getAddressFromLocation(latLng, callback)` | Reverse geocode via `Geocoder` |
| `fetchDirections(source, destination, alternatives)` | Google Directions API (DRIVING mode, with alternatives) |
| `processDirectionsResult(result)` | Decodes polylines from `DirectionsResult` |
| `generateMockRoutes(source, dest)` | Fallback: creates mock routes from direct line |
| `calculateDistance(source, dest, callback)` | Distance Matrix API with Haversine fallback |
| `calculateDuration(source, dest, callback)` | Duration from Distance Matrix API |
| `loadTripDetails(tripId)` | Loads trip from Room → sets TripState.Success |
| `planTrip(userId, source, dest, ...)` | Calls repo `planTrip()` |
| `startTrip(trip)` | Calls repo `startTrip()` |
| `endTrip(tripId)` | Calls repo `endTrip()` → sets TripState.TripEnded |
| `sendAlert(tripId, type, description)` | Creates alert via AlertRepository |
| `sendSOS(tripId, lat, lng, description)` | Creates SOS alert |
| `cancelAlert(tripId)` | Cancels last SOS for trip |
| `resetState()` | Resets to Idle |

---

### 10.4 `TripHistoryViewModel.kt` — `@HiltViewModel`

**Injected:** `TripRepository`, `UserRepository`

**State:**
```kotlin
sealed class TripHistoryState {
    object Loading
    object Empty
    data class Success(val trips: List<Trip>)
    data class Error(val message: String)
}
```

| Method | Description |
|--------|-------------|
| `loadTripHistory()` | Gets userId from currentUser → loads trips from Room → categorizes state |

---

### 10.5 `RouteViewModel.kt` — `@HiltViewModel`

**Injected:** `RouteRepository`, `PlacesClient`, `GeoApiContext`, `Geocoder`

**Exposed StateFlows:**
- `placeSuggestions: List<PlaceSuggestion>`
- `routes: List<List<LatLng>>` — currently computed route polylines
- `userRoutes: List<Route>` — saved routes
- `isLoading`, `error`
- `_isLoading: MutableStateFlow<Boolean>` — publicly accessible for UI-driven loading

| Method | Description |
|--------|-------------|
| `searchPlaces(query, locationBias)` | 300ms debounced, uses `AutocompleteSessionToken`, restricts by `locationBias` bounds, prefetches place details |
| `getPlaceLocation(placeId, callback)` | Fetches LAT_LNG, NAME, ADDRESS from Places API |
| `debugPlaceDetails(placeId)` | Logs all available place fields for debugging |
| `getAddressFromLocation(latLng, callback)` | Reverse geocode |
| `generateRoutes(source, dest, waypoints)` | Google Directions API with **WALKING** mode + waypoints → stores result in `routes` |
| `generateRoutesForPath(source, dest, waypoints)` | Same but returns `List<List<LatLng>>` directly |
| `processDirectionsResult(result)` | Decodes polylines from DirectionsResult |
| `createRoute(name, desc, ..., paths, waypointsList)` | Builds Path/PathPoint entities: source (order=0) → waypoints (order=1..n) → destination (order=n+1), saves via repository |
| `loadUserRoutes()` | Loads routes from repository |
| `clearError()` | Clears error state |

**Important:** Route creation uses `TravelMode.WALKING` for generating directions, not DRIVING.

---

### 10.6 `RoutesViewModel.kt` — `@HiltViewModel`

**Injected:** `RouteRepository`

Simple list VM:

| Method | Description |
|--------|-------------|
| `init` | Loads all routes on creation |
| `deleteRoute(routeId)` | Deletes via repository |
| `clearError()` | Clears error |

---

### 10.7 `RouteDetailsViewModel.kt` — `@HiltViewModel`

**Injected:** `RouteRepository`, `GeoApiContext`, `Application`

**Exposed StateFlows:**
- `route`, `paths`, `selectedPathIndex`, `isLoading`, `error`
- `routePolylines: List<List<LatLng>>` — decoded polylines for map display

**Directions caching:** Uses dual-layer cache:
1. **In-memory:** `HashMap<String, List<LatLng>>` keyed by "routeId_pathIndex"
2. **SharedPreferences:** `route_directions_cache` with Gson-serialized polylines

| Method | Description |
|--------|-------------|
| `loadRouteDetails(routeId)` | Loads route + paths from Room → fetches directions for active path |
| `selectPath(index)` | Changes selected path → fetches/caches directions |
| `fetchDirectionsForPath(pathIndex)` | Cache-first: memory → SharedPrefs → API call (WALKING mode) |
| `setActivePath(pathId)` | Calls repo `setActivePath()` |
| `deleteRoute()` | Deletes route + clears all direction cache |
| `startTripFromRoute(onSuccess, onError)` | Creates trip via `RouteRepository.createTripFromRoute()` → starts it |
| `clearError()` | Clears error |

---

### 10.8 `SafeCircleViewModel.kt` — `@HiltViewModel`

**Injected:** `SafeCircleRepository`, `UserRepository`

**State classes:**
```kotlin
sealed class CircleState { Idle, Loading, Success(circle), Error(message) }
sealed class JoinCircleState { Idle, Loading, Success(circle), Error(message) }
sealed class UserCirclesState { Idle, Loading, Empty, Success(circles: List<SafeCircle>), Error(message) }
sealed class MembersState { Idle, Loading, Success(members: List<User>), Error(message) }
```

**Key behavior:** Uses `supervisorScope` to prevent child coroutine failures from cancelling the parent.

| Method | Description |
|--------|-------------|
| `init` | Syncs circle membership with server |
| `loadUserCircles()` | Server-first: API `getGroupDetails` → local fallback |
| `createSafeCircle(name, desc)` | Checks user isn't already in a circle → calls repo |
| `joinCircle(code)` | Calls repo → refreshes circles |
| `leaveSafeCircle(code)` | Calls repo → refreshes from server after leaving |
| `loadCircleMembers(groupCode)` | Backend-first: API `getGroupMembers` → updates local DB → local fallback on error |
| `resetCircleState()` | Resets to Idle |
| `resetJoinState()` | Resets to Idle |

---

## 11. Navigation & Routing

### 11.1 `Screen.kt` — 20 Route Definitions

```kotlin
sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Register : Screen("register")
    object CreateProfile : Screen("create_profile")
    object Permissions : Screen("permissions")
    object Home : Screen("home")
    object Profile : Screen("profile")
    object EditProfile : Screen("edit_profile")
    object Trips : Screen("trips")
    object PlanTrip : Screen("plan_trip")
    object TripHistory : Screen("trip_history")
    object TripDetails : Screen("trip_details/{tripId}") {
        fun createRoute(tripId: String) = "trip_details/$tripId"
    }
    object ActiveTrip : Screen("active_trip/{tripId}") {
        fun createRoute(tripId: String) = "active_trip/$tripId"
    }
    object SafeCircle : Screen("safe_circle")
    object CreateCircle : Screen("create_circle")
    object JoinCircle : Screen("join_circle")
    object SafeCircleDetails : Screen("safe_circle_details/{groupCode}") {
        fun createRoute(groupCode: String) = "safe_circle_details/$groupCode"
    }
    object Routes : Screen("routes")
    object CreateRoute : Screen("create_route")
    object RouteDetails : Screen("route_details/{routeId}") {
        fun createRoute(routeId: String) = "route_details/$routeId"
    }
    object EditRoute : Screen("edit_route/{routeId}") {
        fun createRoute(routeId: String) = "edit_route/$routeId"
    }
}
```

### 11.2 `NavigationGraph.kt`

NavHost composable that maps all Screen routes to their Composable screens. Key details:
- `PlanTrip` route renders `ActiveTripScreen` (reuses trip creation flow)
- `Trips` route renders `TripsScreen` (placeholder)
- `EditRoute` route renders placeholder text "Edit Route - Coming Soon"
- `ActiveTrip` extracts `tripId` from `backStackEntry.arguments`
- `RouteDetails` extracts `routeId` from arguments

### 11.3 `BottomNavigationBar.kt`

5-tab bottom navigation:

| Tab | Icon | Route | Label |
|-----|------|-------|-------|
| Home | `Icons.Default.Home` | `home` | Home |
| Trips | `Icons.Default.DirectionsCar` | `trips` | Trips |
| Routes | `Icons.Default.Route` | `routes` | Routes |
| Safe Circle | `Icons.Default.Group` | `safe_circle` | Safe Circle |
| Profile | `Icons.Default.Person` | `profile` | Profile |

**Smart selection logic:** A tab is highlighted not only for its exact route but also for child routes. For example, the Routes tab is selected when viewing `routes`, `create_route`, `route_details/*`, or `edit_route/*`.

**Navigation behavior:** Uses `popUpTo(Screen.Home.route)` with `saveState = true` and `restoreState = true` for proper backstack management. `launchSingleTop = true` prevents duplicate entries.

---

## 12. Screen-by-Screen Breakdown

### 12.1 `PermissionsScreen.kt`

**Route:** `permissions`  
**ViewModel:** `AuthViewModel`

**UI elements:**
- Security icon (72dp)
- "SafeRoute Needs Permissions" headline
- Explanation text about location, SMS, and notification permissions
- "Grant Permissions" button → launches system permission dialogs
- "Open Settings" button → opens app settings via intent

**Permission flow:**
1. On composition: checks if all permissions granted → auto-navigates
2. Regular permissions (FINE_LOCATION, COARSE_LOCATION, SEND_SMS, POST_NOTIFICATIONS) requested via `ActivityResultContracts.RequestMultiplePermissions`
3. If all granted, checks for background location (Android Q+) → shows dedicated dialog
4. Background location dialog explains: "SafeRoute needs background location access to track your trips even when the app is not in use"
5. Navigation after all granted: `navigateBasedOnLoginStatus()`:
   - `currentUser != null` → Home
   - `currentUser == null` → Login

---

### 12.2 `LoginScreen.kt`

**Route:** `login`  
**ViewModel:** `AuthViewModel`

**UI elements:**
- "SafeRoute" title (headlineLarge, bold, primary color)
- "Keep your loved ones informed" subtitle
- Phone Number text field
- Password text field (password visual transformation)
- "Login" button (disabled when empty or loading, shows spinner when loading)
- Error text in red below button (when LoginState.Error)
- "Don't have an account? Sign up" TextButton

**Behavior:**
- On Login Success: navigates to Home, pops entire graph (inclusive), launchSingleTop
- On Login Error: shows snackbar + inline error text

---

### 12.3 `RegisterScreen.kt`

**Route:** `register`  
**ViewModel:** `AuthViewModel`

**UI elements:**
- "Create Account" title
- Full Name, Phone Number, Email (Optional), Password, Confirm Password fields
- Validation: name/phone/password non-empty + password == confirmPassword
- "Register" button with loading spinner
- "Already have an account? Sign in" TextButton

**Behavior:**
- Calls `viewModel.register(name, phoneNumber, password, email.takeIf { it.isNotEmpty() })`
- On Success: navigates to Home (clears backstack)
- On Error: snackbar message

---

### 12.4 `HomeScreen.kt`

**Route:** `home`  
**ViewModel:** `HomeViewModel`

**UI structure:**
- **TopAppBar:** "SafeRoute" title + Profile icon button
- **BottomNavigationBar**
- **BackHandler:** blocks back navigation (prevents returning to login)
- **Scrollable content:**
  1. **Welcome Card:** "Welcome, [userName]!" with subtitle
  2. **Quick Actions section** (3 `QuickActionCard` components):
     - "Plan New Trip" (LocationOn icon) → `Screen.PlanTrip`
     - "View Trip History" (History icon) → `Screen.TripHistory`
     - "Manage Safe Circles" (Group icon) → `Screen.SafeCircle`
  3. **Active Trips section:**
     - If active trip: destination, start time (formatted HH:mm), "Continue Trip" button → `Screen.ActiveTrip.createRoute(trip.id)`
     - If no active trip: "No active trips" with "Plan a Trip" button

**Helper composables:**
- `QuickActionCard(title, description, icon, onClick)` — card with left icon + text
- `AlertItem(alert)` — color-coded alert card (SOS=error, DEVIATION=errorContainer, STOP=tertiary)

---

### 12.5 `ProfileScreen.kt`

**Route:** `profile`  
**ViewModel:** `AuthViewModel`

**UI structure:**
- **TopAppBar:** "My Profile" with back arrow
- **BottomNavigationBar**
- **BackHandler:** navigates to Home (not back to login)
- **Profile header:**
  - 120dp circular profile photo (Base64 decoded to Bitmap)
  - Loading spinner while photo loads
  - Fallback: Person icon in surfaceVariant circle
  - User name (headlineMedium, bold)
  - Phone number
- **Contact Information Card:**
  - Phone icon + phone number
  - Email icon + email (or "Not set")
- **Account Actions Card:**
  - "Edit Profile" FilledTonalButton → `Screen.EditProfile`
  - "Logout" OutlinedButton → clears session, navigates to Login (popUpTo 0)

**Photo loading:** First checks `currentUser?.profilePhoto` (local). If null, fetches from server via `viewModel.getProfilePhoto()`.

---

### 12.6 `EditProfileScreen.kt`

**Route:** `edit_profile`  
**ViewModel:** `AuthViewModel`

**UI structure:**
- **TopAppBar:** "Edit Profile" with back arrow + loading indicator
- **BottomNavigationBar**
- **Profile photo section:**
  - 120dp clickable circular photo with camera icon overlay
  - Clicking opens image picker (`ActivityResultContracts.GetContent` for "image/*")
  - Image processing: resize to max 500x500, compress JPEG 80%, convert to Base64 with `data:image/jpeg;base64,` prefix
  - Immediately uploads via `viewModel.updateProfilePhoto()`
- **Personal Information Card:**
  - Full Name field (editable, with Person icon)
  - Email field (editable, with Email icon, keyboard type Email)
  - Phone Number field (**read-only/disabled** — cannot change login identifier)
- **Save Changes button:**
  - Validates name is not blank
  - Calls `viewModel.updateProfile(name, email)`
  - Shows spinner while loading

**On success:** Snackbar "Profile updated successfully!" + `navController.popBackStack()`

---

### 12.7 `CreateProfileScreen.kt`

**Route:** `create_profile`

**UI structure:**
- "Complete Your Profile" heading
- Profile picture placeholder (Person icon, 100dp circle)
- Add photo button (non-functional: `{ /* Open image picker */ }`)
- Full Name, Phone Number fields
- Emergency Contacts section: two fields for emergency contacts
- "Save Profile" button → navigates to Home (popUpTo 0)

**Note:** This screen is a **basic placeholder** — the save button only navigates, it doesn't persist data. No ViewModel is used.

---

### 12.8 `TripsScreen.kt` (PLACEHOLDER)

**Route:** `trips`

Simple placeholder screen showing:
- "My Trips" title
- "This screen will show the user's trip history" body text

**No ViewModel, no data, no functionality.**

---

### 12.9 `TripHistoryScreen.kt`

**Route:** `trip_history`  
**ViewModel:** `TripHistoryViewModel`

**UI structure:**
- **TopAppBar:** "Trip History" + refresh button
- **BottomNavigationBar**
- **FAB:** "Plan New Trip" ExtendedFloatingActionButton
- **Content states:**
  - **Loading:** Spinner + "Loading your trip history..."
  - **Empty:** LocationOn icon + "No Trip History" + "Plan Your First Trip" button
  - **Success:** `LazyColumn` of `TripItem` cards
  - **Error:** Error icon + message + "Try Again" button

**TripItem card:**
- LocationOn icon (color-coded by status: STARTED=primary, COMPLETED=tertiary, CANCELLED=error)
- Destination address (bold)
- "From: [sourceAddress]"
- "Started: [date formatted MMM dd, yyyy at hh:mm a]"
- "Ended: [date]" (if completed)
- Status badge text in bottom-right

**Click behavior:** Both active and completed trips navigate to `Screen.ActiveTrip.createRoute(trip.id)`

---

### 12.10 `ActiveTripScreen.kt` (777 lines)

**Route:** `active_trip/{tripId}`  
**ViewModels:** `TripViewModel`, `RouteDetailsViewModel`

**UI structure:**
- **Status bar** (full-width colored bar at top):
  - STARTED → Green "On Route" + GPS icon
  - EMERGENCY → Red "Emergency Mode"
  - COMPLETED → Blue "Trip Completed"
  - Other → Gray "Trip Planned"

- **Full-screen Google Map:**
  - Source marker (HUE_GREEN)
  - Destination marker (HUE_RED)
  - Current location marker (HUE_YELLOW)
  - Route polylines (multi-colored per path: primary, secondary, tertiary)
  - Waypoint markers (HUE_AZURE) for all paths
  - **Safe corridor polygon:** Transparent green overlay (100m wide) around active path
  - `isMyLocationEnabled` based on permission check

- **Status panel** (Card overlay at top):
  - Destination address
  - ETA (calculated from startTime + estimatedDuration)
  - Remaining distance (Haversine from current position to destination)
  - Number of available paths

- **SafeCircle status indicator** (top-right Card):
  - Group icon + "3 watching" (hardcoded placeholder)

- **Action buttons** (bottom area):
  - **Emergency/SOS button:**
    - Default: Red "Emergency" button
    - In emergency mode: Pulsating "I'm Safe Now" button (teal color)
    - Confirmation dialog before sending
    - Sends alert via `viewModel.sendAlert(tripId, AlertType.SOS, ...)`
  - **End Trip button:**
    - Secondary color
    - Shows authentication dialog before allowing
  - **My Location FAB:** Re-centers camera on current position

- **Emergency mode overlay:** Semi-transparent red overlay on entire screen

- **Authentication dialog:**
  - Required for back navigation and ending trip
  - "Please authenticate to end the trip" message
  - Confirm → authenticates (simulated) → navigates home
  - Cancel → dismisses

**Auto-refresh:** Trip data reloaded every 10 seconds via `LaunchedEffect`

**Helper functions (outside composable):**
- `calculateETA(trip)` — Computes arrival time from start + estimated duration
- `calculateRemainingDistance(trip, currentPosition)` — Haversine with estimated distance ratio
- `calculateHaversineDistance(point1, point2)` — Standard Haversine formula
- `createSafeCorridor(routePath, widthMeters)` — Generates polygon points on both sides of route
- `calculateBearing(start, end)` — Bearing between two LatLngs
- `calculateDestination(start, bearing, distance)` — Point at distance/bearing from start
- `hasLocationPermission(context)` — FINE or COARSE location check

---

### 12.11 `RoutesScreen.kt`

**Route:** `routes`  
**ViewModel:** `RoutesViewModel`

**UI structure:**
- **TopAppBar:** "My Routes"
- **FAB:** "+" to create route → `Screen.CreateRoute`
- **BottomNavigationBar**
- **Content states:**
  - **Loading:** Centered spinner
  - **Empty:** Map icon + "No routes yet" + "Create Route" button
  - **Routes list:** `LazyColumn` of route cards:
    - Route name + arrow button
    - Description (max 2 lines, ellipsis)
    - "From" / "To" addresses
    - Click → `Screen.RouteDetails.createRoute(route.id)`
- **Error snackbar** with dismiss action

---

### 12.12 `CreateRouteScreen.kt` (1333 lines)

**Route:** `create_route`  
**ViewModel:** `RouteViewModel`

The most complex screen in the app. Full-screen map-based route creation with multiple modes.

**UI structure:**
- **TopAppBar:** "Create Route" + back arrow + save icon
- **Full-screen Google Map** with multiple interaction modes
- **Location input card** (overlay at top):
  - Source address field with Places autocomplete + map selection button
  - Destination address field with Places autocomplete + map selection button
  - Place suggestions displayed in dropdown cards (max 200dp)
  - Selection mode instruction banner (changes text based on mode)
- **Saved paths card** (overlay at bottom):
  - Count of saved paths
  - Circular path indicators (numbered, clickable to select)
  - Delete selected path button
  - Add path button
- **Floating buttons** (right side):
  - My Location button
  - Add Waypoint / Cancel Selection button

**Interaction modes:**
1. **Normal:** Tap map has no effect
2. **Selecting Source:** Tap map sets source location → gets address via reverse geocoding → regenerates routes
3. **Selecting Destination:** Tap map sets destination → gets address → regenerates routes
4. **Adding Waypoint:** Tap map adds waypoint → regenerates routes with waypoint

**Map markers:**
- Source: HUE_BLUE, **draggable** (updates all paths on drag end)
- Destination: HUE_RED, **draggable** (updates all paths on drag end)
- Waypoints: HUE_AZURE, **draggable** (updates routes on drag), **clickable** (removes waypoint on click)

**Route generation:** When source + destination are set, calls `viewModel.generateRoutes()` (Google Directions API with WALKING mode + waypoints). Current route shown as primary-color polyline (12f width). Saved paths shown with color based on selection.

**Path management:**
- "Add Path" dialog: saves current route polyline + current waypoints as a path
- Each path stores its own waypoints independently
- Selecting a path loads its waypoints for editing
- Changing source/destination regenerates ALL paths with their respective waypoints
- `updateSourceAcrossPaths()` / `updateDestinationAcrossPaths()` handle cross-path updates

**Save Route Dialog:**
- Route Name (required), Description (optional)
- Shows path count
- Validation: name required, at least 1 path required
- Calls `viewModel.createRoute(name, desc, sourceAddr, destAddr, lat/lng, paths, waypointsList)`
- Navigates back on save

**Address search:** 
- Minimum 2 characters to trigger search
- Location-biased using current viewport/source/destination/default (Delhi LatLng as ultimate fallback)
- Click suggestion → `viewModel.getPlaceLocation()` → updates location + regenerates routes

**Initial location:** Gets current GPS on launch, defaults to Delhi (28.6139, 77.2090)

---

### 12.13 `RouteDetailsScreen.kt`

**Route:** `route_details/{routeId}`  
**ViewModel:** `RouteDetailsViewModel`

**UI structure:**
- **TopAppBar:** Route name + back arrow + delete icon
- **BottomNavigationBar**
- **Content states:**
  - Loading spinner
  - "Route not found" error with "Go Back" button
  - Route map view

**Map view:**
- Google Map with source (green), destination (red), current path polyline (primary), waypoint markers (azure)
- Camera auto-bounds to show full route
- My location button enabled if permission granted
- Uses `derivedStateOf` for performance optimization on polylines/paths

**Route Info Card** (top overlay):
- Route description
- MyLocation icon + source address
- LocationOn icon + destination address

**Path Selector** (bottom, shown only if >1 path):
- Horizontal row of numbered circle buttons
- Selected path highlighted in primary color
- "Set Active" button for inactive paths / "Active" badge for active path

**Start Trip Button:**
- Full-width button with PlayArrow icon + "START TRIP" text
- Calls `viewModel.startTripFromRoute()` → navigates to ActiveTrip on success

**Delete Route Dialog:**
- Confirmation: "Are you sure? This action cannot be undone."
- Delete → calls `viewModel.deleteRoute()` → navigates back

---

### 12.14 `SafeCircleScreen.kt` (762 lines)

**Route:** `safe_circle`  
**ViewModel:** `SafeCircleViewModel`

**UI structure:**
- **TopAppBar:** "Safe Circle" + leave button (if in circle)
- **BottomNavigationBar**

**Content states:**
- **Loading:** Spinner + "Loading your circles..."
- **Empty (EmptyCirclesView):**
  - Group icon
  - "You don't have a Safe Circle yet"
  - Explanation text about circles + "one circle at a time" constraint
  - "Create New Circle" button → `Screen.CreateCircle`
  - "Join Existing Circle" button → `Screen.JoinCircle`
- **Success (CircleDetailsView):** Shows first circle only
- **Error:** Error icon + message + "Try Again" button with Refresh icon

**CircleDetailsView:**
- Circle info card:
  - Circle name (headlineSmall, bold)
  - Description (if exists)
  - "Share this code with others to join:"
  - Group code displayed in primaryContainer card (headlineMedium)
  - Share button → Android share intent with formatted message
- Members section header with count
- Members list (`LazyColumn`):
  - Each member: Person icon + name (append "(You)" for current user)
  - Click member → opens MemberDetailsDialog
- "You can only be a member of one Safe Circle at a time" footer

**MemberDetailsDialog:**
- Header with "Member Details" + close button
- Member info: name (bold), phone, email (if set)
- Current Trip section: **placeholder** ("No active trip")
- Recent Alerts section: **placeholder** ("No recent alerts")
- Trip History section: **placeholder** ("No trip history available")
- Close button

**Leave Circle Dialog:**
- "Are you sure you want to leave? You will no longer receive alerts."
- Confirm → `viewModel.leaveSafeCircle(code)`

---

### 12.15 `CreateCircleScreen.kt`

**Route:** `create_circle`  
**ViewModel:** `SafeCircleViewModel`

**UI elements:**
- **TopAppBar:** "Create Safe Circle" + back arrow
- Circle Name field (required, with validation error)
- Description field (optional, max 3 lines)
- "What is a Safe Circle?" info section:
  - Members can monitor your trips
  - They receive alerts for unusual events
  - Circle code can be shared with trusted contacts
  - Only one circle at a time (shown in primary color)
- "Create Circle" button (disabled when empty or loading, shows spinner)

**On success:** Snackbar with circle name + code, navigates to SafeCircle screen

---

### 12.16 `JoinCircleScreen.kt`

**Route:** `join_circle`  
**ViewModel:** `SafeCircleViewModel`

**UI elements:**
- **TopAppBar:** "Join a Safe Circle" + back arrow
- **BottomNavigationBar**
- "Join a Safe Circle" headline
- Instruction text + "one circle at a time" note
- Circle Code text field (trimmed on input)
- "Join Circle" button with spinner
- Error text displayed below button

**Error handling:** Provides user-friendly messages:
- "not found" → "Please check the code and try again..."
- "already a member" → "You are already a member..."

**On success:** Navigates to SafeCircle screen (popUpTo inclusive)

---

## 13. UI Components & Theme

### 13.1 `BottomNavigationBar.kt`

Reusable composable with 5 `NavigationBarItem` entries. Uses `currentDestination?.hierarchy` to determine selection. Navigation uses `popUpTo(Screen.Home.route)` with `saveState = true`, `restoreState = true`, `launchSingleTop = true`.

### 13.2 Theme

**`Color.kt`:**
```kotlin
val Purple80 = Color(0xFFD0BCFF)
val PurpleGrey80 = Color(0xFFCCC2DC)
val Pink80 = Color(0xFFEFB8C8)
val Purple40 = Color(0xFF6650a4)
val PurpleGrey40 = Color(0xFF625b71)
val Pink40 = Color(0xFF7D5260)
```

**`Theme.kt` — `SafeRouteTheme`:**
- Dark color scheme: Purple80, PurpleGrey80, Pink80
- Light color scheme: Purple40, PurpleGrey40, Pink40
- **Dynamic color:** On Android 12+ (SDK 31), uses `dynamicDarkColorScheme()` / `dynamicLightColorScheme()`
- Falls back to static schemes on older Android

**`Type.kt`:**
- Uses default Material 3 Typography
- Only `bodyLarge` customized: fontFamily=Default, fontWeight=Normal, fontSize=16sp, lineHeight=24sp, letterSpacing=0.5sp

---

## 14. Services & Background Tasks

### 14.1 `LocationTrackingService.kt`

**Type:** Android Foreground Service  
**Annotation:** `@AndroidEntryPoint`  
**Injected:** `TripDao`, `AlertDao`, `ApiService`, `UserPreferenceManager`

**Constants:**
- `LOCATION_UPDATE_INTERVAL = 10_000L` (10 seconds)
- `FASTEST_LOCATION_INTERVAL = 5_000L` (5 seconds)
- `DEVIATION_THRESHOLD = 100.0` (meters)
- `STOP_DETECTION_TIME = 90_000L` (90 seconds)
- `NOTIFICATION_CHANNEL_ID = "location_channel"`

**Lifecycle:**
1. `ACTION_START_SERVICE` with extra `TRIP_ID`:
   - Creates notification channel
   - Starts foreground with "Tracking your journey for safety" notification
   - Loads trip from Room via `tripDao.getTripById()`
   - Requests location updates from `FusedLocationProviderClient`
2. `ACTION_STOP_SERVICE`:
   - Removes location updates
   - Calls `stopForeground(STOP_FOREGROUND_REMOVE)` + `stopSelf()`

**Location callback logic:**
- **Route deviation:** Checks `trip.isOnRoute(lat, lng)` → if off-route, creates DEVIATION alert + increments `deviationCount` in Room + POSTs to API
- **Stop detection:** Tracks speed. If speed < 1.0 m/s for > 90 seconds, creates STOP alert + increments `stopCount`
- **Auto-completion:** If within 100m of destination, updates trip status to COMPLETED + creates TRIP_COMPLETE alert
- All alerts posted to backend API in coroutine with error logging

---

### 14.2 `NetworkSyncWorker.kt`

**Type:** WorkManager `CoroutineWorker`  
**Custom Factory:** Nested `Factory` class for Hilt DI

**`doWork()` logic:**
1. Syncs pending local routes to server (uploads)
2. Downloads new routes from server (downloads)
3. Returns `Result.success()` (WorkManager Result, not custom)

---

### 14.3 `SyncManager.kt`

**Injected:** `WorkManager`

| Method | Description |
|--------|-------------|
| `schedulePeriodicSync()` | `PeriodicWorkRequestBuilder<NetworkSyncWorker>(1, TimeUnit.HOURS)` with flex interval 15 minutes. Enqueues as unique periodic work. |
| `syncNow()` | `OneTimeWorkRequestBuilder<NetworkSyncWorker>()` for immediate sync |

---

### 14.4 `SafeRouteWorkerFactory.kt`

**Injected:** `RouteRepository`, `UserPreferenceManager`

Custom `WorkerFactory` that creates `NetworkSyncWorker` instances with proper DI dependencies. Returns `null` for unknown worker classes (delegates to default factory).

---

## 15. Dependency Injection (Hilt Modules)

### 15.1 `AppModule.kt` — `@Module @InstallIn(SingletonComponent)`

| Provides | Type | Details |
|----------|------|---------|
| `Geocoder` | `@Singleton` | Requires `@ApplicationContext` |

### 15.2 `DatabaseModule.kt` — `@Module @InstallIn(SingletonComponent)`

| Provides | Type | Details |
|----------|------|---------|
| `AppDatabase` | `@Singleton` | `Room.databaseBuilder(...)` with `.fallbackToDestructiveMigration()` |
| `UserDao` | — | `database.userDao()` |
| `TripDao` | — | `database.tripDao()` |
| `AlertDao` | — | `database.alertDao()` |
| `SafeCircleDao` | — | `database.safeCircleDao()` |
| `RouteDao` | — | `database.routeDao()` |
| `PathDao` | — | `database.pathDao()` |
| `PathPointDao` | — | `database.pathPointDao()` |

### 15.3 `NetworkModule.kt` — `@Module @InstallIn(SingletonComponent)`

| Provides | Type | Details |
|----------|------|---------|
| `HttpLoggingInterceptor` | `@Singleton` | Level = `BODY` (logs full request/response) |
| `OkHttpClient` | `@Singleton` | 30s connect/read/write timeouts, logging + auth interceptors |
| `Retrofit` | `@Singleton` | Base URL from `BuildConfig.BACKEND_URL` (fallback: `http://localhost:5000/api/`), custom Gson with `DateTypeAdapterFactory` |
| `ApiService` | `@Singleton` | From Retrofit |
| `RouteApiService` | `@Singleton` | From Retrofit |
| `Gson` | `@Singleton` | `GsonBuilder().registerTypeAdapterFactory(DateTypeAdapterFactory()).create()` |

### 15.4 `PlacesModule.kt` — `@Module @InstallIn(SingletonComponent)`

| Provides | Type | Details |
|----------|------|---------|
| `PlacesClient` | `@Singleton` | Initializes Places SDK with `MAPS_API_KEY` from BuildConfig |
| `GeoApiContext` | `@Singleton` | `GeoApiContext.Builder().apiKey(MAPS_API_KEY).build()` |

### 15.5 `WorkManagerModule.kt` — `@Module @InstallIn(SingletonComponent)`

| Provides | Type | Details |
|----------|------|---------|
| `SafeRouteWorkerFactory` | `@Singleton` | Uses injected `RouteRepository` + `UserPreferenceManager` |

---

## 16. Utilities

### 16.1 `AlertManager.kt`

**Injected:** `ApiService`, `UserPreferenceManager`

Sends alerts to Safe Circle members via:
1. **API first:** POSTs alert to backend
2. **SMS fallback:** If API fails, formats message with emojis and Google Maps link, sends via SMS intent

**Message formats:**
- SOS: `"🚨 EMERGENCY: [Name] needs help! Location: https://maps.google.com/?q=[lat],[lng]"`
- DEVIATION: `"⚠️ ROUTE DEVIATION: [Name] deviated from route. Location: [link]"`
- STOP: `"⏸️ UNEXPECTED STOP: [Name] stopped unexpectedly. Location: [link]"`
- SOS cancellation: `"✅ ALL CLEAR: [Name] is safe now! The emergency alert has been cancelled."`

### 16.2 `Result.kt` — Custom Sealed Class

```kotlin
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val exception: Exception) : Result<Nothing>()

    val isSuccess: Boolean
    val isError: Boolean
    fun getOrNull(): T?
    fun exceptionOrNull(): Exception?
    fun <R> map(transform: (T) -> R): Result<R>
}
```

Used as return type in repositories for operations that can fail.

### 16.3 `NetworkUtils.kt`

| Function | Return | Description |
|----------|--------|-------------|
| `isNetworkAvailable(context)` | `Boolean` | Checks WiFi, Cellular, or Ethernet via `ConnectivityManager.activeNetwork` |
| `observeNetworkState(context)` | `Flow<Boolean>` | `callbackFlow` that emits network availability changes via `NetworkCallback` |

### 16.4 `PermissionUtils.kt`

**Constants:**
```kotlin
val REQUIRED_PERMISSIONS = listOf(
    Manifest.permission.ACCESS_FINE_LOCATION,
    Manifest.permission.ACCESS_COARSE_LOCATION,
    Manifest.permission.SEND_SMS,
    Manifest.permission.POST_NOTIFICATIONS  // Android 13+
)
val BACKGROUND_LOCATION_PERMISSION = Manifest.permission.ACCESS_BACKGROUND_LOCATION
```

**Functions:**
- `areAllPermissionsGranted(context)` — checks all required + background location
- `getPermissionsToRequest(context)` — returns list of ungranted permissions
- `isBackgroundLocationPermissionGranted(context)` — separate check for Android Q+
- `getPermissionDisplayName(permission)` — human-readable name
- `getPermissionExplanation(permission)` — why it's needed
- `createAppSettingsIntent(context)` — creates intent to app settings

### 16.5 `LocationPermissionHelper.kt`

| Function | Description |
|----------|-------------|
| `hasLocationPermission(context)` | FINE or COARSE granted |
| `hasBackgroundLocationPermission(context)` | Background location granted |
| `rememberMapPropertiesWithPermissions(context)` | `@Composable` — returns `MapProperties` with `isMyLocationEnabled` based on permission |
| `rememberMapUiSettingsWithPermissions(context)` | `@Composable` — returns `MapUiSettings` with `myLocationButtonEnabled` based on permission |

### 16.6 `DateTypeAdapter.kt`

Custom Gson `TypeAdapter<Long>` for reading Long values that might be:
- JSON numbers → read directly
- Numeric strings → parse to Long
- ISO-8601 date strings → parse to epoch milliseconds

Supports formats:
- `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`
- `yyyy-MM-dd'T'HH:mm:ss'Z'`
- `yyyy-MM-dd'T'HH:mm:ss`
- `yyyy-MM-dd`

Falls back to `System.currentTimeMillis()` on parse failure.

### 16.7 `DateTypeAdapterFactory.kt`

`TypeAdapterFactory` that wraps the `DateTypeAdapter` logic. Applied only to `Long` and `long` types. Delegates to a `LongTypeAdapter` that tries multiple ISO-8601 date formats (UTC timezone). Registered in `NetworkModule`'s Gson instance.

### 16.8 `FormatUtils.kt`

**EMPTY FILE** — contains only whitespace. No implementation.

---

## 17. Preferences & Local Storage

### `UserPreferenceManager.kt`

**SharedPreferences name:** `"safe_route_prefs"`

**Stored keys:**

| Key | Type | Description |
|-----|------|-------------|
| `USER_ID` | String | Current user's UUID |
| `PHONE_NUMBER` | String | Login phone number |
| `USER_NAME` | String | Display name |
| `USER_EMAIL` | String | Email address |
| `USER_JSON` | String | Full user object serialized via Gson |
| `IS_LOGGED_IN` | Boolean | Login flag |
| `SESSION_TOKEN` | String | JWT Bearer token |
| `LAST_LOGIN_TIME` | Long | Timestamp of last login |
| `GROUP_CODE` | String | Current Safe Circle code |
| `PENDING_SYNC_ROUTES` | StringSet | Route IDs pending sync to server |
| `LAST_SYNC_TIME` | Long | Last successful sync timestamp |

**Methods:**
- `saveUserData(user, token)` — saves all user fields + token + login time
- `getUserData()` — returns `User?` from `USER_JSON` (Gson deserialization)
- `clearUserData()` — clears all prefs
- `getSessionToken()` — returns JWT token
- `savePendingSyncRoutes(routeIds)` — saves route ID set
- `getPendingSyncRoutes()` — returns route ID set
- `updateLastSyncTime()` — saves current timestamp

---

## 18. Complete User Flows

### 18.1 First-Time User Flow

```
1. App Launch → SafeRouteApplication.onCreate()
   ├── Google Maps SDK initialized
   ├── Periodic sync scheduled
   └── Network observer started

2. MainActivity.onCreate()
   ├── Permissions not granted → PermissionsScreen
   │   ├── Grant all permissions + background location
   │   ├── No currentUser → LoginScreen
   │   │   └── "Don't have an account? Sign up" → RegisterScreen
   │   │       ├── Enter: name, phone, email(optional), password, confirm
   │   │       ├── API: POST /api/users/register
   │   │       ├── Token saved to SharedPreferences
   │   │       ├── User saved to Room DB
   │   │       └── Navigate to HomeScreen (backstack cleared)
   │   └── currentUser exists → HomeScreen
```

### 18.2 Returning User Flow

```
1. App Launch → SafeRouteApplication restores user from SharedPreferences
   ├── User JSON found → insert to Room, set as currentUser
   └── Not found → currentUser remains null

2. MainActivity checks:
   ├── Permissions OK + currentUser exists → HomeScreen
   ├── Permissions OK + no currentUser + prefs have user data → create User, set in repo → HomeScreen
   ├── Permissions OK + no currentUser → LoginScreen
   └── Permissions missing → PermissionsScreen → (see above)
```

### 18.3 Offline Login Flow

```
1. User enters phone + password on LoginScreen
2. viewModel.login() → repo.login()
3. API call fails (no network)
4. Fallback: 
   ├── Look up user by phone in Room DB
   ├── Verify stored password matches
   ├── Check existing session token in prefs
   ├── If all match → LoginState.Success (offline)
   └── If mismatch → LoginState.Error
```

### 18.4 Trip Planning Flow (from HomeScreen)

```
1. HomeScreen → "Plan New Trip" → PlanTrip screen (renders ActiveTripScreen)
   └── NOTE: PlanTrip route actually renders ActiveTripScreen in NavigationGraph

Alternative flow via Routes:
1. RoutesScreen → click route → RouteDetailsScreen
2. Map shows route + paths
3. Select active path
4. "START TRIP" button
5. RouteDetailsViewModel.startTripFromRoute():
   ├── RouteRepository.createTripFromRoute(routeId)
   │   ├── Load route from Room
   │   ├── Create Trip with routeId, source/dest from route
   │   └── Insert to Room
   ├── RouteRepository.startTrip(trip)
   │   ├── Update status to STARTED in Room
   │   ├── POST /api/trips/start
   │   └── Start LocationTrackingService
   └── Navigate to ActiveTripScreen(tripId)
```

### 18.5 Active Trip Monitoring Flow

```
1. ActiveTripScreen loads with tripId
2. TripViewModel.loadTripDetails(tripId) → loads from Room
3. RouteDetailsViewModel.loadRouteDetails(routeId) → loads route + paths + directions
4. Map displays: markers, polylines, safe corridor, current position
5. Every 10 seconds: trip data refreshed

Background (LocationTrackingService):
├── Location update every 10 seconds
├── Check route deviation (100m threshold)
│   └── DEVIATION alert → Room + API → SMS to circle
├── Check unexpected stop (speed < 1.0 for 90s)
│   └── STOP alert → Room + API → SMS to circle
└── Check destination proximity (100m)
    └── TRIP_COMPLETE → update status, alert

User actions:
├── Emergency button → confirmation → SOS alert → circle notified
├── "I'm Safe Now" → cancel SOS → "All Clear" sent to circle
├── End Trip → authentication dialog → trip completed → navigate Home
└── Back button → authentication dialog required
```

### 18.6 Route Creation Flow

```
1. RoutesScreen → "+" FAB → CreateRouteScreen
2. Map loads at current GPS location (or Delhi default)
3. User sets source:
   ├── Type in search field → Places autocomplete suggestions
   │   └── Click suggestion → getPlaceLocation → set source
   └── Click map icon → "Tap on map" mode → tap → set source
4. User sets destination (same methods)
5. Route auto-generated: Google Directions API (WALKING mode)
6. Add waypoints:
   ├── Click add waypoint button → "Tap on map" mode → tap → add
   ├── Click on waypoint marker → remove waypoint
   └── Drag waypoint marker → update position → regenerate route
7. Save as path: "Add Path" dialog → adds current route to saved paths
8. Add more paths (different waypoints) for same source/dest
9. Save Route:
   ├── Save dialog: name (required) + description (optional)
   ├── viewModel.createRoute():
   │   ├── Build Path entities with PathPoints (source + waypoints + dest ordered)
   │   ├── Save to Room DB (route + paths + points)
   │   └── Sync to backend API
   └── Navigate back
```

### 18.7 Safe Circle Flow

```
Create Circle:
1. SafeCircleScreen (empty state) → "Create New Circle" → CreateCircleScreen
2. Enter name + optional description
3. viewModel.createSafeCircle():
   ├── Checks user not already in a circle
   ├── API: POST /api/groups/create
   │   └── Server generates 6-char code, adds creator as member
   ├── Save circle to Room
   └── Update user's groupCode in prefs + Room
4. Success → snackbar with code → navigate to SafeCircleScreen

Join Circle:
1. SafeCircleScreen (empty state) → "Join Existing Circle" → JoinCircleScreen
2. Enter 6-character code
3. viewModel.joinCircle():
   ├── API: POST /api/groups/join
   ├── Save circle to Room + add membership
   └── Update user's groupCode
4. Success → navigate to SafeCircleScreen

Share Circle:
1. SafeCircleScreen → share button
2. Android share intent with message:
   "Join my SafeRoute circle '[name]': [description]\nUse code: [code]"

View Members:
1. SafeCircleScreen loads circle details
2. loadCircleMembers():
   ├── API: GET /api/groups/{code}/members (server-first)
   ├── Parse members, update local DB
   └── Fallback: load from Room on error
3. Click member → MemberDetailsDialog (name, phone, email, placeholders)

Leave Circle:
1. Top-right ExitToApp icon → confirmation dialog
2. viewModel.leaveSafeCircle():
   ├── API: POST /api/groups/leave
   ├── Delete local circle + memberships
   └── Clear user's groupCode
3. Refresh → shows empty state
```

### 18.8 Alert Notification Pipeline

```
Location Change Detected (LocationTrackingService)
       │
       ▼
Analyze:
  ├── Route deviation (>100m from any route point)
  │   → incrementDeviationCount(tripId) in Room
  │   → Create DEVIATION Alert in Room
  │   → POST /api/alerts
  │   → Backend: find circle members → SMS/WhatsApp via Twilio
  │   
  ├── Unexpected stop (speed < 1.0 for >90 seconds)
  │   → incrementStopCount(tripId) in Room  
  │   → Create STOP Alert in Room
  │   → POST /api/alerts
  │   → Backend: SMS/WhatsApp to circle
  │
  ├── Destination reached (<100m from destination)
  │   → Update trip status to COMPLETED
  │   → Create TRIP_COMPLETE Alert
  │   → POST /api/alerts
  │   → Backend: SMS/WhatsApp to circle
  │
  └── User-triggered SOS (from ActiveTripScreen)
      → Create SOS Alert in Room
      → POST /api/alerts
      → Backend: SMS/WhatsApp with Maps link
      → WebSocket broadcast to circle
```

### 18.9 Route Sync Flow

```
Background Sync (every 1 hour via WorkManager):
1. SyncManager schedules NetworkSyncWorker
2. NetworkSyncWorker.doWork():
   ├── Upload: get pending route IDs from prefs → POST each to API
   └── Download: POST /api/routes/sync/{userId}
       ├── Send local route IDs
       ├── Server returns only new routes
       └── Save new routes to Room

On-Demand Sync (network restored):
1. SafeRouteApplication monitors network via observeNetworkState()
2. Network becomes available → SyncManager.syncNow()
3. OneTimeWorkRequest for NetworkSyncWorker

Efficient Sync Protocol:
1. Client sends: { localRouteIds: ["id1", "id2", ...] }
2. Server compares with DB, returns: { totalRoutes: N, newRoutes: [...] }
3. Client saves only new routes
4. Fallback: if efficient sync fails, full sync (GET all routes)
```

---

## 19. Real-Time Features

### 19.1 Socket.IO Integration (Backend)

- **Group Rooms:** Users join Safe Circle room on connection
- **Location Updates:** Real-time broadcasts within group
- **Alert Broadcasting:** Instant alerts to all circle members
- **Alert Cancellation:** Broadcast when SOS cancelled

### 19.2 Alert Delivery Channels

| Channel | Implementation | 
|---------|---------------|
| **In-App** | Room DB alerts + Flow observation |
| **SMS** | Twilio SMS API (fallback: Android SMS intent) |
| **WhatsApp** | Twilio WhatsApp API (primary channel) |
| **WebSocket** | Socket.IO broadcast to group room |

---

## 20. Database Schemas

### 20.1 MongoDB (Backend)

**Users Collection:**
```json
{
  "id": "String (unique)",
  "name": "String",
  "phone": "String (unique)",
  "email": "String?",
  "password": "String (bcrypt)",
  "profilePhoto": "Buffer?",
  "groupCode": "String?",
  "createdAt": "Date"
}
```

**Trips Collection:**
```json
{
  "id": "String (unique)",
  "userId": "String (ref: User)",
  "sourceLatitude": "Number",
  "sourceLongitude": "Number",
  "destinationLatitude": "Number",
  "destinationLongitude": "Number",
  "sourceAddress": "String",
  "destinationAddress": "String",
  "routePolyline": "String",
  "status": "Enum ['PLANNED','ACTIVE','COMPLETED','CANCELLED']",
  "startTime": "Date",
  "endTime": "Date?",
  "deviationCount": "Number (default: 0)",
  "stopCount": "Number (default: 0)",
  "alertCount": "Number (default: 0)"
}
```

**Alerts Collection:**
```json
{
  "id": "String (unique)",
  "tripId": "String (ref: Trip)",
  "userId": "String (ref: User)",
  "type": "Enum ['DEVIATION','STOP','SOS','TRIP_COMPLETE']",
  "latitude": "Number",
  "longitude": "Number",
  "timestamp": "Date",
  "description": "String?",
  "isSent": "Boolean (default: false)",
  "isAcknowledged": "Boolean (default: false)",
  "isCancelled": "Boolean (default: false)"
}
```
Indexes: `(userId, timestamp)`, `(tripId, timestamp)`, `(type, isCancelled)`

**SafeCircles Collection:**
```json
{
  "groupCode": "String (unique)",
  "name": "String",
  "description": "String",
  "creatorId": "String (ref: User)",
  "createdAt": "Date"
}
```

**CircleMembers Collection:**
```json
{
  "groupCode": "String (ref: SafeCircle)",
  "userId": "String (ref: User)",
  "joinedAt": "Date"
}
```
Unique compound index: `(groupCode, userId)`

**Routes Collection:**
```json
{
  "id": "String (unique)",
  "userId": "String",
  "name": "String",
  "description": "String",
  "sourceLat": "Number",
  "sourceLng": "Number",
  "destinationLat": "Number",
  "destinationLng": "Number",
  "sourceAddress": "String",
  "destinationAddress": "String",
  "isActive": "Boolean",
  "createdAt": "Date",
  "updatedAt": "Date",
  "paths": [{
    "id": "String",
    "name": "String",
    "description": "String",
    "isActive": "Boolean",
    "points": [{
      "latitude": "Number",
      "longitude": "Number",
      "order": "Number",
      "isSource": "Boolean",
      "isDestination": "Boolean",
      "isWaypoint": "Boolean"
    }]
  }]
}
```

### 20.2 Room Database (Android, v4)

**7 Tables:**

| Table | Entity | Primary Key | Foreign Keys |
|-------|--------|-------------|--------------|
| `users` | `User` | `id: String` | — |
| `trips` | `Trip` | `id: String` | — |
| `alerts` | `Alert` | `id: String` | — |
| `safe_circles` | `SafeCircle` | `id: String` | — |
| `routes` | `Route` | `id: String` | — |
| `paths` | `Path` | `id: String` | FK → `routes(id)` CASCADE |
| `path_points` | `PathPoint` | `id: String` | FK → `paths(id)` CASCADE |

**NOT in database:** `CircleMember` entity exists in code but is **not registered** in `AppDatabase.entities`. Circle member data is managed via the `circle_members` table operations in `CircleMemberDao`, but the table may not actually exist due to this omission (destructive migration would create only registered entities).

---

## 21. Third-Party Integrations

### 21.1 Google Maps SDK
- Interactive maps on ActiveTripScreen, CreateRouteScreen, RouteDetailsScreen
- Markers: source (green/blue), destination (red), waypoints (azure), current location (yellow)
- Polylines for route visualization (multiple colors per path)
- Polygons for safe corridor visualization (transparent green)
- Camera animation and bounds calculation
- Draggable markers on CreateRouteScreen

### 21.2 Google Places API
- Place autocomplete with `AutocompleteSessionToken` for cost optimization
- 300ms debounced search to avoid excessive API calls
- Location-biased results using `RectangularBounds` from current viewport
- Place details fetching: `LAT_LNG`, `NAME`, `ADDRESS` fields
- Prefetch pattern in RouteViewModel for faster selection

### 21.3 Google Directions API (via GeoApiContext)
- Route generation between source/destination with optional waypoints
- **WALKING mode** for route creation (RouteViewModel)
- **DRIVING mode** for trip planning (TripRepository)
- Alternative route support via `alternatives(true)`
- Encoded polyline decoding via `PolyUtil.decode()`
- Directions caching (in-memory + SharedPreferences) in RouteDetailsViewModel

### 21.4 Google Distance Matrix API
- Distance and duration calculation in TripViewModel
- Haversine fallback when API is unavailable

### 21.5 Twilio (Backend)
- **SMS:** Alert messages to circle members
- **WhatsApp:** Primary channel for alerts (falls back to SMS)
- **Message types:** SOS, deviation, stop, cancellation, daily summary

### 21.6 Socket.IO (Backend)
- Real-time bidirectional communication
- Group-based rooms for Safe Circles
- Location update broadcasting, alert notifications

---

## 22. Known Placeholders & Incomplete Features

| Feature | Location | Status |
|---------|----------|--------|
| **Trips screen** | `TripsScreen.kt` | Placeholder text only: "This screen will show the user's trip history" |
| **Edit Route screen** | `NavigationGraph.kt` | Placeholder text: "Edit Route - Coming Soon" |
| **CreateProfileScreen** | `CreateProfileScreen.kt` | Save button only navigates, no data persistence. Photo picker not functional |
| **SafeCircle watcher count** | `ActiveTripScreen.kt` | Hardcoded "3 watching" |
| **Member trip/alert data** | `MemberDetailsDialog` | Placeholders: "No active trip", "No recent alerts", "No trip history available" |
| **FormatUtils.kt** | `utils/FormatUtils.kt` | Empty file with no implementation |
| **Authentication on ActiveTrip** | `ActiveTripScreen.kt` | Simulated auth — no biometric/PIN implementation |
| **CircleMember entity** | `AppDatabase.kt` | Defined as `@Entity` but not in `AppDatabase.entities` array |
| **Coil image loading** | `build.gradle.kts` | Dependency declared but Base64 approach used instead |

---

## Summary

SafeRoute is a comprehensive personal safety application that combines:

1. **Trip Planning** — Users create routes with multiple valid paths and waypoints using Google Maps, Directions API (walking/driving), and Places autocomplete
2. **Real-Time Monitoring** — GPS tracking with foreground service (10s intervals), route deviation (100m threshold), stop detection (90s), destination auto-detection
3. **Social Safety Network** — Safe Circles of trusted contacts (one per user) who receive automated alerts via SMS/WhatsApp
4. **Multi-Channel Alerting** — SOS, deviation, stop, completion alerts delivered via API, SMS, WhatsApp, and WebSocket
5. **Offline-First Architecture** — Room database for local storage, offline login support, pending sync queue for routes, WorkManager background sync every hour
6. **Route Management** — Multi-path routes with waypoints; directions caching; draggable markers; route-to-trip conversion
7. **Safe Corridor** — Geometric polygon visualization around active path during trips for visual safety feedback

The app follows modern Android development practices: Jetpack Compose with Material 3, Hilt DI, MVVM with StateFlow, Room with Flow, offline-first with sync recovery, and coroutines-based async throughout.
