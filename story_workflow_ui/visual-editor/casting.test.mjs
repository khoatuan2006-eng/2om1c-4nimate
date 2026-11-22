import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument,setValue} from './model.mjs';
test('casting survives scene serialization and transform edits; refuses external and escaping image sources',()=>{
 const doc={version:1,revision:2,layers:{'S01/shot-0/hero':{base:{x:42},keys:{}}},casting:{characterId:'film/psd-1761027148569',images:{hero:{src:'images/cast-'+'a'.repeat(64)+'.png',pose:'站立',face:'无表情'},head:{hidden:true}}}};
 assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc)),1506),doc);
 const edited={...doc,layers:{...doc.layers,'S01/shot-0/hero':setValue(doc.layers['S01/shot-0/hero'],10,{y:20},true)}};
 assert.deepEqual(validateDocument(edited,1506).casting,doc.casting);
 for(const src of ['https://example.com/hero.png','../hero.png','images/hero.png'])assert.throws(()=>validateDocument({...doc,casting:{images:{hero:{src}}}},1506));
});
