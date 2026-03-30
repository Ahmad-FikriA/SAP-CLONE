# Equipment-Interval-TaskList Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map each equipment + interval pair to a GeneralTaskList so that when creating an SPK, selecting equipment auto-populates activity rows from the mapped task list.

**Architecture:** New `equipment_interval_mappings` table with a Sequelize model and CRUD API at `/api/equipment-mappings`. A dedicated admin page lets users manage mappings. The SPK create form loads all mappings upfront and auto-fills activities when equipment is checked (create mode only, no-op if no mapping exists for that equipment+interval).

**Tech Stack:** Express.js, Sequelize ORM, MySQL, vanilla JS admin UI (matches existing patterns in public/js/).

---

## File Map

| Action | File |
|--------|------|
| Create | `src/models/EquipmentIntervalMapping.js` |
| Modify | `src/models/associations.js` |
| Create | `src/controllers/preventive/equipmentMappingController.js` |
| Modify | `src/routes/preventive.js` |
| Modify | `src/server.js` |
| Modify | `src/seed.js` |
| Create | `public/pages/equipment-mappings.html` |
| Create | `public/js/equipment-mappings.js` |
| Modify | `public/js/spk.js` |
| Modify | `public/index.html` and all `public/pages/*.html` (sidebar link) |

---

## Task 1: Sequelize Model + Associations

**Files:**
- Create: `src/models/EquipmentIntervalMapping.js`
- Modify: `src/models/associations.js`

- [ ] **Step 1: Create `src/models/EquipmentIntervalMapping.js`**

```js
'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EquipmentIntervalMapping = sequelize.define('EquipmentIntervalMapping', {
  id:          { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  equipmentId: { type: DataTypes.STRING(20), allowNull: false, field: 'equipment_id' },
  interval:    { type: DataTypes.STRING(30), allowNull: false },
  taskListId:  { type: DataTypes.STRING(50), allowNull: false, field: 'task_list_id' },
}, {
  tableName: 'equipment_interval_mappings',
  underscored: true,
  timestamps: false,
  indexes: [{ unique: true, fields: ['equipment_id', 'interval'] }],
});

module.exports = EquipmentIntervalMapping;
```

- [ ] **Step 2: Register in `src/models/associations.js`**

Add import after the `GeneralTaskList` import line:
```js
const EquipmentIntervalMapping = require('./EquipmentIntervalMapping');
```

Add associations before `module.exports`:
```js
// Equipment x GeneralTaskList interval mappings
Equipment.hasMany(EquipmentIntervalMapping, { foreignKey: 'equipmentId', as: 'intervalMappings', onDelete: 'CASCADE' });
EquipmentIntervalMapping.belongsTo(Equipment, { foreignKey: 'equipmentId', as: 'equipment' });
GeneralTaskList.hasMany(EquipmentIntervalMapping, { foreignKey: 'taskListId', as: 'intervalMappings' });
EquipmentIntervalMapping.belongsTo(GeneralTaskList, { foreignKey: 'taskListId', as: 'taskList' });
```

Add `EquipmentIntervalMapping` to the `module.exports` object at the bottom.

- [ ] **Step 3: Verify server starts cleanly**

Run: `node src/server.js`
Expected: `Database models synced successfully.` — the new table is auto-created by `sequelize.sync({ alter: true })`. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/models/EquipmentIntervalMapping.js src/models/associations.js
git commit -m "feat: add EquipmentIntervalMapping model and associations"
```

---

## Task 2: API Controller + Routes + Server Mount

**Files:**
- Create: `src/controllers/preventive/equipmentMappingController.js`
- Modify: `src/routes/preventive.js`
- Modify: `src/server.js`

- [ ] **Step 1: Create `src/controllers/preventive/equipmentMappingController.js`**

```js
'use strict';

const EquipmentIntervalMapping = require('../../models/EquipmentIntervalMapping');
const Equipment = require('../../models/Equipment');
const { GeneralTaskList, GeneralTaskListActivity } = require('../../models/GeneralTaskList');

const INCLUDE_FULL = [
  { model: Equipment, as: 'equipment', attributes: ['equipmentId', 'equipmentName'] },
  {
    model: GeneralTaskList,
    as: 'taskList',
    attributes: ['taskListId', 'taskListName'],
    include: [{ model: GeneralTaskListActivity, as: 'activities', attributes: ['stepNumber', 'operationText'] }],
  },
];

function fmt(m) {
  const j = m.toJSON();
  return {
    id: j.id,
    equipmentId: j.equipmentId,
    equipmentName: j.equipment ? j.equipment.equipmentName : null,
    interval: j.interval,
    taskListId: j.taskListId,
    taskListName: j.taskList ? j.taskList.taskListName : null,
    activities: (j.taskList && j.taskList.activities ? j.taskList.activities : [])
      .map(a => ({ stepNumber: a.stepNumber, operationText: a.operationText })),
  };
}

