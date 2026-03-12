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

## Testing

This project includes comprehensive API tests using Jest and Supertest.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-run on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- auth.test.js
```

### Test Coverage

Tests cover the following modules:
- **Authentication** - Login, token validation, protected routes
- **Users** - CRUD operations, filtering, bulk delete
- **Preventive SPK** - CRUD, submission, SAP sync, bulk operations
- **Lembar Kerja** - CRUD, submission, approval workflow
- **Equipment** - CRUD, filtering by category
- **Corrective Maintenance** - Notifications, SPK Corrective, workflow

### Test Structure

```
tests/
├── setup.js                 # Test configuration & utilities
├── auth.test.js             # Authentication tests
├── users.test.js            # Users CRUD tests
├── spk.test.js              # Preventive SPK tests
├── lembarKerja.test.js      # Lembar Kerja tests
├── equipment.test.js        # Equipment tests
├── corrective.test.js       # Corrective maintenance tests
└── README.md                # Testing documentation
```

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
| POST   | `/api/lk/:lkNumber/approve`     | Approve LK (supervisor/manager)                |
| POST   | `/api/lk/:lkNumber/reject`      | Reject LK (supervisor/manager)                 |

### Preventive SPK

| Method | Endpoint                        | Description                                    |
|--------|---------------------------------|------------------------------------------------|
| GET    | `/api/spk`                      | List all (optional `?category=Mekanik`)        |
| GET    | `/api/spk/:spkNumber`           | Single SPK                                     |
| POST   | `/api/spk`                      | Create new SPK                                 |
| PUT    | `/api/spk/:spkNumber`           | Partial update                                 |
| DELETE | `/api/spk/:spkNumber`           | Delete                                         |
| POST   | `/api/spk/:spkNumber/submit`    | Submit completion — saves to submissions.json  |
| POST   | `/api/spk/:spkNumber/sync`      | Mock SAP sync — returns `{ syncedAt }`         |
| POST   | `/api/spk/bulk-delete`          | Bulk delete SPKs                               |

### Equipment

| Method | Endpoint                        | Description                                    |
|--------|---------------------------------|------------------------------------------------|
| GET    | `/api/equipment`                | List all (optional `?category=Mekanik`)        |
| POST   | `/api/equipment`                | Create                                         |
| PUT    | `/api/equipment/:equipmentId`   | Update                                         |
| DELETE | `/api/equipment/:equipmentId`   | Delete                                         |
| POST   | `/api/equipment/bulk-delete`    | Bulk delete equipment                          |

### Users (Admin)

| Method | Endpoint            | Description                              |
|--------|---------------------|------------------------------------------|
| GET    | `/api/users`        | List all (optional `?role=teknisi`)      |
| POST   | `/api/users`        | Create user                              |
| PUT    | `/api/users/:id`    | Update (use `{ password: "..." }` to reset password) |
| DELETE | `/api/users/:id`    | Delete user                              |
| POST   | `/api/users/bulk-delete` | Bulk delete users                   |

### Submissions (Read-only)

| Method | Endpoint                  | Description      |
|--------|---------------------------|------------------|
| GET    | `/api/submissions`        | List all         |
| GET    | `/api/submissions/:id`    | Single           |
| DELETE | `/api/submissions/:id`    | Delete submission|
| POST   | `/api/submissions/bulk-delete` | Bulk delete |

### Corrective Maintenance

#### Notifications (Corrective Requests)

| Method | Endpoint                              | Description                                    |
|--------|---------------------------------------|------------------------------------------------|
| GET    | `/api/corrective/requests`            | List all corrective requests                   |
| GET    | `/api/corrective/requests/:id`        | Single corrective request                      |
| POST   | `/api/corrective/requests`            | Create new request                             |
| PUT    | `/api/corrective/requests/:id`        | Update request                                 |
| DELETE | `/api/corrective/requests/:id`        | Delete request                                 |
| POST   | `/api/corrective/requests/bulk-delete`| Bulk delete requests                           |
| POST   | `/api/corrective/requests/:id/approve`| Approve request (supervisor/manager)           |
| POST   | `/api/corrective/requests/:id/reject` | Reject request (supervisor/manager)            |

#### SPK Corrective

| Method | Endpoint                                           | Description                           |
|--------|----------------------------------------------------|---------------------------------------|
| GET    | `/api/corrective/spk`                              | List all corrective SPKs              |
| GET    | `/api/corrective/spk/:spkId`                       | Single corrective SPK                 |
| POST   | `/api/corrective/spk`                              | Create new corrective SPK             |
| PUT    | `/api/corrective/spk/:spkId`                       | Update corrective SPK                 |
| DELETE | `/api/corrective/spk/:spkId`                       | Delete corrective SPK                 |
| POST   | `/api/corrective/spk/bulk-delete`                  | Bulk delete corrective SPKs           |
| POST   | `/api/corrective/spk/:spkId/start-work`            | Teknisi mulai mengerjakan             |
| POST   | `/api/corrective/spk/:spkId/complete-work`         | Teknisi selesai mengerjakan           |
| POST   | `/api/corrective/spk/:spkId/approve-kadis-pusat`   | Kadis Pusat review                    |
| POST   | `/api/corrective/spk/:spkId/approve-kadis-pelapor` | Kadis Pelapor final approval          |
| POST   | `/api/corrective/spk/:spkId/reject`                | Reject SPK                            |

#### Corrective Workflow

**Flow:** Kadis Pelapor (create notification) → Planner (create SPK) → Teknisi (execute) → Kadis Pusat (review) → Kadis Pelapor (final approval) → Close

1. **Notification Created** (`status: draft/submitted`)
2. **SPK Created** from notification (`status: draft`)
3. **Start Work** - Teknisi mulai (`status: in_progress`)
4. **Complete Work** - Teknisi selesai (`status: awaiting_kadis_pusat`)
5. **Kadis Pusat Approval** (`status: awaiting_kadis_pelapor`)
6. **Kadis Pelapor Approval** (`status: completed`)

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
│   ├── config/
│   │   └── database.js       # MySQL connection config
│   ├── controllers/
│   │   ├── auth/
│   │   │   └── authController.js
│   │   ├── corrective/
│   │   │   ├── correctiveRequestController.js
│   │   │   └── spkCorrectiveController.js
│   │   ├── preventive/
│   │   │   ├── equipmentController.js
│   │   │   ├── lembarKerjaController.js
│   │   │   ├── mapsController.js
│   │   │   ├── spkController.js
│   │   │   └── submissionsController.js
│   │   └── users/
│   │       └── usersController.js
│   ├── middleware/
│   │   ├── auth.js           # JWT verification
│   │   └── errorHandler.js   # Centralized error handling
│   ├── models/
│   │   ├── associations.js   # Sequelize relationships
│   │   ├── CorrectiveRequest.js
│   │   ├── Equipment.js
│   │   ├── LembarKerja.js
│   │   ├── Notification.js   # Corrective notifications
│   │   ├── Plant.js
│   │   ├── Spk.js            # Preventive SPK
│   │   ├── SpkCorrective.js  # Corrective SPK
│   │   ├── SpkCorrectiveItem.js
│   │   ├── Submission.js
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── corrective.js     # Corrective routes
│   │   ├── preventive.js     # Preventive routes
│   │   └── users.js
│   ├── services/
│   │   └── fileStore.js      # JSON read/write helper
│   ├── seed.js               # Database seeder
│   └── server.js             # Express app entry point
├── tests/                    # API Test suite
│   ├── setup.js              # Test configuration
│   ├── auth.test.js
│   ├── users.test.js
│   ├── spk.test.js
│   ├── lembarKerja.test.js
│   ├── equipment.test.js
│   ├── corrective.test.js
│   └── README.md
├── uploads/                  # Photo uploads land here
├── .env.example
├── .gitignore
├── AGENTS.md                 # Guidelines for AI agents
├── ARCHITECTURE.md           # Architecture documentation
└── package.json
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
JWT_SECRET=kti-mock-secret-dev
URI=mysql://username:password@localhost:3306/kti_database
```

