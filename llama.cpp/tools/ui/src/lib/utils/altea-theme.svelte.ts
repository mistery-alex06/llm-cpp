// Temi e dimensione del testo di Altea. I temi sono tavolozze (classi `palette-*` su <html>)
// che forzano anche la modalità chiaro/scuro tramite mode-watcher.
import { setMode } from 'mode-watcher';

const KEY_THEME = 'Altea.theme';
const KEY_SIZE = 'Altea.fontSize';

export interface AlteaTheme {
	id: string;
	name: string;
	mode: 'light' | 'dark';
	/** Classe `palette-*` da applicare (vuota = tavolozza predefinita). */
	palette: string;
	/** Colori dell'anteprima: sfondo, accento. */
	swatch: [string, string];
}

export const THEMES: AlteaTheme[] = [
	{ id: 'chiaro', name: 'Chiaro', mode: 'light', palette: '', swatch: ['#ffffff', '#262626'] },
	{ id: 'scuro', name: 'Scuro', mode: 'dark', palette: '', swatch: ['#0b1220', '#e6c36a'] },
	{ id: 'seppia', name: 'Seppia', mode: 'light', palette: 'palette-seppia', swatch: ['#e8d9b8', '#7a4a1e'] },
	{ id: 'mezzanotte', name: 'Mezzanotte', mode: 'dark', palette: 'palette-mezzanotte', swatch: ['#14151c', '#8f9cf5'] },
	{ id: 'foresta', name: 'Foresta', mode: 'dark', palette: 'palette-foresta', swatch: ['#0e1a15', '#6fcf97'] },
	{ id: 'oceano', name: 'Oceano', mode: 'dark', palette: 'palette-oceano', swatch: ['#0a1c2c', '#4fd0e0'] },
	{ id: 'grafite', name: 'Grafite', mode: 'dark', palette: 'palette-grafite', swatch: ['#26241f', '#f0a050'] },
	{ id: 'lavanda', name: 'Lavanda', mode: 'light', palette: 'palette-lavanda', swatch: ['#f1ecf8', '#6a3fc0'] },
	{ id: 'menta', name: 'Menta', mode: 'light', palette: 'palette-menta', swatch: ['#e9f5ef', '#1f7a56'] }
];

export const FONT_SIZES = [
	{ id: 'small', name: 'Piccolo', px: 14 },
	{ id: 'normal', name: 'Normale', px: 16 },
	{ id: 'large', name: 'Grande', px: 18 }
];

function read(key: string, fallback: string): string {
	try {
		return localStorage.getItem(key) || fallback;
	} catch {
		return fallback;
	}
}

function write(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* ignore */
	}
}

class AlteaThemeStore {
	themeId = $state(typeof localStorage !== 'undefined' ? read(KEY_THEME, '') : '');
	sizeId = $state(typeof localStorage !== 'undefined' ? read(KEY_SIZE, 'normal') : 'normal');

	/** Applica le preferenze salvate (da chiamare una volta al montaggio). */
	init() {
		this.applyPalette();
		this.applySize();
	}

	private applyPalette() {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		THEMES.forEach((t) => t.palette && root.classList.remove(t.palette));
		const t = THEMES.find((x) => x.id === this.themeId);
		if (!t) return; // nessuna scelta: resta il comportamento di default dell'app
		if (t.palette) root.classList.add(t.palette);
		setMode(t.mode);
	}

	private applySize() {
		if (typeof document === 'undefined') return;
		const s = FONT_SIZES.find((x) => x.id === this.sizeId) ?? FONT_SIZES[1];
		document.documentElement.style.fontSize = s.px + 'px';
	}

	setTheme(id: string) {
		this.themeId = id;
		write(KEY_THEME, id);
		this.applyPalette();
	}

	setSize(id: string) {
		this.sizeId = id;
		write(KEY_SIZE, id);
		this.applySize();
	}
}

export const alteaTheme = new AlteaThemeStore();
