require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// API configuration
const API_KEY = 'aaa96136-492f-4435-8177-714d8d64cf93';
const API_BASE_URL = 'https://drive.api.hscc.bdpa.org/v1';

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));
app.use(morgan('dev'));

// Session configuration
app.use(session({
  secret: 'bdpadrive-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(flash());

// Global middleware
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user;
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  next();
});

// Import routes
const authRoutes = require('./routes/auth');
const explorerRoutes = require('./routes/explorer');
const editorRoutes = require('./routes/editor');
const dashboardRoutes = require('./routes/dashboard');

// Use routes
app.use('/', authRoutes);
app.use('/explorer', explorerRoutes);
app.use('/editor', editorRoutes);
app.use('/dashboard', dashboardRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).render('error', {
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
