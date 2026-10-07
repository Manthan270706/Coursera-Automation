/**
 * Auto Coursera — Popup Script
 * Handles UI interactions, settings persistence, and sending messages to the active tab.
 */

(function () {
    'use strict';

    // ─── Provider Configuration ────────────────────────────────────────────────

    const PROVIDER_CONFIG = {
        groq: {
            name: 'Groq',
            placeholder: 'Enter Groq API key (gsk_...)',
            models: [
                { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fast & Free Tier)' },
                { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (High Speed)' },
                { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
                { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
                { value: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B' },
                { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
                { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
                { value: '__custom__', label: '✏️ Enter Custom Model...' }
            ],
            defaultModel: 'llama-3.1-8b-instant'
        },
        gemini: {
            name: 'Gemini',
            placeholder: 'Enter Gemini API key',
            models: [
                { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
                { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
                { value: '__custom__', label: '✏️ Enter Custom Model...' }
            ],
            defaultModel: 'gemini-2.5-flash'
        }
    };

    const providerState = {
        groq: { apiKey: '', model: 'llama-3.1-8b-instant' },
        gemini: { apiKey: '', model: 'gemini-2.5-flash' }
    };
    let currentProvider = 'groq';

    // ─── DOM References ───────────────────────────────────────────────────────

    const bypassBtn         = document.getElementById('bypass');
    const autoQuizBtn       = document.getElementById('autoQuiz');
    const quizToggle        = document.getElementById('quizToggel');
    const providerSelect    = document.getElementById('provider-select');
    const keyInput          = document.getElementById('key');
    const modelSelect       = document.getElementById('model-select');
    const customModelInput  = document.getElementById('custom-model-input');
    const saveBtn           = document.getElementById('save');
    const keyStatus         = document.getElementById('key-status');

    // ─── UI Helpers ───────────────────────────────────────────────────────────

    function updateModelOptions(provider, selectedModel) {
        if (!modelSelect) return;
        const config = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.groq;
        modelSelect.innerHTML = '';

        let found = false;
        config.models.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.value;
            opt.textContent = item.label;
            modelSelect.appendChild(opt);
            if (item.value === selectedModel) found = true;
        });

        if (selectedModel && !found && selectedModel !== '__custom__') {
            // It's a custom model not in the predefined list
            modelSelect.value = '__custom__';
            if (customModelInput) {
                customModelInput.value = selectedModel;
                customModelInput.style.display = 'block';
            }
        } else {
            modelSelect.value = selectedModel || config.defaultModel;
            if (customModelInput) {
                customModelInput.style.display = modelSelect.value === '__custom__' ? 'block' : 'none';
            }
        }
    }

    function fetchAvailableGroqModels(apiKey) {
        if (!apiKey || !apiKey.startsWith('gsk_')) return;
        chrome.runtime.sendMessage({ action: 'getGroqModels', apiKey }, response => {
            if (response?.ok && Array.isArray(response.models) && response.models.length > 0) {
                const fetchedModels = response.models.map(id => ({ value: id, label: id }));
                fetchedModels.push({ value: '__custom__', label: '✏️ Enter Custom Model...' });
                PROVIDER_CONFIG.groq.models = fetchedModels;
                const activeModel = providerState.groq.model || 'llama-3.1-8b-instant';
                if (currentProvider === 'groq') {
                    updateModelOptions('groq', activeModel);
                }
            }
        });
    }

    function updateUIForProvider(provider) {
        currentProvider = provider;
        const config = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.groq;
        const state = providerState[provider] || { apiKey: '', model: config.defaultModel };

        if (keyInput) {
            keyInput.placeholder = config.placeholder;
            keyInput.value = state.apiKey || '';
        }

        updateModelOptions(provider, state.model);

        if (keyStatus) {
            keyStatus.textContent = state.apiKey
                ? `✅ ${config.name} API key configured.`
                : `Enter your ${config.name} API key for auto-solving quizzes.`;
        }

        if (provider === 'groq' && state.apiKey) {
            fetchAvailableGroqModels(state.apiKey);
        }
    }

    // ─── Storage helpers ──────────────────────────────────────────────────────

    function getActiveModelValue() {
        if (modelSelect?.value === '__custom__') {
            return customModelInput?.value.trim() || '';
        }
        return modelSelect ? modelSelect.value : '';
    }

    function saveSettings() {
        return new Promise((resolve) => {
            if (providerSelect) currentProvider = providerSelect.value;
            let currentKey = keyInput ? keyInput.value.trim() : '';

            // Auto-detect provider if user pasted a recognizable key
            if (currentKey.startsWith('gsk_')) {
                currentProvider = 'groq';
                if (providerSelect) providerSelect.value = 'groq';
            } else if (currentKey.startsWith('AIza')) {
                currentProvider = 'gemini';
                if (providerSelect) providerSelect.value = 'gemini';
            }

            const currentModel = getActiveModelValue();
            providerState[currentProvider].apiKey = currentKey;
            providerState[currentProvider].model = currentModel;

            const settings = {
                provider: currentProvider,
                groqApiKey: providerState.groq.apiKey,
                groqModel: providerState.groq.model,
                geminiApiKey: providerState.gemini.apiKey,
                geminiModel: providerState.gemini.model,
                apiKey: currentKey,
                model: currentModel,
                quizEnabled: quizToggle ? quizToggle.checked : false,
            };

            chrome.storage.local.set(settings, () => {
                if (saveBtn) {
                    saveBtn.textContent = 'Saved ✓';
                    saveBtn.classList.add('saved');
                    setTimeout(() => {
                        saveBtn.textContent = 'Save Settings';
                        saveBtn.classList.remove('saved');
                    }, 2000);
                }
                const config = PROVIDER_CONFIG[currentProvider] || PROVIDER_CONFIG.groq;
                if (keyStatus) {
                    keyStatus.textContent = settings.apiKey
                        ? `✅ ${config.name} settings saved (${currentModel}).`
                        : `${config.name} API key cleared.`;
                }
                resolve(settings);
            });
        });
    }

    function loadSettings() {
        chrome.storage.local.get([
            'provider',
            'apiKey',
            'model',
            'groqApiKey',
            'groqModel',
            'geminiApiKey',
            'geminiModel',
            'quizEnabled'
        ], (result) => {
            let provider = result.provider || 'groq';

            // Populate Groq state
            providerState.groq.apiKey = result.groqApiKey || (result.apiKey && result.apiKey.startsWith('gsk_') ? result.apiKey : '');
            providerState.groq.model = result.groqModel || (result.model && !result.model.startsWith('gemini') ? result.model : 'llama-3.1-8b-instant');

            // Populate Gemini state
            providerState.gemini.apiKey = result.geminiApiKey || (result.apiKey && !result.apiKey.startsWith('gsk_') ? result.apiKey : '');
            providerState.gemini.model = result.geminiModel || (result.model && result.model.startsWith('gemini') ? result.model : 'gemini-2.5-flash');

            // Auto-detect provider if user stored a gsk_ key
            if (providerState.groq.apiKey && !providerState.gemini.apiKey) {
                provider = 'groq';
            }

            if (providerSelect) {
                providerSelect.value = provider;
            }

            updateUIForProvider(provider);

            if (quizToggle) {
                quizToggle.checked = result.quizEnabled === true;
            }
        });
    }

    // ─── Tab messaging ────────────────────────────────────────────────────────

    function getActiveTab() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                resolve(tabs[0] || null);
            });
        });
    }

    async function sendToTab(action) {
        const tab = await getActiveTab();
        if (!tab) return;

        // Check if we're on a Coursera course page
        if (!tab.url || !tab.url.includes('coursera.org/learn')) {
            showToast('⚠️ Please navigate to a Coursera course page first.');
            return;
        }

        chrome.tabs.sendMessage(tab.id, { action }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[AutoCoursera Popup]', chrome.runtime.lastError.message);
                showToast('⚠️ Could not connect to page. Try reloading the Coursera tab.');
                return;
            }
            if (response?.ok === false) {
                showToast(response.error || 'The page could not start that action.');
                return;
            }
            window.close();
        });
    }

    // ─── Toast notification ───────────────────────────────────────────────────

    function showToast(message) {
        let toast = document.getElementById('ac-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ac-toast';
            toast.style.cssText = `
                position: fixed; bottom: 12px; left: 12px; right: 12px;
                background: #1e293b; color: #fde68a; border-radius: 8px;
                padding: 10px 14px; font-size: 12px; z-index: 9999;
                border: 1px solid #475569; animation: fadeIn 0.2s ease;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
    }

    // ─── Event handlers ───────────────────────────────────────────────────────

    if (providerSelect) {
        providerSelect.addEventListener('change', () => {
            // Save state of current before switching
            if (keyInput) providerState[currentProvider].apiKey = keyInput.value.trim();
            if (modelSelect) providerState[currentProvider].model = modelSelect.value;
            updateUIForProvider(providerSelect.value);
        });
    }

    if (keyInput) {
        keyInput.addEventListener('input', () => {
            providerState[currentProvider].apiKey = keyInput.value.trim();
        });
        keyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveSettings();
        });
    }

    if (modelSelect) {
        modelSelect.addEventListener('change', () => {
            if (modelSelect.value === '__custom__') {
                if (customModelInput) {
                    customModelInput.style.display = 'block';
                    customModelInput.focus();
                }
            } else {
                if (customModelInput) customModelInput.style.display = 'none';
                providerState[currentProvider].model = modelSelect.value;
            }
        });
    }

    if (customModelInput) {
        customModelInput.addEventListener('input', () => {
            providerState[currentProvider].model = customModelInput.value.trim();
        });
    }

    if (bypassBtn) {
        bypassBtn.addEventListener('click', () => {
            sendToTab('bypass');
        });
    }

    if (autoQuizBtn) {
        autoQuizBtn.addEventListener('click', async () => {
            const tab = await getActiveTab();
            if (!tab || !tab.url || !tab.url.includes('coursera.org/learn')) {
                showToast('⚠️ Please navigate to a Coursera quiz page first.');
                return;
            }

            const activeKey = keyInput ? keyInput.value.trim() : '';
            const config = PROVIDER_CONFIG[currentProvider] || PROVIDER_CONFIG.groq;
            if (!activeKey) {
                showToast(`⚠️ Please enter your ${config.name} API key first.`);
                if (keyInput) keyInput.focus();
                return;
            }

            // Save settings first and wait for storage commit then trigger solve
            await saveSettings();
            await sendToTab('autoQuiz');
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }

    if (quizToggle) {
        quizToggle.addEventListener('change', () => {
            chrome.storage.local.set({ quizEnabled: quizToggle.checked });
        });
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadSettings, { once: true });
    else loadSettings();

})();
