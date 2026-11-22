export function taskLayerIds(task,document){const ids=document.production?.taskBindings?.[task.id]?.layerIds??task.layerIds;return Array.isArray(ids)&&ids.every(id=>typeof id==='string')?ids:[];}
