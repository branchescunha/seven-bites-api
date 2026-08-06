export const buildPublicUserPayload = ({ email, name, password }) => ({
  admin: false,
  email,
  name,
  password,
});
