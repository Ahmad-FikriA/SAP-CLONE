# 🏗️ Smart WaterCare — Backend Architecture Guide

> **Read this first** before writing any code. This explains **why** the backend project is structured this way and **what** to build in each folder. It perfectly aligns with the frontend's Clean Architecture approach.

---

## 🚀 The Backend Ecosystem

This backend serves as the core data provider and business logic executor for the mobile application.

- **Client:** Smart WaterCare Flutter Application.
- **API Server:** Node.js + Express.js app serving RESTful APIs.
- **Data Layer:** Sequelize ORM connecting to a MySQL database.
- **Storage:** Local file system (`/uploads`) and potentially external cloud storage.

---

## 🧠 Why Layered Architecture? (The "3 Layer" System)

Just like the frontend's Clean Architecture prevents UI code from mixing with database queries, our backend uses a similar Layered Architecture. Each layer has **ONE job**, which allows independent testing and simple modifications.

```text
┌─────────────────────────────────────────────────────┐
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

### 📺 Routing / API Layer — "The Receptionist"

**Job:** Receive the HTTP request from the Flutter app, extract parameters/body, and pass them to the Service Layer. Then, format the Service Layer's result into a standardized JSON response.

| Folder | What Goes Here | Example |
|--------|---------------|---------|
| `routes/` | Route definitions & HTTP verbs | `spk.js`, `lembarKerja.js` |
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
| `models/` | Sequelize schemas (MySQL) | `Equipment`, `User`, `LembarKerja` |
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
    │ spkService       │ ──→ Validates data rules. Creates the SPK object.
    └──────────────────┘
           │
    ┌─ 3. DATA LAYER ───┐
    │ Sequelize Model  │ ──→ Executes `INSERT INTO SPKs...` via MySQL.
    └──────────────────┘
           │
    Response flows BACK UP:
    Model → Service → Route (sends JSON { success: true, ... }) → Flutter App!
```

---

## 📦 Tech Stack Detail

| Category | Technology | Why |
|----------|------------|-----|
| **Runtime** | `Node.js` | Fast, asynchronous JavaScript execution |
| **Web Framework**| `Express.js`| Standard, reliable framework for REST APIs |
| **Database** | `MySQL` | Relational, reliable, widely supported |
| **ORM** | `Sequelize` | Powerful Type-safe mapping for SQL tables |
| **Container** | `Docker` | Isolated, consistent deployment (via `Dockerfile`) |
| **Security** | `JWT / bcrypt`| Stateless authentication and secure password hashing |

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

3. **Environment Segregation:** Keep `docker-compose.yml` configured with a MySQL service container for easy local development without needing a native MySQL install.

---
*Last updated: March 2026*
