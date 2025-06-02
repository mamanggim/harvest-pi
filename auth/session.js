export function switchToLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('register-screen').style.display = 'none';
}

export function switchToRegister() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('register-screen').style.display = 'flex';
}
