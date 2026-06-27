require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY가 .env 파일에 없습니다.');
  console.error('   .env 파일을 만들고 GEMINI_API_KEY=발급받은키 를 입력해주세요.');
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Gemini API 프록시 — 키는 서버에서만 사용, 브라우저에 노출 안 됨
app.post('/api/ai', async (req, res) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중 → http://localhost:${PORT}`);
  console.log(`📊 포털:          http://localhost:${PORT}/index.html`);
  console.log(`🏨 호스텔 계산기: http://localhost:${PORT}/hostel-calculator.html`);
});
