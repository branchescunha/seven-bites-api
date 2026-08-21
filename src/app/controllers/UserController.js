import bcrypt from 'bcrypt';
import { v4 } from 'uuid';
import * as Yup from 'yup';
import User from '../models/User.js';
import { buildPublicUserPayload } from '../services/userPayload.js';

export const DUPLICATE_EMAIL_MESSAGE =
  'Já existe uma conta com este e-mail. Entre para continuar.';

export const sendDuplicateEmailResponse = (response) =>
  response.status(409).json({ error: DUPLICATE_EMAIL_MESSAGE });

class UserController {
  async store(request, response) {
    const schema = Yup.object({
      name: Yup.string().required(),
      email: Yup.string().email().required(),
      password: Yup.string().min(6).required(),
    });

    try {
      schema.validateSync(request.body, { abortEarly: false, strict: true });
    } catch (err) {
      return response.status(400).json({ error: err.errors });
    }

    const { name, email, password } = buildPublicUserPayload(request.body);

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return sendDuplicateEmailResponse(response);
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      id: v4(),
      name,
      email,
      password_hash,
      admin: false,
    });

    return response.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      admin: user.admin,
    });
  }
}

export default new UserController();
