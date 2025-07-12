import { describe, it, expect, beforeEach } from 'vitest';
import { PromptManager } from '../manager.js';
import { getBuiltInInstructions } from '../tool-instructions.js';

describe('PromptManager', () => {
	let promptManager: PromptManager;

	beforeEach(() => {
		promptManager = new PromptManager();
	});

	describe('getCompleteSystemPrompt', () => {
		it('should return only built-in instructions when no user instruction is provided', () => {
			const completePrompt = promptManager.getCompleteSystemPrompt();
			const builtInInstructions = getBuiltInInstructions();
			
			expect(completePrompt).toBe(builtInInstructions);
		});

		it('should combine user instruction with built-in instructions', () => {
			const userInstruction = 'You are a helpful AI assistant.';
			promptManager.load(userInstruction);
			
			const completePrompt = promptManager.getCompleteSystemPrompt();
			const builtInInstructions = getBuiltInInstructions();
			
			expect(completePrompt).toContain(userInstruction);
			expect(completePrompt).toContain(builtInInstructions);
			expect(completePrompt).toContain('\n\n');
			expect(completePrompt.startsWith(userInstruction)).toBe(true);
			expect(completePrompt.endsWith(builtInInstructions)).toBe(true);
		});

		it('should handle user instruction that ends with newline', () => {
			const userInstruction = 'You are a helpful AI assistant.\n';
			promptManager.load(userInstruction);
			
			const completePrompt = promptManager.getCompleteSystemPrompt();
			const builtInInstructions = getBuiltInInstructions();
			
			expect(completePrompt).toContain(userInstruction);
			expect(completePrompt).toContain(builtInInstructions);
			expect(completePrompt).toContain('\n');
			expect(completePrompt.startsWith(userInstruction)).toBe(true);
			expect(completePrompt.endsWith(builtInInstructions)).toBe(true);
		});

		it('should handle empty string user instruction', () => {
			promptManager.load('');
			
			const completePrompt = promptManager.getCompleteSystemPrompt();
			const builtInInstructions = getBuiltInInstructions();
			
			expect(completePrompt).toBe(builtInInstructions);
		});

		it('should handle whitespace-only user instruction', () => {
			promptManager.load('   \n  \t  ');
			
			const completePrompt = promptManager.getCompleteSystemPrompt();
			const builtInInstructions = getBuiltInInstructions();
			
			expect(completePrompt).toBe(builtInInstructions);
		});
	});

	describe('getUserInstruction', () => {
		it('should return the user instruction', () => {
			const userInstruction = 'You are a helpful AI assistant.';
			promptManager.load(userInstruction);
			
			expect(promptManager.getUserInstruction()).toBe(userInstruction);
		});

		it('should return empty string when no instruction is loaded', () => {
			expect(promptManager.getUserInstruction()).toBe('');
		});
	});

	describe('getBuiltInInstructions', () => {
		it('should return the built-in tool instructions', () => {
			const builtInInstructions = getBuiltInInstructions();
			
			expect(promptManager.getBuiltInInstructions()).toBe(builtInInstructions);
		});
	});

	describe('getInstruction (legacy method)', () => {
		it('should return the user instruction only', () => {
			const userInstruction = 'You are a helpful AI assistant.';
			promptManager.load(userInstruction);
			
			expect(promptManager.getInstruction()).toBe(userInstruction);
		});

		it('should return empty string when no instruction is loaded', () => {
			expect(promptManager.getInstruction()).toBe('');
		});
	});
}); 