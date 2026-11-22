// Bounded abstract values for media paths. This never runs application code.
// Unsupported syntax/callers become UNKNOWN, preserving a broad dependency.
export const UNKNOWN_MEDIA_VALUE=Symbol('unknown-media-value');
export function createStaticMediaValues({jsonForBinding,aliases,activeReferences,callableForImport}){
 const U=UNKNOWN_MEDIA_VALUE,limit=96;
 const union=values=>{const out=[...new Set(values.flat())];return out.includes(U)||out.length>limit?[U]:out;};
 const array=items=>({items}),record=fields=>({fields});
 const domain=value=>typeof value==='function'?value():value;
 const jsonShapes=new WeakMap();
 function fromJSON(value){if(!value||typeof value!=='object')return value;if(jsonShapes.has(value))return jsonShapes.get(value);const shape=Array.isArray(value)?array([]):record(new Map());jsonShapes.set(value,shape);if(shape.items)shape.items=value.map(v=>[fromJSON(v)]);else for(const [key,v] of Object.entries(value))shape.fields.set(key,[fromJSON(v)]);return shape;}
 function property(values,keys,optional=false){return union(values.flatMap(v=>{
  if(v===U||keys.includes(U)){
   if(v?.fields&&!keys.every(k=>k!==U))return [...v.fields.values()].map(domain).concat([[undefined]]);
   if(v?.items&&!keys.every(k=>k!==U))return [...v.items,[undefined]];
   return [[U]];
  }
  if(v==null)return optional?[[undefined]]:[];
  return keys.map(k=>v.fields?domain(v.fields.get(String(k)))??[undefined]:v.items?(k==='length'?[v.unknownLength?U:v.items.length]:v.items[Number(k)]??[undefined]):typeof v==='string'&&k==='length'?[v.length]:[U]);
 }));}
 function functionPath(path){
  if(!path?.node)return null;if(path.isFunction())return path;
  if(!path.isIdentifier())return null;const b=path.scope.getBinding(path.node.name);if(!b)return null;
  const p=b.path;if(p.isFunctionDeclaration())return p;if(p.isVariableDeclarator()&&p.get('init').isFunction())return p.get('init');
  return callableForImport?.(b)??null;
 }
 function refs(binding,seen=new Set()){
  if(seen.has(binding))return [];seen.add(binding);
  return [...binding.referencePaths.filter(p=>activeReferences.has(p.node)),...[...(aliases.get(binding)??[])].flatMap(b=>refs(b,seen))];
 }
 function choose(pattern,name,values,ctx){
  if(!pattern?.node)return null;const n=pattern.node;
  if(n.type==='Identifier')return n.name===name?values:null;
  if(n.type==='AssignmentPattern')return choose(pattern.get('left'),name,union(values.map(v=>v===undefined?read(pattern.get('right'),ctx):[v])),ctx);
  if(n.type==='ObjectPattern')for(const p of pattern.get('properties')){
   if(p.isRestElement()){if(p.node.argument.name===name)return [U];continue;}
   const key=p.node.computed?read(p.get('key'),ctx):[p.node.key.name??p.node.key.value],found=choose(p.get('value'),name,property(values,key),ctx);if(found!==null)return found;
  }
  if(n.type==='ArrayPattern')for(const [index,p] of pattern.get('elements').entries()){const found=choose(p,name,property(values,[index]),ctx);if(found!==null)return found;}
  return null;
 }
 function callbackArguments(call,ctx){
  const c=call.node.callee;if(c.type!=='MemberExpression'||c.computed)return null;
  const method=c.property.name;
  if(c.object.type==='Identifier'&&c.object.name==='Array'&&method==='from'){
   const src=read(call.get('arguments')[0],ctx),items=[];for(const v of src){if(v===U)return [[U],[U]];if(v?.items)items.push(...v.items);else{const n=domain(v?.fields?.get('length'));if(!n||n.length!==1||!Number.isInteger(n[0])||n[0]<0||n[0]>limit)return [[U],[U]];items.push(...Array.from({length:n[0]},()=>[undefined]));}}
   return [union(items),items.map((_,i)=>i)];
  }
  if(!['map','flatMap','filter','find','findIndex','forEach','sort'].includes(method))return null;
  const values=read(call.get('callee').get('object'),ctx),items=[];for(const v of values){if(!v?.items)return [[U],[U]];items.push(...v.items);}
  return method==='sort'?[union(items),union(items)]:[union(items),items.map((_,i)=>i)];
 }
 function callerArguments(ref,ctx){
  const parent=ref.parentPath;
  if(parent.isCallExpression()){
   if(parent.node.callee===ref.node){if(parent.node.arguments.some(a=>a.type==='SpreadElement'))return null;return parent.get('arguments').map(p=>read(p,ctx));}
   return callbackArguments(parent,ctx);
  }
  const opening=parent.isJSXOpeningElement()?parent:parent.isJSXClosingElement()?parent.parentPath.get('openingElement'):null;
  if(opening){const fields=new Map();for(const a of opening.get('attributes')){if(a.isJSXSpreadAttribute())return [[U]];const v=a.get('value');fields.set(a.node.name.name,()=>!v.node?[true]:v.isJSXExpressionContainer()?read(v.get('expression'),ctx):read(v,ctx));}return [[record(fields)]];}
  return null;
 }
 function parameter(binding,ctx){
  const fn=binding.scope.path;if(!fn.isFunction())return [U];
  const parent=fn.parentPath;
  let sources=[];
  if(parent.isCallExpression()&&parent.node.arguments.includes(fn.node))sources=[callbackArguments(parent,ctx)];
  else{
   const id=fn.node.id?.name??(parent.isVariableDeclarator()?parent.node.id.name:null),owner=id?(parent.isVariableDeclarator()?parent.scope.getBinding(id):fn.scope.getBinding(id)):null;
   if(!owner)return [U];sources=refs(owner).map(ref=>callerArguments(ref,ctx));
  }
  if(!sources.length)return [U];const values=[];
  for(const args of sources){if(!args)return [U];let matched=false;for(const [i,p] of fn.get('params').entries()){const found=choose(p,binding.identifier.name,args[i]??[undefined],ctx);if(found!==null){values.push(found);matched=true;break;}}if(!matched)return [U];}
  return union(values);
 }
 function returns(fn,args,ctx){
  if(!fn)return [U];const env=new Map(ctx.env);for(const [i,p] of fn.get('params').entries()){
   const names=Object.keys(p.getBindingIdentifiers());for(const name of names){const b=fn.scope.getBinding(name);env.set(b,choose(p,name,args[i]??[undefined],ctx)??[U]);}
  }
  const next={...ctx,env,depth:ctx.depth+1};if(fn.get('body').isExpression())return read(fn.get('body'),next);
  const values=[];fn.get('body').traverse({ReturnStatement(p){if(p.getFunctionParent()===fn)values.push(p.node.argument?read(p.get('argument'),next):[undefined]);}});return values.length?union(values):[undefined];
 }
 function call(path,ctx){
  const c=path.node.callee,args=path.get('arguments');if(path.node.arguments.some(a=>a.type==='SpreadElement'))return [U];
  const binding=c.type==='Identifier'?path.scope.getBinding(c.name):null;
  if(binding?.path.isImportSpecifier()&&binding.path.parent.source.value==='remotion'&&binding.path.node.imported.name==='staticFile')return args.length===1?read(args[0],ctx):[U];
  if(c.type==='MemberExpression'&&!c.computed){
   const method=c.property.name,object=path.get('callee').get('object');
   if(object.isIdentifier({name:'Object'})&&['keys','values','entries'].includes(method)){
    const out=[];for(const v of read(args[0],ctx)){if(!v?.fields)return [U];const entries=[...v.fields];out.push(array(entries.map(([k,value])=>method==='keys'?[k]:method==='values'?domain(value):[array([[k],domain(value)])])));}return out;
   }
   if(object.isIdentifier({name:'Array'})&&method==='from'){
    const src=read(args[0],ctx),out=[];for(const v of src){let items=v?.items;if(!items){const length=domain(v?.fields?.get('length'));if(!length||length.length!==1||!Number.isInteger(length[0])||length[0]<0||length[0]>limit)return [U];items=Array.from({length:length[0]},()=>[undefined]);}const fn=args[1]?functionPath(args[1]):null;out.push(array(fn?items.map((d,i)=>returns(fn,[d,[i]],ctx)):items));}return out;
   }
   const values=read(object,ctx);if(!values.length)return [];
   if(values.every(v=>v?.items)){
    if(method==='reverse')return values.map(v=>({...v,items:[...v.items].reverse()}));
    if(['sort','slice','filter','toSorted'].includes(method))return values.map(v=>({...v,items:v.items.map(()=>union(v.items)),unknownLength:v.unknownLength||['slice','filter'].includes(method)}));
    if(method==='find')return union(values.flatMap(v=>[...v.items,[undefined]]));
    if(method==='map'){const fn=functionPath(args[0]);return fn?values.map(v=>array(v.items.map((d,i)=>returns(fn,[d,[i]],ctx)))):[U];}
    if(method==='join'){const sep=args[0]?read(args[0],ctx):[','];if(sep.length!==1||typeof sep[0]!=='string')return [U];let parts=[''];for(const v of values){for(const [i,d] of v.items.entries()){if(d.some(x=>x===U||x&&typeof x==='object'))return [U];parts=union(parts.flatMap(prefix=>d.map(x=>prefix+(i?sep[0]:'')+String(x))));}}return parts;}
   }
   if(values.every(v=>typeof v==='string')&&['slice','substring','split','trim','toLowerCase','toUpperCase','startsWith','endsWith','includes','replace','replaceAll'].includes(method)){
    const domains=args.map(p=>read(p,ctx));if(domains.some(d=>d.length!==1||d[0]===U||d[0]&&typeof d[0]==='object'))return [U];const out=values.map(v=>v[method](...domains.map(d=>d[0])));return out.map(v=>Array.isArray(v)?array(v.map(x=>[x])):v);
   }
  }
  const fn=functionPath(path.get('callee'));return fn?returns(fn,args.map(p=>read(p,ctx)),ctx):[U];
 }
 function read(path,ctx){
  if(!path?.node||ctx.depth>32||++ctx.budget.count>12000)return [U];const n=path.node,next={...ctx,depth:ctx.depth+1};
  if(['StringLiteral','NumericLiteral','BooleanLiteral'].includes(n.type))return [n.value];if(n.type==='NullLiteral')return [null];
  if(['TSAsExpression','TSNonNullExpression','TSTypeAssertion','ParenthesizedExpression'].includes(n.type))return read(path.get('expression'),next);
  if(n.type==='Identifier'){
   const b=path.scope.getBinding(n.name);if(!b)return n.name==='undefined'?[undefined]:[U];if(ctx.env.has(b))return ctx.env.get(b);if(ctx.seen.has(b))return [U];const seen=new Set(ctx.seen).add(b),nested={...next,seen};
   if(b.kind==='param')return parameter(b,nested);
   if(b.path.isImportDefaultSpecifier()){const json=jsonForBinding(b);return json===U?[U]:[fromJSON(json)];}
   if(b.constant&&b.path.isVariableDeclarator()){
    // A const reference does not make its object immutable. Avoid narrowing
    // after property writes or calls that may mutate/escape the value.
    if(b.referencePaths.some(ref=>{const p=ref.parentPath;if(!p.isMemberExpression())return false;const owner=p.parentPath;return owner.isAssignmentExpression()&&owner.node.left===p.node||owner.isUpdateExpression()||owner.isCallExpression()&&owner.node.callee===p.node&&(!['map','flatMap','filter','find','findIndex','forEach','sort','slice','reverse','toSorted','join','includes','startsWith','endsWith','substring','split','trim','toLowerCase','toUpperCase'].includes(p.node.property.name)||['sort','reverse'].includes(p.node.property.name)&&(b.referencePaths.length>1||owner.parentPath.isExpressionStatement()));}))return [U];
    if(b.path.node.init){const values=read(b.path.get('init'),nested);if(values.some(v=>v?.fields||v?.items)&&b.referencePaths.some(ref=>{const p=ref.parentPath;return p.isCallExpression()&&p.node.callee!==ref.node||p.isVariableDeclarator()&&p.node.init===ref.node;}))return [U];return values;}
    const loop=b.path.parentPath.parentPath;if(loop?.isForOfStatement()){const items=[];for(const v of read(loop.get('right'),nested)){if(!v?.items)return [U];items.push(...v.items);}return choose(b.path.get('id'),b.identifier.name,union(items),nested)??[U];}
   }return [U];
  }
  if(n.type==='ArrayExpression')return n.elements.some(e=>e?.type==='SpreadElement')?[U]:[array(path.get('elements').map(p=>p.node?read(p,next):[undefined]))];
  if(n.type==='ObjectExpression'){const fields=new Map();for(const p of path.get('properties')){if(!p.isObjectProperty()||p.node.computed)return [U];fields.set(p.node.key.name??String(p.node.key.value),()=>read(p.get('value'),next));}return [record(fields)];}
  if(['MemberExpression','OptionalMemberExpression'].includes(n.type))return property(read(path.get('object'),next),n.computed?read(path.get('property'),next):[n.property.name],n.optional);
  if(n.type==='ConditionalExpression')return union([read(path.get('consequent'),next),read(path.get('alternate'),next)]);
  if(n.type==='LogicalExpression'){const left=read(path.get('left'),next);if(left.includes(U))return [U];return union(left.map(v=>n.operator==='??'?(v==null?read(path.get('right'),next):[v]):n.operator==='||'?(v?[v]:read(path.get('right'),next)):(v?read(path.get('right'),next):[v])));}
  if(n.type==='TemplateLiteral'){let out=[n.quasis[0].value.cooked??n.quasis[0].value.raw];for(const [i,p] of path.get('expressions').entries()){const values=read(p,next);if(values.some(v=>v===U||v&&typeof v==='object'))return [U];out=union(out.flatMap(prefix=>values.map(v=>prefix+String(v)+(n.quasis[i+1].value.cooked??n.quasis[i+1].value.raw))));if(out.includes(U))return out;}return out;}
  if(n.type==='BinaryExpression'&&['+','-','*','/','%'].includes(n.operator)){const a=read(path.get('left'),next),b=read(path.get('right'),next);if([...a,...b].some(v=>v===U||v&&typeof v==='object'))return [U];if(n.operator!== '+'&&[...a,...b].some(v=>typeof v!=='number'))return [U];return union(a.flatMap(x=>b.map(y=>n.operator==='+'?x+y:n.operator==='-'?x-y:n.operator==='*'?x*y:n.operator==='/'?x/y:x%y)));}
  if(n.type==='CallExpression')return call(path,next);
  return [U];
 }
 return path=>read(path,{seen:new Set(),env:new Map(),depth:0,budget:{count:0}});
}
