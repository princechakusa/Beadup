// app.json is the source of truth. BEADUP_WEB_SPA=1 switches the web export to a
// single-page bundle with no lazy route chunks (used to render the demo screens
// for App Store screenshots); normal builds are unchanged.
module.exports = ({ config }) =>
  process.env.BEADUP_WEB_SPA
    ? {
        ...config,
        web: { ...config.web, output: 'single' },
        extra: { ...config.extra, router: { ...config.extra?.router, asyncRoutes: false } },
      }
    : config;
