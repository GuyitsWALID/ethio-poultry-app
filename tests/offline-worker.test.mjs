import assert from 'node:assert/strict';
import test from 'node:test';
import {offlineWorkerFailed,reportOfflineWorkerFailure,reportOfflineWorkerReady} from '../src/lib/today-workspace/offline-worker.ts';

test('worker failures remain visible to a later-mounted workspace until activation recovers',()=>{
 reportOfflineWorkerReady();assert.equal(offlineWorkerFailed(),false);
 reportOfflineWorkerFailure();assert.equal(offlineWorkerFailed(),true);
 reportOfflineWorkerReady();assert.equal(offlineWorkerFailed(),false);
});
