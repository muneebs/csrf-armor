import { csrfMiddleware } from '@csrf-armor/express';
import cookieParser from 'cookie-parser';
import express from 'express';

const app = express();
const port = 3000;

// Middleware to parse URL-encoded data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const strategies = [
  'double-submit',
  'signed-double-submit',
  'signed-token',
  'origin-check',
  'hybrid',
];

const commonConfig = {
  secret: 'super-secret-key-for-dev-only-32-chars-long-enough',
  token: {
    expiry: 3600,
    fieldName: '_csrf',
  },
  cookie: {
    secure: false, // Set to true in production if using HTTPS
    name: 'x-csrf-token', // Default, can be customized per strategy if needed
  },
  excludePaths: ['/.well-known/'],
  allowedOrigins: [`http://localhost:${port}`], // For origin-check and hybrid
};

// Helper function to generate HTML for the form page
function getDemoPageHtml(strategy, csrfToken) {
  let tokenInfo = '';
  if (strategy !== 'origin-check') {
    tokenInfo = `<p>CSRF Token: <code>${csrfToken || 'N/A (token might be in cookie or not used directly in form)'}</code></p>`;
  }

  let notes = '';
  switch (strategy) {
    case 'double-submit':
      notes =
        '<p><b>Notes:</b> Compares a token sent in a cookie with a token sent in the request body/header. No secret needed.</p>';
      break;
    case 'signed-double-submit':
      notes =
        '<p><b>Notes:</b> Similar to double-submit, but the cookie token (or part of it) is signed. Requires a secret.</p>';
      break;
    case 'signed-token':
      notes =
        '<p><b>Notes:</b> A stateless strategy where a signed token is generated and provided to the client to send back. Requires a secret. Token is not stored in a cookie by the middleware by default (it is returned for client to handle).</p>';
      break;
    case 'origin-check':
      notes =
        '<p><b>Notes:</b> Validates the <code>Origin</code> and/or <code>Referer</code> headers against a list of allowed origins. No explicit token in form. Requires <code>allowedOrigins</code> configuration.</p>';
      break;
    case 'hybrid':
      notes =
        '<p><b>Notes:</b> Combines <code>signed-token</code> and <code>origin-check</code>. Requires a secret and <code>allowedOrigins</code>.</p>';
      break;
  }

  return `
    <h1>CSRF Armor Express Example: <code>${strategy}</code> Strategy</h1>
    <p><a href="/">Back to Strategy List</a></p>
    ${tokenInfo}
    <form action="/submit/${strategy}" method="POST">
      ${strategy !== 'origin-check' ? `<input type="hidden" name="${commonConfig.token.fieldName}" value="${csrfToken || ''}">` : ''}
      <label for="data">Enter some data:</label>
      <input type="text" id="data" name="data" value="Hello ${strategy} CSRF">
      <button type="submit">Submit with ${strategy}</button>
    </form>
    ${notes}
    <hr>
    <p>Try submitting with a modified or missing _csrf token (if applicable) to see it fail.</p>
  `;
}

// Routes for each strategy
strategies.forEach((strategy) => {
  const strategyConfig = {
    ...commonConfig,
    strategy: strategy,
  };

  // For 'double-submit' and 'origin-check', secret is not used by the core logic, so we can omit it
  // or the core logic should ignore it.
  // For 'origin-check', ensure allowedOrigins is primary.
  // For 'double-submit', no secret is needed.
  if (strategy === 'double-submit') {
    const { secret, allowedOrigins, ...dsConfig } = strategyConfig;
    dsConfig.cookie = { ...dsConfig.cookie, name: 'ds-csrf-token' }; // Use a different cookie name to avoid clashes
    app.use(`/demo/${strategy}`, csrfMiddleware(dsConfig));
    app.use(`/submit/${strategy}`, csrfMiddleware(dsConfig));
  } else if (strategy === 'origin-check') {
    const { secret, ...ocConfig } = strategyConfig;
    app.use(`/demo/${strategy}`, csrfMiddleware(ocConfig));
    app.use(`/submit/${strategy}`, csrfMiddleware(ocConfig));
  } else {
    // For signed strategies, ensure secret is present
    // For hybrid, ensure allowedOrigins is present
    app.use(`/demo/${strategy}`, csrfMiddleware(strategyConfig));
    app.use(`/submit/${strategy}`, csrfMiddleware(strategyConfig));
  }

  app.get(`/demo/${strategy}`, (req, res) => {
    res.send(getDemoPageHtml(strategy, req.csrfToken));
  });

  app.post(`/submit/${strategy}`, (req, res) => {
    console.log(`Data submitted with ${strategy} strategy:`, req.body.data);
    res.send(
      `Form submitted successfully using <strong>${strategy}</strong> strategy! <br><a href="/demo/${strategy}">Go Back</a> <br><a href="/">Strategy List</a>`
    );
  });
});

// Index page to select strategy
app.get('/', (req, res) => {
  const links = strategies
    .map((s) => `<li><a href="/demo/${s}">${s}</a></li>`)
    .join('');
  res.send(`
    <h1>CSRF Armor Express - Strategy Demo</h1>
    <p>Select a CSRF protection strategy to test:</p>
    <ul>${links}</ul>
  `);
});

// Global error handler for CSRF errors (and others)
app.use((err, req, res, next) => {
  if (err.code === 'CSRF_VERIFICATION_ERROR') {
    console.error('CSRF Error:', err.message, 'Strategy:', req.path); // Log which strategy path caused error
    res
      .status(403)
      .send(
        `CSRF token validation failed for path ${req.path}: ${err.message} <br><a href="/">Try another strategy</a>`
      );
  } else {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
  console.log('Visit http://localhost:3000 to see strategy demos.');
});
