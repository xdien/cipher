import { z } from 'zod';
import { logger } from '@core/index.js';

export function validateCliOptions(opts: any): void {
	logger.debug('Validating CLI options', opts);
	const cliOptionShape = z.object({
		verbose: z.boolean().optional().default(true),
		mode: z
			.enum(['cli', 'mcp'], {
				errorMap: () => ({ message: 'Mode must be either cli or mcp' }),
			})
			.optional()
			.default('cli'),
		strict: z.boolean().optional().default(false),
		newSession: z.union([z.boolean(), z.string()]).optional(),
	});

	const cliOptionSchema = cliOptionShape;

	const result = cliOptionSchema.safeParse({
		verbose: opts.verbose,
		mode: opts.mode,
		strict: opts.strict,
		newSession: opts.newSession,
	});

	if (!result.success) {
		throw result.error;
	}

	logger.debug('CLI options validated successfully', result.data);
}

export function handleCliOptionsError(error: unknown): never {
	if (error instanceof z.ZodError) {
		logger.error('Invalid command-line options detected:');
		error.errors.forEach(err => {
			const fieldName = err.path.join('.') || 'Unknown Option';
			logger.error(`- Option '${fieldName}': ${err.message}`);
		});
		logger.error('Please check your command-line arguments or run with --help for usage details.');
	} else {
		logger.error(
			`Validation error: ${error instanceof Error ? error.message : JSON.stringify(error)}`
		);
	}
	process.exit(1);
}
