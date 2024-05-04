// routes/index.js

const express = require('express');
const auth = require('./auth');
const todo = require('./todo');
const router = express.Router();

router.use('/auth', auth);
router.use('/main', todo);


module.exports = router;
