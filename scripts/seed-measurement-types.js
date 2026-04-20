'use strict';

/**
 * Seed measurementType + measurementUnit onto GeneralTaskListActivity rows.
 *
 * Usage:
 *   node scripts/seed-measurement-types.js          # dry run — preview only
 *   node scripts/seed-measurement-types.js --apply  # commit to DB
 */

require('../src/models/associations');
const { GeneralTaskList, GeneralTaskListActivity } = require('../src/models/GeneralTaskList');
const { SpkActivity } = require('../src/models/Spk');
const {
  ensureGeneralTaskListActivitySchema,
  ensureSpkActivitySchema,
} = require('../src/models/ensureMeasurementSchema');

// ── KTI indicator reference (from Indikator Pengukuran.xlsx) ─────────────────
const KTI_INDICATORS = {
  KTI_TEMP:     { label: 'Temperature',  unit: '°C'   },
  KTI_VIBR:     { label: 'Vibrasi',      unit: 'mm/s' },
  KTI_PRESSURE: { label: 'Pressure',     unit: 'bar'  },
  KTI_AMP:      { label: 'Arus Listrik', unit: 'A'    },
  KTI_FLOW:     { label: 'Flow',         unit: 'm3/h' },
  KTI_PH:       { label: 'pH',           unit: 'pH'   },
  KTI_TURBID:   { label: 'Turbidity',    unit: 'NTU'  },
  KTI_VAC:      { label: 'Tegangan AC',  unit: 'V'    },
  KTI_LEVEL:    { label: 'Level',        unit: '%'    },
  KTI_DESIBLE:  { label: 'Kebisingan',   unit: 'dB(A)'},
};

// ── Keyword rules (most-specific first) ──────────────────────────────────────
// label: override display label (null = use KTI_INDICATORS[indicator].label)
// requireMeasureWord: true = operationText must also contain ukur/catat/nilai/record/measure
const RULES = [
  { patterns: ['vib nde', 'vibrasi nde', 'vibration nde'], indicator: 'KTI_VIBR',     label: 'Vib NDE', requireMeasureWord: false },
  { patterns: ['vib de',  'vibrasi de',  'vibration de'],  indicator: 'KTI_VIBR',     label: 'Vib DE',  requireMeasureWord: false },
  { patterns: ['vibrasi', 'vibration'],                    indicator: 'KTI_VIBR',     label: null,      requireMeasureWord: true  },
  { patterns: ['temperatur', 'temperature', 'suhu'],        indicator: 'KTI_TEMP',     label: null,      requireMeasureWord: false },
  { patterns: ['tekanan', 'pressure'],                     indicator: 'KTI_PRESSURE', label: null,      requireMeasureWord: false },
  { patterns: ['arus listrik', 'ampere', 'arus'],          indicator: 'KTI_AMP',      label: null,      requireMeasureWord: false },
  { patterns: ['debit', 'aliran', 'flow'],                 indicator: 'KTI_FLOW',     label: null,      requireMeasureWord: true  },
  { patterns: ['keasaman'],                                indicator: 'KTI_PH',       label: null,      requireMeasureWord: false },
  { patterns: [' ph '],                                    indicator: 'KTI_PH',       label: null,      requireMeasureWord: true  },
  { patterns: ['turbid', 'kekeruhan'],                     indicator: 'KTI_TURBID',   label: null,      requireMeasureWord: true  },
  { patterns: ['tegangan', 'voltage'],                     indicator: 'KTI_VAC',      label: null,      requireMeasureWord: true  },
  { patterns: ['ketinggian'],                              indicator: 'KTI_LEVEL',    label: null,      requireMeasureWord: false },
  { patterns: ['level'],                                   indicator: 'KTI_LEVEL',    label: null,      requireMeasureWord: true  },
  { patterns: ['kebisingan', 'desibel', 'noise'],          indicator: 'KTI_DESIBLE',  label: null,      requireMeasureWord: false },
];

const MEASURE_WORDS = ['ukur', 'catat', 'nilai', 'record', 'measure', 'baca', 'cek &', 'cek dan'];

