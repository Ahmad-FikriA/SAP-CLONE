# KTI SmartCare — SAP Mock System

A local mock SAP backend for the KTI SmartCare Flutter preventive-maintenance app.
Includes a REST API server and a Fiori-styled web admin UI for managing dummy data.

---

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Seed the database with sample data
npm run seed

# 3. Start the server
npm start
```

Server runs at **http://localhost:3000**

- **API:**      http://localhost:3000/api
- **Admin UI:** http://localhost:3000

For development with auto-reload:
```bash
npm run dev
```

---

## Test Credentials

| Username        | Password     | Role        | Name          |
|-----------------|--------------|-------------|---------------|
| `teknisi_01`    | `password123`| teknisi     | Budi Santoso  |
| `planner_01`    | `password123`| planner     | Siti Rahayu   |
| `supervisor_01` | `password123`| supervisor  | Ahmad Fauzi   |
| `manager_01`    | `password123`| manager     | Dewi Kusuma   |
| `admin_01`      | `password123`| admin       | Admin KTI     |

---

## API Reference

All endpoints except `POST /api/auth/login` require:
```
Authorization: Bearer <jwt_token>
```

Error responses always use: `{ "error": "message" }`

### Authentication

| Method | Endpoint           | Body                              | Response                              |
|--------|--------------------|-----------------------------------|---------------------------------------|
| POST   | `/api/auth/login`  | `{ username, password }`          | `{ token, user: { id, name, ... } }`  |

### Lembar Kerja

| Method | Endpoint                        | Description                                    |
|--------|---------------------------------|------------------------------------------------|
| GET    | `/api/lk`                       | List all (optional `?category=Mekanik`)        |
| GET    | `/api/lk/:lkNumber`             | Single LK with resolved SPK objects            |
| POST   | `/api/lk`                       | Create new LK                                  |
| PUT    | `/api/lk/:lkNumber`             | Partial update                                 |
| DELETE | `/api/lk/:lkNumber`             | Delete                                         |
| POST   | `/api/lk/:lkNumber/submit`      | Submit — body `{ evaluasi }`, sets `completed` |

### SPK

| Method | Endpoint                        | Description                                    |
|--------|---------------------------------|------------------------------------------------|
| GET    | `/api/spk`                      | List all (optional `?category=Mekanik`)        |
| GET    | `/api/spk/:spkNumber`           | Single SPK                                     |
| POST   | `/api/spk`                      | Create new SPK                                 |
| PUT    | `/api/spk/:spkNumber`           | Partial update                                 |
| DELETE | `/api/spk/:spkNumber`           | Delete                                         |
| POST   | `/api/spk/:spkNumber/submit`    | Submit completion — saves to submissions.json  |
| POST   | `/api/spk/:spkNumber/sync`      | Mock SAP sync — returns `{ syncedAt }`         |

### Equipment

| Method | Endpoint                        | Description                                    |
|--------|---------------------------------|------------------------------------------------|
| GET    | `/api/equipment`                | List all (optional `?category=Mekanik`)        |
| POST   | `/api/equipment`                | Create                                         |
| PUT    | `/api/equipment/:equipmentId`   | Update                                         |
| DELETE | `/api/equipment/:equipmentId`   | Delete                                         |

### Users (Admin)

| Method | Endpoint            | Description                              |
|--------|---------------------|------------------------------------------|
| GET    | `/api/users`        | List all (optional `?role=teknisi`)      |
| POST   | `/api/users`        | Create user                              |
| PUT    | `/api/users/:id`    | Update (use `{ password: "..." }` to reset password) |

### Submissions (Read-only)

| Method | Endpoint                  | Description      |
|--------|---------------------------|------------------|
| GET    | `/api/submissions`        | List all         |
| GET    | `/api/submissions/:id`    | Single           |

### Photo Upload

| Method | Endpoint              | Description                                 |
|--------|-----------------------|---------------------------------------------|
| POST   | `/api/upload/photo`   | `multipart/form-data`, field `photo`        |
|        |                       | Returns `{ path: "uploads/filename.jpg" }`  |

---

## Project Structure

```
sap-mock/
├── data/                     # JSON flat-file storage (auto-created by seed)
│   ├── users.json
│   ├── equipment.json
│   ├── lembar_kerja.json
│   ├── spk.json
│   └── submissions.json
├── public/                   # Web Admin UI
│   ├── css/style.css
│   ├── index.html            # Dashboard
│   ├── pages/
│   │   ├── spk.html
│   │   ├── lembar-kerja.html
│   │   ├── equipment.html
│   │   ├── users.html
│   │   └── submissions.html
│   └── js/
│       ├── app.js            # Shared: auth, fetch helpers, sidebar, toast
│       ├── spk.js
│       ├── lembar-kerja.js
│       ├── equipment.js
│       └── users.js
├── src/
│   ├── middleware/
│   │   ├── auth.js           # JWT verification
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── lembarKerja.js
│   │   ├── spk.js
│   │   ├── equipment.js
│   │   ├── users.js
│   │   └── submissions.js
│   ├── services/
│   │   └── fileStore.js      # JSON read/write helper
│   ├── seed.js               # Seed data generator
│   └── server.js             # Express app entry point
├── uploads/                  # Photo uploads land here
├── .env.example
├── .gitignore
└── package.json
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
JWT_SECRET=kti-mock-secret-dev
```

---

## Re-seeding Data

To reset all JSON data files to the default sample data:

```bash
npm run seed
```

This creates:
- 5 users (one per role)
- 10 equipment (Mekanik ×4, Listrik ×3, Sipil ×2, Otomasi ×1)
- 12 SPKs across all categories with realistic Indonesian operation text
- 4 LembarKerja (one per category, March 2026)
- 2 Submissions for completed SPKs

---

## Flutter Integration

Point your Flutter app's `ApiConfig.baseUrl` to this server:

| Device              | Base URL                        |
|---------------------|---------------------------------|
| Android emulator    | `http://10.0.2.2:3000/api`      |
| iOS simulator       | `http://localhost:3000/api`     |
| Physical device     | `http://<your-machine-ip>:3000/api` |

Login with any credentials from the table above to get a JWT token (valid 24h).
