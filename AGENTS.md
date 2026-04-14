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

This project uses **Layered Architecture** mirroring the frontend's Clean Architecture approach. See `ARCHITECTURE.md` for the full guide.

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

# Run API tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- auth.test.js
```

### Testing Guidelines

**ALWAYS run tests after making changes:**
```bash
npm test
```

**Test coverage requirements:**
- Minimum 50% coverage for branches, functions, lines, statements
- All new endpoints MUST have corresponding tests
- All model changes MUST have integration tests

**Writing tests:**
- Create test files in `tests/` folder
- Name pattern: `[module].test.js`
- Use utilities from `tests/setup.js`:
  - `authRequest(method, path)` - Authenticated requests
  - `expectSuccess(response, status)` - Success validation
  - `expectArray(response, minLength)` - Array validation
  - `expectObject(response, fields)` - Object validation

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
- Database fields: `snake_case` with `underscored: true` in Sequelize

---

## Backend Best Practices

### Route Structure

- Group routes logically by domain (`equipment.js`, `spk.js`, `corrective.js`).
- Use Express routers (`express.Router()`).
- Keep routes thin - business logic goes to controllers.

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
- Always verify JWT tokens on protected routes using `verifyToken` middleware.

### Database Operations

- Use transactions when updating multiple related tables:
```javascript
const t = await sequelize.transaction();
try {
  await Model1.create({...}, { transaction: t });
  await Model2.create({...}, { transaction: t });
  await t.commit();
} catch (err) {
  await t.rollback();
  throw err;
}
```

---

## Common Anti-Patterns to AVOID

| ❌ Anti-Pattern | ✅ Do This Instead |
|---|---|
| "Fat" Controllers (1000 lines of logic in a route) | Extract business logic into a `services/` layer |
| Ignored Promise Rejections | Always use `try/catch` with `async/await` |
| Returning raw DB errors to client | Map errors to safe, generic messages in production |
| Hardcoding connection strings | Use `process.env.DATABASE_URL` |
| Duplicate validations in frontend/backend | Backend MUST always re-validate all inputs to be safe |
| Missing tests for new features | Write tests BEFORE or WITH new code |
| Not running tests after changes | ALWAYS run `npm test` before committing |

---

## Project Structure (Layered API Pattern)

```text
/
├── src/
│   ├── config/             # Configuration files
│   │   └── database.js     # MySQL/Sequelize config
│   ├── models/             # Sequelize Models (Data definition for MySQL)
│   │   ├── associations.js # Model relationships
│   │   ├── CorrectiveRequest.js
│   │   ├── Equipment.js
│   │   ├── LembarKerja.js
│   │   ├── Notification.js # Corrective notifications
│   │   ├── Plant.js
│   │   ├── Spk.js          # Preventive SPK
│   │   ├── SpkCorrective.js # Corrective SPK
│   │   ├── SpkCorrectiveItem.js
│   │   ├── Submission.js
│   │   └── User.js
│   ├── controllers/        # Business logic controllers
│   │   ├── auth/
│   │   ├── corrective/     # Corrective maintenance
│   │   ├── preventive/     # Preventive maintenance
│   │   └── users/
│   ├── middleware/         # Express middlewares (Auth, Upload, Error)
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── routes/             # API Endpoints (The "Receptionist")
│   │   ├── auth.js
│   │   ├── corrective.js
│   │   ├── preventive.js
│   │   └── users.js
│   ├── services/           # Business Logic (The "Brain")
│   │   └── fileStore.js
│   ├── seed.js             # Database seeder
│   └── server.js           # Entry point
├── tests/                  # API Test suite
│   ├── setup.js            # Test utilities
│   ├── *.test.js           # Test files
│   └── README.md           # Testing docs
├── data/                   # JSON Mock/Seed data
├── public/                 # Web Admin UI
│   ├── index.html          # Main Dashboard
│   ├── pages/
│   │   ├── corrective-planner.html  # Corrective Planner UI
│   │   ├── equipment.html
│   │   ├── lembar-kerja.html
│   │   ├── spk.html
│   │   └── submissions.html
│   └── js/
│       ├── app.js
│       ├── corrective-planner.js    # Planner logic
│       ├── spk.js
│       └── equipment.js
└── uploads/                # Local file storage
```

---

## Model Guidelines

### Creating New Models

1. Define model in `src/models/[ModelName].js`
2. Add associations to `src/models/associations.js`
3. Create migration if needed (run `npm run seed` for dev)
4. Write tests in `tests/[model].test.js`

### Model Structure

```javascript
'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ModelName = sequelize.define('ModelName', {
  // Primary key
  id: {
    type: DataTypes.STRING(30),
    primaryKey: true,
    field: 'id', // snake_case for DB
  },
  // Fields
  fieldName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'field_name',
  },
  // Enums
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
  // Foreign keys
  foreignId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'foreign_id',
  },
}, {
  tableName: 'table_names',  // snake_case, plural
  underscored: true,         // Auto-convert camelCase to snake_case
  timestamps: true,          // createdAt, updatedAt
});

module.exports = ModelName;
```

### Key Models Reference

**Preventive Maintenance:**
- `Spk` - Preventive work orders
- `SpkEquipment` - SPK-Equipment junction
- `SpkActivity` - SPK activities
- `LembarKerja` - Work sheets
- `Submission` - SPK submissions

**Corrective Maintenance:**
- `Notification` - Corrective notifications (created by Kadis Pelapor)
- `CorrectiveRequest` - Legacy corrective requests
- `SpkCorrective` - Corrective work orders (created from Notification)
- `SpkCorrectiveItem` - Materials/services for corrective SPK
- `SpkCorrectivePhoto` - Before/after/during photos

**Core:**
- `User` - User accounts
- `Equipment` - Equipment inventory
- `Plant` - Plant locations

---

## Pre-commit Checklist

Before committing code:

- [ ] Run `npm test` - All tests must pass
- [ ] Check test coverage - Must be >= 50%
- [ ] Run `npm run dev` - Server starts without errors
- [ ] Check for console.log statements (remove or keep intentionally)
- [ ] Verify no sensitive data in code (passwords, secrets)
- [ ] Update documentation if API changes
- [ ] Check `associations.js` if adding new models

---

## Troubleshooting

### Tests Failing
```bash
# Clear Jest cache
npm test -- --clearCache

# Run with verbose output
npm test -- --verbose

# Run specific failing test
npm test -- --testNamePattern="should login"
```

### Database Connection Issues
```bash
# Check .env file
# Ensure MySQL is running
# Run seeder to recreate tables
npm run seed
```

### Port Already in Use
```bash
# Kill process on port 3000 (Linux/Mac)
lsof -ti:3000 | xargs kill -9

# Or change PORT in .env
PORT=3001
```
