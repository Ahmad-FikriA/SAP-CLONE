# Agent Guidelines for PPHSE PT KTI Backend (Smart WaterCare)

This is a Node.js project using Express.js framework, Sequelize ORM, and MySQL.

---

## ⚠️ CRITICAL RULES — Read First

### 🚫 No Raw Queries Unless Necessary

**NEVER use raw SQL queries** if Sequelize ORM methods can achieve the same result. Raw queries bypass model validations and hooks.

| ❌ Anti-Pattern | ✅ Use Instead | Why |
|---|---|---|
| `sequelize.query('SELECT * FROM users')` | `User.findAll()` | Type safety, hooks, relationships |
| Returning internal errors to client | Standard JSON responses | Security & Client parsing |
| Exposing `.env` variables | Use `process.env` | Security |
| Manual validation | Validation Middlewares / Joi/Zod | Consistency & Security |

### 📖 Always Check Documentation First

Before writing or suggesting ANY Node.js/Express code:

1. Verify Express.js routing and middleware documentation.
2. Check Sequelize v6 (or relevant version) associations and querying docs.
3. Understand MySQL relational database concepts.

### 🧱 Follow Layered Architecture Strictly

This project uses **Layered Architecture** mirroring the frontend's Clean Architecture approach. See `ARCHITECTURE_backend.md` for the full guide.

**Layer rules:**

- **Routes (API Layer)** → Only handles HTTP routing, extracts body/params, calls Controllers/Services.
- **Controllers/Services (Business Logic)** → Implements the actual business rules (the "Brain").
- **Models/Repositories (Data Access)** → Sequelize models, directly interacts with the database.

---

## Build/Lint/Test Commands

```bash
# Install dependencies
npm install

# Run the app in development mode (nodemon)
npm run dev

# Run the app in production mode
npm start

# Run database seeder
node src/seed.js
```

---

## Code Style Guidelines

### Imports (Strict Order)

```javascript
// 1. Core Node.js Modules
const path = require('path');
const fs = require('fs');

// 2. Third-party packages
const express = require('express');
const { Op } = require('sequelize');

// 3. Project imports
const { User, Equipment, SPK } = require('../models');
const { verifyToken } = require('../middleware/auth');
```

**Rules:**

- Use `const` variables for imports.
- Preferred syntax is CommonJS (`require`), unless the project explicitly uses ESModules (`import`).

### Formatting & Variables

- Use `const` for immutable variables, `let` for reassignable variables. Never use `var`.
- Use trailing commas where appropriate.
- Promise chaining: Prefer `async/await` over `.then().catch()`.

### Naming Conventions

- Variables, Functions, Parameters: `camelCase` (`getUser`, `equipmentList`)
- Classes, Models: `PascalCase` (`User`, `EquipmentModel`)
- Files, Directories: `camelCase` or `kebab-case` consistently (`lembarKerja.js`, `auth-middleware.js`). Avoid arbitrary changes.
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRIES`)

---

## Backend Best Practices

### Route Structure

- Group routes logically by domain (`equipment.js`, `spk.js`).
- Use Express routers (`express.Router()`).

### Error Handling

- Use `try/catch` for ALL async operations in route handlers to prevent unhandled promise rejections.
- Use a centralized error handling middleware.
- Return consistent JSON structures for responses (e.g., `{ success: true, data: ... }` or `{ success: false, error: ... }`).

```javascript
// ✅ Good: Using try/catch and structured response
router.get('/', async (req, res, next) => {
  try {
    const data = await spkService.getAll();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error); // Pass to centralized error handler
  }
});
```

### Security (IMPORTANT)

- Never expose MySQL credentials, JWT secrets, or DB passwords in code. Use `.env`.
- Implement rate limiting and validation (e.g., `express-validator` or `Joi`) on user inputs to prevent SQL Injection or XSS.

---

## Common Anti-Patterns to AVOID

| ❌ Anti-Pattern | ✅ Do This Instead |
|---|---|
| "Fat" Controllers (1000 lines of logic in a route) | Extract business logic into a `services/` layer |
| Ignored Promise Rejections | Always use `try/catch` with `async/await` |
| Returning raw DB errors to client | Map errors to safe, generic messages in production |
| Hardcoding connection strings | Use `process.env.DATABASE_URL` |
| Duplicate validations in frontend/backend | Backend MUST always re-validate all inputs to be safe |

---

## Project Structure (Layered API Pattern)

```text
/
├── src/
│   ├── models/           # Sequelize Models (Data definition for MySQL)
│   ├── middleware/       # Express middlewares (Auth, Upload, Error)
│   ├── routes/           # API Endpoints (The "Receptionist")
│   ├── services/         # Business Logic (The "Brain", corresponds to Domain UseCases)
│   ├── seed.js           # Database seeder
│   └── server.js         # Entry point
├── data/                 # JSON Mock/Seed data
└── uploads/              # Local file storage
```
