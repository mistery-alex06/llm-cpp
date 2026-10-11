import { ColorMode } from '$lib/enums/ui.enums';
import { SettingsFieldType } from '$lib/enums/settings.enums';
import { SyncableParameterType } from '$lib/enums';
import {
	Funnel,
	AlertTriangle,
	Code,
	Monitor,
	ListRestart,
	Sliders,
	PencilRuler,
	Database,
	Monitor as MonitorIcon,
	Sun,
	Moon
} from '@lucide/svelte';
import type { Component } from 'svelte';
import type {
	SettingsConfigValue,
	SyncableParameter,
	SettingsEntry,
	SettingsSectionTitle,
	SettingsSectionEntry,
	SettingsSection
} from '$lib/types';
import { CLI_FLAGS, DEFAULT_MCP_CONFIG } from '$lib/constants';
import { SETTINGS_KEYS } from './settings-keys';
import { ROUTES, SETTINGS_SECTION_SLUGS } from './routes';
import { TITLE_GENERATION } from './title-generation';

export const SETTINGS_SECTION_TITLES = {
	GENERAL: 'Generali',
	DISPLAY: 'Visualizzazione',
	SAMPLING: 'Campionamento',
	PENALTIES: 'Penalità',
	AGENTIC: 'Agentico',
	TOOLS: 'Strumenti',
	IMPORT_EXPORT: 'Importa/Esporta',
	DEVELOPER: 'Sviluppatore'
} as const;

const STANDALONE_SECTIONS: { title: SettingsSectionTitle; slug: string; icon: Component }[] = [
	{ title: SETTINGS_SECTION_TITLES.TOOLS, slug: SETTINGS_SECTION_SLUGS.TOOLS, icon: PencilRuler },
	{
		title: SETTINGS_SECTION_TITLES.IMPORT_EXPORT,
		slug: SETTINGS_SECTION_SLUGS.IMPORT_EXPORT,
		icon: Database
	}
];

const COLOR_MODE_OPTIONS: Array<{ value: string; label: string; icon: Component }> = [
	{ value: ColorMode.SYSTEM, label: 'Sistema', icon: MonitorIcon },
	{ value: ColorMode.LIGHT, label: 'Chiaro', icon: Sun },
	{ value: ColorMode.DARK, label: 'Scuro', icon: Moon }
];

// Shared options for the title-generation radio group. Both paired registry entries
// (USE_FIRST_LINE, USE_LLM) reference this list so labels stay in lockstep.
const TITLE_GENERATION_RADIO_OPTIONS: Array<{
	value: string;
	label: string;
	key: string;
	isExperimental?: boolean;
}> = [
	{
		value: 'firstLine',
		label: 'Use first non-empty line for the conversation title',
		key: SETTINGS_KEYS.TITLE_GENERATION_USE_FIRST_LINE
	},
	{
		value: 'llm',
		label: 'Genera il titolo con l\'LLM',
		key: SETTINGS_KEYS.TITLE_GENERATION_USE_LLM,
		isExperimental: true
	}
];

// Common shape for the conversation title radio entry.
const TITLE_GENERATION_BASE = {
	type: SettingsFieldType.RADIO,
	section: SETTINGS_SECTION_SLUGS.GENERAL,
	radioOptions: TITLE_GENERATION_RADIO_OPTIONS
} as const;

