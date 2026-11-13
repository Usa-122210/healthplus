function validateAiGeneratedText({ text, unavailableIngredients = [], allergies = [] }) {
  if (!text || typeof text !== 'string' || text.trim().length < 8) {
    return { valid: false, reason: 'empty_response' };
  }
  const lower = text.toLowerCase();
  const forbiddenDosage = /\b(take\s+\d+\s*(mg|ml|units)|insulin\s*dose\s*\d+|prescribe)\b/i;
  if (forbiddenDosage.test(lower)) {
    return { valid: false, reason: 'clinical_prescription_violation' };
  }

  for (const ing of unavailableIngredients) {
    const cleanIng = String(ing).replace('_', ' ');
    const recommendPattern = new RegExp(`(cook|make|eat|try|suggest|banayein|khao)[^.!\\n]{0,45}\\b${cleanIng}\\b`, 'i');
    if (recommendPattern.test(lower)) {
      return { valid: false, reason: `suggested_unavailable_ingredient:${cleanIng}` };
    }
  }

  const allergenKeywords = {
    dairy: ['paneer', 'milk', 'dahi', 'curd', 'cheese', 'ghee'],
    peanuts: ['peanut', 'peanuts', 'moongfali'],
    gluten: ['wheat', 'roti', 'atta', 'suji', 'chapati'],
    eggs: ['egg', 'eggs', 'anda'],
    soy: ['soya', 'tofu', 'soybean'],
  };
  for (const allergy of allergies) {
    for (const term of allergenKeywords[allergy] || []) {
      const recommendPattern = new RegExp(`(cook|make|eat|try|suggest|banayein|khao)[^.!\\n]{0,45}\\b${term}\\b`, 'i');
      if (recommendPattern.test(lower)) {
        return { valid: false, reason: `suggested_allergen:${allergy}` };
      }
    }
  }

  return { valid: true, reason: null };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

  if (!hasGemini && !hasOpenAI) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        configured: false,
        provider: null,
        reason: 'missing_llm_credentials',
      })
    );
    return;
  }

  try {
    const body = await readJsonBody(req);
    const {
      message = '',
      targetLanguage = 'hinglish',
      intent = 'general_checkin',
      userContext = {},
      history = [],
      candidateReplyHint = '',
    } = body;

    const systemPrompt = [
      'You are HEALTH PLUS (Team CASA Vital), an empathetic Indian personal wellness companion.',
      `Strictly respond in language code "${targetLanguage}" ("hi"=Devanagari Hindi, "hinglish"=natural conversational Hindi-English romanized, "en"=clean warm English). NEVER switch languages abruptly without the user asking.`,
      'STRICT GROUNDING RULES:',
      '1. NEVER invent meals logged, workout reps, calories consumed, blood reports, or confidence scores.',
      '2. Only cite nutrition metrics present in the verified JSON context below; if meals are empty, state honestly that nothing is logged yet.',
      '3. NEVER prescribe medications, insulin doses, or medical diagnoses; advise physician consultation cleanly.',
      `4. Excluded allergens (HARD NEVER RECOMMEND): ${JSON.stringify(userContext.allergies || [])}.`,
      `5. Unavailable ingredients at home right now (DO NOT RECOMMEND): ${JSON.stringify(userContext.unavailableIngredients || [])}.`,
      `User profile & real state JSON: ${JSON.stringify(userContext)}`,
      `Safe deterministic baseline guidance: ${candidateReplyHint}`,
    ].join('\n');

    let llmText = '';
    let usedProvider = hasGemini ? 'gemini' : 'openai';
    let modelName = hasGemini ? 'gemini-2.0-flash' : 'gpt-4o-mini';

    if (hasGemini) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
        process.env.GEMINI_API_KEY.trim()
      )}`;
      const contents = [
        ...history.slice(-6).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(h.content || '') }],
        })),
        { role: 'user', parts: [{ text: String(message) }] },
      ];
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 450 },
        }),
      });
      if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}`);
      const json = await resp.json();
      llmText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.4,
          max_tokens: 450,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-6).map((h) => ({
              role: h.role === 'assistant' ? 'assistant' : 'user',
              content: String(h.content || ''),
            })),
            { role: 'user', content: String(message) },
          ],
        }),
      });
      if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}`);
      const json = await resp.json();
      llmText = json?.choices?.[0]?.message?.content || '';
    }

    const validation = validateAiGeneratedText({
      text: llmText,
      unavailableIngredients: userContext.unavailableIngredients || [],
      allergies: userContext.allergies || [],
    });

    if (!validation.valid) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          ok: true,
          configured: true,
          provider: usedProvider,
          model: modelName,
          validated: false,
          validationReason: validation.reason,
          intent,
        })
      );
      return;
    }

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        configured: true,
        provider: usedProvider,
        model: modelName,
        validated: true,
        content: llmText.trim(),
        intent,
      })
    );
  } catch (err) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: false,
        configured: true,
        error: err instanceof Error ? err.message : 'gateway_error',
      })
    );
  }
};

module.exports.validateAiGeneratedText = validateAiGeneratedText;
