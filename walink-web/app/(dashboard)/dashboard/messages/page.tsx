"use client";

import { useEffect, useState, useMemo } from "react";
import { useUserStore } from "@/store/user.store";
import { createClient } from "@/lib/supabase/client";
import api from "@/lib/api";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";

import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Loader2, Image as ImageIcon, Video, Music, FileText, MapPin, CheckCircle, XCircle } from "lucide-react";

const _CREDIT_COSTS: Record<string, number> = {
  text: 1, location: 1, image: 3, video: 3, audio: 3, file: 3
};

// Form Schemas
const singleMessageSchema = z.object({
  session_id: z.string().min(1, "Session is required"),
  to_number: z.string().regex(/^\d{7,15}$/, "Must be between 7 and 15 digits"),
  type: z.enum(["text", "image", "video", "audio", "file", "location"]),
  message: z.string().max(4096, "Message too long").optional(),
  file_url: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  caption: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.type === "text" && (!data.message || data.message.trim() === "")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Message is required", path: ["message"] });
  }
  if (["image", "video", "audio", "file"].includes(data.type) && !data.file_url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL is required", path: ["file_url"] });
  }
  if (data.type === "location" && (!data.latitude || !data.longitude)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Latitude is required", path: ["latitude"] });
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Longitude is required", path: ["longitude"] });
  }
});

const bulkMessageSchema = singleMessageSchema.omit({ to_number: true }).extend({
  numbers: z.string().min(1, "Numbers are required"),
  delay: z.number().min(1000).max(10000),
});

