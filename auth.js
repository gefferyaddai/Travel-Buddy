// Simple toggle for sliding between login and signup

const wrapper = document.getElementById('auth-wrapper');
const goSignupBtn = document.getElementById('go-signup');
const goLoginBtn  = document.getElementById('go-login');

if (goSignupBtn) {
    goSignupBtn.addEventListener('click', () => {
        wrapper.classList.remove('show-login');
        wrapper.classList.add('show-signup');
    });
}

if (goLoginBtn) {
    goLoginBtn.addEventListener('click', () => {
        wrapper.classList.remove('show-signup');
        wrapper.classList.add('show-login');
    });
}

// Optional: stub so your onclick="login()" doesn't error if you haven't wired it yet
function login() {
    // TODO: plug real login logic here
    console.log("Login clicked");
}
function RememberME(){
    return true
}