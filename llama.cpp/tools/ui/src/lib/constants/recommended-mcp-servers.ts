import type { RecommendedMCPServer } from '$lib/types';

// Suggested MCP servers shown as opt-in cards in the "Aggiungi nuovo server" dialog.
// Rendering these cards never reaches the upstream domain - favicons come
// from local bundles in static/recommended-mcp/ and the URL is only used
// after the user clicks Add.
export const RECOMMENDED_MCP_SERVERS: RecommendedMCPServer[] = [
	{
		id: 'exa',
		name: 'Exa',
		description: 'Cerca sul web e ottieni il contenuto completo delle pagine in markdown.',
		url: 'https://mcp.exa.ai/mcp',
		iconUrl: '/recommended-mcp/exa.ico'
	},
	{
		id: 'huggingface',
		name: 'Hugging Face',
		description: 'Cerca modelli, dataset, spazi e documentazione su Hugging Face Hub.',
		url: 'https://huggingface.co/mcp',
		iconUrl: '/recommended-mcp/huggingface.ico'
	},
	{
		id: 'github',
		name: 'GitHub',
		description: 'Cerca repository, issue e pull request e interagisci con il codice su GitHub.',
		url: 'https://api.githubcopilot.com/mcp',
		iconUrlLight: '/recommended-mcp/github-light.png',
		iconUrlDark: '/recommended-mcp/github-dark.png',
		needsAuthorization: true
	},
	{
		id: 'context7',
		name: 'Context7',
		description: 'Consulta documentazione aggiornata ed esempi di codice per librerie e framework.',
		url: 'https://mcp.context7.com/mcp',
		iconUrl: '/recommended-mcp/context7.png'
	}
];
