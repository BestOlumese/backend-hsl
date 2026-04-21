# Intelligence Query Engine - Stage 2

This is the production-ready **Intelligence Query Engine** built for Insighta Labs. The system allows demographic intelligence analysts to filter, sort, paginate, and query user profiles using natural language.

## 🚀 Key Features

* **Natural Language Query (NLQ):** An informal search engine that parses natural phrases like *"young males from nigeria"* into structured data filters.
* **Advanced Filtering:** Combine multiple conditions including gender, country, age ranges, and statistical probability thresholds.
* **Smart Pagination & Sorting:** Full support for `page` and `limit` with accurate metadata, and sorting by `age`, `created_at`, or `gender_probability`.
* **Robust Seeding:** A database initialization script that handles bulk demographic data idempotentally.
* **Idempotent creations:** Duplicate incoming `name` parameters return the existing database record.
* **LibSQL Persistence:** Powered by Turso for high-performance, edge-ready data storage.

## 📡 Endpoints

### 1. Natural Language Search
**GET** `/api/profiles/search?q={query}`

Parses informal phrases into filters.
* **Examples**:
  - `?q=young males from nigeria`
  - `?q=females under 30`
  - `?q=seniors from united kingdom`
* **Keywords**: "young" (16-24), "above X", "under X", gender titles, and country names.

### 2. Get All Profiles (Advanced Query)
**GET** `/api/profiles`

Supports standard query parameters for precise segmentation:
* **Filters**: `gender`, `country_id`, `age_group`, `min_age`, `max_age`, `min_gender_probability`, `min_country_probability`.
* **Sorting**: `sort_by` (`age`, `created_at`, `gender_probability`) and `order` (`asc`, `desc`).
* **Pagination**: `page` (default: 1) and `limit` (default: 10, max: 50).

### 3. Create Profile
**POST** `/api/profiles`
Request body: `{ "name": "bella" }`
Fetch prediction data concurrently from Genderize, Agify, and Nationalize APIs.

### 4. Single Profile & Delete
* **GET** `/api/profiles/{id}`: Fetch detailed record.
* **DELETE** `/api/profiles/{id}`: Remove record from engine.

## 💻 Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Setup Environment**:
   Create a `.env` file with your Turso credentials:
   ```env
   TURSO_DATABASE_URL=your_libsql_url
   TURSO_AUTH_TOKEN=your_auth_token
   ```
3. **Seed Database**:
   Populate the engine with benchmark profile data:
   ```bash
   npm run seed
   ```
4. **Boot Server**:
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:3000`.

## 🧪 Testing
You can test the engine using standard HTTP clients or terminal commands:
```bash
# Complex Query example
curl "http://localhost:3000/api/profiles?min_age=25&gender=female&sort_by=age&order=desc"

# NLQ example
curl "http://localhost:3000/api/profiles/search?q=young+males+from+nigeria"
```