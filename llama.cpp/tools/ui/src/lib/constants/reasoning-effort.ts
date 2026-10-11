import { ReasoningEffort } from '$lib/enums';
import type { ReasoningEffortLevel } from '$lib/types';

/**
 * Reasoning effort UI labels.
 * Keys match the ReasoningEffort enum values for type-safe lookups.
 */
export const REASONING_EFFORT_LABELS: Record<string, string> = {
	[ReasoningEffort.DEFAULT]: 'Default',
	[ReasoningEffort.OFF]: 'Off',
	[ReasoningEffort.LOW]: 'Low',
	[ReasoningEffort.MEDIUM]: 'Medium',
	[ReasoningEffort.HIGH]: 'High',
	[ReasoningEffort.MAX]: 'Max'
};

export const REASONING_EFFORT_LEVELS: ReasoningEffortLevel[] = [
	{ value: ReasoningEffort.DEFAULT, label: 'Predefinito' },
	{ value: ReasoningEffort.OFF, label: 'Disattivato' },
	{ value: ReasoningEffort.LOW, label: 'Basso' },
	{ value: ReasoningEffort.MEDIUM, label: 'Medio' },
	{ value: ReasoningEffort.HIGH, label: 'Alto' },
	{ value: ReasoningEffort.MAX, label: 'Massimo', hasInfo: true }
];
