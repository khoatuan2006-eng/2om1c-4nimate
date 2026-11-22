import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storageError} from './storage-error.mjs';
test('storage classification covers filesystem and extended SQLite failures without exposing paths',()=>{
 for(const code of ['ENOSPC','EDQUOT','SQLITE_FULL'])assert.equal(storageError({code,message:'secret/path'}).code,'STORAGE_FULL');
 for(const code of ['EROFS','EACCES','EPERM','SQLITE_READONLY'])assert.equal(storageError({code}).code,'STORAGE_READONLY');
 for(const code of ['EIO','SQLITE_IOERR'])assert.equal(storageError({code}).code,'STORAGE_IO_ERROR');
 for(const [errcode,expected] of [[13,'STORAGE_FULL'],[8+256,'STORAGE_READONLY'],[10+256,'STORAGE_IO_ERROR']]){
  const result=storageError({code:'ERR_SQLITE_ERROR',errcode,message:'secret/path'});assert.equal(result.code,expected);assert.ok(!result.error.includes('secret/path'));
 }
 assert.equal(storageError({status:409,code:'SCENE_LOCKED'}),null);
 assert.equal(storageError({status:409,code:'REVISION_CONFLICT'}),null);
 assert.equal(storageError({code:'ENOENT'}),null);
});
