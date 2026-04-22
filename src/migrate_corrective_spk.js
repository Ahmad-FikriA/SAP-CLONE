'use strict';

// Migration is obsolete because we dropped the tables and rebuilt sap_spk_corrective
async function migrateCorrective() {
  console.log('Skipping Corrective Maintenance Schema Migration...');
  process.exit(0);
}

migrateCorrective();
