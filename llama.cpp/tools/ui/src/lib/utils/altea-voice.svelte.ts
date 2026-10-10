// Lettura ad alta voce delle risposte di Altea.
// 1) Voce naturale: server locale `tts_server.py` (comando `say` di macOS, voci Premium).
// 2) Se il server non risponde: sintesi vocale del browser (Web Speech API).
// Tutto locale: nessun dato lascia il computer.

const TTS_URL = 'http://127.0.0.1:8765';
const FEMALE_IT = ['federica', 'emma', 'paola', 'alice', 'elsa', 'carla', 'silvia', 'google italiano'];

class AlteaVoice {
	speakingId = $state<string | null>(null);
	private token = 0;
	private abort: AbortController | null = null;
	private audio: HTMLAudioElement | null = null;

	get supported(): boolean {
		return typeof window !== 'undefined' && ('speechSynthesis' in window || 'Audio' in window);
	}

	/** Toglie markdown, blocchi di codice e ragionamento: resta solo testo parlabile. */
	private clean(text: string): string {
		return text
			.replace(/<think>[\s\S]*?<\/think>/gi, ' ')
			.replace(/```[\s\S]*?```/g, ' Blocco di codice. ')
			.replace(/`([^`]*)`/g, '$1')
			.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
			.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
			.replace(/https?:\/\/\S+/g, ' ')
			.replace(/^\s{0,3}#{1,6}\s+/gm, '')
			.replace(/^\s*[-*+]\s+/gm, '')
			.replace(/^\s*\d+[.)]\s+/gm, '')
			.replace(/[*_~>|]/g, '')
			.replace(/\n{2,}/g, '. ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	/** Spezza in frasi di lunghezza gestibile. */
	private chunks(text: string, max: number): string[] {
		const parts = text.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [text];
		const out: string[] = [];
		let cur = '';
		for (const p of parts) {
			if ((cur + p).length > max && cur) {
				out.push(cur.trim());
				cur = p;
			} else cur += p;
		}
		if (cur.trim()) out.push(cur.trim());
		return out;
	}

	stop(): void {
		this.token++;
		this.abort?.abort();
		this.abort = null;
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.audio = null;
		}
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			window.speechSynthesis.cancel();
		}
		this.speakingId = null;
	}

	toggle(id: string, rawText: string): void {
		if (!this.supported) return;
		if (this.speakingId === id) {
			this.stop();
			return;
		}
		this.stop();
		const text = this.clean(rawText);
		if (!text) return;

		const my = ++this.token;
		this.speakingId = id;
		void this.run(my, text);
	}

	private async fetchWav(text: string, signal: AbortSignal): Promise<string> {
		const res = await fetch(`${TTS_URL}/speak`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text }),
			signal
		});
		if (!res.ok) throw new Error('tts');
		return URL.createObjectURL(await res.blob());
	}

	private async run(my: number, text: string): Promise<void> {
		const queue = this.chunks(text, 300);
		this.abort = new AbortController();
		const signal = this.abort.signal;

		let nextUrl: Promise<string> | null = null;
		try {
			nextUrl = this.fetchWav(queue[0], signal);
			await nextUrl; // se fallisce, passa alla voce del browser
		} catch {
			if (my === this.token) this.speakWithBrowser(my, text);
			return;
		}

		for (let i = 0; i < queue.length; i++) {
			if (my !== this.token) return;
			const current = nextUrl!;
			// prepara il blocco successivo mentre questo viene letto
			nextUrl = i + 1 < queue.length ? this.fetchWav(queue[i + 1], signal) : null;
			nextUrl?.catch(() => {});
			try {
				const url = await current;
				if (my !== this.token) {
					URL.revokeObjectURL(url);
					return;
				}
				await this.play(url);
				URL.revokeObjectURL(url);
			} catch {
				break;
			}
		}
		if (my === this.token) this.speakingId = null;
	}

	private play(url: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const a = new Audio(url);
			this.audio = a;
			a.onended = () => resolve();
			a.onerror = () => reject(new Error('audio'));
			a.play().catch(reject);
		});
	}

	// ---- Fallback: voce del browser ----
	private pickVoice(): SpeechSynthesisVoice | null {
		const voices = window.speechSynthesis
			.getVoices()
			.filter((v) => v.lang.toLowerCase().startsWith('it'));
		if (voices.length === 0) return null;
		for (const name of FEMALE_IT) {
			const v = voices.find((x) => x.name.toLowerCase().includes(name));
			if (v) return v;
		}
		return voices[0];
	}

	private speakWithBrowser(my: number, text: string): void {
		if (!('speechSynthesis' in window)) {
			this.speakingId = null;
			return;
		}
		const voice = this.pickVoice();
		const queue = this.chunks(text, 180);
		const next = () => {
			if (my !== this.token) return;
			const part = queue.shift();
			if (!part) {
				this.speakingId = null;
				return;
			}
			const u = new SpeechSynthesisUtterance(part);
			u.lang = 'it-IT';
			if (voice) u.voice = voice;
			u.onend = next;
			u.onerror = () => {
				if (my === this.token) this.speakingId = null;
			};
			window.speechSynthesis.speak(u);
		};
		next();
	}
}

export const alteaVoice = new AlteaVoice();
