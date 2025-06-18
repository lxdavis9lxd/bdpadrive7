const express = require('express');
const router = express.Router();
const apiService = require('../services/apiService');
const cryptoService = require('../services/cryptoService');
const { isGuest, isAuthenticated } = require('../middleware/auth');

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
  res.render('auth/register');
});

// Register logic
router.post('/register', isGuest, async (req, res) => {
  try {
    const { username, email, password } = req.body;

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
      req.flash('error', 'Registration failed. Please try again.');
      res.redirect('/register');
    }
  } catch (error) {
    let message = 'Registration failed. Please try again.';
    if (error.message.includes('duplicate')) {
      message = 'Username already exists. Please choose another.';
    }
    req.flash('error', message);
    res.redirect('/register');
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
