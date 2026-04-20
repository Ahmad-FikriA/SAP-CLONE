'use strict';

require('../src/models/associations');
const { GeneralTaskList, GeneralTaskListActivity } = require('../src/models/GeneralTaskList');

async function main() {
  const rows = await GeneralTaskList.findAll({
    include: [{ model: GeneralTaskListActivity, as: 'activities', order: [['stepNumber', 'ASC']] }],
    order: [['taskListId', 'ASC']],
  });

  for (const tl of rows) {
    console.log(`\n=== [${tl.taskListId}] ${tl.taskListName} (${tl.category}) ===`);
    for (const act of tl.activities) {
      const meas = act.measurementType ? ` → ${act.measurementType} (${act.measurementUnit ?? '?'})` : '';
      console.log(`  Step ${act.stepNumber}: ${act.operationText}${meas}`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
