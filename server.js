const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use('/auth', authRoutes);

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
