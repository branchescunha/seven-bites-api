import jwt from 'jsonwebtoken';
import authConfig from '../../config/auth.js';

const authMiddleware = (request, response, next) => {
  const authToken = request.headers.authorization;

  if (!authToken?.startsWith('Bearer ')) {
    return response
      .status(401)
      .json({ error: 'Authentication token is required.' });
  }

  const token = authToken.split(' ')[1];

  try {
    jwt.verify(token, authConfig.secret, (error, decoded) => {
      if (error) {
        throw Error();
      }

      request.userId = decoded.id;
      request.userName = decoded.name;
      request.userIsAdmin = decoded.admin;
    });
  } catch (_error) {
    return response.status(401).json({ error: 'Invalid or expired session.' });
  }

  return next();
};

export default authMiddleware;