function hasMeasureWord(lower) {
  return MEASURE_WORDS.some(w => lower.includes(w));
}

function matchRule(operationText) {
  const lower = ` ${operationText.toLowerCase()} `;
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (lower.includes(pattern.toLowerCase())) {
        if (rule.requireMeasureWord && !hasMeasureWord(lower)) continue;
        return rule;
      }
    }
  }
  return null;
}

async function main() {
  const apply = process.argv.includes('--apply');

  await ensureGeneralTaskListActivitySchema();
  await ensureSpkActivitySchema();

  const taskLists = await GeneralTaskList.findAll({
    include: [{ model: GeneralTaskListActivity, as: 'activities', order: [['stepNumber', 'ASC']] }],
    order: [['taskListId', 'ASC']],
  });

  const pending = [];
  let alreadySet = 0;
  let noMatch = 0;

  for (const tl of taskLists) {
    for (const act of tl.activities) {
      if (act.measurementType) { alreadySet++; continue; }
      const rule = matchRule(act.operationText);
      if (!rule) { noMatch++; continue; }
      const indicator = KTI_INDICATORS[rule.indicator];
      const measurementType = rule.label ?? indicator.label;
      const measurementUnit = indicator.unit;
      pending.push({ act, tl, measurementType, measurementUnit });
    }
  }

  // ── Also scan existing SpkActivity rows ──────────────────────────────────
  const spkActivities = await SpkActivity.findAll({ where: { measurementType: null } });
  const spkPending = [];
  let spkAlreadySet = 0;
  let spkNoMatch = 0;

  for (const act of spkActivities) {
    if (act.measurementType) { spkAlreadySet++; continue; }
    const rule = matchRule(act.operationText);
    if (!rule) { spkNoMatch++; continue; }
    const indicator = KTI_INDICATORS[rule.indicator];
    spkPending.push({
      act,
      measurementType: rule.label ?? indicator.label,
      measurementUnit: indicator.unit,
    });
  }

  // ── Print preview ─────────────────────────────────────────────────────────
  console.log(`\n${apply ? '✅ APPLYING' : '🔍 DRY RUN — pass --apply to commit'}\n`);

  function printTable(label, rows, labelFn) {
    if (rows.length === 0) { console.log(`${label}: none`); return; }
    console.log(`${label}:`);
    console.log('─'.repeat(90));
    for (const row of rows) {
      const op = row.act.operationText;
      const opShort = op.length > 45 ? op.slice(0, 42) + '...' : op.padEnd(45);
      console.log(`${labelFn(row)} ${opShort} → ${row.measurementType} (${row.measurementUnit})`);
    }
    console.log('─'.repeat(90));
  }

  printTable(
    'Task list activities to update',
    pending,
    ({ tl, act }) => `[${tl.taskListId.padEnd(16)}] Step ${String(act.stepNumber).padStart(2)}:`,
  );

  console.log(`Summary (task lists): ${pending.length} to update | ${alreadySet} already set | ${noMatch} no match`);

  printTable(
    '\nSPK activities to update',
    spkPending,
    ({ act }) => `[${act.spkNumber.padEnd(16)}] Act  ${String(act.activityNumber).padStart(2)}:`,
  );

  console.log(`Summary (SPK):        ${spkPending.length} to update | ${spkAlreadySet} already set | ${spkNoMatch} no match`);

  if (!apply) {
    console.log('\nRun with --apply to commit these changes.\n');
    process.exit(0);
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  let updated = 0;
  for (const { act, measurementType, measurementUnit } of pending) {
    await GeneralTaskListActivity.update(
      { measurementType, measurementUnit },
      { where: { id: act.id } }
    );
    updated++;
  }
  for (const { act, measurementType, measurementUnit } of spkPending) {
    await SpkActivity.update(
      { measurementType, measurementUnit },
      { where: { id: act.id } }
    );
    updated++;
  }

  console.log(`\nDone. ${updated} rows updated.\n`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