const SETTINGS_REGISTRY: Record<string, SettingsSectionEntry> = {
	[SETTINGS_SECTION_SLUGS.GENERAL]: {
		title: SETTINGS_SECTION_TITLES.GENERAL,
		slug: SETTINGS_SECTION_SLUGS.GENERAL,
		icon: Sliders,
		settings: [
			{
				key: SETTINGS_KEYS.THEME,
				label: 'Tema',
				help: 'Scegli il tema colori dell\'interfaccia: Sistema (segue il dispositivo), Chiaro o Scuro.',
				defaultValue: ColorMode.SYSTEM,
				type: SettingsFieldType.SELECT,
				section: SETTINGS_SECTION_SLUGS.GENERAL,
				options: COLOR_MODE_OPTIONS
			},
			{
				key: SETTINGS_KEYS.API_KEY,
				label: 'Chiave API',
				help: `Set the API Key if you are using <code> ${CLI_FLAGS.API_KEY} </code> option for the server.`,
				defaultValue: '',
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.GENERAL
			},
			{
				key: SETTINGS_KEYS.SYSTEM_MESSAGE,
				label: 'Messaggio di sistema',
				help: 'Messaggio iniziale che definisce il comportamento del modello.',
				defaultValue: '',
				type: SettingsFieldType.TEXTAREA,
				section: SETTINGS_SECTION_SLUGS.GENERAL
			},
			{
				key: SETTINGS_KEYS.PASTE_LONG_TEXT_TO_FILE_LEN,
				label: 'Lunghezza testo incollato → file',
				help: 'Il testo lungo incollato viene convertito in file. Imposta la lunghezza soglia; 0 disattiva.',
				defaultValue: 2500,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.GENERAL
			},
			{
				key: SETTINGS_KEYS.SEND_ON_ENTER,
				label: 'Invia il messaggio con Invio',
				help: 'Invio per inviare, Shift + Invio per andare a capo. Se disattivato, usa Ctrl/Cmd + Invio.',
				defaultValue: true,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.GENERAL
			},
			{
				key: SETTINGS_KEYS.AUTO_MIC_ON_EMPTY,
				label: 'Mostra il microfono a campo vuoto',
				help: 'Mostra il microfono al posto del pulsante di invio quando il campo è vuoto, per i modelli con supporto audio.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.GENERAL,
				isExperimental: true
			},
			{
				key: SETTINGS_KEYS.ENABLE_CONTINUE_GENERATION,
				label: 'Abilita il pulsante "Continua"',
				help: 'Enable "Continue" button for assistant messages, including reasoning models.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.GENERAL,
				isExperimental: true
			},
			{
				...TITLE_GENERATION_BASE,
				key: SETTINGS_KEYS.TITLE_GENERATION_USE_FIRST_LINE,
				label: 'Titolo conversazione',
				help: 'Choose how conversation titles are generated. The first non-empty line uses a fast deterministic rule; the LLM option uses a model-generated title from the first message exchange.',
				defaultValue: true
			},
			{
				key: SETTINGS_KEYS.TITLE_GENERATION_PROMPT,
				label: 'Prompt di generazione titolo LLM',
				help: 'Optional template for the title generation prompt. Use {{USER}} for the user message and {{ASSISTANT}} for the assistant message.',
				defaultValue: TITLE_GENERATION.DEFAULT_PROMPT,
				type: SettingsFieldType.TEXTAREA,
				section: SETTINGS_SECTION_SLUGS.GENERAL,
				dependsOn: SETTINGS_KEYS.TITLE_GENERATION_USE_LLM
			},
			{
				key: SETTINGS_KEYS.COPY_TEXT_ATTACHMENTS_AS_PLAIN_TEXT,
				label: 'Copia gli allegati di testo come testo semplice',
				help: 'When copying a message with text attachments, combine them into a single plain text string instead of a special format that can be pasted back as attachments.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.GENERAL
			},
			{
				key: SETTINGS_KEYS.PDF_AS_IMAGE,
				label: 'Interpreta PDF come immagine',
				help: 'Parse PDF as image instead of text. Automatically falls back to text processing for non-vision models.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.GENERAL
			},
			{
				key: SETTINGS_KEYS.MAX_IMAGE_RESOLUTION,
				label: 'Maximum image resolution (megapixels)',
				help: 'Le immagini più grandi verranno ridimensionate prima dell\'invio. 0 per disattivare.',
				defaultValue: 0,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.GENERAL
			}
		]
	},
	[SETTINGS_SECTION_SLUGS.DISPLAY]: {
		title: SETTINGS_SECTION_TITLES.DISPLAY,
		slug: SETTINGS_SECTION_SLUGS.DISPLAY,
		icon: Monitor,
		settings: [
			{
				key: SETTINGS_KEYS.SHOW_MESSAGE_STATS,
				label: 'Mostra statistiche di generazione dei messaggi',
				help: 'Display generation statistics (tokens/second, token count, duration) below each assistant message.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.SHOW_AGENTIC_TURN_STATS,
				label: 'Mostra statistiche per singoli turni agentici',
				help: 'Display per-turn statistics (tokens, duration) under each turn in agentic responses. Shown only when "Mostra statistiche di generazione dei messaggi" is enabled.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY,
				dependsOn: SETTINGS_KEYS.SHOW_MESSAGE_STATS
			},
			{
				key: SETTINGS_KEYS.SHOW_THOUGHT_IN_PROGRESS,
				label: 'Mostra il ragionamento in corso',
				help: 'Espandi il ragionamento per impostazione predefinita durante la generazione.',
				defaultValue: true,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.ALWAYS_SHOW_TOOL_CALL_CONTENT,
				label: 'Mostra sempre il contenuto delle chiamate agli strumenti',
				help: 'Espandi automaticamente i dettagli delle chiamate agli strumenti durante l\'esecuzione e mantienili aperti al termine.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.RENDER_USER_CONTENT_AS_MARKDOWN,
				label: 'Mostra i messaggi utente come Markdown',
				help: 'Mostra i messaggi utente in formato Markdown.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.RENDER_THINKING_AS_MARKDOWN,
				label: 'Mostra il ragionamento come Markdown',
				help: 'Mostra il blocco di ragionamento come Markdown formattato invece che testo semplice.',
				defaultValue: true,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.FULL_HEIGHT_CODE_BLOCKS,
				label: 'Blocchi di codice a piena altezza',
				help: 'Mostra sempre i blocchi di codice a piena altezza, ignorando i limiti.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.DISABLE_AUTO_SCROLL,
				label: 'Disattiva scorrimento automatico',
				help: 'Disattiva lo scorrimento automatico durante la generazione per controllare manualmente la posizione.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.ALWAYS_SHOW_SIDEBAR_ON_DESKTOP,
				label: 'Mostra sempre la barra laterale su desktop',
				help: 'Mantieni sempre visibile la barra laterale su desktop invece di nasconderla.',
				defaultValue: true,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.SHOW_RAW_MODEL_NAMES,
				label: 'Mostra i nomi grezzi dei modelli',
				help: 'Display full raw model identifiers (e.g. "ggml-org/GLM-4.7-Flash-GGUF:Q8_0") instead of parsed names with badges.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.SHOW_MODEL_QUANTIZATION,
				label: 'Mostra la quantizzazione del modello',
				help: 'Display quantization badges (e.g. Q8_0, Q4_K_M) next to model names throughout the interface.',
				defaultValue: true,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.SHOW_MODEL_TAGS,
				label: 'Mostra i tag del modello',
				help: 'Display model tags (e.g. "vision", "reasoning") next to model names throughout the interface.',
				defaultValue: true,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			},
			{
				key: SETTINGS_KEYS.SHOW_BUILD_VERSION,
				label: 'Mostra la versione della build',
				help: 'Mostra la versione corrente in basso a destra.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DISPLAY
			}
		]
	},
	[SETTINGS_SECTION_SLUGS.SAMPLING]: {
		title: SETTINGS_SECTION_TITLES.SAMPLING,
		slug: SETTINGS_SECTION_SLUGS.SAMPLING,
		icon: Funnel,
		settings: [
			{
				key: SETTINGS_KEYS.TEMPERATURE,
				label: 'Temperatura',
				help: 'Controls the randomness of the generated text by affecting the probability distribution of the output tokens. Higher = more random, lower = more focused.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: {
					serverKey: SETTINGS_KEYS.TEMPERATURE,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.DYNATEMP_RANGE,
				label: 'Intervallo temperatura dinamica',
				help: 'Addon for the temperature sampler. The added value to the range of dynamic temperature, which adjusts probabilities by entropy of tokens.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: {
					serverKey: SETTINGS_KEYS.DYNATEMP_RANGE,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.DYNATEMP_EXPONENT,
				label: 'Esponente temperatura dinamica',
				help: 'Addon for the temperature sampler. Smoothes out the probability redistribution based on the most probable token.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: {
					serverKey: SETTINGS_KEYS.DYNATEMP_EXPONENT,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.TOP_K,
				label: 'Top K',
				help: 'Mantiene solo i primi k token.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: { serverKey: SETTINGS_KEYS.TOP_K, paramType: SyncableParameterType.NUMBER }
			},
			{
				key: SETTINGS_KEYS.TOP_P,
				label: 'Top P',
				help: 'Limita ai token la cui probabilità cumulata raggiunge almeno p',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: { serverKey: SETTINGS_KEYS.TOP_P, paramType: SyncableParameterType.NUMBER }
			},
			{
				key: SETTINGS_KEYS.MIN_P,
				label: 'Min P',
				help: 'Limits tokens based on the minimum probability for a token to be considered, relative to the probability of the most likely token.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: { serverKey: SETTINGS_KEYS.MIN_P, paramType: SyncableParameterType.NUMBER }
			},
			{
				key: SETTINGS_KEYS.XTC_PROBABILITY,
				label: 'Probabilità XTC',
				help: 'XTC sampler cuts out top tokens; this parameter controls the chance of cutting tokens at all. 0 disables XTC.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: {
					serverKey: SETTINGS_KEYS.XTC_PROBABILITY,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.XTC_THRESHOLD,
				label: 'Soglia XTC',
				help: 'XTC sampler cuts out top tokens; this parameter controls the token probability that is required to cut that token.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: {
					serverKey: SETTINGS_KEYS.XTC_THRESHOLD,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.TYP_P,
				label: 'Typical P',
				help: 'Sorts and limits tokens based on the difference between log-probability and entropy.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: { serverKey: SETTINGS_KEYS.TYP_P, paramType: SyncableParameterType.NUMBER }
			},
			{
				key: SETTINGS_KEYS.MAX_TOKENS,
				label: 'Token massimi',
				help: 'The maximum number of token per output. Use -1 for infinite (no limit).',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: {
					serverKey: SETTINGS_KEYS.MAX_TOKENS,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.SAMPLERS,
				label: 'Campionatori',
				help: 'The order at which samplers are applied, in simplified way. Default is "top_k;typ_p;top_p;min_p;temperature": top_k->typ_p->top_p->min_p->temperature',
				defaultValue: '',
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.SAMPLING,
				sync: { serverKey: SETTINGS_KEYS.SAMPLERS, paramType: SyncableParameterType.STRING }
			},
			{
				key: SETTINGS_KEYS.BACKEND_SAMPLING,
				label: 'Campionamento backend',
				help: 'Enable backend-based samplers. When enabled, supported samplers run on the accelerator backend for faster sampling.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.SAMPLING
			}
		]
	},
	[SETTINGS_SECTION_SLUGS.PENALTIES]: {
		title: SETTINGS_SECTION_TITLES.PENALTIES,
		slug: SETTINGS_SECTION_SLUGS.PENALTIES,
		icon: AlertTriangle,
		settings: [
			{
				key: SETTINGS_KEYS.REPEAT_LAST_N,
				label: 'Ripeti ultimi N',
				help: 'Ultimi n token considerati per penalizzare le ripetizioni',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.PENALTIES,
				sync: {
					serverKey: SETTINGS_KEYS.REPEAT_LAST_N,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.REPEAT_PENALTY,
				label: 'Penalità di ripetizione',
				help: 'Controls the repetition of token sequences in the generated text',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.PENALTIES,
				sync: {
					serverKey: SETTINGS_KEYS.REPEAT_PENALTY,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.PRESENCE_PENALTY,
				label: 'Penalità di presenza',
				help: 'Limita i token in base alla loro presenza nell\'output.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.PENALTIES,
				sync: {
					serverKey: SETTINGS_KEYS.PRESENCE_PENALTY,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.FREQUENCY_PENALTY,
				label: 'Penalità di frequenza',
				help: 'Limita i token in base alla frequenza con cui compaiono nell\'output.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.PENALTIES,
				sync: {
					serverKey: SETTINGS_KEYS.FREQUENCY_PENALTY,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.DRY_MULTIPLIER,
				label: 'DRY moltiplicatore',
				help: 'DRY sampling reduces repetition in generated text even across long contexts. This parameter sets the DRY sampling multiplier.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.PENALTIES,
				sync: {
					serverKey: SETTINGS_KEYS.DRY_MULTIPLIER,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.DRY_BASE,
				label: 'DRY base',
				help: 'DRY sampling reduces repetition in generated text even across long contexts. This parameter sets the DRY sampling base value.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.PENALTIES,
				sync: { serverKey: SETTINGS_KEYS.DRY_BASE, paramType: SyncableParameterType.NUMBER }
			},
			{
				key: SETTINGS_KEYS.DRY_ALLOWED_LENGTH,
				label: 'DRY lunghezza consentita',
				help: 'DRY sampling reduces repetition in generated text even across long contexts. This parameter sets the allowed length for DRY sampling.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.PENALTIES,
				sync: {
					serverKey: SETTINGS_KEYS.DRY_ALLOWED_LENGTH,
					paramType: SyncableParameterType.NUMBER
				}
			},
			{
				key: SETTINGS_KEYS.DRY_PENALTY_LAST_N,
				label: 'DRY penalità ultimi N',
				help: 'DRY sampling reduces repetition in generated text even across long contexts. This parameter sets DRY penalty for the last n tokens.',
				defaultValue: undefined,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.PENALTIES,
				sync: {
					serverKey: SETTINGS_KEYS.DRY_PENALTY_LAST_N,
					paramType: SyncableParameterType.NUMBER
				}
			}
		]
	},
	[SETTINGS_SECTION_SLUGS.AGENTIC]: {
		title: SETTINGS_SECTION_TITLES.AGENTIC,
		slug: SETTINGS_SECTION_SLUGS.AGENTIC,
		icon: ListRestart,
		settings: [
			{
				key: SETTINGS_KEYS.AGENTIC_MAX_TURNS,
				label: 'Turni agentici',
				help: 'Numero massimo di cicli di esecuzione strumenti prima di fermarsi (evita loop infiniti).',
				defaultValue: 10,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.AGENTIC,
				isPositiveInteger: true
			},
			{
				key: SETTINGS_KEYS.MCP_REQUEST_TIMEOUT_SECONDS,
				label: 'MCP request timeout (seconds)',
				help: 'Timeout per le singole chiamate agli strumenti MCP.',
				defaultValue: DEFAULT_MCP_CONFIG.requestTimeoutSeconds,
				type: SettingsFieldType.INPUT,
				section: SETTINGS_SECTION_SLUGS.AGENTIC,
				isPositiveInteger: true
			}
		]
	},
	[SETTINGS_SECTION_SLUGS.DEVELOPER]: {
		title: SETTINGS_SECTION_TITLES.DEVELOPER,
		slug: SETTINGS_SECTION_SLUGS.DEVELOPER,
		icon: Code,
		settings: [
			{
				key: SETTINGS_KEYS.PRE_ENCODE_CONVERSATION,
				label: 'Precarica la cache KV dopo la risposta',
				help: 'After each response, re-submit the conversation to pre-fill the server KV cache. Makes the next turn faster since the prompt is already encoded while you read the response.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DEVELOPER
			},
			{
				key: SETTINGS_KEYS.DISABLE_REASONING_PARSING,
				label: 'Disattiva l\'analisi del contenuto di ragionamento',
				help: 'Send reasoning_format=none so the server returns thinking tokens inline instead of extracting them into a separate field.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DEVELOPER
			},
			{
				key: SETTINGS_KEYS.EXCLUDE_REASONING_FROM_CONTEXT,
				label: 'Escludi il ragionamento dal contesto',
				help: 'Strip thinking from previous messages before sending. When off, thinking is sent back via the reasoning_content field so the model sees its own chain-of-thought across turns.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DEVELOPER
			},
			{
				key: SETTINGS_KEYS.SHOW_RAW_OUTPUT_SWITCH,
				label: 'Abilita l\'interruttore output grezzo',
				help: 'Mostra un pulsante per visualizzare i messaggi come testo semplice invece che Markdown',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DEVELOPER
			},
			{
				key: SETTINGS_KEYS.JS_SANDBOX_ENABLED,
				label: 'Strumento sandbox JavaScript',
				help: 'Expose a run_javascript tool to the model. Code runs in a Web Worker inside a sandboxed iframe with an opaque origin, isolated from the WebUI and its API, with a hard timeout.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DEVELOPER
			},
			{
				key: SETTINGS_KEYS.SYMBOLIC_MATH_ENABLED,
				label: 'Symbolic math (nerdamer)',
				help: 'Pre-load nerdamer in the sandbox for symbolic computation: simplify, diff, integrate, solve, and more. Requires "Strumento sandbox JavaScript" to be enabled.',
				defaultValue: false,
				type: SettingsFieldType.CHECKBOX,
				section: SETTINGS_SECTION_SLUGS.DEVELOPER,
				dependsOn: SETTINGS_KEYS.JS_SANDBOX_ENABLED
			},
			{
				key: SETTINGS_KEYS.CUSTOM_JSON,
				label: 'JSON personalizzato',
				help: 'Parametri JSON personalizzati da inviare all\'API. Devono essere JSON valido.',
				defaultValue: '',
				type: SettingsFieldType.TEXTAREA,
				section: SETTINGS_SECTION_SLUGS.DEVELOPER
			},
			{
				key: SETTINGS_KEYS.CUSTOM_CSS,
				label: 'CSS personalizzato',
				help: 'CSS injected into the page at runtime. Set it here, or ship it server side via the --ui-config customCss field.',
				defaultValue: '',
				type: SettingsFieldType.TEXTAREA,
				section: SETTINGS_SECTION_SLUGS.DEVELOPER
			}
		]
	}
} as const;

const NON_UI_SETTINGS: SettingsEntry[] = [
	{
		key: SETTINGS_KEYS.SHOW_SYSTEM_MESSAGE,
		label: 'Mostra messaggio di sistema',
		help: 'Mostra il messaggio di sistema all\'inizio di ogni conversazione.',
		defaultValue: true,
		type: SettingsFieldType.CHECKBOX
	},
	{
		key: SETTINGS_KEYS.MCP_SERVERS,
		label: 'server MCP',
		help: 'Configure MCP servers as a JSON list. Use the form in the MCP Client settings section to edit.',
		defaultValue: '[]',
		type: SettingsFieldType.INPUT
	},
	{
		key: SETTINGS_KEYS.TITLE_GENERATION_USE_LLM,
		label: 'Genera il titolo con l\'LLM',
		help: 'Counterpart of the conversation title radio; stored and synced without a dedicated UI field.',
		defaultValue: false,
		type: SettingsFieldType.CHECKBOX
	}
	// {
	// 	key: SETTINGS_KEYS.PY_INTERPRETER_ENABLED,
	// 	label: 'Interprete Python abilitato',
	// 	help: 'Enable Python interpreter using Pyodide. Allows running Python code in markdown code blocks.',
	// 	defaultValue: false,
	// 	type: SettingsFieldType.CHECKBOX,
	// 	isExperimental: true,
	//
	// }
];

function getAllSettings(): SettingsEntry[] {
	const result: SettingsEntry[] = [];
	for (const section of Object.values(SETTINGS_REGISTRY)) {
		result.push(...section.settings);
	}
	result.push(...NON_UI_SETTINGS);
	return result;
}

/** Flat config object stored in localStorage. */
export const SETTING_CONFIG_DEFAULT: Record<string, SettingsConfigValue> = Object.fromEntries(
	getAllSettings().map((s) => [s.key, s.defaultValue])
) as Record<string, SettingsConfigValue>;

/** Help text for every setting (including non-UI). */
export const SETTING_CONFIG_INFO: Record<string, string> = Object.fromEntries(
	getAllSettings().map((s) => [s.key, s.help])
) as Record<string, string>;

/** Theme select options. */
export const SETTINGS_COLOR_MODES_CONFIG = COLOR_MODE_OPTIONS;

/** Sidebar sections + field configs (as consumed by UI). */
export const SETTINGS_CHAT_SECTIONS: SettingsSection[] = [
	...Object.values(SETTINGS_REGISTRY).map((section) => ({
		title: section.title,
		slug: section.slug,
		icon: section.icon,
		fields: section.settings.map((s) => ({
			key: s.key,
			label: s.label,
			type: s.type,
			isExperimental: s.isExperimental,
			isPositiveInteger: s.isPositiveInteger,
			dependsOn: s.dependsOn,
			help: s.help,
			options: s.options,
			radioOptions: s.radioOptions
		}))
	})),
	...STANDALONE_SECTIONS
];

/** INPUT-type settings whose value is a number. */
export const NUMERIC_FIELDS = getAllSettings()
	.filter((s) => s.type === SettingsFieldType.INPUT && typeof s.defaultValue !== 'string')
	.map((s) => s.key) as readonly string[];

/** Numeric fields clamped to ≥ 1 and rounded. */
export const POSITIVE_INTEGER_FIELDS = getAllSettings()
	.filter((s) => s.isPositiveInteger)
	.map((s) => s.key) as readonly string[];

/** Derived for the parameter sync service. */
export const SYNCABLE_PARAMETERS: SyncableParameter[] = getAllSettings()
	.filter((s) => s.sync !== undefined)
	.map((s) => ({
		key: s.key,
		serverKey: s.sync!.serverKey,
		type: s.sync!.paramType,
		canSync: true
	}));

export const SETTINGS_FALLBACK_EXIT_ROUTE = ROUTES.START;
