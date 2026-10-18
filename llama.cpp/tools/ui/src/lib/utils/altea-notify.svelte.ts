// Avviso a fine risposta: suono breve + notifica di sistema quando la scheda/finestra non è in primo piano.
const KEY = 'Altea.notify';

function load(): boolean {
	try {
		return localStorage.getItem(KEY) !== '0';
	} catch {
		return true;
	}
}

class AlteaNotify {
	enabled = $state(load());

	toggle() {
		this.enabled = !this.enabled;
		try {
			localStorage.setItem(KEY, this.enabled ? '1' : '0');
		} catch {
			/* ignore */
		}
		if (this.enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
			Notification.requestPermission().catch(() => {});
		}
	}

	private beep() {
		try {
			const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			const ctx = new Ctx();
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.type = 'sine';
			o.frequency.value = 880;
			g.gain.setValueAtTime(0.0001, ctx.currentTime);
			g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
			g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
			o.connect(g).connect(ctx.destination);
			o.start();
			o.stop(ctx.currentTime + 0.4);
			o.onended = () => ctx.close().catch(() => {});
		} catch {
			/* ignore */
		}
	}

	/** Da chiamare quando una risposta è completata. Agisce solo se la finestra non è visibile/in primo piano. */
	done() {
		if (!this.enabled || typeof document === 'undefined') return;
		if (document.visibilityState === 'visible' && document.hasFocus()) return;
		this.beep();
		try {
			if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
				new Notification('Banana', { body: 'Risposta pronta.', silent: true });
			}
		} catch {
			/* ignore */
		}
	}
}

export const alteaNotify = new AlteaNotify();
