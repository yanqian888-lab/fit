const { generateDiary } = require('./src/controllers/aiController');

function mockReq(query) {
  return { userId: 1, query };
}
function mockRes() {
  const res = {};
  res.status = (code) => { res._code = code; return res; };
  res.json = (data) => { console.log('RESPONSE:', JSON.stringify(data, null, 2)); return res; };
  return res;
}

(async () => {
  const req = mockReq({ date: '2026-07-01' });
  const res = mockRes();
  await generateDiary(req, res);
})();
