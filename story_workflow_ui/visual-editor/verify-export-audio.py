"""Independent decoded-waveform audit of every cue in an editor export snapshot."""
import argparse
import datetime as dt
import json
import subprocess
from pathlib import Path
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('folder', type=Path)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--samples', type=Path)
args = parser.parse_args()
snapshot = json.loads((args.folder / 'snapshot.json').read_text(encoding='utf-8'))
job = json.loads((args.folder / 'job.json').read_text(encoding='utf-8'))
rate, radius = 16000, 1600

def decode(path):
    data = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-vn', '-ac', '1', '-ar', str(rate), '-f', 'f32le', '-'], timeout=120)
    return np.frombuffer(data, dtype='<f4').astype(np.float64)

video = args.folder / 'preview.mp4'
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(video)], timeout=30))
decoded = np.pad(decode(video), (radius, radius))
sources, results = {}, []
project = snapshot['project']
for scene in project['scenes']:
    for cue in scene.get('cues', []):
        path = Path(snapshot['mediaRoot']) / cue['publicPath'].split('?')[0].lstrip('/')
        key = str(path)
        if key not in sources:
            sources[key] = decode(path)
        reference = sources[key]
        expected = (scene['from'] + cue['from']) / project['fps']
        start = round(expected * rate)
        segment = decoded[start:start + len(reference) + radius * 2]
        if len(segment) < len(reference) + radius * 2:
            segment = np.pad(segment, (0, len(reference) + radius * 2 - len(segment)))
        size = 1 << (len(segment) + len(reference) - 1).bit_length()
        convolution = np.fft.irfft(np.fft.rfft(segment, size) * np.fft.rfft(reference[::-1], size), size)
        numerator = convolution[len(reference)-1:len(segment)]
        energy = np.concatenate(([0.0], np.cumsum(segment * segment)))
        norms = np.sqrt(np.maximum(energy[len(reference):] - energy[:-len(reference)], 0) * np.dot(reference, reference))
        scores = np.divide(numerator, norms, out=np.zeros_like(numerator), where=norms > 1e-12)
        best = int(np.argmax(scores))
        results.append({'sceneId': scene['id'], 'cueId': cue['cueId'], 'expectedStartSec': expected,
                        'correlation': float(scores[best]), 'alignmentErrorMs': (best - radius) / rate * 1000})

stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')
duration = float(probe['format']['duration'])
timing_ok = int(stream['nb_frames']) == project['duration'] and abs(duration - project['duration'] / project['fps']) < 0.05
audio_ok = bool(results) and all(r['correlation'] >= .98 and abs(r['alignmentErrorMs']) <= 2 for r in results)
report = {'status': 'pass' if timing_ok and audio_ok else 'fail', 'exportId': job['id'],
          'method': 'FFmpeg decoded mono 16k audio; normalized FFT correlation against original TTS, +/-100ms at every cue',
          'frames': int(stream['nb_frames']), 'width': stream['width'], 'height': stream['height'],
          'durationSec': duration, 'fileBytes': video.stat().st_size, 'cueCount': len(results),
          'minCorrelation': min((r['correlation'] for r in results), default=None),
          'maxAlignmentErrorMs': max((abs(r['alignmentErrorMs']) for r in results), default=None), 'cues': results,
          'limits': 'Repeated speech/assets are a stress fixture. Audio identity/timing only, no linguistic or QG-2 quality claim.'}
if job.get('completedAt'):
    elapsed = (dt.datetime.fromisoformat(job['completedAt']) - dt.datetime.fromisoformat(job['createdAt'])).total_seconds()
    report['exportWallSeconds'] = elapsed
    report['wallSecondsPerVideoSecond'] = elapsed / duration
if args.samples:
    samples = json.loads(args.samples.read_text(encoding='utf-8-sig'))
    cpu = {}
    for sample in samples:
        for process in sample.get('processes', []):
            cpu[process['Id']] = max(cpu.get(process['Id'], 0), process.get('CPU') or 0)
    report['processTelemetry'] = {'sampleCount': len(samples),
        'maxSampledSumWorkingSetBytes': max(sum(p.get('WorkingSet64', 0) for p in s.get('processes', [])) for s in samples),
        'maxSampledSumPrivateBytes': max(sum(p.get('PrivateMemorySize64', 0) for p in s.get('processes', [])) for s in samples),
        'sumObservedProcessCpuSeconds': sum(cpu.values()),
        'limits': 'Sampled process tree only; working sets can double-count shared pages. Private bytes are committed memory, not physical RAM. CPU is accumulated per observed PID; this is not total machine usage or an instantaneous peak.'}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'cues'}, ensure_ascii=False))
raise SystemExit(0 if report['status'] == 'pass' else 1)
