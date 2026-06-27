require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY가 .env 파일에 없습니다.');
  console.error('   .env 파일을 만들고 ANTHROPIC_API_KEY=발급받은키 를 입력해주세요.');
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Claude API 프록시 — 키는 서버에서만 사용, 브라우저에 노출 안 됨
app.post('/api/ai', async (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중 → http://localhost:${PORT}`);
  console.log(`📊 포털:          http://localhost:${PORT}/index.html`);
  console.log(`🏨 호스텔 계산기: http://localhost:${PORT}/hostel-calculator.html`);
});
