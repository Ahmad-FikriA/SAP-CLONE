# 🏗️ Smart WaterCare — Backend Architecture Guide

> **Read this first** before writing any code. This explains **why** the backend project is structured this way and **what** to build in each folder. It perfectly aligns with the frontend's Clean Architecture approach.

---

## 🚀 The Backend Ecosystem

This backend serves as the core data provider and business logic executor for the mobile application.

- **Client:** Smart WaterCare Flutter Application.
- **API Server:** Node.js + Express.js app serving RESTful APIs.
- **Data Layer:** Sequelize ORM connecting to a MySQL database.
- **Storage:** Local file system (`/uploads`) and potentially external cloud storage.
- **Testing:** Jest + Supertest for comprehensive API testing.

---

## 🧠 Why Layered Architecture? (The "4 Layer" System)

Just like the frontend's Clean Architecture prevents UI code from mixing with database queries, our backend uses a similar Layered Architecture. Each layer has **ONE job**, which allows independent testing and simple modifications.

```text
┌─────────────────────────────────────────────────────┐
│                    TEST LAYER                        │
│              (Quality Assurance)                     │
│     Jest Tests, Integration Tests, Mock Data         │
├─────────────────────────────────────────────────────┤
│                 ROUTING / API LAYER                  │
│               (The "Receptionist")                   │
│          Express Routes, Controllers, DTOs           │
├─────────────────────────────────────────────────────┤
│                  SERVICE LAYER                       │
│        (The "Brain" / Business Rules)                │
│    Core application logic, calculation, validation   │
├─────────────────────────────────────────────────────┤
│                   DATA LAYER                         │
│       (Where data COMES FROM and GOES TO)            │
│  Sequelize Models, Database connections, File I/O    │
└─────────────────────────────────────────────────────┘
```

### 🧪 Test Layer — "Quality Assurance"

**Job:** Ensure the API works correctly through automated testing. This layer validates that all endpoints, business logic, and data operations function as expected.

| Folder | What Goes Here | Example |
|--------|---------------|---------|
| `tests/` | Jest test files, utilities | `auth.test.js`, `spk.test.js` |

**Rules:**

- ✅ Tests should cover happy paths and edge cases.
- ✅ Use `authRequest()` helper for authenticated requests.
- ✅ Clean up test data after each test.
- ✅ Minimum 50% coverage for all code changes.
- ❌ Never test implementation details, test behavior.

**Analogy:** The quality inspector at a factory. They check that products meet specifications before shipping.

---

### 📺 Routing / API Layer — "The Receptionist"

**Job:** Receive the HTTP request from the Flutter app, extract parameters/body, and pass them to the Service Layer. Then, format the Service Layer's result into a standardized JSON response.

| Folder | What Goes Here | Example |
|--------|---------------|---------|
| `routes/` | Route definitions & HTTP verbs | `spk.js`, `lembarKerja.js`, `corrective.js` |
| `middleware/` | Pre-request processors | `auth.js` (Verify JWT), `upload.js` |

**Rules:**

- ✅ Validates incoming request formatting.
- ❌ NEVER performs business logic directly (like calculating costs).
- ❌ NEVER touches the database directly.

**Analogy:** The receptionist at a hospital. They check your ID and direct you to the doctor. They do not perform the surgery.

---

### 🧠 Service Layer — "The Brain"

**Job:** Execute the actual business rules of Smart WaterCare. This layer is equivalent to the frontend's `UseCases`.

| Folder | What Goes Here | Example |
|--------|---------------|---------|
| `services/` | Business Logic execution | `fileStore.js`, `spkService.js` |
| `controllers/` | Request handlers with business logic | `spkController.js`, `spkCorrectiveController.js` |

**Rules:**

- ✅ Calls the Models to fetch/save data.
- ✅ Applies logic (e.g., "Cannot create a Corrective SPK if Equipment is active").
- ❌ Does not know about HTTP requests (`req`, `res`). It just returns raw data or throws errors.

**Analogy:** The doctor in the hospital. They diagnose the issue based on the info from the receptionist and read your medical history (from the records room).

---

### 💾 Data Layer — "The Records Room"

**Job:** Retrieve data from the underlying database or file system.

| Folder | What Goes Here | Example |
|--------|---------------|---------|
| `models/` | Sequelize schemas (MySQL) | `Equipment`, `User`, `LembarKerja`, `SpkCorrective` |
| `data/` | Static files, mock seeds | `spk.json` |

**Rules:**

- ✅ Defines what an entity looks like in the DB (schema, hooks, associations).
- ❌ Defines no business logic beyond strict data constraints (like "email must be unique").

**Analogy:** The hospital's filing system. It only knows how to store and fetch folders.

---

## 🔄 How They Work Together (The Flow)

