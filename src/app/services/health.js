export const buildHealthPayload = () => ({
  service: 'seven-bites-api',
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
});

export const buildReadyPayload = (checks) => {
  const ready = checks.postgres === 'ok' && checks.mongo === 'ok';

  return {
    body: {
      checks,
      service: 'seven-bites-api',
      status: ready ? 'ready' : 'unavailable',
      timestamp: new Date().toISOString(),
    },
    statusCode: ready ? 200 : 503,
  };
};
