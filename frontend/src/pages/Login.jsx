import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import GoogleAuthButton from "../components/GoogleAuthButton";

function Login() {

  const navigate = useNavigate();
  const [email, setEmail] =useState("");
  const [password, setPassword] =useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const storeSession = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const handleLogin = async (e) => {

    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {

      const response =
        await axios.post(
          "/api/auth/login",
          {
            email: email.trim().toLowerCase(),
            password
          }
        );

      storeSession(response.data);
      navigate("/dashboard");


    } catch (error) {

      setMessage(
        error.response?.data?.message ||
        "Unable to connect to StudyGenie. Please try again."
      );

    } finally {
      setLoading(false);
    }

  };

  const handleGoogleLogin = async (credential) => {
    setMessage("");
    setLoading(true);

    try {
      const response = await axios.post("/api/auth/google", { credential });
      storeSession(response.data);
      navigate("/dashboard");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        "Unable to sign in with Google. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };


  return (

    <div className="authPage">

      <div className="authLeft">

        <span className="badge">
          👋 Welcome Back
        </span>

        <h1>
          Login to Your
          <span> StudyGenie </span>
          Account
        </h1>

        <p>
          Access your personalized dashboard,
          study materials, AI notes,
          quizzes and much more.
        </p>

        <img
          src="/robot.png"
          alt="StudyGenie AI"
          className="authRobot"
        />

      </div>


      <div className="authRight">

        <form
          className="authCard"
          onSubmit={handleLogin}
        >

          <h1>Welcome Back!</h1>

          <p>
            Login to continue your learning journey
          </p>

          <GoogleAuthButton
            onCredential={handleGoogleLogin}
            buttonText="signin_with"
            disabled={loading}
          />

          <div className="authDivider">
            <span>or continue with email</span>
          </div>

          <label htmlFor="login-email">
            Email Address
          </label>

          <input
            id="login-email"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            value={email}
            onChange={
              (e) =>
                setEmail(e.target.value)
            }
            required
          />
<label htmlFor="login-password">
  Password
</label>

<div className="passwordWrapper">
  <input
    id="login-password"
    type={showPassword ? "text" : "password"}
    placeholder="Enter password"
    autoComplete="current-password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
  />

  <button
    type="button"
    className="togglePassword"
    onClick={() => setShowPassword(!showPassword)}
    aria-label={showPassword ? "Hide password" : "Show password"}
  >
    {showPassword ? "🙈" : "👁️"}
  </button>
</div>

          {message && (
            <p className="message" role="alert">
              {message}
            </p>
          )}

          <p className="switchAuth">
            Don't have an account?
            <Link to="/register">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>

  );
}
export default Login;