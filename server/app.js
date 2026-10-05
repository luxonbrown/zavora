const express = require('express');
const cors = require('cors');
const session = require('express-session');

const config = require('./config');
const { ping } = require('./database/pool');
const { attachUser } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // correct secure-cookie detection behind a proxy

app.use(
  cors({
    origin: config.clientOrigins,
    credentials: true, // required: the session cookie must cross origins
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: config.session.name,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: config.session.httpOnly,
      sameSite: config.session.sameSite,
      secure: config.session.secure,
      maxAge: config.session.maxAgeMs,
    },
  })
);

// Resolve the session cookie to a user row on every request.
app.use(attachUser);

/** Liveness + database reachability. */
app.get('/api/health', async (req, res) => {
  let database = 'down';
  try {
    await ping();
    database = 'up';
  } catch {
    database = 'down';
  }
  res.status(database === 'up' ? 200 : 503).json({
    ok: database === 'up',
    service: 'zavora-api',
    env: config.env,
    database,
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/products.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api', require('./routes/index'));

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`[zavora] API listening on http://localhost:${config.port}`);
  });
}

module.exports = app;
