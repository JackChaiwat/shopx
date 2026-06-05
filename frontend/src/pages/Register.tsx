import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Input, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

interface RegisterForm {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Lowercase letter", pass: /[a-z]/.test(password) },
    { label: "Number", pass: /\d/.test(password) },
  ];
  const score = checks.filter(c => c.pass).length;
  const colors = ["bg-gray-200", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-500"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < score ? colors[score] : "bg-gray-200 dark:bg-gray-700"}`} />
        ))}
      </div>
      <div className="flex flex-col gap-1 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <span>{labels[score]}</span>
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {checks.map(c => (
            <span key={c.label} className={`flex items-center gap-0.5 ${c.pass ? "text-green-600" : "text-gray-400"}`}>
              <CheckCircle2 size={10} /> {c.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>();
  const password = watch("password", "");

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser(data.email, data.password, data.full_name);
      toast.success("Account created! Please verify your email.");
      navigate(`/verify-email?email=${encodeURIComponent(data.email)}&sent=1`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Registration failed");
    }
  };

  return (
    <>
      <Helmet><title>Create Account - ShopX</title></Helmet>
      <div className="flex min-h-[calc(100dvh-7rem)] items-start justify-center px-3 py-6 sm:items-center sm:px-4 sm:py-8">
        <div className="card w-full max-w-md p-5 sm:p-8">
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="text-2xl font-bold">Create account</h1>
            <p className="text-gray-500 text-sm mt-1">Join millions of shoppers on ShopX</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="John Doe"
              error={errors.full_name?.message}
              {...register("full_name", {
                required: "Name is required",
                minLength: { value: 2, message: "Min 2 characters" },
              })}
            />

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
                  placeholder="Min 8 characters"
                  className={`input pr-10 ${errors.password ? "border-red-400" : ""}`}
                  {...register("password", {
                    required: "Password is required",
                    minLength: { value: 8, message: "Min 8 characters" },
                  })}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              <PasswordStrength password={password} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat password"
                  className={`input pr-10 ${errors.confirm_password ? "border-red-400" : ""}`}
                  {...register("confirm_password", {
                    required: "Please confirm your password",
                    validate: v => v === password || "Passwords don't match",
                  })}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm_password && <p className="text-xs text-red-500 mt-1">{errors.confirm_password.message}</p>}
            </div>

            <p className="text-xs text-gray-400">
              By creating an account, you agree to ShopX's{" "}
              <Link to="/terms" className="text-primary-600 hover:underline">Terms of Service</Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>
            </p>

            <button type="submit" disabled={isLoading} className="btn btn-primary w-full btn-lg">
              {isLoading ? <Spinner className="w-5 h-5" /> : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </>
  );
}
