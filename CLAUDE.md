# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run seed       # Reset/seed the MySQL database with sample data
npm start          # Start server (node src/server.js)
npm run dev        # Start with auto-reload via nodemon
```

No test runner is configured in this project.

## Environment Setup

Copy `.env.example` to `.env` and add the required `URI` variable (not in the example file):

```env
PORT=3000
JWT_SECRET=kti-mock-secret-dev
URI=mysql://user:password@host:3306/dbname
```

`URI` is required — the server will `process.exit(1)` if it's missing.

## Architecture

**KTI SmartCare SAP Mock** — Express.js REST API backend with a Fiori-styled web admin UI, backed by MySQL via Sequelize ORM.

### Request flow

```
HTTP Request
  → src/middleware/auth.js (JWT verification via verifyToken)
  → src/routes/{auth,users,preventive,corrective}.js
  → src/controllers/{domain}/{entity}Controller.js
  → Sequelize models → MySQL
```

### Domain split

| Domain                 | Routes prefix                                                                                                            | Controllers path              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Preventive maintenance | `/api/spk`, `/api/lk`, `/api/equipment`, `/api/maps`, `/api/submissions`, `/api/functional-locations`, `/api/task-lists` | `src/controllers/preventive/` |
| Corrective maintenance | `/api/corrective/requests`, `/api/corrective/parse-excel`                                                                | `src/controllers/corrective/` |
| Auth                   | `/api/auth`                                                                                                              | `src/controllers/auth/`       |
| Users                  | `/api/users`                                                                                                             | `src/controllers/users/`      |

All preventive routes are defined together in `src/routes/preventive.js` and export named routers. Corrective routes live in `src/routes/corrective.js`.

### Sequelize models & associations

Models live in `src/models/`. **All associations must be defined in `src/models/associations.js`**, which is imported once at startup in `server.js`. Never define cross-model associations inside individual model files.

Key models and their junction tables:

- `Spk` → `SpkEquipment` (junction), `SpkActivity`
- `LembarKerja` → `LembarKerjaSpk` (junction linking LK to SPK)
- `Submission` → `SubmissionPhoto`, `SubmissionActivityResult`
- `CorrectiveRequest` → `CorrectiveRequestImage`
- `FunctionalLocation` — self-referencing tree (`parentId`)
- `GeneralTaskList` → `GeneralTaskListActivity`
- `Equipment` belongs to both `Plant` and `FunctionalLocation`

Models use `underscored: true` and explicit `field:` mappings for snake_case DB columns.

### Admin UI

Static files in `public/`. `public/js/app.js` provides shared auth, fetch helpers, sidebar, and toast utilities used by all page scripts. The server serves `public/index.html` as SPA fallback for all non-API GET routes.

### File uploads & static storage

- `uploads/` — photo uploads (served at `/uploads`)
- `storage/` — additional static files (served at `/storage`)

### Categories & roles

Equipment/SPK/LK categories: `Mekanik`, `Listrik`, `Sipil`, `Otomasi`

User roles: `teknisi`, `planner`, `supervisor`, `manager`, `admin`

LK approval chain: `pending` → `awaiting_kasie` → `awaiting_ap` → `awaiting_kadis_pusat` → `awaiting_kadis_keamanan` → `approved` (or `rejected` at any step)
