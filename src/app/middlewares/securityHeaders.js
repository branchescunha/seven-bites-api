export const securityHeaders = (_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');

  return next();
};

export const publicAssetHeaders = (_request, response, next) => {
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  return next();
};
