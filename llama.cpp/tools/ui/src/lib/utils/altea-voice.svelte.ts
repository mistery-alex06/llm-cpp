// Lettura ad alta voce delle risposte di Altea (Web Speech API, sintesi vocale del sistema).
// Tutto locale: usa le voci installate su macOS, nessun dato lascia il computer.

const FEMALE_IT = ['federica', 'emma', 'paola', 'alice', 'elsa', 'carla', 'silvia', 'google italiano'];

class AlteaVoice {
	speakingId = $state<string | null>(null);
	private token = 0;

	get supported(): boolean {
		return typeof window !== 'undefined' && 'speechSynthesis' in window;
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

	/** Spezza in frasi: Chrome interrompe gli enunciati troppo lunghi. */
	private chunks(text: string): string[] {
		const parts = text.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [text];
		const out: string[] = [];
		let cur = '';
		for (const p of parts) {
			if ((cur + p).length > 180 && cur) {
				out.push(cur.trim());
				cur = p;
			} else cur += p;
		}
		if (cur.trim()) out.push(cur.trim());
		return out;
	}

	private pickVoice(): SpeechSynthesisVoice | null {
		const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('it'));
		if (voices.length === 0) return null;
		// voci femminili in ordine di preferenza; a parità, qualità più alta (premium > enhanced)
		const quality = (v: SpeechSynthesisVoice) =>
			/premium/i.test(v.name) ? 2 : /enhanced|migliorata/i.test(v.name) ? 1 : 0;
		for (const name of FEMALE_IT) {
			const matches = voices
				.filter((x) => x.name.toLowerCase().includes(name))
				.sort((a, b) => quality(b) - quality(a));
			if (matches.length) return matches[0];
		}
		return voices[0];
	}

	stop(): void {
		this.token++;
		if (this.supported) window.speechSynthesis.cancel();
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
		const voice = this.pickVoice();
		const queue = this.chunks(text);

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
			u.rate = 1;
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
