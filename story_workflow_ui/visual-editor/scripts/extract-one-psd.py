"""On-demand single-PSD thumbnail preview and lazy extraction into Studio imports/.
Reuses D:/Doyin/asset_browser/psd_bridge.py so extraction layout and bboxes stay 100% consistent.

Usage:
  python extract-one-psd.py --thumb <psd_path> --out <thumb.png> [--max-size=640]
  python extract-one-psd.py --extract <psd_path> --out-root <imports_root> --id <asset_id> --type <characters|backgrounds|props|effects> --label <name>
"""
from pathlib import Path
import sys, json, hashlib, argparse

sys.path.insert(0, 'D:/Doyin/asset_browser')
import psd_bridge as bridge
from PIL import Image


def atomic_json(path: Path, value):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(path)


def make_thumb(psd_path: Path, out_path: Path, max_size: int = 640):
    psd = bridge.PSDImage.open(psd_path)
    im = psd.composite()
    if im is None:
        raise RuntimeError('PSD has no composite image')
    im = im.convert('RGBA')
    im.thumbnail((max_size, max_size), Image.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix('.tmp.png')
    im.save(tmp, format='PNG', optimize=True)
    tmp.replace(out_path)
    print(json.dumps({'ok': True, 'width': im.width, 'height': im.height, 'canvas': [psd.width, psd.height], 'out': str(out_path)}, ensure_ascii=False))


def extract_one(psd_path: Path, out_root: Path, asset_id: str, asset_type: str, label: str):
    if asset_type not in ('characters', 'backgrounds', 'props', 'effects'):
        raise ValueError('Invalid asset type: ' + asset_type)
    rel_dir = Path('assets') / asset_id / 'v1'
    folder = out_root / rel_dir
    folder.mkdir(parents=True, exist_ok=True)

    psd = bridge.PSDImage.open(psd_path)
    canvas = [psd.width, psd.height]
    fp = bridge.file_fingerprint(psd_path)
    tree = [bridge.inspect_node(l, str(i)) for i, l in enumerate(psd)]
    errors, empty, records = [], [], {}
    choices = {'poses': [], 'faces': [], 'props': []}

    def export_layer(layer, lid, kind):
        if lid in records:
            return records[lid]
        try:
            bridge.enable_layer_chain(layer)
            im = bridge.rasterize_layer(layer)
            if im is None:
                raise ValueError('No raster data')
            alpha = im.getchannel('A').getbbox()
            if not alpha:
                empty.append({'id': lid, 'name': layer.name})
                return None
            original = list(layer.bbox)
            origin = (0, 0) if list(im.size) == canvas else original[:2]
            bbox = [origin[0] + alpha[0], origin[1] + alpha[1], origin[0] + alpha[2], origin[1] + alpha[3]]
            im = im.crop(alpha)
            dest = folder / kind / (lid.replace('/', '__') + '_' + bridge.safe_name(layer.name) + '.png')
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest)
            rec = {
                'id': lid,
                'sourceLayerId': lid,
                'name': layer.name,
                'bbox': bbox,
                'originalBBox': original,
                'width': im.width,
                'height': im.height,
                'path': str(dest),
                'relativePath': dest.relative_to(out_root).as_posix(),
                'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(),
            }
            records[lid] = rec
            return rec
        except Exception as e:
            errors.append({'id': lid, 'name': getattr(layer, 'name', ''), 'error': str(e)})
            return None

    # Save source composite before toggling individual layers
    comp_path = folder / 'source-composite.png'
    try:
        comp = psd.composite().convert('RGBA')
        comp.save(comp_path)
    except Exception as e:
        errors.append({'id': 'composite', 'error': str(e)})

    for role in ['pose', 'face', 'prop']:
        for lid, layer in bridge.role_children(psd, role):
            bridge.select_role_child(psd, role, lid)
            rec = export_layer(layer, lid, role + 's')
            if rec:
                choices[role + 's'].append(rec)

    leaves = []
    for node in bridge.tree_nodes(tree):
        if node.get('children'):
            continue
        layer = bridge.layer_at(psd, node['id'])
        rec = export_layer(layer, node['id'], 'layers')
        if rec:
            leaves.append({**rec, 'role': node['role']})

    if asset_type in ('props', 'effects') and not choices['props']:
        choices['props'] = [r for r in leaves if r['role'] != 'background']
    if asset_type == 'backgrounds' and comp_path.exists():
        im = Image.open(comp_path)
        leaves.insert(0, {
            'id': 'composite',
            'sourceLayerId': 'composite',
            'name': 'Nền ghép gốc',
            'bbox': [0, 0, *canvas],
            'width': im.width,
            'height': im.height,
            'path': str(comp_path),
            'relativePath': comp_path.relative_to(out_root).as_posix(),
            'sha256': hashlib.sha256(comp_path.read_bytes()).hexdigest(),
            'role': 'background',
            'composite': True,
        })

    manifest = {
        'schemaVersion': 1,
        'assetId': asset_id,
        'displayName': label,
        'assetType': {'characters': 'character', 'backgrounds': 'background', 'props': 'prop', 'effects': 'effect'}[asset_type],
        'status': 'extracted' if not errors else 'extracted-with-errors',
        'source': {'path': str(psd_path), **fp},
        'canvas': canvas,
        'capabilities': {**choices, 'layers': leaves},
        'layerTree': tree,
        'emptyLayers': empty,
        'errors': errors,
    }
    atomic_json(folder / 'asset.manifest.json', manifest)

    # Update imports/editor-index.json atomically (idempotent upsert)
    index_path = out_root / 'editor-index.json'
    entries = []
    if index_path.exists():
        try:
            entries = json.loads(index_path.read_text(encoding='utf-8'))
        except Exception:
            entries = []
    rel_posix = rel_dir.as_posix()
    entries = [e for e in entries if e.get('assetId') != asset_id]
    entries.append({'assetId': asset_id, 'relativePath': rel_posix, 'type': asset_type})
    atomic_json(index_path, entries)

    print(json.dumps({
        'ok': True,
        'assetId': asset_id,
        'catalogId': 'import/' + asset_id,
        'displayName': label,
        'type': asset_type,
        'relativePath': rel_posix,
        'poses': len(choices['poses']),
        'faces': len(choices['faces']),
        'props': len(choices['props']),
        'layers': len(leaves),
        'errors': len(errors),
    }, ensure_ascii=False))


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--thumb', type=str)
    p.add_argument('--extract', type=str)
    p.add_argument('--out', type=str)
    p.add_argument('--out-root', type=str)
    p.add_argument('--id', type=str)
    p.add_argument('--type', type=str, default='characters')
    p.add_argument('--label', type=str)
    p.add_argument('--max-size', type=int, default=640)
    args = p.parse_args()

    if args.thumb:
        if not args.out:
            raise SystemExit('--out required for --thumb')
        make_thumb(Path(args.thumb), Path(args.out), args.max_size)
    elif args.extract:
        if not args.out_root or not args.id:
            raise SystemExit('--out-root and --id required for --extract')
        psd = Path(args.extract)
        extract_one(psd, Path(args.out_root), args.id, args.type, args.label or psd.stem)
    else:
        raise SystemExit('Specify --thumb or --extract')


if __name__ == '__main__':
    main()
