// assets/main.js
// Lightweight client glue for login/signup/dashboard (placeholder Firebase integration).
// Replace / expand with real Firebase calls if you set up Firebase project.

const isLoginPage = !!document.getElementById('loginForm');
const isSignupPage = !!document.getElementById('signupForm');
const logoutBtn = document.getElementById('logoutBtn');

if (isLoginPage) {
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    // temporary: store simple session in sessionStorage
    sessionStorage.setItem('nexus_user', JSON.stringify({email}));
    window.location.href = 'dashboard.html';
  });
}

if (isSignupPage) {
  document.getElementById('signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const username = document.getElementById('signupUsername').value;
    // temporary: store simple session in sessionStorage
    sessionStorage.setItem('nexus_user', JSON.stringify({email, username}));
    window.location.href = 'dashboard.html';
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('nexus_user');
    window.location.href = 'index.html';
  });
}

// basic protection: redirect to login if no session
(function requireAuthIfDashboard(){
  if (location.pathname.endsWith('dashboard.html')) {
    const u = sessionStorage.getItem('nexus_user');
    if (!u) {
      window.location.href = 'login.html';
    }
  }
})();
