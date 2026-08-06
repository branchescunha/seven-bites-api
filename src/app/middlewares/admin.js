const adminMiddleware = (request, response, next) => {
  const isUserAdmin = request.userIsAdmin;

  if (!isUserAdmin) {
    return response.status(403).json({ error: 'Admin access is required.' });
  }

  return next();
};

export default adminMiddleware;
