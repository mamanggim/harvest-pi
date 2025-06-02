export const encodeEmail = (email) =>
  email.replace('@', '_at_').replace(/\./g, '_dot_');

export const resolveUserKey = (role, email, username) =>
  role === 'admin' ? encodeEmail(email) : username;
