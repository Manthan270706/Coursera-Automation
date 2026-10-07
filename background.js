chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (!tab.url || changeInfo.status !== 'complete') return;

    let url;
    try { url = new URL(tab.url); } catch (_) { return; }
    if (!url.hostname.endsWith('coursera.org') || !url.pathname.startsWith('/learn/')) return;

    if (url.pathname.replace(/\/+$/, '').endsWith('/attempt')) {
        chrome.tabs.sendMessage(tabId, { action: 'attempt' }, function () {
            if (chrome.runtime.lastError) {
                console.log('Error sending message to tab:', chrome.runtime.lastError.message);
            }
        });
    }
});


chrome.runtime.onInstalled.addListener(function () {
    chrome.tabs.query({ url: "https://www.coursera.org/*" }, function (tabs) {
        tabs.forEach(function (tab) {
            if (tab.id !== undefined) chrome.tabs.reload(tab.id);
        });
    });
});

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    const isGroqKey = typeof message?.apiKey === 'string' && message.apiKey.trim().startsWith('gsk_');
    const isGeminiKey = typeof message?.apiKey === 'string' && message.apiKey.trim().startsWith('AIza');

    if (message?.action === 'geminiGenerate') {
        // If the key is a Groq key (e.g. from an unrefreshed tab), route to Groq automatically
        const handler = isGroqKey ? generateWithGroq : generateWithGemini;
        handler(message)
            .then(text => sendResponse({ ok: true, text }))
            .catch(error => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message?.action === 'groqGenerate') {
        generateWithGroq(message)
            .then(text => sendResponse({ ok: true, text }))
            .catch(error => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message?.action === 'getGroqModels') {
        const apiKey = message.apiKey?.trim();
        if (!apiKey) {
            sendResponse({ ok: false, error: 'No API key provided.' });
            return false;
        }
        fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data?.data && Array.isArray(data.data)) {
                const chatModels = data.data
                    .map(m => m.id)
                    .filter(id => !id.includes('whisper') && !id.includes('guard') && !id.includes('orpheus'))
                    .sort();
                sendResponse({ ok: true, models: chatModels });
            } else {
                sendResponse({ ok: false, error: data?.error?.message || 'Could not fetch models' });
            }
        })
        .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (message?.action === 'aiGenerate') {
        let handler = generateWithGroq;
        if (isGroqKey) {
            handler = generateWithGroq;
        } else if (isGeminiKey) {
            handler = generateWithGemini;
        } else if (message.provider === 'gemini') {
            handler = generateWithGemini;
        }
        handler(message)
            .then(text => sendResponse({ ok: true, text }))
            .catch(error => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    return false;
});

async function generateWithGroq({ apiKey, model, prompt }) {
    if (!apiKey) throw new Error('Groq API key is missing.');
    let activeModel = (model || '').trim();
    if (!activeModel || activeModel.startsWith('gemini')) {
        activeModel = 'llama-3.1-8b-instant';
    }
    if (!/^[A-Za-z0-9._/:-]+$/.test(activeModel)) throw new Error('Invalid Groq model name.');
    if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Groq prompt is empty.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response;
    try {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.trim()}`,
            },
            body: JSON.stringify({
                model: activeModel.trim(),
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert Coursera quiz solver. You always strictly follow formatting instructions and output valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1
            }),
            signal: controller.signal,
        });
    } catch (error) {
        if (error?.name === 'AbortError') throw new Error('Groq request timed out.');
        throw new Error(`Could not reach Groq: ${error.message}`);
    } finally {
        clearTimeout(timeout);
    }

    const body = await response.text();
    let data = null;
    try { data = JSON.parse(body); } catch (_) { /* handled below */ }
    if (!response.ok) {
        throw new Error(data?.error?.message || `Groq API request failed (HTTP ${response.status}).`);
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Groq returned no answer content.');
    return text;
}

async function generateWithGemini({ apiKey, model, prompt, responseMimeType }) {
    if (!apiKey) throw new Error('Gemini API key is missing.');
    if (!/^[A-Za-z0-9._-]+$/.test(model || '')) throw new Error('Invalid Gemini model name.');
    if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Gemini prompt is empty.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response;
    try {
        response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: responseMimeType || 'application/json',
                    },
                }),
                signal: controller.signal,
            }
        );
    } catch (error) {
        if (error?.name === 'AbortError') throw new Error('Gemini request timed out.');
        throw new Error(`Could not reach Gemini: ${error.message}`);
    } finally {
        clearTimeout(timeout);
    }

    const body = await response.text();
    let data = null;
    try { data = JSON.parse(body); } catch (_) { /* handled below */ }
    if (!response.ok) {
        throw new Error(data?.error?.message || `Gemini API request failed (HTTP ${response.status}).`);
    }

    const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!text) throw new Error('Gemini returned no answer content.');
    return text;
}
