const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT =
  '너는 번역기다. 절대 인사말, 부연 설명, 마크다운을 출력하지 마라. ' +
  '입력 언어를 자동 감지하여 한국어→베트남어, 베트남어→한국어로 번역하라. ' +
  '원문을 요약·축소·변형하지 말고 100% 보존하라. ' +
  '반드시 다음 JSON 형식으로만 응답하라: {"translation":"번역결과"}';

const cleanJson = (raw) => {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
};

const handleError = (status) => {
  if (status === 429) throw new Error('RATE_LIMIT');
  if (status >= 400) throw new Error('SERVER_ERROR');
};

export const translateText = async (text, settings) => {
  if (settings.aiProvider === 'groq') {
    return callGroq(text, settings.groqApiKey, SYSTEM_PROMPT);
  }
  return callGeminiText(text, settings.apiKey);
};

export const translateImage = async (base64, mimeType = 'image/jpeg', settings) => {
  return callGeminiImage(base64, mimeType, settings.apiKey);
};

export const askFollowUp = async (original, translation, type, settings) => {
  const prompts = {
    context:
      `원문: "${original}"\n번역: "${translation}"\n` +
      '이 표현에 대해 현지에서 주의할 점이나 상황 설명을 딱 한 줄로 알려줘. ' +
      '반드시 JSON 형식: {"translation":"한 줄 설명"}',
    simple:
      `원문: "${original}"\n번역: "${translation}"\n` +
      '현지인이 실제로 쓰는 가장 짧고 쉬운 서바이벌 표현과 직관적인 한글 발음을 알려줘. ' +
      '반드시 JSON 형식: {"translation":"베트남어 표현 (한글발음)"}',
  };

  const prompt = prompts[type];
  if (settings.aiProvider === 'groq') {
    return callGroq(prompt, settings.groqApiKey, SYSTEM_PROMPT);
  }
  return callGeminiText(prompt, settings.apiKey);
};

export const testApiKey = async (settings) => {
  try {
    const result = await translateText('안녕', settings);
    return result ? { ok: true } : { ok: false, message: '응답이 없습니다.' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
};

async function callGeminiText(text, apiKey) {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
      },
    }),
  });
  handleError(res.status);
  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return cleanJson(raw);
}

async function callGeminiImage(base64, mimeType, apiKey) {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: '이 이미지의 텍스트를 번역해줘.' },
          ],
        },
      ],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
      },
    }),
  });
  handleError(res.status);
  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return cleanJson(raw);
}

async function callGroq(userMessage, apiKey, systemPrompt) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });
  handleError(res.status);
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content ?? '';
  return cleanJson(raw);
}
