import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',testMatch:'*.spec.mjs',fullyParallel:false,workers:1,
 timeout:30000,expect:{timeout:7000},
 outputDir:'./evidence/frontend-tests/artifacts',
 reporter:[['list'],['json',{outputFile:'./evidence/frontend-tests/results.json'}]],
 use:{browserName:'chromium',channel:'chromium',headless:true,viewport:{width:1600,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
});
