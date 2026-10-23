// Contenuto della guida mostrata con /help. Aggiornala quando aggiungi comandi o funzioni.
export interface HelpItem {
	name: string;
	desc: string;
}
export interface HelpSection {
	title: string;
	items: HelpItem[];
}

export const HELP: HelpSection[] = [
	{
		title: 'Comandi (scrivi / nella casella)',
		items: [
			{ name: '/help', desc: 'Apre questa guida.' },
			{ name: '/riassumi', desc: 'Inserisce il modello "Riassumi in modo conciso il seguente testo". Con un indirizzo ("riassumi https://...") riassume la pagina web.' },
			{ name: '/traduci', desc: 'Inserisce il modello per tradurre un testo in inglese.' },
			{ name: '/spiega', desc: 'Inserisce il modello per una spiegazione semplice con esempio.' },
			{ name: '/correggi', desc: 'Inserisce il modello per correggere grammatica e stile.' },
			{ name: '/quiz', desc: 'Inserisce il modello per creare 5 domande a risposta multipla su un argomento.' },
			{ name: '/nuova', desc: 'Inizia una nuova chat.' },
			{ name: '/memoria', desc: 'Apre il pannello Memoria (vedi, modifica, elimina i fatti ricordati).' },
			{ name: '/esporta', desc: 'Scarica la chat corrente in Markdown (solo domande e risposte).' },
			{ name: '/web', desc: 'Attiva/disattiva la ricerca web.' },
			{ name: '/auto', desc: 'Attiva/disattiva la scelta automatica del modello.' },
			{ name: '/avviso', desc: 'Attiva/disattiva suono e notifica a fine risposta.' },
			{ name: '/azioni', desc: 'Attiva/disattiva le azioni sul computer.' },
			{ name: '/ruolo-banana', desc: 'Ruolo predefinito: assistente generale.' },
			{ name: '/ruolo-tutor', desc: 'Tutor Polimi: spiega passo passo con formule ed esempi e verifica la comprensione.' },
			{ name: '/ruolo-codice', desc: 'Revisore di codice: cerca bug e problemi e propone correzioni.' },
			{ name: '/ruolo-traduttore', desc: 'Traduttore: italiano ↔ inglese, senza commenti.' },
			{ name: '/ruolo-sintetico', desc: 'Ultra-sintetico: al massimo 3 frasi o 5 punti.' }
		]
	},
	{
		title: 'Azioni sul computer (con Azioni: on)',
		items: [
			{ name: 'elenca_file', desc: 'Elenca i file nella cartella di lavoro (~/Banana/workspace).' },
			{ name: 'leggi_file', desc: 'Legge un file di testo della cartella di lavoro; il contenuto torna ad Banana.' },
			{ name: 'scrivi_file', desc: 'Crea o sovrascrive un file nella cartella di lavoro (la conferma mostra il contenuto).' },
			{ name: 'apri_file', desc: 'Apre un documento, immagine o PDF della cartella con l\'app predefinita (mai script o eseguibili).' },
			{ name: 'apri_url', desc: 'Apre un indirizzo http/https nel browser.' },
			{ name: 'Conferma', desc: 'Ogni azione richiede il tuo clic su Consenti; nessun comando di sistema, nessun file fuori cartella.' }
		]
	},
	{
		title: 'Barra superiore',
		items: [
			{ name: 'Ruolo', desc: 'Cambia il modo di rispondere di Banana (Banana, Tutor, Revisore di codice, Traduttore, Ultra-sintetico).' },
			{ name: 'Comandi rapidi', desc: 'Riassumi, Traduci, Spiega, Correggi, Quiz: inseriscono un modello nella casella.' },
			{ name: 'Esporta .md', desc: 'Scarica la chat in Markdown, solo domande e risposte.' },
			{ name: 'Azioni: on/off', desc: 'Permette ad Banana di proporre azioni sul computer, sempre con conferma.' },
			{ name: 'Avviso: on/off', desc: 'Suono e notifica quando una risposta finisce e la finestra non è in primo piano.' },
			{ name: 'Memoria', desc: 'Pannello dei fatti che Banana ricorda in tutte le chat.' },
			{ name: 'Tema', desc: '9 temi (Chiaro, Scuro, Seppia, Lavanda, Menta, Mezzanotte, Foresta, Oceano, Grafite) e dimensione del testo.' },
			{ name: 'Stato', desc: 'Modello caricato, velocità (tok/s), tempo stimato rimasto, RAM/swap, ricerca web e archivio.' }
		]
	},
	{
		title: 'Casella di testo',
		items: [
			{ name: 'Web', desc: 'Cerca sul web (DuckDuckGo) e usa i risultati nella risposta.' },
			{ name: 'Doc', desc: 'Carica documenti (PDF, testo) e risponde citandoli; ogni documento ha il pannello "Studia" (riassunto, flashcard, quiz).' },
			{ name: 'Auto', desc: 'Sceglie da solo il modello adatto e permette di allegare immagini, audio e video.' },
			{ name: 'Storico', desc: 'Cerca nelle chat passate e porta in contesto le più rilevanti.' },
			{ name: 'Allegati', desc: 'Immagini, audio e video (con Qwen2.5-Omni); i video vengono scomposti in fotogrammi e audio.' }
		]
	},
	{
		title: 'Progetti e memoria',
		items: [
			{ name: 'Barra Progetti (destra)', desc: 'Raggruppa chat sullo stesso argomento, con istruzioni, memoria e documenti propri del progetto.' },
			{ name: 'Memoria automatica', desc: 'Banana ricorda da sola fatti personali e di progetto; si gestiscono dal pannello Memoria e dalla barra Progetti.' },
			{ name: 'Backup', desc: 'Impostazioni → Importa/Esporta: salva e ripristina memoria, documenti e progetti (copia automatica anche in ~/Banana/data).' }
		]
	},
	{
		title: 'Timer e promemoria',
		items: [
			{ name: 'Timer', desc: 'Scrivi "timer 10 minuti" o "timer di 1 ora e 30 minuti per la pasta".' },
			{ name: 'Promemoria', desc: 'Scrivi "ricordami tra 20 minuti di chiamare Marco", "ricordami domani alle 9 di ..." o "sveglia alle 7:30". Alla scadenza: notifica, suono e voce, anche a scheda chiusa.' },
			{ name: 'Elenco e annullo', desc: '"/promemoria" mostra quelli attivi (numerati); "annulla tutti i timer" li cancella, "annulla il timer della pasta" o "annulla il promemoria 2" ne cancella uno solo.' }
		]
	},
	{
		title: 'Tasti utili',
		items: [
			{ name: 'Invio', desc: 'Invia il messaggio (nel menu "/" conferma il comando evidenziato).' },
			{ name: 'Maiusc + Invio', desc: 'Va a capo.' },
			{ name: 'Frecce ↑ ↓ / Tab', desc: 'Scorrono e confermano le voci del menu "/".' },
			{ name: 'Esc', desc: 'Chiude menu e finestre.' }
		]
	},
	{
		title: 'Scorciatoie (Alt + tasto)',
		items: [
			{ name: 'Alt + N', desc: 'Nuova chat.' },
			{ name: 'Alt + L', desc: 'Porta il cursore nella casella di testo.' },
			{ name: 'Alt + M', desc: 'Apre/chiude il pannello Memoria.' },
			{ name: 'Alt + E', desc: 'Esporta la chat in Markdown.' },
			{ name: 'Alt + H', desc: 'Apre/chiude questa guida.' },
			{ name: 'Alt + R', desc: 'Passa al ruolo successivo.' },
			{ name: 'Alt + T', desc: 'Passa al tema successivo.' }
		]
	}
];
