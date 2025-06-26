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
		return this.instruction;
	}
}
