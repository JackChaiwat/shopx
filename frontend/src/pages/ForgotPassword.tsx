import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useForm } from "react-hook-form";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Input, Spinner } from "@/components/ui";
import api from "@/services/api";
import toast from "react-hot-toast";

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>();

  const onSubmit = async ({ email }: { email: string }) => {
    try {
      await api.post("/auth/send-reset-otp", { email });
      setSentEmail(email);
      setSent(true);
      toast.success("Reset code sent");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <>
      <Helmet><title>Forgot Password - ShopX</title></Helmet>
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="card p-8 w-full max-w-md">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-1">
                We've sent a 6-digit reset code to
              </p>
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-6">{sentEmail}</p>
              <Link
                to={`/reset-password?email=${encodeURIComponent(sentEmail)}`}
                className="btn btn-primary w-full mb-3"
              >
                Enter Reset Code
              </Link>
              <button
                onClick={() => setSent(false)}
                className="text-sm text-gray-500 hover:text-primary-600"
              >
                Didn't receive it? Send again
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mail size={26} className="text-primary-600" />
                </div>
                <h1 className="text-2xl font-bold">Forgot password?</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Enter your email and we'll send a 6-digit code to reset your password
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register("email", { required: "Email is required" })}
                />
                <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full btn-lg">
                  {isSubmitting ? <Spinner className="w-5 h-5" /> : "Send Reset Code"}
                </button>
              </form>

              <div className="text-center mt-6">
                <Link to="/login" className="text-sm text-gray-500 hover:text-primary-600 flex items-center justify-center gap-1">
                  <ArrowLeft size={14} /> Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
