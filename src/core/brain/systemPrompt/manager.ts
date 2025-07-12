import { getBuiltInInstructions } from './tool-instructions.js';

export class PromptManager {
	private instruction!: string;

	/**
	 * Load instruction
	 */
	load(instruction: string) {
		this.instruction = instruction;
	}

	/**
	 * Get the instruction
	 */
	getInstruction() {
		return this.instruction || '';
	}

	/**
	 * Get the complete system prompt combining user instruction with built-in tool instructions
	 */
	getCompleteSystemPrompt(): string {
		const userInstruction = this.instruction || '';
		const builtInInstructions = getBuiltInInstructions();
		
		// Combine user instruction with built-in instructions
		// If user instruction is empty, just return built-in instructions
		if (!userInstruction.trim()) {
			return builtInInstructions;
		}
		
		// If user instruction doesn't end with a newline, add one
		const userInstructionWithNewline = userInstruction.endsWith('\n') 
			? userInstruction 
			: userInstruction + '\n';
		
		return userInstructionWithNewline + '\n' + builtInInstructions;
	}

	/**
	 * Get only the user-provided instruction (without built-in instructions)
	 */
	getUserInstruction(): string {
		return this.instruction || '';
	}

	/**
	 * Get only the built-in tool instructions
	 */
	getBuiltInInstructions(): string {
		return getBuiltInInstructions();
	}
}
