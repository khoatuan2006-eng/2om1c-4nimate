"""Read the top-level group structure of every catalog source PSD and write catalog-annotations.json.

Catalog manifests dropped the PSD group names, so "表情豆豆眼" (bean-eye faces) and "表情" (detailed faces)
ended up as 146 faces with duplicate names. This records, per source PSD file name:
  - the pose group and how many poses it has (28 = base set, 52 = base + left/right-hand variants)
  - every face group (index in the PSD = first part of a face's sourceLayerId), its name, style and count
Run:  python -I visual-editor/scripts/build-catalog-annotations.py   (from story_workflow_ui; needs psd_tools)
The output is a small tracked file; re-run when new PSDs are extracted.
"""
import json, sys, warnings
from pathlib import Path
from psd_tools import PSDImage

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "catalog-annotations.json"
SOURCES = [
    Path(r"D:\Doyin\story_workflow_ui\preproduction\nhat-thanh\resource-library\rebuild-20261009"),
    Path(r"D:\Doyin\story_workflow_ui\preproduction\nhat-thanh\resource-library\imports"),
    Path(r"D:\Doyin\asset_browser\library"),
]
POSE = ("动作", "姿势", "pose")
STYLE = {"表情豆豆眼": "bean", "表情": "detailed", "表情_通用": "generic"}


def manifests():
    for root in SOURCES:
        if root.is_dir():
            yield from root.rglob("asset.manifest.json")


def source_of(manifest):
    src = manifest.get("source")
    return (src.get("path") if isinstance(src, dict) else src) or ""


def main():
    result, missing = {}, []
    for file in manifests():
        try:
            m = json.loads(file.read_text(encoding="utf-8-sig"))
        except Exception:
            continue
        caps = m.get("capabilities", {})
        if not caps.get("faces") and not caps.get("poses"):
            continue
        src = source_of(m)
        key = Path(src).name
        if not key or key in result:
            continue
        if not Path(src).is_file():
            missing.append(src)
            continue
        psd = PSDImage.open(src)
        entry = {"poseGroup": None, "poseCount": 0, "faceGroups": []}
        for index, layer in enumerate(psd):
            if not layer.is_group():
                continue
            name = layer.name
            count = len(list(layer))
            if any(w in name.lower() for w in POSE) and entry["poseGroup"] is None:
                entry["poseGroup"], entry["poseCount"] = name, count
            elif name.startswith("表情"):
                entry["faceGroups"].append({"index": index, "name": name, "style": STYLE.get(name, "other"), "count": count})
        entry["frameSet"] = "base-28" if entry["poseCount"] <= 28 else "extended-52" if entry["poseCount"] <= 52 else "custom"
        result[key] = entry
    OUT.write_text(json.dumps(dict(sorted(result.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(result)} PSDs); missing source files: {len(missing)}")
    for path in missing[:10]:
        print("  missing", path)


if __name__ == "__main__":
    sys.exit(main())
