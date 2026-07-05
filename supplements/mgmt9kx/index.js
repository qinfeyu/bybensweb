      // ════════════════════════════════════════════
      // CONFIG
      // ════════════════════════════════════════════
      const _sbLogin = window.supabase;

      // If already logged in, go straight to admin
      if (sessionStorage.getItem("bb_admin_auth") === "1") {
        window.location.href = "/supplements/panel4rz";
      }

      async function doLogin() {
        const email = document.getElementById("loginUser").value.trim();
        const p = document.getElementById("loginPass").value;
        const btn = document.getElementById("loginBtn");

        if (!email || !p) {
          showError("Please enter email and password");
          return;
        }

        btn.classList.add("loading");
        btn.disabled = true;
        document.getElementById("loginErr").classList.remove("show");

        try {
          const { data: authData, error } = await _sbLogin.auth.signInWithPassword({ email, password: p });

          if (!error && authData.session) {
            sessionStorage.setItem("bb_admin_auth", "1");
            sessionStorage.setItem("bb_admin_name", authData.user?.email || email);
            window.location.href = "/supplements/panel4rz";
          } else {
            showError("Invalid email or password");
            document.getElementById("loginPass").value = "";
            document.getElementById("loginPass").focus();
          }
        } catch (e) {
          showError("Connection failed");
        }

        btn.classList.remove("loading");
        btn.disabled = false;
      }

      function showError(msg) {
        const err = document.getElementById("loginErr");
        const errMsg = document.getElementById("loginErrMsg");
        errMsg.textContent = msg;
        err.classList.remove("show");
        void err.offsetWidth; // re-trigger shake animation
        err.classList.add("show");
      }

      function togglePw() {
        const inp = document.getElementById("loginPass");
        const ico = document.getElementById("eye-icon");
        if (inp.type === "password") {
          inp.type = "text";
          ico.innerHTML =
            '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        } else {
          inp.type = "password";
          ico.innerHTML =
            '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        }
      }

      document.addEventListener("DOMContentLoaded", () => {
        document
          .getElementById("loginUser")
          .addEventListener("keydown", (e) => {
            if (e.key === "Enter") doLogin();
          });
        document
          .getElementById("loginPass")
          .addEventListener("keydown", (e) => {
            if (e.key === "Enter") doLogin();
          });
        document.getElementById("loginUser").focus();
      });
