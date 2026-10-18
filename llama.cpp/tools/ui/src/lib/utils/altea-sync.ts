// Sincronizzazione su file di Banana: memoria, progetti e documenti vengono copiati anche
// in ~/Altea/data/ tramite il servizio locale store_server.py (porta 8092).
// Se il servizio non è raggiungibile, la UI continua a funzionare solo con il browser.
const STORE_URL = 'http://127.0.0.1:8092/store';
const TS_PREFIX = 'Altea.sync.';

export type SyncName = 'memory' | 'projects' | 'docs';

interface Envelope<T> {
	updatedAt: number;
	data: T;
}

function localTs(name: SyncName): number {
	try {
		return Number(localStorage.getItem(TS_PREFIX + name)) || 0;
	} catch {
		return 0;
	}
}

function setLocalTs(name: SyncName, ts: number): void {
	try {
		localStorage.setItem(TS_PREFIX + name, String(ts));
	} catch {
		/* ignore */
	}
}

const timers = new Map<SyncName, ReturnType<typeof setTimeout>>();

/** Salva nel file (con un piccolo ritardo per raggruppare le modifiche ravvicinate). */
export function pushSync<T>(name: SyncName, data: T): void {
	if (typeof window === 'undefined') return;
	const updatedAt = Date.now();
	setLocalTs(name, updatedAt);
	clearTimeout(timers.get(name));
	timers.set(
		name,
		setTimeout(() => {
			const env: Envelope<T> = { updatedAt, data };
			fetch(`${STORE_URL}/${name}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(env)
			}).catch(() => {
				/* servizio non attivo: resta il solo browser */
			});
		}, 600)
	);
}

async function pull<T>(name: SyncName): Promise<Envelope<T> | null> {
	try {
		const r = await fetch(`${STORE_URL}/${name}`, { signal: AbortSignal.timeout(4000) });
		if (!r.ok) return null;
		const env = await r.json();
		if (env && typeof env.updatedAt === 'number' && 'data' in env) return env as Envelope<T>;
		return null;
	} catch {
		return null;
	}
}

/**
 * All'avvio confronta browser e file: vince la copia più recente.
 * - file più recente (o browser vuoto) → `apply` carica i dati del file nel browser;
 * - browser più recente o file assente → i dati del browser vengono scritti nel file.
 */
export async function reconcile<T>(
	name: SyncName,
	getLocal: () => T,
	isEmpty: (v: T) => boolean,
	apply: (data: T) => void | Promise<void>
): Promise<void> {
	try {
		const ping = await fetch('http://127.0.0.1:8092/health', { signal: AbortSignal.timeout(2000) });
		if (!ping.ok) return;
	} catch {
		return;
	}
	const remote = await pull<T>(name);
	const local = getLocal();
	const ts = localTs(name);
	if (!remote) {
		if (!isEmpty(local)) pushSync(name, local);
		return;
	}
	if (remote.updatedAt > ts || isEmpty(local)) {
		await apply(remote.data);
		setLocalTs(name, remote.updatedAt);
	} else if (ts > remote.updatedAt) {
		pushSync(name, local);
	}
}
