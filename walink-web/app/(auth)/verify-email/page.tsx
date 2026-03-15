"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Attempt to grab unsigned user context to know where to send resend email logic
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setUserEmail(data.user.email);
      }
    };
    fetchUser();
  }, [supabase]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (!userEmail) {
      toast.error("Please login to request a new verification link.");
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Verification email sent successfully.");
        setCountdown(60);
      }
    } catch (err) {
      toast.error("An error occurred while resending the email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-border/50 bg-surface-1/80 backdrop-blur-xl shadow-2xl relative overflow-hidden ring-1 ring-white/5 text-center">
      <div className="absolute top-0 right-1/2 translate-x-1/2 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

      <CardHeader className="relative z-10 pt-8 pb-4 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl text-text-primary tracking-tight">Check your email</CardTitle>
        <CardDescription className="text-text-muted max-w-[280px] mx-auto mt-2 text-base">
          We sent a verification link to your email address. Click the link to activate your account.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="relative z-10 pb-8 space-y-6">
        <Button 
          variant="outline" 
          className="w-full bg-surface-2 hover:bg-surface-2/80 text-text-primary border-border" 
          onClick={handleResend}
          disabled={isLoading || countdown > 0}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {countdown > 0 ? `Resend available in ${countdown}s` : "Resend email"}
        </Button>
        
        <div className="text-sm text-text-secondary">
          <Link href="/login" className="text-primary hover:text-primary-light font-medium underline-offset-4 hover:underline transition-colors flex items-center justify-center gap-2">
            Back to Sign In
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
