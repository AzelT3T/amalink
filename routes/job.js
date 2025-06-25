const express = require('express');
const pool = require('../db');
const path = require('path');
const router = express.Router();

// GET 求人フォーム
router.get('/new', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.sendFile(path.join(__dirname, '../public/job_form.html'));
});

// POST 求人登録処理
router.post('/new', async (req, res) => {
  if (!req.session.user) return res.status(401).send('ログインしてください');

  const userId = req.session.user.id;
  const { title, description, location, salary } = req.body;

  try {
    const [company] = await pool.query(
      'SELECT * FROM companies WHERE created_by = ?',
      [userId]
    );

    if (company.length === 0) {
      return res.status(400).send('企業登録が必要です');
    }

    await pool.query(
      `INSERT INTO jobs (title, description, location, salary, created_by_company_id)
       VALUES (?, ?, ?, ?, ?)`,
      [title, description, location, salary, company[0].id]
    );

    res.redirect('/home');
  } catch (err) {
    console.error(err);
    res.status(500).send('求人登録に失敗しました');
  }
});

router.get('/applied', (req, res) => {
  const status = req.query.status;

  let message = '応募が完了しました！ご応募ありがとうございます。';
  if (status === 'already') {
    message = 'すでにこの求人に応募済みです。';
  }

  const html = `
    <html><head><title>応募完了</title><link rel="stylesheet" href="/css/style.css"></head>
    <body><div class="container">
      <h2>${message}</h2>
      <a href="/home" class="button-link">トップページに戻る</a>
    </div></body></html>
  `;
  res.send(html);
});


// 求人詳細ページ
router.get('/:id', async (req, res) => {
  const jobId = req.params.id;

  try {
    const [jobRows] = await pool.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (jobRows.length === 0) return res.status(404).send('求人が見つかりません');

    const job = jobRows[0];

    // 企業名取得
    const [companyRows] = await pool.query(
      'SELECT name FROM companies WHERE id = ?',
      [job.created_by_company_id]
    );

    const companyName = companyRows[0]?.name || '不明な企業';

    let html = `
      <html><head><title>${job.title}</title><link rel="stylesheet" href="/css/style.css"></head>
      <body><div class="container">
        <h1>${job.title}</h1>
        <p>${job.description}</p>
        <p>企業名: ${companyName}</p>
        <p>勤務地: ${job.location || '不明'}</p>
        <p>給与: ${job.salary || '不明'}</p>
        <form method="POST" action="/job/${job.id}/apply">
          <button type="submit">この求人に応募する</button>
        </form>
        <a href="/home">← 戻る</a>
      </div></body></html>
    `;
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('詳細ページの表示に失敗しました');
  }
});


// 応募処理
router.post('/:id/apply', async (req, res) => {
  if (!req.session.user) return res.status(401).send('ログインしてください');

  const userId = req.session.user.id;
  const jobId = req.params.id;

  try {
    const [existing] = await pool.query(
      'SELECT * FROM applications WHERE user_id = ? AND job_id = ?',
      [userId, jobId]
    );

    if (existing.length > 0) {
      return res.redirect('/job/applied?status=already');
    }

    await pool.query(
      'INSERT INTO applications (user_id, job_id) VALUES (?, ?)',
      [userId, jobId]
    );

    res.redirect('/job/applied?status=ok');
  } catch (err) {
    console.error(err);
    res.status(500).send('応募に失敗しました');
  }
});



module.exports = router;
