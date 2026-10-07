/**
 * Helper class for interacting with AI models (Groq and Gemini)
 */
class AIHelper {
    constructor(provider = 'groq', apiKey = '', model = '') {
        this.provider = (provider || 'groq').toLowerCase();
        this.apiKey = apiKey;
        if (!model) {
            this.model = this.provider === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.1-8b-instant';
        } else {
            this.model = model;
        }
    }

    async generateResponse(prompt, responseMimeType = "application/json") {
        const providerTitle = this.provider === 'gemini' ? 'Gemini' : 'Groq';
        if (!this.apiKey) {
            throw new Error(`${providerTitle} API Key is missing.`);
        }
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'aiGenerate',
                provider: this.provider,
                apiKey: this.apiKey,
                model: this.model,
                prompt,
                responseMimeType,
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(`Could not reach the extension service: ${chrome.runtime.lastError.message}`));
                    return;
                }
                if (!response?.ok) {
                    reject(new Error(response?.error || `${providerTitle} request failed.`));
                    return;
                }
                resolve(response.text);
            });
        });
    }

    async solveQuestions(questionsPrompt) {
        const fullPrompt = `You are an expert Coursera assessment solver. Analyze the provided assessment JSON questions carefully and provide the correct answers.

CRITICAL INSTRUCTIONS:
1. For single-choice questions ('allowMultiple' is false): select exactly ONE correct option and return its 0-indexed number in 'correctOptionsIndex' (e.g. [2]).
2. For multi-select questions ('allowMultiple' is true): select ALL correct options and return their 0-indexed numbers in 'correctOptionsIndex' (e.g. [0, 2, 3]).
3. Provide 'correctOptions' as an array containing the exact text strings of the selected options.
4. For text questions, provide 'content' as the string answer.
5. Respond with ONLY a valid JSON array of objects corresponding to each question in the exact same order. Do NOT include markdown formatting or explanations outside the JSON array.

Question Data:
${questionsPrompt}`;
        const responseText = await this.generateResponse(fullPrompt);
        try {
            return AIHelper.parseAnswers(responseText);
        } catch (e) {
            console.error("Failed to parse AI response:", responseText);
            throw new Error(e.message || "AI returned invalid JSON.");
        }
    }

    static parseAnswers(responseText) {
        if (!responseText || !responseText.trim()) {
            throw new Error("AI returned empty response.");
        }
        const cleaned = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

        // 1. Direct parse attempt
        try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') {
                for (const key of Object.keys(parsed)) {
                    if (Array.isArray(parsed[key])) return parsed[key];
                }
            }
        } catch (_) {}

        // 2. Extract [ ... ] block
        const firstBracket = cleaned.indexOf('[');
        const lastBracket = cleaned.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
            try {
                const parsed = JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
                if (Array.isArray(parsed)) return parsed;
            } catch (_) {}
        }

        // 3. Extract { ... } block and inspect its properties
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            try {
                const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
                for (const key of Object.keys(parsed)) {
                    if (Array.isArray(parsed[key])) return parsed[key];
                }
            } catch (_) {}
        }

        throw new Error("AI returned invalid JSON: could not extract answer array.");
    }
}

class GeminiAI extends AIHelper {
    constructor(apiKey, model = 'gemini-2.5-flash') {
        super('gemini', apiKey, model);
    }
}

class GroqAI extends AIHelper {
    constructor(apiKey, model = 'llama-3.1-8b-instant') {
        super('groq', apiKey, model);
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIHelper, GeminiAI, GroqAI };
} else {
    window.AIHelper = AIHelper;
    window.GeminiAI = GeminiAI;
    window.GroqAI = GroqAI;
}
