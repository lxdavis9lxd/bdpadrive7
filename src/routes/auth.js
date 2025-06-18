const express = require('express');
const router = express.Router();
const apiService = require('../services/apiService');
const cryptoService = require('../services/cryptoService');
const { isGuest, isAuthenticated } = require('../middleware/auth');

// CAPTCHA generation helper
function generateCaptcha() {
  const operations = [
    { a: Math.floor(Math.random() * 10) + 1, b: Math.floor(Math.random() * 10) + 1, op: '+' },
    { a: Math.floor(Math.random() * 10) + 5, b: Math.floor(Math.random() * 5) + 1, op: '-' },
    { a: Math.floor(Math.random() * 5) + 2, b: Math.floor(Math.random() * 5) + 2, op: '*' }
  ];
  
  const captcha = operations[Math.floor(Math.random() * operations.length)];
  let answer;
  let question;
  
  switch (captcha.op) {
    case '+':
      answer = captcha.a + captcha.b;
      question = `What is ${captcha.a} + ${captcha.b}?`;
      break;
    case '-':
      answer = captcha.a - captcha.b;
      question = `What is ${captcha.a} - ${captcha.b}?`;
      break;
    case '*':
      answer = captcha.a * captcha.b;
      question = `What is ${captcha.a} × ${captcha.b}?`;
      break;
  }
  
  return { question, answer };
}

// Auth view - Landing page for guests
router.get('/', isGuest, (req, res) => {
  res.render('auth/landing');
});

// Login page
router.get('/login', isGuest, (req, res) => {
  res.render('auth/login');
});

// Login logic
router.post('/login', isGuest, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get user data to retrieve salt
    const userData = await apiService.getUser(username);
    if (!userData.user) {
      req.flash('error', 'Invalid username or password');
      return res.redirect('/login');
    }

    // Derive key using stored salt and provided password
    const key = await cryptoService.deriveKey(password, userData.user.salt);

    // Attempt authentication
    const authResult = await apiService.authenticateUser(username, key);
    if (authResult.success) {
      req.session.user = {
        username: username,
        userId: userData.user.user_id
      };
      res.redirect('/explorer');
    } else {
      req.flash('error', 'Invalid username or password');
      res.redirect('/login');
    }
  } catch (error) {
    req.flash('error', 'Login failed. Please try again.');
    res.redirect('/login');
  }
});

// Register page
router.get('/register', isGuest, (req, res) => {
  const captcha = generateCaptcha();
  res.render('auth/register', {
    captchaQuestion: captcha.question,
    captchaAnswer: captcha.answer
  });
});

// Register logic
router.post('/register', isGuest, async (req, res) => {
  try {
    const { username, email, password, confirmPassword, captcha, captchaAnswer } = req.body;

    // Validation
    const errors = [];

    // Username validation (alphanumeric, dashes, underscores)
    if (!/^[a-zA-Z0-9-_]+$/.test(username)) {
      errors.push('Username must contain only letters, numbers, dashes, and underscores');
    }

    // Email validation
    if (!email || !email.includes('@')) {
      errors.push('Please provide a valid email address');
    }

    // Password strength validation
    if (password.length <= 10) {
      errors.push('Password is too weak. Must be at least 11 characters');
    }

    // Password confirmation
    if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }

    // CAPTCHA validation
    if (parseInt(captcha) !== parseInt(captchaAnswer)) {
      errors.push('CAPTCHA answer is incorrect');
    }

    if (errors.length > 0) {
      const newCaptcha = generateCaptcha();
      return res.render('auth/register', {
        error: errors.join('. '),
        captchaQuestion: newCaptcha.question,
        captchaAnswer: newCaptcha.answer
      });
    }

    // Generate salt and derive key
    const salt = await cryptoService.generateSalt();
    const key = await cryptoService.deriveKey(password, salt);

    // Create user
    const result = await apiService.createUser({
      username,
      email,
      salt,
      key
    });

    if (result.success) {
      req.flash('success', 'Registration successful! Please log in.');
      res.redirect('/login');
    } else {
      const newCaptcha = generateCaptcha();
      res.render('auth/register', {
        error: 'Registration failed. Please try again.',
        captchaQuestion: newCaptcha.question,
        captchaAnswer: newCaptcha.answer
      });
    }
  } catch (error) {
    let message = 'Registration failed. Please try again.';
    if (error.message.includes('duplicate') || error.message.includes('already exists')) {
      message = 'Username already exists. Please choose another.';
    }
    
    const newCaptcha = generateCaptcha();
    res.render('auth/register', {
      error: message,
      captchaQuestion: newCaptcha.question,
      captchaAnswer: newCaptcha.answer
    });
  }
});

// Logout
router.get('/logout', isAuthenticated, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;
