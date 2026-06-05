import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Eye, EyeOff, ShoppingBag } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Input, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

interface LoginForm { email: string; password: string; }

export default function Login() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || "/";
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      const user = await login(data.email, data.password);
      // If email not verified, redirect to verify page
      if (user && !user.is_email_verified) {
        toast("Please verify your email to continue.");
        navigate(`/verify-email?email=${encodeURIComponent(data.email)}&sent=1`);
        return;
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === "EMAIL_NOT_VERIFIED") {
        toast("Please verify your email. We sent a new code.");
        navigate(`/verify-email?email=${encodeURIComponent(data.email)}&sent=1`);
        return;
      }
      const msg = err?.response?.data?.error?.message || "Login failed";
      toast.error(msg);
    }
  };

  return (
    <>
      <Helmet><title>Login - ShopX</title></Helmet>
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="card w-full max-w-md p-5 sm:p-8">
          <div className="mb-6 text-center sm:mb-8">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500"><ShoppingBag size={30} /></div>
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to your ShopX account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register("email", { required: "Email is required" })}
            />

            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="current-password"
                  spellCheck={false}
                  style={{ fontFamily: "Arial, sans-serif" }}
                  className={`input pr-10 ${errors.password ? "border-red-400" : ""}`}
                  {...register("password", { required: "Password is required" })}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={isLoading} className="btn btn-primary w-full btn-lg">
              {isLoading ? <Spinner className="w-5 h-5" /> : "Sign In"}
            </button>
          </form>


          <p className="text-center text-sm text-gray-500 mt-4">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </>
  );
}



