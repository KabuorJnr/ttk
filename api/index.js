const { boot } = require('../transparent');

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = boot({ serverless: true })
      .then(({ app }) => app)
      .catch(err => {
        appPromise = null;
        throw err;
      });
  }
  return appPromise;
}

module.exports = async (req, res) => {
  try {
    const app = await getApp();
    app(req, res);
  } catch (err) {
    console.error('[TTK Serverless] Boot error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Server initialization failed', message: err.message }));
  }
};