**Required:**
- `URI` - MySQL connection string
- `JWT_SECRET` - Secret key for JWT signing
- `PORT` - Server port (default: 3000)

---

## Database Schema

### Core Tables
- **users** - User accounts with roles
- **equipment** - Equipment inventory
- **plants** - Plant/facility locations

### Preventive Maintenance
- **spk** - Preventive work orders
- **spk_equipment** - SPK equipment junction
- **spk_activities** - SPK activities/tasks
- **lembar_kerja** - Work sheets
- **lembar_kerja_spk** - LK-SP junction
- **submissions** - SPK submissions
- **submission_photos** - Submission photos
- **submission_activity_results** - Activity completion results

### Corrective Maintenance
- **notifications** - Corrective maintenance notifications
- **corrective_requests** - Legacy corrective requests
- **corrective_request_images** - Request photos
- **spk_corrective** - Corrective work orders
- **spk_corrective_items** - Materials/services/tools for SPK
- **spk_corrective_photos** - Before/after/during photos

---

## Re-seeding Data

To reset database to default sample data:

```bash
npm run seed
```

This creates:
- 10 users (various roles)
- 10 equipment (Mekanik ×4, Listrik ×3, Sipil ×2, Otomasi ×1)
- 12+ SPKs across all categories
- 4 LembarKerja (one per category)
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

---

## Development Guidelines

See [AGENTS.md](AGENTS.md) for coding guidelines and best practices.

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

---

## License

MIT License - PT Krakatau Tirta Industri
