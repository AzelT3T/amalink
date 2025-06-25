const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const pool = require('../db');
const router = express.Router();

// GET /auth/register
router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

// POST /auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, phone, gender, age, purpose, role } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, phone, gender, age, purpose, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hashed, phone, gender, age, purpose, role]
    );
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    res.status(500).send('登録に失敗しました');
  }
});

// ✅ GET /auth/login
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// ✅ POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).send('メールアドレスが見つかりません');
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).send('パスワードが正しくありません');
    }

    // ✅ セッションにユーザー情報を保存
    req.session.user = {
      id: user.id,
      name: user.name,
      role: user.role
    };

    res.redirect('/home');
  } catch (err) {
    console.error(err);
    res.status(500).send('ログインに失敗しました');
  }
});

// GET /auth/company → 登録フォームを返す
router.get('/company', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/company.html'));
});

// POST /auth/company → 登録処理（role = company）
router.post('/company', async (req, res) => {
  const { name, email, phone } = req.body;

  if (!req.session.user) {
    return res.status(401).send('ログインが必要です');
  }

  const userId = req.session.user.id;

  try {
    await pool.query(
      `INSERT INTO companies (name, contact_email, phone, created_by)
      VALUES (?, ?, ?, ?)`,
      [name, email, phone, userId]
    );
    res.status(200).send('企業情報の登録が完了しました');
  } catch (err) {
    console.error(err);
    res.status(500).send('企業登録に失敗しました');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;