const getAll = async (req, res) => {
  const data = await EquipmentIntervalMapping.findAll({
    include: INCLUDE_FULL,
    order: [['equipmentId', 'ASC'], ['interval', 'ASC']],
  });
  res.json(data.map(fmt));
};

const create = async (req, res) => {
  const { equipmentId, interval, taskListId } = req.body;
  if (!equipmentId || !interval || !taskListId) {
    return res.status(400).json({ error: 'equipmentId, interval, dan taskListId wajib diisi' });
  }
  const existing = await EquipmentIntervalMapping.findOne({ where: { equipmentId, interval } });
  if (existing) {
    return res.status(409).json({ error: 'Mapping untuk equipment ' + equipmentId + ' interval ' + interval + ' sudah ada' });
  }
  const mapping = await EquipmentIntervalMapping.create({ equipmentId, interval, taskListId });
  const fresh = await EquipmentIntervalMapping.findByPk(mapping.id, { include: INCLUDE_FULL });
  res.status(201).json(fmt(fresh));
};

const remove = async (req, res) => {
  const count = await EquipmentIntervalMapping.destroy({ where: { id: req.params.id } });
  if (!count) return res.status(404).json({ error: 'Mapping not found' });
  res.json({ message: 'Deleted' });
};

module.exports = { getAll, create, remove };
```

- [ ] **Step 2: Add `mappingRouter` in `src/routes/preventive.js`**

After the `taskListController` require line, add:
```js
const equipmentMappingController = require('../controllers/preventive/equipmentMappingController');
```

After the `taskListRouter` block, add:
```js
// Equipment Interval Mappings
const mappingRouter = express.Router();
mappingRouter.get('/',       verifyToken, equipmentMappingController.getAll);
mappingRouter.post('/',      verifyToken, equipmentMappingController.create);
mappingRouter.delete('/:id', verifyToken, equipmentMappingController.remove);
```

Update `module.exports` to include `mappingRouter`.

- [ ] **Step 3: Mount in `src/server.js`**

Add `mappingRouter` to the destructure from `./routes/preventive`.

After `app.use("/api/task-lists", taskListRouter);`:
```js
app.use("/api/equipment-mappings", mappingRouter);
```

- [ ] **Step 4: Commit**

```bash
git add src/controllers/preventive/equipmentMappingController.js src/routes/preventive.js src/server.js
git commit -m "feat: add /api/equipment-mappings CRUD routes"
```

---

## Task 3: Seed Default Mappings

**Files:**
- Modify: `src/seed.js`

- [ ] **Step 1: Add model import in `src/seed.js`** (after the GeneralTaskList import line)

```js
const EquipmentIntervalMapping = require('./models/EquipmentIntervalMapping');
```

- [ ] **Step 2: Add data array before `async function main()`**

```js
// Equipment x Interval x TaskList defaults.
// Intervals match SPK form select values: '1wk','2wk','4wk','8wk','12wk','14wk','16wk'
// Task list IDs from data/general_task_lists.json
const equipmentMappings = [
  { equipmentId: '2210000438', interval: '4wk',  taskListId: 'KTI_0001' }, // Pompa Intake 1M1
  { equipmentId: '2210000438', interval: '12wk', taskListId: 'KTI_0005' },
  { equipmentId: '2210000439', interval: '4wk',  taskListId: 'KTI_0001' }, // Pompa Intake 2M1
  { equipmentId: '2210000439', interval: '12wk', taskListId: 'KTI_0005' },
  { equipmentId: '2210000449', interval: '4wk',  taskListId: 'KTI_0001' }, // Pompa Booster Clorine
  { equipmentId: '2210000451', interval: '4wk',  taskListId: 'KTI_0001' }, // Pompa Sump Pump
  { equipmentId: '2210000640', interval: '4wk',  taskListId: 'KTI_0014' }, // Panel Katodik
  { equipmentId: '2210000651', interval: '12wk', taskListId: 'KTI_0014' }, // Transformator BT 01
  { equipmentId: '2210000652', interval: '12wk', taskListId: 'KTI_0014' }, // Transformator BT 02
];
```

- [ ] **Step 3: Add insertion block in `main()` after the task_lists log line**

```js
  // Equipment Interval Mappings (insert-if-not-exists)
  added = 0; skipped = 0;
  for (const m of equipmentMappings) {
    const [, created] = await EquipmentIntervalMapping.findOrCreate({
      where: { equipmentId: m.equipmentId, interval: m.interval },
      defaults: m,
    });
    created ? added++ : skipped++;
  }
  console.log(`  ok  eq_mappings  (+${added} added, ${skipped} already existed)`);
