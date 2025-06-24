const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password, phone, gender, age, purpose } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone, gender, age, purpose)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hashed, phone, gender, age, purpose]
    );
    res.status(200).json({ message: '登録成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '登録失敗' });
  }
});

module.exports = router;
