"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/user.store";
import api from "@/lib/api";
import { toast } from "sonner";
import { Copy, RefreshCw, QrCode, Smartphone, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, fetchUser, isLoading: userLoading } = useUserStore();
  const [step, setStep] = useState<Step>(1);
  const [sessionName, setSessionName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string>("STARTING");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string>("");

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    // Poll for QR code if it's not ready yet
    let qrPollInterval: NodeJS.Timeout;
    
    const fetchQr = async () => {
      if (sessionId && step === 3 && qrStatus !== "CONNECTED") {
        try {
          const { data, status } = await api.get(`/api/sessions/${sessionId}/qr`, {
            validateStatus: (s) => s < 500 // Don't throw on 202 or 400
          });
          
          if (status === 200 && data.qr_code) {
            setQrCode(data.qr_code);
            setQrStatus("SCAN_QR_CODE");
          } else if (status === 202) {
            setQrStatus(data.status || "STARTING");
          } else if (status === 400 && data.status === "CONNECTED") {
            setQrStatus("CONNECTED");
            setStep(4);
          }
        } catch (error) {
          console.error("Failed to fetch QR:", error);
        }
      }
    };

    if (step === 3 && qrStatus !== "CONNECTED") {
      fetchQr(); // immediate fetch
      qrPollInterval = setInterval(fetchQr, 3000);
    }

    return () => clearInterval(qrPollInterval);
  }, [step, sessionId, qrStatus]);

  useEffect(() => {
    // Poll for status once QR is displayed
    let statusPollInterval: NodeJS.Timeout;

    const checkStatus = async () => {
      if (sessionId && step === 3 && qrStatus === "SCAN_QR_CODE") {
        try {
          const { data } = await api.get(`/api/sessions/${sessionId}/status`);
          setSessionStatus(data.status);
          
          if (data.status === "CONNECTED") {
            toast.success("WhatsApp Connected Successfully!");
            setQrStatus("CONNECTED");
            setStep(4);
          }
        } catch (error) {
          console.error("Status check failed:", error);
        }
      }
    };

    if (step === 3 && qrStatus === "SCAN_QR_CODE") {
      statusPollInterval = setInterval(checkStatus, 3000);
    }

    return () => clearInterval(statusPollInterval);
  }, [step, sessionId, qrStatus]);

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      toast.error("Please enter a session name");
      return;
    }

    setIsCreatingSession(true);
    try {
      const { data } = await api.post("/api/sessions", {
        session_name: sessionName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      });
      setSessionId(data.session.id);
      setStep(3);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to create session");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const copyApiKey = () => {
    if (user?.api_key) {
      navigator.clipboard.writeText(user.api_key);
      toast.success("API Key copied to clipboard");
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Decor */}
      <div 
        className="absolute inset-0 pointer-events-none z-0" 
        style={{
          backgroundImage: `radial-gradient(var(--color-border) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          opacity: 0.15
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 flex flex-col items-center">
        <div className="mb-8 flex items-center justify-center gap-2">
          {/* Mock Logo Space */}
          <div className="w-8 h-8 bg-primary rounded bg-gradient-to-br from-primary to-accent shadow-lg" />
          <span className="text-xl font-bold">WaLink</span>
        </div>

        {/* Step Indicator */}
        <div className="mb-6 bg-surface-1/50 border border-border/50 px-4 py-1.5 rounded-full text-sm font-medium text-text-muted flex items-center gap-2 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Step {step} of 4
        </div>

        <div className="w-full max-w-md">
          {/* STEP 1 */}
          {step === 1 && (
            <Card className="border-border/50 bg-surface-1/80 backdrop-blur-xl shadow-2xl relative overflow-hidden ring-1 ring-white/5">
              <CardHeader className="text-center pt-8 pb-4">
                <CardTitle className="text-2xl text-text-primary tracking-tight">
                  Welcome to WaLink, {user?.full_name?.split(' ')[0] || 'there'}!
                </CardTitle>
                <CardDescription className="text-text-muted max-w-sm mx-auto text-base mt-2">
                  Send WhatsApp messages programmatically without the official API overhead. Let&apos;s get your first number connected.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-8">
                <Button 
                  onClick={() => setStep(2)}
                  className="w-full bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/25 h-12 text-md transition-all group"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <Card className="border-border/50 bg-surface-1/80 backdrop-blur-xl shadow-2xl relative ring-1 ring-white/5 animate-in fade-in zoom-in-95 duration-300">
              <CardHeader className="text-center pt-8 pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl text-text-primary tracking-tight">
                  Connect your WhatsApp
                </CardTitle>
                <CardDescription className="text-text-muted text-base mt-2">
                  Give this device session a name to identify it in your dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pb-8">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary pl-1">Session Name</label>
                  <Input 
                    placeholder="e.g. support-phone" 
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="bg-surface-2/50 border-border/80 h-12 text-md focus-visible:ring-primary/50"
                  />
                </div>
                <Button 
                  onClick={handleCreateSession}
                  disabled={isCreatingSession || !sessionName.trim()}
                  className="w-full bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/25 h-12 font-medium"
                >
                  {isCreatingSession ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Starting Engine...</>
                  ) : (
                    "Create Session"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <Card className="border-border/50 bg-surface-1/80 backdrop-blur-xl shadow-2xl relative ring-1 ring-white/5 animate-in slide-in-from-right-8 duration-500 overflow-hidden">
              <div className="absolute top-0 right-1/2 translate-x-1/2 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[80px] pointer-events-none" />

              <CardHeader className="text-center pt-8 pb-2 relative z-10">
                <CardTitle className="text-2xl text-text-primary tracking-tight mb-2">
                  Scan with WhatsApp
                </CardTitle>
                <CardDescription className="text-text-muted">
                  Open WhatsApp on your phone to scan the code
                </CardDescription>
              </CardHeader>

              <CardContent className="relative z-10 pb-8 space-y-6">
                <div className="flex justify-center my-6">
                  <div className="bg-white p-4 rounded-3xl shadow-xl shadow-black/40 ring-4 ring-white/10 relative">
                    {!qrCode ? (
                      <div className="w-[240px] h-[240px] flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <span className="text-text-muted font-medium bg-black px-4 py-1.5 rounded-full text-sm">
                          Generating QR...
                        </span>
                      </div>
                    ) : (
                      <div className="w-[240px] h-[240px] relative">
                         <Image 
                           src={qrCode} 
                           alt="WhatsApp QR Code" 
                           fill
                           className="object-contain"
                         />
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                      <div className="bg-surface-2 border border-border/80 text-text-primary px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-semibold">
                        <span className={`w-2 h-2 rounded-full ${qrStatus === 'STARTING' ? 'bg-warning animate-pulse' : 'bg-primary animate-ping'}`} />
                        {qrStatus === 'STARTING' ? 'WAITING' : 'READY TO SCAN'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-surface-2/40 p-5 rounded-2xl border border-border/50 mt-8">
                  <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-primary" /> How to scan
                  </h4>
                  <ol className="text-sm text-text-secondary space-y-3">
                    <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">1</span> Open WhatsApp on your phone</li>
                    <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">2</span> Tap Menu or Settings and select Linked Devices</li>
                    <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">3</span> Point your phone to this screen to capture the code</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <Card className="border-accent/30 bg-surface-1/80 backdrop-blur-xl shadow-2xl relative ring-1 ring-accent/20 animate-in zoom-in-95 duration-500 overflow-hidden">
              <div className="absolute top-0 right-1/2 translate-x-1/2 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[100px] pointer-events-none" />

              <CardHeader className="text-center pt-10 pb-4 relative z-10">
                <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-success/30 shadow-[0_0_40px_rgba(0,201,122,0.3)]">
                  <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <CardTitle className="text-3xl text-text-primary tracking-tight">
                  You&apos;re all set!
                </CardTitle>
                <CardDescription className="text-text-muted mt-2 text-base">
                  Your WhatsApp number is successfully connected.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="relative z-10 space-y-6 pb-8 px-6">
                <div className="bg-background rounded-xl p-5 border border-border/80 relative group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Your API Key</span>
                    <Button variant="ghost" size="sm" onClick={copyApiKey} className="h-8 px-2 text-primary hover:text-primary-light hover:bg-primary/10 transition-colors">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <code className="text-sm font-mono text-accent block break-all leading-tight">
                    {user?.api_key || 'Loading API key...'}
                  </code>
                </div>

                <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-warning text-sm font-bold">!</span>
                  </div>
                  <p className="text-sm text-text-secondary leading-snug">
                    <strong className="text-text-primary font-medium block mb-1">Keep this secret.</strong>
                    Don&apos;t share it publicly. You can always regenerate it from your Dashboard settings.
                  </p>
                </div>

                <Button 
                  onClick={() => router.push('/dashboard')}
                  className="w-full bg-success hover:bg-success/80 text-background font-bold h-12 shadow-lg shadow-success/25 mt-4 text-md"
                >
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