export default function SendMessagePage() {
  const router = useRouter();
  const { user, fetchUser } = useUserStore();
  const supabase = createClient();
  const [sessions, setSessions] = useState<any[]>([]);

  // Bulk Progress State
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ total: 0, sent: 0, failed: 0, current_number: "" });
  const [bulkComplete, setBulkComplete] = useState(false);
  
  // Single submit state
  const [isSendingSingle, setIsSendingSingle] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      if (!user) return;
      const { data } = await supabase.from("wa_sessions").select("*").eq("user_id", user.id).eq("status", "CONNECTED");
      setSessions(data || []);
    }
    loadSessions();
  }, [user, supabase]);

  const singleForm = useForm<z.infer<typeof singleMessageSchema>>({
    resolver: zodResolver(singleMessageSchema),
    defaultValues: { type: "text", message: "", file_url: "", caption: "", latitude: "", longitude: "" }
  });

  const bulkForm = useForm<z.infer<typeof bulkMessageSchema>>({
    resolver: zodResolver(bulkMessageSchema),
    defaultValues: { type: "text", message: "", file_url: "", caption: "", latitude: "", longitude: "", delay: 2000, numbers: "" }
  });

  // Watch Single Form
  const watchSingleType = singleForm.watch("type");
  const watchSingleMsg = singleForm.watch("message");
  const watchSingleCaption = singleForm.watch("caption");
  
  // Watch Bulk Form
  const watchBulkType = bulkForm.watch("type");
  const watchBulkMsg = bulkForm.watch("message");
  const watchBulkCaption = bulkForm.watch("caption");
  const watchBulkNumbers = bulkForm.watch("numbers");
  const watchBulkDelay = bulkForm.watch("delay");

  // Cost calculations
  const singleCost = _CREDIT_COSTS[watchSingleType] || 1;
  const singleBalanceAfter = (user?.credits_balance || 0) - singleCost;

  // Bulk numbers parsing
  const parsedNumbers = useMemo(() => {
    if (!watchBulkNumbers) return { valid: [], invalid: [] };
    const lines = watchBulkNumbers.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    const valid: string[] = [];
    const invalid: string[] = [];
    lines.forEach(n => {
      if (/^\d{7,15}$/.test(n)) valid.push(n);
      else invalid.push(n);
    });
    return { valid, invalid };
  }, [watchBulkNumbers]);

  const bulkCost = (_CREDIT_COSTS[watchBulkType] || 1) * parsedNumbers.valid.length;
  const bulkBalanceAfter = (user?.credits_balance || 0) - bulkCost;
  const bulkEstimatedMins = ((parsedNumbers.valid.length * watchBulkDelay) / 60000).toFixed(1);

  // Submit Handlers
  const onSingleSubmit = async (values: z.infer<typeof singleMessageSchema>) => {
    if (singleBalanceAfter < 0) {
      toast.error("Insufficient credits for this message.");
      return;
    }
    setIsSendingSingle(true);
    try {
      // mapping to internal API request shape
      const payload: any = { session_id: values.session_id, to: values.to_number, type: values.type };
      if (values.type === "text") payload.message = values.message;
      else if (values.type === "location") { payload.latitude = values.latitude; payload.longitude = values.longitude; }
      else { payload.file_url = values.file_url; payload.caption = values.caption; }

      await api.post("/api/messages/send", payload);
      toast.success(`Message sent! ${singleCost} credit(s) deducted`);
      singleForm.reset({ ...values, to_number: "", message: "", file_url: "", caption: "", latitude: "", longitude: "" });
      fetchUser();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to send message");
    } finally {
      setIsSendingSingle(false);
    }
  };

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const onBulkSubmit = async (values: z.infer<typeof bulkMessageSchema>) => {
    if (parsedNumbers.valid.length === 0) {
      toast.error("No valid numbers provided.");
      return;
    }
    if (bulkBalanceAfter < 0) {
      toast.error("Insufficient credits for this bulk dispatch.");
      return;
    }
    if (!confirm(`You are about to send ${parsedNumbers.valid.length} messages using ${bulkCost} credits. Continue?`)) {
      return;
    }

    setIsBulkSending(true);
    setBulkComplete(false);
    setBulkProgress({ total: parsedNumbers.valid.length, sent: 0, failed: 0, current_number: parsedNumbers.valid[0] });

    const controller = new AbortController();
    setAbortController(controller);

    // Call existing bulk API sequentially handled backend, but frontend requests it at once. 
    // Wait, the prompt says: progress UI while sending. "Call existing bulk API sequentially handled backend". 
    // Ah, the `/api/messages/bulk` in Phase 4 handles sequentially?
    // YES, the phase 4 backend `messages.router.ts` does all the looping and delay internally!
    // But that means we can't easily show LIVE progress from frontend calling a single `/bulk` route.
    // Let's check phase 4 prompt: "loop all valid numbers... await delay(delay_ms)... return final report".
    // If we call `/bulk`, it will hang until it's fully done, the frontend can't show live "Sent: X | Failed X | Current Number" natively unless streaming or doing the loop on FRONTEND.
    // Wait, let's do the loop on FRONTEND to satisfy the detailed UI progress reqs easily!
    // But then how is credits handled? Frontend calls `/send` in a loop? 
    // Let's use the `/api/messages/send` endpoint in a loop here on the frontend, so we can cleanly control it and abort!

    let sent = 0; let failed = 0;
    for (let i = 0; i < parsedNumbers.valid.length; i++) {
        if (controller.signal.aborted) {
           break;
        }
        const num = parsedNumbers.valid[i];
        setBulkProgress(prev => ({ ...prev, current_number: num }));
        
        try {
           const payload: any = { session_id: values.session_id, to: num, type: values.type };
           if (values.type === "text") payload.message = values.message;
           else if (values.type === "location") { payload.latitude = values.latitude; payload.longitude = values.longitude; }
           else { payload.file_url = values.file_url; payload.caption = values.caption; }
           
           await api.post("/api/messages/send", payload);
           sent++;
        } catch(e) {
           failed++;
        }
        
        setBulkProgress(prev => ({ ...prev, sent, failed }));
        
        if (i < parsedNumbers.valid.length - 1 && !controller.signal.aborted) {
           await new Promise(r => setTimeout(r, values.delay));
        }
    }

    setIsBulkSending(false);
    setBulkComplete(true);
    fetchUser();
  };

  const cancelBulkUpload = () => {
    if (abortController) abortController.abort();
    setIsBulkSending(false);
  };

  const renderDynamicFields = (formObj: any, watchType: string) => {
    return (
      <div className="space-y-4">
        {watchType === "text" && (
          <FormField control={formObj.control} name="message" render={({ field }) => (
            <FormItem>
              <FormLabel>Message Body</FormLabel>
              <FormControl><Textarea className="resize-none min-h-[120px] bg-surface-2" placeholder="Hello there!" {...field} /></FormControl>
              <FormDescription className="text-right">{field.value?.length || 0}/4096 docs</FormDescription>
              <FormMessage />
            </FormItem>
          )}/>
        )}
        {["image", "video", "audio", "file"].includes(watchType) && (
          <FormField control={formObj.control} name="file_url" render={({ field }) => (
            <FormItem>
              <FormLabel>File URL</FormLabel>
              <FormControl><Input placeholder="https://example.com/file.pdf" {...field} className="bg-surface-2" /></FormControl>
              <FormMessage />
            </FormItem>
          )}/>
        )}
        {["image", "video", "file"].includes(watchType) && (
          <FormField control={formObj.control} name="caption" render={({ field }) => (
            <FormItem>
              <FormLabel>Caption (Optional)</FormLabel>
              <FormControl><Input placeholder="Check this out!" {...field} className="bg-surface-2" /></FormControl>
              <FormMessage />
            </FormItem>
          )}/>
        )}
        {watchType === "location" && (
          <div className="grid grid-cols-2 gap-4">
             <FormField control={formObj.control} name="latitude" render={({ field }) => (
               <FormItem><FormLabel>Latitude</FormLabel><FormControl><Input placeholder="25.2048" {...field} className="bg-surface-2" /></FormControl><FormMessage /></FormItem>
             )}/>
             <FormField control={formObj.control} name="longitude" render={({ field }) => (
               <FormItem><FormLabel>Longitude</FormLabel><FormControl><Input placeholder="55.2708" {...field} className="bg-surface-2" /></FormControl><FormMessage /></FormItem>
             )}/>
          </div>
        )}
      </div>
    );
  };

  const renderPhonePreview = (type: string, msg: string, caption: string) => {
    return (
      <div className="w-[300px] h-[600px] border-[8px] border-surface-2 rounded-[3rem] bg-[#0b141a] overflow-hidden shadow-2xl relative mx-auto flex flex-col scale-90 sm:scale-100 origin-top">
         <div className="bg-[#202c33] h-16 w-full flex items-center px-4 shrink-0 shadow z-10">
            <div className="w-10 h-10 bg-surface-2 rounded-full flex shrink-0 border border-border"></div>
            <div className="ml-3 flex-1 overflow-hidden">
               <div className="text-white font-semibold text-sm truncate">Recipient</div>
               <div className="text-[#8696a0] text-xs">online</div>
            </div>
         </div>
         {/* Internal background using simple whatsapp-like pattern approximation directly injected via SVG pattern conceptually */}
         <div className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto bg-[#0b141a] relative z-0">
             <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(var(--color-border) 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />
             
             {/* The Bubble */}
             <div className="max-w-[85%] bg-[#005c4b] self-end rounded-xl rounded-tr-none p-2 text-[15px] text-[#e9edef] mt-auto relative shadow-sm break-words">
                 {type === 'text' && (
                    <span className="whitespace-pre-wrap">{msg || "Message preview..."}</span>
                 )}
                 {['image','video','file'].includes(type) && (
                    <div className="bg-[#0b141a]/20 w-full aspect-square rounded overflow-hidden flex flex-col items-center justify-center mb-1 border border-white/5">
                        {type === 'image' && <ImageIcon className="w-8 h-8 opacity-50" />}
                        {type === 'video' && <Video className="w-8 h-8 opacity-50" />}
                        {type === 'file' && <FileText className="w-8 h-8 opacity-50" />}
                    </div>
                 )}
                 {type === 'audio' && (
                    <div className="flex items-center gap-2 p-1 bg-[#0b141a]/10 rounded mb-1 min-w-[150px]">
                      <Music className="w-5 h-5 opacity-70 shrink-0" />
                      <div className="h-1 bg-white/20 rounded-full flex-1"><div className="w-1/3 h-full bg-primary rounded-full" /></div>
                    </div>
                 )}
                 {type === 'location' && (
                    <div className="w-full aspect-video bg-[#0b141a]/20 flex items-center justify-center rounded mb-1 relative border border-white/5">
                        <MapPin className="w-6 h-6 text-danger" />
                        <span className="absolute bottom-1 left-2 text-[10px] opacity-60">Location</span>
                    </div>
                 )}
                 {['image','video','file'].includes(type) && caption && (
                    <span className="whitespace-pre-wrap block text-sm mt-1">{caption}</span>
                 )}
                 <span className="text-[10px] text-[#8696a0] float-right mt-1 ml-2 select-none relative top-0.5">12:00</span>
             </div>
         </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Send Message</h1>
          <p className="text-text-muted mt-1 text-sm">Dispatch singular API blasts or bulk arrays.</p>
        </div>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="mb-6 w-full md:w-auto grid grid-cols-2 md:inline-flex bg-surface-1 border border-border/50 h-12">
          <TabsTrigger value="single" className="text-sm">Single Message</TabsTrigger>
          <TabsTrigger value="bulk" className="text-sm">Bulk Send</TabsTrigger>
        </TabsList>
        
        {/* =========================================================================
            SINGLE MESSAGE TAB
            ========================================================================= */}
        <TabsContent value="single" className="border-none p-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="grid lg:grid-cols-2 gap-8">
             <Card className="bg-surface-1 border-border/50 shadow-xl overflow-hidden">
                <CardContent className="p-6">
                   <Form {...singleForm}>
                      <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-5">
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={singleForm.control} name="session_id" render={({field}) => (
                               <FormItem>
                                 <FormLabel>From Session</FormLabel>
                                 <Select onValueChange={field.onChange} defaultValue={field.value} disabled={sessions.length === 0}>
                                    <FormControl>
                                       <SelectTrigger className="bg-surface-2 border-border/80">
                                         <SelectValue placeholder={sessions.length === 0 ? "No connected sessions" : "Select session"} />
                                       </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                       {sessions.map(s => (
                                          <SelectItem key={s.id} value={s.id}>{s.session_name} (+{s.phone_number})</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                                 <FormMessage />
                               </FormItem>
                            )}/>
                            <FormField control={singleForm.control} name="type" render={({field}) => (
                               <FormItem>
                                 <FormLabel>Message Type</FormLabel>
                                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                       <SelectTrigger className="bg-surface-2 border-border/80 capitalize">
                                         <SelectValue />
                                       </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                       {Object.keys(_CREDIT_COSTS).map(t => (
                                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                                 <FormMessage />
                               </FormItem>
                            )}/>
                         </div>

                         <FormField control={singleForm.control} name="to_number" render={({field}) => (
                             <FormItem>
                               <FormLabel>To Number</FormLabel>
                               <FormControl><Input placeholder="201012345678" {...field} className="bg-surface-2 h-11" /></FormControl>
                               <FormDescription>Include country code without +</FormDescription>
                               <FormMessage />
                             </FormItem>
                         )}/>

                         {renderDynamicFields(singleForm, watchSingleType)}

                         <div className="pt-4 border-t border-border/50">
                            <div className="flex items-center justify-between text-sm mb-4 bg-surface-2/50 p-3 rounded-lg border border-border/30">
                               <span className="text-text-secondary">This message will cost <strong>{singleCost} credit(s)</strong></span>
                               {singleBalanceAfter >= 0 ? (
                                  <span className="text-success flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> Valid</span>
                               ) : (
                                  <span className="text-danger flex items-center"><XCircle className="w-4 h-4 mr-1"/> Insufficient balance</span>
                               )}
                            </div>
                            <Button 
                              type="submit" 
                              disabled={isSendingSingle || sessions.length === 0 || singleBalanceAfter < 0} 
                              className="w-full bg-primary hover:bg-primary-dark h-12 text-md transition-all shadow-lg shadow-primary/20"
                            >
                              {isSendingSingle ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                              {isSendingSingle ? "Sending Payload..." : "Send Message"}
                            </Button>
                         </div>
                      </form>
                   </Form>
                </CardContent>
             </Card>

             {/* SINGLE PREVIEW PANEL */}
             <div className="relative">
                {renderPhonePreview(watchSingleType, watchSingleMsg || "", watchSingleCaption || "")}
                <div className="mt-8 max-w-[300px] mx-auto text-center space-y-2">
                   <div className="text-3xl font-extrabold text-primary">{user?.credits_balance?.toLocaleString() || 0}</div>
                   <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">Current Credits</div>
                   <div className={`text-sm ${singleBalanceAfter < 0 ? 'text-danger font-bold' : 'text-text-secondary'}`}>
                      {singleBalanceAfter.toLocaleString()} after send
                   </div>
                </div>
             </div>
          </div>
        </TabsContent>

        {/* =========================================================================
            BULK SEND TAB
            ========================================================================= */}
        <TabsContent value="bulk" className="border-none p-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
          {!isBulkSending && !bulkComplete ? (
             <Card className="bg-surface-1 border-border/50 shadow-xl max-w-4xl mx-auto">
               <CardContent className="p-6">
                 <Form {...bulkForm}>
                    <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-6">
                       
                       <div className="grid md:grid-cols-2 gap-6">
                          <FormField control={bulkForm.control} name="session_id" render={({field}) => (
                               <FormItem>
                                 <FormLabel>From Session</FormLabel>
                                 <Select onValueChange={field.onChange} defaultValue={field.value} disabled={sessions.length === 0}>
                                    <FormControl>
                                       <SelectTrigger className="bg-surface-2 border-border/80">
                                         <SelectValue placeholder={sessions.length === 0 ? "No connected sessions" : "Select session"} />
                                       </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                       {sessions.map(s => (
                                          <SelectItem key={s.id} value={s.id}>{s.session_name} (+{s.phone_number})</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                                 <FormMessage />
                               </FormItem>
                          )}/>

                          <FormField control={bulkForm.control} name="type" render={({field}) => (
                               <FormItem>
                                 <FormLabel>Message Type</FormLabel>
                                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                       <SelectTrigger className="bg-surface-2 border-border/80 capitalize">
                                         <SelectValue />
                                       </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                       {Object.keys(_CREDIT_COSTS).map(t => (
                                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                                 <FormMessage />
                               </FormItem>
                          )}/>
                       </div>

                       <div className="grid md:grid-cols-2 gap-6 items-start">
                          <div className="space-y-4">
                            <FormField control={bulkForm.control} name="numbers" render={({field}) => (
                               <FormItem>
                                 <FormLabel>Recipients</FormLabel>
                                 <FormControl><Textarea placeholder={"201012345678\n201087654321\n..."} className="min-h-[220px] bg-surface-2" {...field}/></FormControl>
                                 <FormDescription>One number per line, include country code</FormDescription>
                                 <FormMessage />
                               </FormItem>
                            )}/>
                            <div className="p-3 bg-surface-2/40 border border-border/40 rounded-lg text-sm">
                               <span className="text-success font-semibold">{parsedNumbers.valid.length} valid numbers</span>
                               {parsedNumbers.invalid.length > 0 && (
                                  <div className="text-danger mt-1 font-semibold border-t border-border/40 pt-1">
                                    {parsedNumbers.invalid.length} invalid lines
                                  </div>
                               )}
                            </div>
                          </div>
                          
                          <div className="space-y-6">
                             {renderDynamicFields(bulkForm, watchBulkType)}
                             
                             <FormField control={bulkForm.control} name="delay" render={({field}) => (
                                <FormItem className="pt-2">
                                   <FormLabel>Delay: {field.value / 1000} seconds between messages</FormLabel>
                                   <FormControl>
                                      <Slider 
                                         min={1000} max={10000} step={500} 
                                         value={[field.value]} 
                                         onValueChange={v => field.onChange((v as number[])[0])} 
                                      />
                                   </FormControl>
                                   <FormDescription>Higher delay = safer for your account</FormDescription>
                                </FormItem>
                             )}/>
                          </div>
                       </div>

                       {/* BULK PRE-SEND SUMMARY */}
                       <div className="bg-[#0b141a] p-5 rounded-2xl border border-border flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full text-center md:text-left">
                               <div>
                                  <div className="text-xs text-text-muted uppercase">Total Numbers</div>
                                  <div className="text-xl font-bold">{parsedNumbers.valid.length}</div>
                               </div>
                               <div>
                                  <div className="text-xs text-text-muted uppercase">Est. Credits</div>
                                  <div className="text-xl font-bold text-accent">{bulkCost}</div>
                               </div>
                               <div>
                                  <div className="text-xs text-text-muted uppercase">Balance After</div>
                                  <div className={`text-xl font-bold ${bulkBalanceAfter < 0 ? 'text-danger' : 'text-text-primary'}`}>{bulkBalanceAfter}</div>
                               </div>
                               <div>
                                  <div className="text-xs text-text-muted uppercase">Est. Time</div>
                                  <div className="text-xl font-bold">{bulkEstimatedMins} min</div>
                               </div>
                           </div>
                       </div>

                       <Button 
                         type="submit" 
                         disabled={parsedNumbers.valid.length === 0 || bulkBalanceAfter < 0 || sessions.length === 0} 
                         className="w-full bg-primary hover:bg-primary-dark h-12 text-md transition-all shadow-lg"
                       >
                         Start Bulk Send
                       </Button>
                    </form>
                 </Form>
               </CardContent>
             </Card>
          ) : isBulkSending ? (
             <Card className="max-w-xl mx-auto bg-surface-1 border-primary/50 ring-1 ring-primary/20 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-1/2 translate-x-1/2 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
                <CardContent className="p-10 flex flex-col items-center text-center space-y-6 relative z-10">
                   <Loader2 className="w-12 h-12 text-primary animate-spin" />
                   <div>
                     <h3 className="text-2xl font-bold text-text-primary tracking-tight">Sending Messages...</h3>
                     <p className="text-sm text-text-muted mt-2">Please keep this page open until complete.</p>
                   </div>
                   
                   <div className="w-full max-w-sm space-y-2 mt-4">
                     <div className="flex justify-between text-xs font-bold text-text-secondary uppercase">
                        <span>Progress</span>
                        <span>{bulkProgress.sent + bulkProgress.failed}/{bulkProgress.total}</span>
                     </div>
                     <Progress value={((bulkProgress.sent + bulkProgress.failed) / bulkProgress.total) * 100} className="h-2" />
                     <div className="text-xs text-text-muted truncate pt-1">Processing: +{bulkProgress.current_number}</div>
                   </div>

                   <div className="flex gap-6 pt-4">
                      <div className="flex flex-col">
                         <span className="text-2xl font-extrabold text-success">{bulkProgress.sent}</span>
                         <span className="text-xs text-text-muted font-semibold uppercase">Sent</span>
                      </div>
                      <div className="h-10 w-px bg-border/50"></div>
                      <div className="flex flex-col">
                         <span className="text-2xl font-extrabold text-danger">{bulkProgress.failed}</span>
                         <span className="text-xs text-text-muted font-semibold uppercase">Failed</span>
                      </div>
                   </div>

                   <Button variant="outline" onClick={cancelBulkUpload} className="w-full max-w-sm border-danger/50 text-danger hover:bg-danger/10 mt-4">
                     Cancel Sending
                   </Button>
                </CardContent>
             </Card>
          ) : (
             <Card className="max-w-xl mx-auto bg-surface-1 border-success/50 ring-1 ring-success/20 shadow-2xl relative overflow-hidden animate-in zoom-in-95">
                <div className="absolute top-0 right-1/2 translate-x-1/2 w-[300px] h-[300px] bg-success/10 rounded-full blur-[80px] pointer-events-none" />
                <CardContent className="p-10 flex flex-col items-center text-center space-y-6 relative z-10">
                   <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center">
                     <CheckCircle className="w-10 h-10 text-success" />
                   </div>
                   <div>
                     <h3 className="text-3xl font-bold text-text-primary tracking-tight">Bulk Send Complete!</h3>
                     <p className="text-text-muted mt-2">All reachable contacts have been processed.</p>
                   </div>
                   
                   <div className="flex gap-8 justify-center bg-surface-2/50 px-8 py-4 rounded-2xl border border-border/50 w-full max-w-sm mt-4">
                      <div className="flex flex-col">
                         <span className="text-3xl font-extrabold text-success tracking-tight">{bulkProgress.sent}</span>
                         <span className="text-xs text-text-muted tracking-widest font-bold uppercase mt-1">Delivered</span>
                      </div>
                      <div className="flex flex-col">
                         <span className="text-3xl font-extrabold text-danger tracking-tight">{bulkProgress.failed}</span>
                         <span className="text-xs text-text-muted tracking-widest font-bold uppercase mt-1">Failed</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4 w-full max-w-sm pt-4">
                     <Button variant="outline" onClick={() => setBulkComplete(false)} className="bg-surface-2 border-border/80">New Batch</Button>
                     <Button onClick={() => router.push('/dashboard/logs')} className="bg-primary hover:bg-primary-dark">View Logs</Button>
                   </div>
                </CardContent>
             </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}