const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const app = express();
const session = require('express-session');
const jobRoutes = require('./routes/job');
const pool = require('./db');

const PORT = process.env.PORT || 3000;

require('dotenv').config();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(session({
  secret: 'your_secret_key', // ここは安全な文字列にする
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // ローカル開発用（本番は true & HTTPS）
}));

app.use('/job', jobRoutes);
app.use('/auth', authRoutes);

app.get('/home', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');

  const userId = req.session.user.id;
  const keyword = req.query.q;
  let jobsQuery = 'SELECT * FROM jobs WHERE is_published = TRUE';
  let params = [];

  if (keyword) {
    jobsQuery += ` AND (
      title LIKE ? OR
      description LIKE ? OR
      location LIKE ? OR
      salary LIKE ?
    )`;
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
  }

  jobsQuery += ' ORDER BY created_at DESC';

  try {
    const [companies] = await pool.query(
      'SELECT * FROM companies WHERE created_by = ?',
      [userId]
    );

    const [jobs] = await pool.query(jobsQuery, params);

    let html = `
      <html><head><title>AmaLink ホーム</title><link rel="stylesheet" href="/css/style2.css"></head>
      <body><div class="container">
      <h1 class="logo">AmaLink</h1>
      <p class="tagline">ようこそ、${req.session.user.name} さん</p>
    `;

    if (req.session.user.role === 'company') {
      if (companies.length > 0) {
        html += `<a href="/job/new" class="button-link">求人登録はこちら</a>`;
        html += `<a href="/dashboard" class="button-link">企業ダッシュボード</a>`;
      } else {
        html += `<a href="/auth/company" class="button-link">企業登録はこちら</a>`;
      }
    }

    html += `
      <h2>求人一覧</h2>
      <form method="GET" action="/home">
        <input type="text" name="q" value="${keyword || ''}" placeholder="キーワード検索">
        <button type="submit">検索</button>
      </form>
      <div class="job-grid">
    `;

    for (const job of jobs) {
      html += `
        <div class="form-card">
          <h3><a href="/job/${job.id}">${job.title}</a></h3>
          <p>${job.description.substring(0, 60)}...</p>
          <small>${job.location || '勤務地不明'} / ${job.salary || '給与不明'}</small>
        </div>
      `;
    }

    html += `</div></div></body></html>`;
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('ページ表示に失敗しました');
  }
});


app.get('/dashboard', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'company') {
    return res.status(403).send('アクセス権限がありません');
  }

  const userId = req.session.user.id;

  try {
    const [companyRows] = await pool.query(
      'SELECT * FROM companies WHERE created_by = ?',
      [userId]
    );
    if (companyRows.length === 0) return res.redirect('/auth/company');

    const companyId = companyRows[0].id;

    const [jobs] = await pool.query(
      'SELECT * FROM jobs WHERE created_by_company_id = ?',
      [companyId]
    );

let html = `
  <html>
    <head>
      <title>企業ダッシュボード</title>
      <link rel="stylesheet" href="/css/dashboard.css">
    </head>
    <body>
      <div class="container">
        <h1>${companyRows[0].name} のダッシュボード</h1>
        <h2>求人閲覧数（ダミーグラフ）</h2>
        <img src="https://quickchart.io/chart?c={type:'bar',data:{labels:['Job1','Job2'],datasets:[{label:'Views',data:[10,20]}]}}" class="chart" alt="閲覧数グラフ">

        <h2>掲載中の求人一覧</h2>
        <ul>
      `;

      for (const job of jobs) {
        const toggleLabel = job.is_published ? '非公開にする' : '公開にする';
        const toggleAction = job.is_published ? 'unpublish' : 'publish';

        html += `
          <li>
            <a href="/dashboard/job/${job.id}">${job.title}</a>
            <form method="POST" action="/dashboard/job/${job.id}/${toggleAction}" style="display:inline; margin-left: 10px;">
              <button type="submit" class="toggle-button">${toggleLabel}</button>
              <a href="/job/${job.id}/edit" class="edit-link">編集</a>
            </form>
          </li>
        `;
      }

      html += `
              </ul>
              <a href="/home" class="button-link">← ホームへ戻る</a>
            </div>
          </body>
        </html>
      `;
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('ダッシュボード表示に失敗しました');
  }
});

app.get('/dashboard/job/:id', async (req, res) => {
  const jobId = req.params.id;
  if (!req.session.user || req.session.user.role !== 'company') {
    return res.status(403).send('アクセス権限がありません');
  }

  try {
    const [jobRows] = await pool.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (jobRows.length === 0) return res.status(404).send('求人が見つかりません');

    const job = jobRows[0];

    // 応募者取得
    const [applicants] = await pool.query(
      `SELECT users.name, users.email, applications.applied_at
       FROM applications
       JOIN users ON users.id = applications.user_id
       WHERE applications.job_id = ?`,
      [jobId]
    );

    let html = `
      <html><head><title>${job.title} 応募者</title><link rel="stylesheet" href="/css/dashboard.css"></head>
      <body><div class="container">
        <h1>${job.title} の応募者一覧</h1>
    `;

    if (applicants.length === 0) {
      html += `<p>まだ応募者がいません。</p>`;
    } else {
      html += `<ul>`;
      for (const a of applicants) {
        html += `<li>${a.name}（${a.email}） - ${new Date(a.applied_at).toLocaleString()}</li>`;
      }
      html += `</ul>`;
    }

    html += `<a href="/dashboard">← ダッシュボードに戻る</a></div></body></html>`;
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('応募者表示に失敗しました');
  }
});

app.post('/dashboard/job/:id/publish', async (req, res) => {
  await pool.query('UPDATE jobs SET is_published = TRUE WHERE id = ?', [req.params.id]);
  res.redirect('/dashboard');
});

app.post('/dashboard/job/:id/unpublish', async (req, res) => {
  await pool.query('UPDATE jobs SET is_published = FALSE WHERE id = ?', [req.params.id]);
  res.redirect('/dashboard');
});

app.get('/job/:id/edit', async (req, res) => {
  const jobId = req.params.id;
  const [[job]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [jobId]);

  if (!job) {
    return res.status(404).send('求人が見つかりません');
  }

  res.send(`
    <html>
      <head>
        <title>求人編集 - AmaLink</title>
        <link rel="stylesheet" href="/css/dashboard.css">
      </head>
      <body>
        <div class="container">
          <h1>求人編集</h1>
          <form method="POST" action="/job/${job.id}/edit" class="form-card">
            <input name="title" value="${job.title}" required><br>
            <textarea name="description" rows="6" required>${job.description}</textarea><br>
            <input name="location" value="${job.location || ''}" placeholder="勤務地"><br>
            <input name="salary" value="${job.salary || ''}" placeholder="給与"><br>
            <button type="submit" class="button-link">更新する</button>
          </form>
          <a href="/dashboard" class="button-link">← ダッシュボードに戻る</a>
        </div>
      </body>
    </html>
  `);
});

app.post('/job/:id/edit', async (req, res) => {
  const jobId = req.params.id;
  const { title, description, location, salary } = req.body;

  await pool.query(
    'UPDATE jobs SET title = ?, description = ?, location = ?, salary = ? WHERE id = ?',
    [title, description, location, salary, jobId]
  );

  res.redirect('/dashboard');
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});