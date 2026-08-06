import jsonwebtoken from 'jsonwebtoken';
import mongoose from 'mongoose';
import multer from 'multer';
import { ValidationError as SequelizeValidationError } from 'sequelize';
import { ValidationError as YupValidationError } from 'yup';

const isCorsError = (error) =>
  error.message === 'Origin is not allowed by CORS policy.';

const getPublicError = (error) => {
  if (error instanceof multer.MulterError) {
    return {
      message: error.message,
      statusCode: error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
    };
  }

  if (isCorsError(error)) {
    return { message: error.message, statusCode: 403 };
  }

  if (error instanceof YupValidationError) {
    return { message: error.message, statusCode: 400 };
  }

  if (error instanceof SequelizeValidationError) {
    return { message: 'Invalid relational data.', statusCode: 400 };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return { message: 'Invalid document data.', statusCode: 400 };
  }

  if (error instanceof jsonwebtoken.JsonWebTokenError) {
    return { message: 'Invalid token.', statusCode: 401 };
  }

  if (error.statusCode) {
    return { message: error.message, statusCode: error.statusCode };
  }

  return { message: 'Internal server error.', statusCode: 500 };
};

export const errorHandler = (error, request, response, _next) => {
  const publicError = getPublicError(error);

  if (publicError.statusCode >= 500) {
    console.error(
      JSON.stringify({
        errorName: error.name,
        method: request.method,
        path: request.originalUrl,
        requestId: request.id,
        status: publicError.statusCode,
      }),
    );
  }

  return response.status(publicError.statusCode).json({
    error: publicError.message,
    requestId: request.id,
  });
};