```text
Flutter App sends POST /api/spk
           │
    ┌─ 1. ROUTE LAYER ─┐
    │ spk.js (Router)  │ ──→ Checks token via auth.js Middleware. Passes body to Service.
    └──────────────────┘
           │
    ┌─ 2. SERVICE LAYER ┐
    │ spkController    │ ──→ Validates data rules. Creates the SPK object.
    └──────────────────┘
           │
    ┌─ 3. DATA LAYER ───┐
    │ Sequelize Model  │ ──→ Executes `INSERT INTO SPKs...` via MySQL.
    └──────────────────┘
           │
    Response flows BACK UP:
    Model → Service → Route (sends JSON { success: true, ... }) → Flutter App!
    
    Test Layer validates:
    ┌─ 4. TEST LAYER ───┐
    │ spk.test.js      │ ──→ Validates API response, data integrity, edge cases.
    └──────────────────┘
```

---

## 📦 Tech Stack Detail

| Category | Technology | Why |
|----------|------------|-----|
| **Runtime** | `Node.js` | Fast, asynchronous JavaScript execution |
| **Web Framework**| `Express.js`| Standard, reliable framework for REST APIs |
| **Database** | `MySQL` | Relational, reliable, widely supported |
| **ORM** | `Sequelize` | Powerful Type-safe mapping for SQL tables |
| **Testing** | `Jest + Supertest` | Industry standard for Node.js API testing |
| **Container** | `Docker` | Isolated, consistent deployment (via `Dockerfile`) |
| **Security** | `JWT / bcrypt`| Stateless authentication and secure password hashing |

---

## 🗂️ Domain Models

### Preventive Maintenance Domain

The preventive maintenance system handles scheduled maintenance tasks.

**Core Entities:**
- **SPK** (Surat Perintah Kerja) - Work orders for preventive maintenance
- **LembarKerja** - Work sheets grouping multiple SPKs
- **Equipment** - Assets that need maintenance
- **Submission** - Completed work reports

**Relationships:**
```
LembarKerja ||--o{ SPK (via LembarKerjaSpk)
SPK ||--o{ SpkEquipment
SPK ||--o{ SpkActivity
SPK ||--o{ Submission
Submission ||--o{ SubmissionPhoto
Submission ||--o{ SubmissionActivityResult
```

### Corrective Maintenance Domain

The corrective maintenance system handles unplanned repairs and breakdowns.

**Core Entities:**
- **Notification** - Initial report of a problem (created by Kadis Pelapor)
- **SpkCorrective** - Work order for corrective maintenance
- **SpkCorrectiveItem** - Materials, services, or tools needed
- **SpkCorrectivePhoto** - Documentation photos (before/after/during)

**Workflow:**
```
KadisPelapor creates Notification
           ↓
Planner creates SpkCorrective from Notification
           ↓
Teknisi executes work (start → complete)
           ↓
KadisPusat reviews work
           ↓
KadisPelapor gives final approval
           ↓
Status: COMPLETED
```

**Relationships:**
```
Notification ||--|| SpkCorrective
SpkCorrective ||--o{ SpkCorrectiveItem
SpkCorrective ||--o{ SpkCorrectivePhoto
User ||--o{ Notification (as KadisPelapor)
```

---

## 📝 Best Practices specific to this backend

1. **Transaction Wrapping:** When updating multiple related tables (e.g., SPK and its attachments), use `sequelize.transaction()` to ensure atomicity. If one fails, the entire request rolls back.

2. **Standardized Responses:** Every API response should follow a strict wrapper, mimicking how Flutter processes API state:

   ```json
   {
       "success": true,
       "message": "Data retrieved successfully.",
       "data": { ... }
   }
   ```

3. **Testing First:** Write tests for new features before or alongside implementation. Run `npm test` before every commit.

4. **Test Coverage:** Maintain minimum 50% coverage. Use `npm run test:coverage` to check.

5. **Environment Segregation:** Keep `docker-compose.yml` configured with a MySQL service container for easy local development without needing a native MySQL install.

---

## 🧪 Testing Architecture

### Test Organization

```
tests/
├── setup.js              # Shared test utilities
├── auth.test.js          # Authentication tests
├── users.test.js         # User management tests
├── spk.test.js           # Preventive SPK tests
├── lembarKerja.test.js   # Lembar Kerja tests
├── equipment.test.js     # Equipment tests
└── corrective.test.js    # Corrective maintenance tests
```

### Test Utilities (setup.js)

```javascript
// Authentication helper
authRequest('get', '/users')  // Auto-attaches JWT token

// Response validators
expectSuccess(response, 200)     // Check status + no error
expectArray(response, 1)         // Check array with min length
expectObject(response, ['id'])   // Check object has fields
validateResponse(body, schema)   // Validate structure
```

### Writing Tests

```javascript
describe('Feature Name', () => {
  describe('GET /api/endpoint', () => {
    it('should return expected data', async () => {
      const response = await authRequest('get', '/endpoint');
      const body = expectSuccess(response);
      expect(body).toHaveProperty('expectedField');
    });
  });
});
```

---

## 🔄 API Versioning Strategy

Currently using **URL versioning**:
- `/api/v1/users` - Future version
- `/api/users` - Current version (v1 implied)

When breaking changes are needed:
1. Create new route files with version prefix
2. Maintain old routes for backward compatibility
3. Update documentation
4. Notify mobile app team

---
*Last updated: March 2026*