```

- [ ] **Step 4: Run and verify**

```bash
npm run seed
```
Expected output includes a line: `ok  eq_mappings  (+9 added, 0 already existed)`

- [ ] **Step 5: Commit**

```bash
git add src/seed.js
git commit -m "feat: seed default equipment-interval-tasklist mappings"
```

---

## Task 4: Admin Page HTML + JS

**Files:**
- Create: `public/pages/equipment-mappings.html`
- Create: `public/js/equipment-mappings.js`

- [ ] **Step 1: Create `public/pages/equipment-mappings.html`**

Copy the shell-bar and sidebar structure from `public/pages/spk.html`. The active nav-item is Task Mapping (class="nav-item active"). Page body:

- `page__header`: title "Task Mapping", subtitle "Peta equipment ke task list per interval perawatan", button calling `openCreate()`
- `table-wrapper` with columns: Equipment | Interval | Task List | Jumlah Aktivitas | Aksi
- `tbody id="mappingBody"`
- Standard overlay + panel divs (same as spk.html) with `panelBody` id
- Scripts: `/js/app.js` then `/js/equipment-mappings.js`

Sidebar nav-item for Task Mapping (active, used only in this page):
```html
<a href="/pages/equipment-mappings.html" class="nav-item active"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg><span>Task Mapping</span></a>
```

Place it after the Users nav-item and before the sidebar__divider that precedes Submissions.

- [ ] **Step 2: Create `public/js/equipment-mappings.js`**

```js
var allMappings = [];
var allEquipment = [];
var allTaskLists = [];
var INTERVALS = ['1wk', '2wk', '4wk', '8wk', '12wk', '14wk', '16wk'];

