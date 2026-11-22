export const libraryText = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
export function filterLibrary(assets, {type, collection, query = ''}) {
  const terms = libraryText(query).trim().split(/\s+/).filter(Boolean);
  return assets.filter(asset => asset.type === type && (collection === 'all' || (collection === 'film' ? ((asset.collection ?? 'shared') === 'film' || asset.collection === 'supplemental') : (asset.collection ?? 'shared') === collection))
    && terms.every(term => libraryText([asset.name, asset.id, asset.source?.name, ...(asset.aliases ?? [])].filter(Boolean).join(' ')).includes(term)));
}
export function libraryPage(items, requested, size = 12) {
  const count = Math.max(1, Math.ceil(items.length / size));
  const page = Math.max(0, Math.min(count - 1, Number.isFinite(requested) ? Math.floor(requested) : 0));
  return {items: items.slice(page * size, (page + 1) * size), page, count, total: items.length};
}
