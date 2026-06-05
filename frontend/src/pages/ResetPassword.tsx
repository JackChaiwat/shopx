import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useForm } from "react-hook-form";
import { KeyRound, ArrowLeft, Eye, EyeOff, CheckCircle, Mail } from "lucide-react";
import { Spinner } from "@/components/ui";
import api from "@/services/api";
import toast from "react-hot-toast";

interface ResetForm {
  otp: string;
  new_password: string;
  confirm_password: string;
}

// â”€â”€ 6-box OTP input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const cleanValue = value.replace(/\D/g, "").slice(0, 6);
  const digits = Array.from({ length: 6 }, (_, i) => cleanValue[i] || "");

  const emitDigits = (nextDigits: string[]) => {
    onChange(nextDigits.join("").replace(/\s/g, "").slice(0, 6));
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = "";
      } else if (i > 0) {
        next[i - 1] = "";
        inputs.current[i - 1]?.focus();
      }
      emitDigits(next);
    }
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleChange = (i: number, v: string) => {
    const incoming = v.replace(/\D/g, "");
    if (!incoming) {
      const next = [...digits];
      next[i] = "";
      emitDigits(next);
      return;
    }

    const next = [...digits];
    incoming.slice(0, 6 - i).split("").forEach((digit, offset) => {
      next[i + offset] = digit;
    });
    emitDigits(next);
    inputs.current[Math.min(i + incoming.length, 5)]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    inputs.current[Math.min(Math.max(pasted.length - 1, 0), 5)]?.focus();
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ""}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          className={`w-11 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all
            ${digits[i] ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-gray-200 dark:border-gray-700"}
            focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800`}
        />
      ))}
    </div>
  );
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialEmail = params.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [requestingCode, setRequestingCode] = useState(false);

  const [step, setStep] = useState<"otp" | "password" | "done">("otp");
  const [otp, setOtp] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ResetForm>();

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const requestResetCode = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return toast.error("Enter your email");
    setRequestingCode(true);
    try {
      await api.post("/auth/send-reset-otp", { email: cleanEmail });
      toast.success("Reset code sent");
      setCountdown(60);
    } catch {
      toast.error("Could not send reset code. Try again.");
    } finally {
      setRequestingCode(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) return toast.error("Enter the 6-digit code");
    setVerifying(true);
    try {
      // Just validate length on frontend; actual verification happens on submit
      setStep("password");
    } finally {
      setVerifying(false);
    }
  };

  const onSubmit = async (data: ResetForm) => {
    try {
      await api.post("/auth/reset-password-otp", {
        email: email,
        otp,
        new_password: data.new_password,
      });
      setStep("done");
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || "Failed to reset password";
      if (msg.toLowerCase().includes("otp") || msg.toLowerCase().includes("code")) {
        toast.error("Invalid or expired code. Please go back and try again.");
        setStep("otp");
        setOtp("");
      } else {
        toast.error(msg);
      }
    }
  };

  const resendOTP = async () => {
    setResending(true);
    try {
      await api.post("/auth/send-reset-otp", { email: email });
      toast.success("New code sent!");
      setCountdown(60);
      setOtp("");
    } catch {
      toast.error("Could not resend. Try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Helmet><title>Reset Password - ShopX</title></Helmet>
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="card p-8 w-full max-w-md">

          {/* Done */}
          {step === "done" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Password Reset!</h2>
              <p className="text-gray-500 text-sm mb-6">Your password has been changed. You can now log in.</p>
              <Link to="/login" className="btn btn-primary w-full">Log In</Link>
            </div>
          )}

          {/* OTP step */}
          {step === "otp" && (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <KeyRound size={26} className="text-primary-600" />
                </div>
                <h1 className="text-2xl font-bold">Enter reset code</h1>
                <p className="text-gray-500 text-sm mt-1">
                  We sent a 6-digit code to <span className="font-medium text-gray-700 dark:text-gray-300">{email || "your email"}</span>
                </p>
              </div>

              {!email.trim() ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="input pl-9"
                      />
                    </div>
                  </div>
                  <button onClick={requestResetCode} disabled={requestingCode || !email.trim()} className="btn btn-primary w-full btn-lg">
                    {requestingCode ? <Spinner className="w-5 h-5" /> : "Send reset code first"}
                  </button>
                </div>
              ) : (
              <div className="space-y-6">
                <OTPInput value={otp} onChange={setOtp} />
                <button
                  onClick={verifyOTP}
                  disabled={otp.length !== 6 || verifying}
                  className="btn btn-primary w-full btn-lg"
                >
                  {verifying ? <Spinner className="w-5 h-5" /> : "Continue"}
                </button>
              </div>
              )}

              <div className="text-center mt-5 space-y-2">
                {countdown > 0 ? (
                  <p className="text-sm text-gray-400">Resend code in {countdown}s</p>
                ) : (
                  <button onClick={resendOTP} disabled={resending}
                    className="text-sm text-primary-600 hover:underline">
                    {resending ? "Sending..." : "Resend code"}
                  </button>
                )}
                <div>
                  <Link to="/forgot-password" className="text-sm text-gray-500 hover:text-primary-600 flex items-center justify-center gap-1">
                    <ArrowLeft size={14} /> Wrong email?
                  </Link>
                </div>
              </div>
            </>
          )}

          {/* New password step */}
          {step === "password" && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold">New password</h1>
                <p className="text-gray-500 text-sm mt-1">Choose a strong password (min. 8 characters)</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-medium mb-1.5">New Password</label>
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Min 8 characters"
                    className={`input pr-10 ${errors.new_password ? "border-red-400" : ""}`}
                    {...register("new_password", {
                      required: "Password is required",
                      minLength: { value: 8, message: "Min 8 characters" },
                      pattern: {
                        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                        message: "Must include uppercase, lowercase, and a number",
                      },
                    })}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-9 text-gray-400">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {errors.new_password && <p className="text-xs text-red-500 mt-1">{errors.new_password.message}</p>}
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat password"
                    className={`input pr-10 ${errors.confirm_password ? "border-red-400" : ""}`}
                    {...register("confirm_password", {
                      required: "Please confirm your password",
                      validate: v => v === watch("new_password") || "Passwords don't match",
                    })}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-9 text-gray-400">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {errors.confirm_password && <p className="text-xs text-red-500 mt-1">{errors.confirm_password.message}</p>}
                </div>

                <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full btn-lg">
                  {isSubmitting ? <Spinner className="w-5 h-5" /> : "Reset Password"}
                </button>
              </form>

              <button onClick={() => setStep("otp")} className="w-full text-center text-sm text-gray-500 hover:text-primary-600 mt-4 flex items-center justify-center gap-1">
                <ArrowLeft size={14} /> Back
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}