async function loadMappings() {
  var tbody = document.getElementById('mappingBody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="5"><div class="spinner"></div></td></tr>';
  try {
    allMappings = await apiGet('/equipment-mappings');
    renderMappings();
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">' + e.message + '</td></tr>';
  }
}

function renderMappings() {
  var tbody = document.getElementById('mappingBody');
  if (!allMappings.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Belum ada mapping</td></tr>';
    return;
  }
  tbody.innerHTML = allMappings.map(function(m) {
    return '<tr>' +
      '<td><strong>' + escHtml(m.equipmentId) + '</strong><br><span class="text-muted text-small">' + escHtml(m.equipmentName || '') + '</span></td>' +
      '<td><span class="badge badge-pending">' + escHtml(m.interval) + '</span></td>' +
      '<td>' + escHtml(m.taskListName || m.taskListId) + '</td>' +
      '<td>' + (m.activities ? m.activities.length : 0) + ' aktivitas</td>' +
      '<td><button class="btn btn-danger btn-sm" onclick="deleteMapping(' + m.id + ')">Hapus</button></td>' +
      '</tr>';
  }).join('');
}

async function openCreate() {
  document.getElementById('panelTitle').textContent = 'Tambah Mapping';
  try {
    var results = await Promise.all([apiGet('/equipment?limit=9999'), apiGet('/task-lists')]);
    allEquipment = results[0].data || results[0];
    allTaskLists = results[1];
  } catch (e) {
    showMessage('Gagal memuat data: ' + e.message, 'error');
    return;
  }
  var eqOptions = allEquipment.map(function(e) {
    return '<option value="' + escHtml(e.equipmentId) + '">' + escHtml(e.equipmentId) + ' -- ' + escHtml(e.equipmentName) + '</option>';
  }).join('');
  var tlOptions = allTaskLists.map(function(t) {
    return '<option value="' + escHtml(t.taskListId) + '">' + escHtml(t.taskListName) + ' (' + escHtml(t.taskListId) + ')</option>';
  }).join('');
  var ivOptions = INTERVALS.map(function(iv) { return '<option>' + iv + '</option>'; }).join('');
  document.getElementById('panelBody').innerHTML =
    '<div class="form-section"><div class="form-section__title">Mapping Baru</div>' +
    '<div class="form-group"><label>Equipment *</label><select id="f_equipmentId">' +
    '<option value="">-- Pilih Equipment --</option>' + eqOptions + '</select></div>' +
    '<div class="form-group"><label>Interval *</label><select id="f_interval">' + ivOptions + '</select></div>' +
    '<div class="form-group"><label>Task List *</label><select id="f_taskListId">' +
    '<option value="">-- Pilih Task List --</option>' + tlOptions + '</select></div></div>';
  openPanel();
}

async function saveMapping() {
  var equipmentId = document.getElementById('f_equipmentId').value;
  var interval    = document.getElementById('f_interval').value;
  var taskListId  = document.getElementById('f_taskListId').value;
  if (!equipmentId || !taskListId) { alert('Equipment dan Task List wajib dipilih.'); return; }
  try {
    await apiPost('/equipment-mappings', { equipmentId: equipmentId, interval: interval, taskListId: taskListId });
    showMessage('Mapping berhasil ditambahkan');
    closePanel();
    loadMappings();
  } catch (e) { showMessage(e.message, 'error'); }
}

async function deleteMapping(id) {
  if (!window.confirm('Hapus mapping ini?')) return;
  try {
    await apiDelete('/equipment-mappings/' + id);
    showMessage('Mapping dihapus');
    loadMappings();
  } catch (e) { showMessage(e.message, 'error'); }
}

loadMappings();
```

- [ ] **Step 3: Verify page and CRUD work**

Start server, open `http://localhost:3000/pages/equipment-mappings.html`. After seed, table shows 9 rows. Create and delete mappings work.

- [ ] **Step 4: Commit**

```bash
git add public/pages/equipment-mappings.html public/js/equipment-mappings.js
git commit -m "feat: add equipment-interval mapping admin page"
```

---

## Task 5: Sidebar Link in All Existing Pages

**Files:** `public/index.html`, `public/pages/spk.html`, `public/pages/lembar-kerja.html`, `public/pages/equipment.html`, `public/pages/maps.html`, `public/pages/users.html`, `public/pages/submissions.html`

- [ ] **Step 1: In each file, insert the Task Mapping nav-item**

After the Users nav-item (ends with `<span>Users</span></a>`) and before the next `sidebar__divider`, insert:
```html
    <a href="/pages/equipment-mappings.html" class="nav-item"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg><span>Task Mapping</span></a>
```

No `active` class — these are not the mapping page.

- [ ] **Step 2: Commit**

```bash
git add public/index.html public/pages/spk.html public/pages/lembar-kerja.html public/pages/equipment.html public/pages/maps.html public/pages/users.html public/pages/submissions.html
git commit -m "feat: add Task Mapping sidebar link to all pages"
```

---

## Task 6: SPK Form Auto-Populate

**Files:**
- Modify: `public/js/spk.js`

- [ ] **Step 1: Add `availableMappings` global after `availableEquipment` (line 3)**

```js
let availableMappings = [];
```

- [ ] **Step 2: Add `loadMappings` function after `loadEquipmentList`**

```js
async function loadMappings() {
  try {
    availableMappings = await apiGet('/equipment-mappings');
  } catch { availableMappings = []; }
}
```

- [ ] **Step 3: Load mappings in parallel when panels open**

Replace `openCreate`:
```js
async function openCreate() {
  editingSpkNumber = null;
  document.getElementById('panelTitle').textContent = 'Tambah SPK';
  await Promise.all([loadEquipmentList(), loadMappings()]);
  renderPanelForm(null);
  openPanel();
}
```

Replace `openEdit`:
```js
async function openEdit(spkNumber) {
  editingSpkNumber = spkNumber;
  document.getElementById('panelTitle').textContent = 'Edit SPK';
  await Promise.all([loadEquipmentList(), loadMappings()]);
  var spk = allSpk.find(function(s) { return s.spkNumber === spkNumber; });
  renderPanelForm(spk);
  openPanel();
}
```

- [ ] **Step 4: Add auto-populate block in `renderActivitySections`**

Inside `renderActivitySections`, after `checkedEqs` is defined and after the early-return block for empty `checkedEqs`, insert BEFORE the `container.innerHTML = ...` line:

```js
  // Auto-populate from mappings in create mode only, for equipment with no activities yet
  if (!editingSpkNumber) {
    var intervalEl = document.getElementById('f_interval');
    var currentInterval = intervalEl ? intervalEl.value : null;
    if (currentInterval) {
      checkedEqs.forEach(function(eq) {
        var hasActs = acts.some(function(a) { return a.equipmentId === eq.equipmentId; });
        if (!hasActs) {
          var mapping = availableMappings.find(function(m) {
            return m.equipmentId === eq.equipmentId && m.interval === currentInterval;
          });
          if (mapping) {
            (mapping.activities || []).forEach(function(step) {
              acts.push({
                equipmentId: eq.equipmentId,
                operationText: step.operationText,
                durationPlan: 0.5,
                resultComment: null,
                durationActual: null,
                isVerified: false,
              });
            });
          }
        }
      });
    }
  }
```

- [ ] **Step 5: Verify end-to-end**

1. `npm run seed`
2. Start server, open SPK page
3. Click "Tambah SPK", set Interval to `4wk`
4. Check equipment `2210000438` (Pompa Intake Cidanau 1M1)
5. Expected: activity section auto-fills with 5 rows from KTI_0001
6. Check `2210000605` (Sensor AWLR, no 4wk mapping): expected empty section
7. Open Edit on existing SPK: existing activities preserved, no auto-populate

- [ ] **Step 6: Commit**

```bash
git add public/js/spk.js
git commit -m "feat: auto-populate SPK activities from equipment-interval task list mapping"
```
