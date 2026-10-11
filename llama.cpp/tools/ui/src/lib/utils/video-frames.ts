// Analisi video di Altea: llama.cpp non legge i video, quindi un video allegato viene
// trasformato nel browser in pochi fotogrammi (immagini JPEG, in ordine) più l'audio (WAV),
// che il modello multimodale (Qwen2.5-Omni) può leggere come qualsiasi immagine o audio.
import { toast } from 'svelte-sonner';

const MAX_FRAMES = 6;
const MIN_FRAMES = 3;
const SECONDS_PER_FRAME = 5; // un fotogramma ogni ~5 s, entro i limiti sopra
const MAX_SIDE = 448; // lato massimo in pixel (meno token per immagine)
const MAX_AUDIO_SECONDS = 30;
const MAX_AUDIO_VIDEO_DURATION = 300; // oltre 5 minuti niente audio (RAM)
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const SEEK_TIMEOUT_MS = 8000;

function baseName(name: string): string {
	return name.replace(/\.[^.]+$/, '') || 'video';
}

function waitFor(target: EventTarget, ok: string, ms: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => {
			cleanup();
			reject(new Error('timeout'));
		}, ms);
		const onOk = () => {
			cleanup();
			resolve();
		};
		const onErr = () => {
			cleanup();
			reject(new Error('errore video'));
		};
		function cleanup() {
			clearTimeout(t);
			target.removeEventListener(ok, onOk);
			target.removeEventListener('error', onErr);
		}
		target.addEventListener(ok, onOk, { once: true });
		target.addEventListener('error', onErr, { once: true });
	});
}

async function extractFrames(
	video: HTMLVideoElement,
	name: string
): Promise<{ files: File[]; duration: number }> {
	const duration = video.duration;
	if (!isFinite(duration) || duration <= 0) throw new Error('durata sconosciuta');

	const count = Math.min(
		MAX_FRAMES,
		Math.max(MIN_FRAMES, Math.ceil(duration / SECONDS_PER_FRAME))
	);
	const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
	const w = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
	const h = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas non disponibile');

	const files: File[] = [];
	for (let i = 0; i < count; i++) {
		const t = (duration * (i + 0.5)) / count;
		const seeked = waitFor(video, 'seeked', SEEK_TIMEOUT_MS);
		video.currentTime = t;
		await seeked;
		ctx.drawImage(video, 0, 0, w, h);
		const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
		if (!blob) continue;
		const sec = Math.round(t);
		files.push(
			new File([blob], `${baseName(name)}_fotogramma_${i + 1}_${sec}s.jpg`, { type: 'image/jpeg' })
		);
	}
	return { files, duration };
}

function encodeWav(samples: Float32Array, rate: number): Blob {
	const buf = new ArrayBuffer(44 + samples.length * 2);
	const v = new DataView(buf);
	const str = (o: number, s: string) => {
		for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
	};
	str(0, 'RIFF');
	v.setUint32(4, 36 + samples.length * 2, true);
	str(8, 'WAVE');
	str(12, 'fmt ');
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true);
	v.setUint16(22, 1, true);
	v.setUint32(24, rate, true);
	v.setUint32(28, rate * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	str(36, 'data');
	v.setUint32(40, samples.length * 2, true);
	for (let i = 0; i < samples.length; i++) {
		const s = Math.max(-1, Math.min(1, samples[i]));
		v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
	}
	return new Blob([buf], { type: 'audio/wav' });
}

/** Estrae l'audio (mono, 16 kHz, max 30 s) come WAV; null se il video non ha audio. */
async function extractAudio(file: File, name: string): Promise<File | null> {
	try {
		const data = await file.arrayBuffer();
		const ctx = new AudioContext();
		let decoded: AudioBuffer;
		try {
			decoded = await ctx.decodeAudioData(data);
		} finally {
			void ctx.close();
		}
		const RATE = 16000;
		const seconds = Math.min(decoded.duration, MAX_AUDIO_SECONDS);
		const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * RATE)), RATE);
		const src = offline.createBufferSource();
		src.buffer = decoded;
		src.connect(offline.destination);
		src.start(0);
		const rendered = await offline.startRendering();
		const samples = rendered.getChannelData(0);
		let peak = 0;
		for (let i = 0; i < samples.length; i += 97) peak = Math.max(peak, Math.abs(samples[i]));
		if (peak < 0.002) return null; // silenzio
		return new File([encodeWav(samples, RATE)], `${baseName(name)}_audio.wav`, {
			type: 'audio/wav'
		});
	} catch {
		return null;
	}
}

async function expandVideo(file: File): Promise<File[]> {
	if (file.size > MAX_VIDEO_BYTES) {
		toast.error(`"${file.name}" è troppo grande (massimo 500 MB).`);
		return [];
	}
	const url = URL.createObjectURL(file);
	const video = document.createElement('video');
	video.muted = true;
	video.playsInline = true;
	video.preload = 'auto';
	video.src = url;
	try {
		await waitFor(video, 'loadeddata', 15000);
		const { files: frames, duration } = await extractFrames(video, file.name);
		const audio =
			duration <= MAX_AUDIO_VIDEO_DURATION ? await extractAudio(file, file.name) : null;
		if (frames.length === 0) throw new Error('nessun fotogramma');
		toast.success(
			`Video "${file.name}": ${frames.length} fotogrammi${audio ? ' e audio' : ''} pronti. ` +
				`Usa un modello con immagini (Qwen2.5-Omni).`
		);
		return audio ? [...frames, audio] : frames;
	} catch (e) {
		toast.error(
			`Impossibile leggere il video "${file.name}": ${e instanceof Error ? e.message : 'errore'}`
		);
		return [];
	} finally {
		video.removeAttribute('src');
		video.load();
		URL.revokeObjectURL(url);
	}
}

/** Sostituisce ogni video con i suoi fotogrammi e il suo audio; gli altri file restano uguali. */
export async function expandVideos(files: File[]): Promise<File[]> {
	const out: File[] = [];
	for (const f of files) {
		if (f.type.startsWith('video/')) out.push(...(await expandVideo(f)));
		else out.push(f);
	}
	return out;
}
