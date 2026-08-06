import crypto from 'node:crypto';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,80}$/;

const createRequestId = () => crypto.randomUUID();

const getRequestId = (request) => {
  const incomingRequestId = request.get(REQUEST_ID_HEADER);

  if (incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)) {
    return incomingRequestId;
  }

  return createRequestId();
};

export const requestContext = (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  const requestId = getRequestId(request);

  request.id = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    console.info(
      JSON.stringify({
        durationMs: Math.round(durationMs),
        method: request.method,
        path: request.originalUrl,
        requestId,
        status: response.statusCode,
      }),
    );
  });

  return next();
};
