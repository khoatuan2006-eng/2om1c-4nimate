import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {storyHash} from './story-chain.mjs';
import {createStaticMediaValues,UNKNOWN_MEDIA_VALUE} from './static-media-values.mjs';
const require=createRequire(resolve(import.meta.dirname,'../../motion_intro/package.json'));
// Recovery/launcher validation imports ProjectStore too. Do not make those
// paths load the compiler until a fingerprint actually needs source analysis.
let parseSource,visitAst;
const parse=(...args)=>(parseSource??=require('@babel/parser').parse)(...args);
const traverse=(...args)=>(visitAst??=require('@babel/traverse').default)(...args);
// These exact, reviewed adapters establish: selected registry routing, metadata
// installed from the saved project, scene-local withScene cache, and an explicit
// EditorContext document. Unknown adapter changes retain the full graph hash.
// Re-reviewed 2026-11-18: ProjectComposition gained a TransitionOverlay (document.transitions, drawn inside
// the scene's own frames) and Editable applies authored opacity; routing, metadata, cache and context are unchanged.
const adapters={
 'ProjectComposition.tsx':'98ec654164c52e00a4f24dec7d28f699afff9703d557c79f84f420ccb4647a84',
 'scenes.tsx':'ad11ea04c6788449eb3672ac355e8b87bb14e3a6bf5c1dbac2894216a3a2c8b8',
 'Editable.tsx':'16bbc71e6a4cbe23da4d4fd5d6c63003e4ad75ace7f7e62d3e10b98146d516b3',
};
const ignored=new Set(['start','end','loc','extra','leadingComments','trailingComments','innerComments','comments','tokens']);
const importLists=new Map();
export function staticCompositionImports(bytes,file){
 if(!/\.(tsx?|m?js|jsx)$/.test(file))return [];
 const key=file+':'+storyHash(bytes);if(importLists.has(key))return importLists.get(key);
 const ast=parse(bytes.toString('utf8'),{sourceType:'module',plugins:['typescript','jsx']}),imports=[];
 function walk(node){
  if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)imports.push(node.source.value);
  if(node.type==='ImportExpression'||node.type==='CallExpression'&&(node.callee.type==='Import'||node.callee.name==='require')){
   const value=node.source??node.arguments[0];if(value?.type!=='StringLiteral')throw Error('Dynamic composition dependency cannot be established: '+file);imports.push(value.value);
  }
  for(const [name,value] of Object.entries(node))if(!ignored.has(name)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
 }
 walk(ast);const result=[...new Set(imports.filter(s=>s.startsWith('.')))];
 if(importLists.size>=512)importLists.clear();importLists.set(key,result);return result;
}
function canonicalNode(node){
 if(Array.isArray(node))return node.map(canonicalNode);
 if(!node||typeof node!=='object')return node;
 return Object.fromEntries(Object.entries(node).filter(([key])=>!ignored.has(key)).map(([key,value])=>[key,canonicalNode(value)]));
}
// No execution, transpilation or substitute renderer: this only selects hashes
// from the actual source graph. A supplied graph also permits virtual edit tests.
export function scopedCompositionDependencies(graph,sceneIds,{directory=import.meta.dirname,onUnsupported=()=>{},onMediaReference=()=>{}}={}){
 const root=resolve(directory),at=name=>resolve(root,name),modules=new Map(),records=new Map(),selected=new Set(sceneIds),activeReferences=new WeakSet(),aliases=new Map(),importTargets=new Map(),programFiles=new WeakMap(),mediaPaths=[];
 if(Object.entries(adapters).some(([name,sha])=>storyHash(graph.get(at(name))??'')!==sha)){onUnsupported('Shared composition adapter changed');return null;}
 const modulePath=(file,source)=>{
  const target=resolve(dirname(file),source),found=['','.tsx','.ts','.mjs','.js','.json','.css'].map(s=>target+s).find(p=>graph.has(p));
  if(!found)throw Error('Unresolved scoped composition dependency: '+target);return found;
 };
 const put=(key,value)=>records.set(key,storyHash(canonicalNode(value)));
 const unknown=()=>[[null]],product=(a,b)=>a.length*b.length>64?unknown():a.flatMap(x=>b.map(y=>[...x,...y]));
 const readValues=createStaticMediaValues({activeReferences,aliases,jsonForBinding:b=>{
  const source=b.path.parent.source?.value;if(!source?.startsWith('.'))return UNKNOWN_MEDIA_VALUE;
  const file=programFiles.get(b.scope.getProgramParent().path.node),m=load(modulePath(file,source));return m.json?m.data:UNKNOWN_MEDIA_VALUE;
 },callableForImport:b=>{const target=importTargets.get(b);if(!target)return null;const p=target.path;return p.isFunctionDeclaration()?p:p.isVariableDeclarator()&&p.get('init').isFunction()?p.get('init'):null;}});
 function mediaPattern(file,path,seen=new Set(),depth=0){
  const n=path.node;if(!n||depth>20)return unknown();
  if(n.type==='StringLiteral')return [[n.value]];
  const values=readValues(path);if(values.length&&values.every(v=>typeof v==='string'))return values.map(v=>[v]);
  if(['TSAsExpression','TSNonNullExpression','TSTypeAssertion'].includes(n.type))return mediaPattern(file,path.get('expression'),seen,depth+1);
  if(n.type==='TemplateLiteral'){
   let parts=[[n.quasis[0].value.cooked??n.quasis[0].value.raw]];
   for(let i=0;i<n.expressions.length;i++)parts=product(product(parts,mediaPattern(file,path.get('expressions')[i],seen,depth+1)),[[n.quasis[i+1].value.cooked??n.quasis[i+1].value.raw]]);return parts;
  }
  if(n.type==='BinaryExpression'&&n.operator==='+')return product(mediaPattern(file,path.get('left'),seen,depth+1),mediaPattern(file,path.get('right'),seen,depth+1));
  if(n.type==='ConditionalExpression'){const values=[...mediaPattern(file,path.get('consequent'),seen,depth+1),...mediaPattern(file,path.get('alternate'),seen,depth+1)];return values.length>64?unknown():values;}
  if(n.type==='Identifier'){
   const b=path.scope.getBinding(n.name);if(!b||seen.has(b))return unknown();
   if(b.constant&&b.path.isVariableDeclarator())return mediaPattern(file,b.path.get('init'),new Set(seen).add(b),depth+1);
  }
  return unknown();
 }
 function load(file){
  if(modules.has(file))return modules.get(file);
  const bytes=graph.get(file);if(!bytes)throw Error('Missing scoped source: '+file);
  if(file.endsWith('.json')){const data=JSON.parse(bytes);const m={json:true,data:file===at('saved-edits.json')?{}:data};modules.set(file,m);return m;}
  if(!/\.(tsx?|m?js|jsx)$/.test(file)){const m={opaque:true};modules.set(file,m);put(file,bytes);return m;}
  const ast=parse(bytes.toString('utf8'),{sourceType:'module',plugins:['typescript','jsx']}),m={ast,exports:new Map(),done:new Set(),visiting:true};modules.set(file,m);
  if(ast.program.directives.length)put(file+'#directives',ast.program.directives);
  // Preserve import initialization order and external package side effects,
  // even when no imported binding is used by the selected component.
  put(file+'#module-imports',ast.program.body.filter(n=>n.type==='ImportDeclaration').map(n=>({source:n.source.value,kind:n.importKind,attributes:n.attributes??n.assertions})));
  // Specialize only the pinned dispatch adapter. Keep all shared function code.
  if(file===at('ProjectComposition.tsx')){
   let props=[];
   for(const statement of ast.program.body)if(statement.type==='VariableDeclaration')for(const d of statement.declarations)if(d.id.name==='components'){
    props=Array.isArray(d.init?.properties)?d.init.properties:[];
    m.registry=props.slice();
    if(Array.isArray(d.init?.properties))d.init.properties=props.filter(p=>selected.has(p.key.name??p.key.value));
   }
   const registered=new Set((m.registry??[]).map(p=>p.key.name??p.key.value)),allNative=sceneIds.length>0&&sceneIds.every(id=>registered.has(id)),allCreated=sceneIds.length>0&&sceneIds.every(id=>!registered.has(id));
   if(allNative||allCreated)traverse(ast,{ConditionalExpression(p){if(p.node.test.type==='MemberExpression'&&p.node.test.object.name==='components')p.replaceWith(allNative?p.node.consequent:p.node.alternate);}});
  }
  if(file===at('scenes.tsx'))for(const statement of ast.program.body){const d=statement.type==='ExportNamedDeclaration'?statement.declaration:statement;if(d?.type==='VariableDeclaration')for(const v of d.declarations)if(v.id.name==='sceneMeta')v.init={type:'ObjectExpression',properties:[]};}
  traverse(ast,{Program(p){m.program=p;p.stop();}});
  programFiles.set(ast.program,file);
  for(const statement of m.program.get('body')){
   const n=statement.node;
   if(n.type==='ExportAllDeclaration')throw Error('Unsupported export-all in scoped graph');
   if(n.type==='ExportDefaultDeclaration')m.exports.set('default',statement.get('declaration'));
   if(n.type==='ExportNamedDeclaration'){
    if(n.source)throw Error('Unsupported re-export in scoped graph');
    const decl=statement.get('declaration');
    if(decl.node?.type==='VariableDeclaration')for(const d of decl.get('declarations')){if(d.node.id.type!=='Identifier')throw Error('Unsupported exported binding');m.exports.set(d.node.id.name,d.node.id.name);}
    else if(decl.node?.id?.name)m.exports.set(decl.node.id.name,decl.node.id.name);
    for(const s of n.specifiers??[])m.exports.set(s.exported.name??s.exported.value,s.local.name);
   }
  }
  let effect=0;
  for(const statement of m.program.get('body')){
   const n=statement.node;
   if(n.type==='ImportDeclaration'){
    if(n.source.value.startsWith('.'))load(modulePath(file,n.source.value));
    if(!n.specifiers.length){put(file+'#effect'+effect++,n);if(n.source.value.startsWith('.'))include(modulePath(file,n.source.value),'*');}
    continue;
   }
   const decl=['ExportNamedDeclaration','ExportDefaultDeclaration'].includes(n.type)?statement.get('declaration'):statement;
   if(!decl.node||['FunctionDeclaration','ClassDeclaration','TSTypeAliasDeclaration','TSInterfaceDeclaration','ExportNamedDeclaration','ExportDefaultDeclaration','EmptyStatement'].includes(decl.node.type)){
    // Class initializers may execute code; retain the complete class and refs.
    if(decl.node?.type==='ClassDeclaration')includeNode(file,decl,'effect'+effect++);
    continue;
   }
   if(decl.node.type==='VariableDeclaration'){
    for(const d of decl.get('declarations')){
     let init=d.get('init');while(['TSAsExpression','TSTypeAssertion','TSNonNullExpression'].includes(init.node?.type))init=init.get('expression');
     const call=init.node,callee=call?.callee;
     const binding=callee?.type==='Identifier'?init.scope.getBinding(callee.name):null;
     const component=call?.arguments?.[1],componentBinding=component?.type==='Identifier'?init.scope.getBinding(component.name):null;
     const plainFunction=componentBinding?.path.isFunctionDeclaration()||componentBinding?.path.isVariableDeclarator()&&['ArrowFunctionExpression','FunctionExpression'].includes(componentBinding.path.node.init?.type);
     const sceneWrapper=call?.type==='CallExpression'&&callee.name==='withScene'&&binding?.path.isImportSpecifier()&&binding.path.node.imported.name==='withScene'&&binding.path.parent.source.value.startsWith('.')&&modulePath(file,binding.path.parent.source.value)===at('scenes.tsx')&&call.arguments.length===2&&call.arguments[0]?.type==='StringLiteral'&&plainFunction;
     if(init.node&&!init.isPure()&&!sceneWrapper)includeNode(file,d,'effect'+effect++);
    }
   }else includeNode(file,decl,'effect'+effect++);
  }
  m.visiting=false;return m;
 }
 function references(file,path){
  const m=modules.get(file);
  const ownedDocumentMedia=file===at('Editable.tsx')||file===at('CreatedScene.tsx')&&storyHash(graph.get(file))==='8b601aa6db2df2e47a53de40e5cf662bedbb058cb0eb05608e12fe33ea2cf8ca';
  const use=p=>{
   activeReferences.add(p.node);
   const b=p.scope.getBinding(p.node.name);
   if(b?.path.isImportSpecifier()&&b.path.parent.source.value==='remotion'&&b.path.node.imported.name==='staticFile'&&!ownedDocumentMedia){
    const call=p.parentPath;mediaPaths.push({file,path:call.isCallExpression()&&call.node.callee===p.node&&call.node.arguments.length===1?call.get('arguments')[0]:null});
   }
   if(b?.path.isImportNamespaceSpecifier()&&b.path.parent.source.value==='remotion')onMediaReference({file,patterns:unknown()});
   if(b&&b.scope===m.program.scope)includeBinding(file,p.node.name);
  };
  if(path.isReferencedIdentifier())use(path);
  path.traverse({Function(p){
   // A local inert helper with no references never contributes media, even
   // though its containing scene function is retained as a code dependency.
   const owner=p.parentPath,id=p.node.id?.name??(owner.isVariableDeclarator()&&owner.node.id.type==='Identifier'?owner.node.id.name:null),binding=id?(owner.isVariableDeclarator()?owner.scope.getBinding(id):p.scope.getBinding(id)):null;
   if(binding&&!binding.referencePaths.length&&p.node.type!=='ObjectMethod'&&p.node.type!=='ClassMethod')p.skip();
  },ReferencedIdentifier:use,JSXAttribute(p){
   if(ownedDocumentMedia||p.node.name.name!=='src')return;const opening=p.parentPath.node,name=opening.name?.name,b=p.scope.getBinding(name),media=['img','audio','video'].includes(name)||b?.path.isImportSpecifier()&&(b.path.parent.source.value==='remotion'&&['Img','Audio','Html5Audio','Video','Html5Video','OffthreadVideo'].includes(b.path.node.imported.name)||b.path.parent.source.value.startsWith('.')&&modulePath(file,b.path.parent.source.value)===at('Editable.tsx')&&b.path.node.imported.name==='EditImg');
   if(!media)return;const value=p.get('value'),expr=value.isJSXExpressionContainer()?value.get('expression'):value,callee=expr.node?.callee,fn=callee?.type==='Identifier'?expr.scope.getBinding(callee.name):null;
   if(!(expr.isCallExpression()&&fn?.path.isImportSpecifier()&&fn.path.parent.source.value==='remotion'&&fn.path.node.imported.name==='staticFile'))mediaPaths.push({file,path:expr});
  },ImportExpression(){throw Error('Dynamic module in scoped graph');},CallExpression(p){if(p.node.callee.type==='Import'||p.node.callee.name==='require')throw Error('Dynamic module in scoped graph');}});
 }
 function includeNode(file,path,label){put(file+'#'+label,path.node);references(file,path);}
 function includeBinding(file,name){
  const m=load(file);if(m.done.has(name))return;m.done.add(name);
  const b=m.program.scope.getBinding(name);if(!b)throw Error('Unresolved source binding: '+name);
  const p=b.path;put(file+'#binding:'+name,p.node);
  if(p.isImportSpecifier()||p.isImportDefaultSpecifier()||p.isImportNamespaceSpecifier()){
   const source=p.parent.source.value;put(file+'#import:'+name,{source,kind:p.parent.importKind,specifier:p.node});
   if(source.startsWith('.')){
    const targetFile=modulePath(file,source),name=p.isImportDefaultSpecifier()?'default':p.isImportNamespaceSpecifier()?'*':p.node.imported.name??p.node.imported.value,targetModule=load(targetFile),exported=targetModule.exports?.get(name),target=typeof exported==='string'?targetModule.program.scope.getBinding(exported):null;
    if(target){importTargets.set(b,target);if(!aliases.has(target))aliases.set(target,new Set());aliases.get(target).add(b);}
    include(targetFile,name);
   }
  }else references(file,p);
 }
 function include(file,name){
  const m=load(file);
  if(m.json){put(file,m.data);return;}
  if(m.opaque)return;
  if(name==='*'){for(const [key] of m.exports)include(file,key);return;}
  const target=m.exports.get(name);if(!target)throw Error('Missing composition export '+name+' in '+file);
  if(typeof target==='string')includeBinding(file,target);else includeNode(file,target,'default');
 }
 function validateRegistry(){
  const m=modules.get(at('ProjectComposition.tsx'));
  for(const property of m.registry??[]){
   const id=property.key.name??property.key.value,component=property.value.arguments?.[1],binding=component?.type==='Identifier'?m.program.scope.getBinding(component.name):null;
   if(!binding?.path.isImportSpecifier())throw Error('Unknown registry component');
   const path=binding.path,target=modulePath(at('ProjectComposition.tsx'),path.parent.source.value),source=load(target),name=source.exports.get(path.node.imported.name);
   const declaration=typeof name==='string'?source.program.scope.getBinding(name)?.path:null,init=declaration?.node.init;
   if(declaration?.isFunctionDeclaration()||['ArrowFunctionExpression','FunctionExpression'].includes(init?.type))continue;
   const callee=init?.callee,wrapper=callee?.type==='Identifier'?source.program.scope.getBinding(callee.name):null,arg=init?.arguments?.[1],fn=arg?.type==='Identifier'?source.program.scope.getBinding(arg.name)?.path:null;
   if(init?.type!=='CallExpression'||init.arguments.length!==2||init.arguments[0]?.value!==id||!wrapper?.path.isImportSpecifier()||wrapper.path.node.imported.name!=='withScene'||modulePath(target,wrapper.path.parent.source.value)!==at('scenes.tsx')||!(fn?.isFunctionDeclaration()||fn?.isVariableDeclarator()&&['ArrowFunctionExpression','FunctionExpression'].includes(fn.node.init?.type)))throw Error('Unknown registry initializer; retain full composition graph');
  }
 }
 try{
  load(at('export-entry.tsx'));
  validateRegistry();
  for(const {file,path} of mediaPaths)onMediaReference({file,patterns:path?mediaPattern(file,path):unknown(),required:path?.isStringLiteral()===true});
  // The entry has a top-level registerRoot effect whose reference closure leads
  // to FilmComposition and the selected registry. Every module's other effects
  // are retained too, including those from otherwise-unused imports.
  return [...records].sort(([a],[b])=>a.localeCompare(b));
 }catch(error){onUnsupported(error.message);return null;}
}
