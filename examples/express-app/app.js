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

/**
 * Generates an HTML page for demonstrating a CSRF protection strategy form.
 *
 * The page displays the current CSRF strategy, shows the CSRF token if applicable, provides explanatory notes about the strategy, and renders a form for submitting test data. For strategies that require a CSRF token, the token is included as a hidden input field.
 *
 * @returns {string} HTML markup for the demo form page
 * @param unsafe
 */
// Helper function to generate HTML for the form page
// Helper function to escape HTML special characters to prevent XSS
function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getDemoPageHtml(strategy, csrfToken) {
  // Escape values to prevent XSS
  const safeStrategy = escapeHtml(strategy);
  const safeToken = escapeHtml(csrfToken);
  let tokenInfo = '';
  if (strategy !== 'origin-check') {
    tokenInfo = `<p>CSRF Token: <code>${safeToken || 'N/A (token might be in cookie or not used directly in form)'}</code></p>`;
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

  // Safely escape the field name as well
  const safeFieldName = escapeHtml(commonConfig.token.fieldName);

  return `
    <h1>CSRF Armor Express Example: <code>${safeStrategy}</code> Strategy</h1>
    <p><a href="/">Back to Strategy List</a></p>
    ${tokenInfo}
    <form action="/submit/${safeStrategy}" method="POST">
      ${strategy !== 'origin-check' ? `<input type="hidden" name="${safeFieldName}" value="${safeToken || ''}">` : ''}
      <label for="data">Enter some data:</label>
      <input type="text" id="data" name="data" value="Hello ${safeStrategy} CSRF">
      <button type="submit">Submit with ${safeStrategy}</button>
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
    const sanitizedData = req.body.data
      ? String(req.body.data).replace(/[\n\r]/g, '')
      : '';
    console.log(`Data submitted with ${strategy} strategy:`, sanitizedData);
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
app.use((err, req, res) => {
  // Sanitize inputs for logging to prevent log injection
  const sanitizedMessage = err.message
    ? String(err.message).replace(/[\n\r]/g, ' ')
    : 'Unknown error';
  const sanitizedPath = req.path
    ? encodeURIComponent(String(req.path).replace(/[\n\r]/g, ' '))
    : 'Unknown path';

  if (err.code === 'CSRF_VERIFICATION_ERROR') {
    // Safe logging with sanitized values
    console.error('CSRF Error:', sanitizedMessage, 'Strategy:', sanitizedPath);

    // Use the escapeHtml function to prevent XSS in the response
    const safeMessage = escapeHtml(err.message);
    const safePath = escapeHtml(req.path);

    // Return 403 Forbidden for CSRF errors
    res
      .status(403)
      .send(
        `CSRF token validation failed for path ${safePath}: ${safeMessage} <br><a href="/">Try another strategy</a>`
      );
  } else {
    // For other errors, log them and send a generic error response
    console.error('Server Error:', sanitizedMessage);
    if (err.stack) {
      console.error(String(err.stack).replace(/[\n\r]/g, '\n'));
    }
    res.status(500).send('Something broke!');
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
  console.log('Visit http://localhost:3000 to see strategy demos.');
});
