import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PsdArchiveIndex,cleanPsdName,guessPsdType} from './psd-archive.mjs';

test('PsdArchiveIndex scans nested PSD directories and searches via Vietnamese, English and Chinese queries',()=>{
  const dir=mkdtempSync(join(tmpdir(),'psd-archive-test-'));
  let idx;
  try{
    const root=join(dir,'oss');
    mkdirSync(join(root,'20251020'),{recursive:true});
    mkdirSync(join(root,'20251022'),{recursive:true});
    writeFileSync(join(root,'20251020','一刀斩劈山_1760972119483.psd'),'mock-psd-1');
    writeFileSync(join(root,'20251020','红发香克斯海贼_1760972119484.psd'),'mock-psd-2');
    writeFileSync(join(root,'20251022','夜晚港口甲板背景_1760972119485.psd'),'mock-psd-3');
    writeFileSync(join(root,'20251022','古书卷轴_1760972119486.psd'),'mock-psd-4');

    assert.equal(cleanPsdName('一刀斩劈山_1760972119483.psd'),'一刀斩劈山');
    assert.equal(guessPsdType('一刀斩劈山'),'effects');
    assert.equal(guessPsdType('夜晚港口甲板背景'),'backgrounds');
    assert.equal(guessPsdType('古书卷轴'),'props');

    idx=new PsdArchiveIndex(join(dir,'psd-archive.sqlite'),{rootDir:root});
    const scan=idx.scan();
    assert.equal(scan.scanned,4);
    assert.equal(idx.count(),4);

    // Search in Vietnamese (with and without diacritics)
    const pirate=idx.search('hai tac');
    assert.equal(pirate.total,1);
    assert.equal(pirate.items[0].name,'红发香克斯海贼');

    const slash=idx.search('chém',{type:'effects'});
    assert.equal(slash.total,1);
    assert.equal(slash.items[0].name,'一刀斩劈山');

    const book=idx.search('sách');
    assert.equal(book.total,1);
    assert.equal(book.items[0].guessedType,'props');

    // Marking extracted persists across re-scan
    idx.markExtracted(pirate.items[0].id,pirate.items[0].id);
    idx.scan();
    const after=idx.search('hai tac');
    assert.equal(after.items[0].extractedCatalogId,'import/'+pirate.items[0].id);
  }finally{
    if(idx)idx.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
