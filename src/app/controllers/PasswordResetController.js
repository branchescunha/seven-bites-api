import {
  requestPasswordReset,
  resetPassword,
} from '../services/passwordReset.js';

class PasswordResetController {
  async forgot(request, response) {
    const result = await requestPasswordReset({
      email: request.body?.email,
    });

    return response.status(result.statusCode).json(result.body);
  }

  async reset(request, response) {
    const result = await resetPassword({
      newPassword: request.body?.newPassword,
      token: request.body?.token,
    });

    return response.status(result.statusCode).json(result.body);
  }
}

export default new PasswordResetController();
