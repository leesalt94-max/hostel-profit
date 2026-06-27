// Vercel 서버리스 함수 — API 키는 Vercel 환경변수에서 관리
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY가 Vercel 환경변수에 설정되지 않았습니다.' } });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: { message: '요청에 prompt가 없습니다.' } });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const text = data.content?.[0]?.text || '응답을 받지 못했습니다.';
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
};
