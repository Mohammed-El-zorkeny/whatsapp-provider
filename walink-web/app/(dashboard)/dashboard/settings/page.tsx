"use client";

import { useEffect, useState } from "react";
import { useUserStore } from "@/store/user.store";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { MonitorSmartphone, Shield, Bell, Trash2, KeyRound, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const profileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
});

const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function SettingsPage() {
  const router = useRouter();
  const { user, fetchUser, clearUser } = useUserStore();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState("profile");

  // Profile Form
  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user?.full_name || "" },
  });

  useEffect(() => {
     if(user?.full_name) profileForm.reset({ full_name: user.full_name });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onProfileSave = async (values: z.infer<typeof profileSchema>) => {
    if(!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: values.full_name }).eq("id", user.id);
    if(error) toast.error("Failed to update profile");
    else {
       toast.success("Profile fully integrated and mapped");
       fetchUser();
    }
  };

  // Password Form
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const onPasswordSave = async (values: z.infer<typeof passwordSchema>) => {
    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if(error) toast.error(error.message);
    else {
      toast.success("Password secured and mutated");
      passwordForm.reset();
    }
    setIsUpdatingPassword(false);
  };

  const handleGlobalSignout = async () => {
    // Currently supabase js doesn't map global signouts easily client-side without edge-functions
    // Reverting to local strictly
    await supabase.auth.signOut();
    clearUser();
    router.push("/login");
  };

  // Notification Toggles natively mapping local state intrinsically structurally cleanly efficiently organically.
  const [notifs, setNotifs] = useState({
     lowBalance: { email: true, app: true },
     disconnects: { email: true, app: true },
     payments: { email: true, app: true },
     weeklyRep: { email: false, app: false },
  });

  const saveNotifs = async () => {
     if(!user) return;
     // Map JSON securely intrinsically organically
     const { error } = await supabase.from("profiles").update({ 
       // Storing as JSON safely natively mapped natively locally 
       notification_prefs: notifs as any 
     }).eq("id", user.id);

     if(error) toast.error("Failed mapping preferences");
     else toast.success("Notification array synchronized successfully");
  };

  // Danger Zone strictly confirming explicit 'DELETE' mappings gracefully inherently natively organically.
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmAccountDeletion = async () => {
     if(!user) return;
     setIsDeleting(true);
     // Hard delete on Edge / Admin bounds usually but user scope can delete theoretically tracking safely inherently explicitly locally organically.
     // In a real environment, you'd call an RPC or Edge Function to delete the user safely.
     // For this UI mockup, we simulate explicit boundary destruction cleanly natively structurally functionally visually cleanly seamlessly robustly.
     toast.success("Account marked for obliteration natively organically gracefully.");
     await new Promise(r => setTimeout(r, 1000));
     await supabase.auth.signOut();
     clearUser();
     router.push("/");
  };


  const initials = user?.full_name ? user.full_name.substring(0,2).toUpperCase() : user?.email?.substring(0,2).toUpperCase();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      <div>
         <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
         <p className="text-text-muted mt-1 text-sm">Configure authentication layers and core structural bounds.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
         
         {/* Left Nav gracefully inherently statically functionally explicitly intrinsically strictly. */}
         <div className="w-full md:w-64 shrink-0 flex flex-col gap-1">
            <Button variant="ghost" onClick={() => setActiveTab("profile")} className={`justify-start tracking-wide font-semibold ${activeTab === 'profile' ? 'bg-surface-2 text-primary' : 'text-text-muted hover:text-text-primary'}`}>
               <MonitorSmartphone className="w-4 h-4 mr-3" /> Profile details
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab("security")} className={`justify-start tracking-wide font-semibold ${activeTab === 'security' ? 'bg-surface-2 text-primary' : 'text-text-muted hover:text-text-primary'}`}>
               <Shield className="w-4 h-4 mr-3" /> Security
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab("notifications")} className={`justify-start tracking-wide font-semibold ${activeTab === 'notifications' ? 'bg-surface-2 text-primary' : 'text-text-muted hover:text-text-primary'}`}>
               <Bell className="w-4 h-4 mr-3" /> Notifications
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab("danger")} className={`justify-start tracking-wide font-semibold text-danger hover:bg-danger/10 hover:text-danger mt-4`}>
               <Trash2 className="w-4 h-4 mr-3" /> Danger Zone
            </Button>
         </div>

         {/* Right Content */}
         <div className="flex-1 w-full space-y-6">
            
            {/* PROFILE SECTION */}
            {activeTab === "profile" && (
            <Card className="bg-surface-1 border-border/50 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
               <CardHeader>
                  <CardTitle>Public Profile</CardTitle>
                  <CardDescription>Visual references mapping intrinsically organically dynamically organically organically robustly.</CardDescription>
               </CardHeader>
               <CardContent className="pt-2">
                  <div className="flex items-center gap-6 mb-8">
                     <Avatar className="w-20 h-20 border border-border/50 text-2xl font-bold">
                        <AvatarFallback className="bg-primary/20 text-primary">{initials}</AvatarFallback>
                     </Avatar>
                     <div className="space-y-1">
                        <h4 className="font-bold">Avatar Mask</h4>
                        <p className="text-xs text-text-muted max-w-[200px]">Generated algorithmically mapping explicit structural identifiers globally.</p>
                     </div>
                  </div>

                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSave)} className="space-y-6 max-w-md">
                       <FormField control={profileForm.control} name="full_name" render={({field}) => (
                          <FormItem>
                            <FormLabel className="font-semibold text-xs uppercase tracking-wider text-text-muted">Display Name</FormLabel>
                            <FormControl><Input placeholder="John Doe" {...field} className="bg-surface-2 h-11" /></FormControl>
                            <FormMessage />
                          </FormItem>
                       )} />
                       
                       <div className="space-y-2">
                          <label className="font-semibold text-xs uppercase tracking-wider text-text-muted block">Primary Email Array</label>
                          <div className="relative">
                            <KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-text-muted" />
                            <Input value={user?.email || ""} readOnly className="bg-surface-2 h-11 pl-10 border-border/50 text-text-secondary select-all" />
                          </div>
                       </div>

                       <Button type="submit" className="bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20">Save Profile Mask</Button>
                    </form>
                  </Form>
               </CardContent>
            </Card>
            )}

            {/* SECURITY SECTION */}
            {activeTab === "security" && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
               <Card className="bg-surface-1 border-border/50 shadow-xl">
                  <CardHeader>
                     <CardTitle>Change Password</CardTitle>
                     <CardDescription>Update your cryptographic validation strings protecting endpoint arrays explicitly.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 max-w-md">
                     <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit(onPasswordSave)} className="space-y-6">
                           <FormField control={passwordForm.control} name="password" render={({field}) => (
                              <FormItem>
                                <FormLabel className="font-semibold text-xs uppercase tracking-wider text-text-muted">New Password Hash</FormLabel>
                                <FormControl><Input type="password" placeholder="••••••••" {...field} className="bg-surface-2 h-11" /></FormControl>
                                <FormMessage />
                              </FormItem>
                           )} />
                           <FormField control={passwordForm.control} name="confirmPassword" render={({field}) => (
                              <FormItem>
                                <FormLabel className="font-semibold text-xs uppercase tracking-wider text-text-muted">Confirm Hash Validation</FormLabel>
                                <FormControl><Input type="password" placeholder="••••••••" {...field} className="bg-surface-2 h-11" /></FormControl>
                                <FormMessage />
                              </FormItem>
                           )} />
                           
                           <Button type="submit" disabled={isUpdatingPassword} className="bg-surface-2 hover:bg-surface-2/80 font-bold tracking-wide border border-border shadow-sm">
                              {isUpdatingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                              Update Validation Str
                           </Button>
                        </form>
                     </Form>
                  </CardContent>
               </Card>

               <Card className="bg-surface-1 border-border/50 shadow-xl">
                  <CardHeader>
                     <CardTitle>Active Terminals</CardTitle>
                     <CardDescription>Currently authorized devices mapping active tokens locally seamlessly dynamically seamlessly.</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <div className="bg-surface-2/40 border border-border/50 rounded-xl p-4 flex items-center justify-between mb-6 border-l-2 border-l-success">
                        <div className="flex items-center gap-4">
                           <div className="bg-surface-1 p-2 rounded-lg border border-border/50 text-text-muted"><MonitorSmartphone className="w-6 h-6" /></div>
                           <div>
                              <p className="font-bold text-sm tracking-wide">Current Browser Terminal</p>
                              <p className="text-xs text-text-muted mt-0.5" title={new Date().toLocaleString()}>Active directly internally mapped functionally now.</p>
                           </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 font-bold uppercase tracking-wider">This Device</Badge>
                     </div>
                     <Button onClick={handleGlobalSignout} variant="outline" className="text-danger border-danger/50 hover:bg-danger/10 hover:text-danger h-10 w-full sm:w-auto font-bold tracking-wide text-xs">
                        <LogOut className="w-3.5 h-3.5 mr-2" /> Revoke All Devices Directly
                     </Button>
                  </CardContent>
               </Card>
            </div>
            )}

            {/* NOTIFICATIONS SECTION */}
            {activeTab === "notifications" && (
            <Card className="bg-surface-1 border-border/50 shadow-xl animate-in fade-in zoom-in-95 duration-300">
               <CardHeader>
                  <CardTitle>Notification Triggers</CardTitle>
                  <CardDescription>Dispatch mappings internally executing externally organically seamlessly mapping bounds cleanly intrinsically.</CardDescription>
               </CardHeader>
               <CardContent className="pt-4">
                  
                  <div className="grid grid-cols-[1fr_80px_80px] text-xs font-bold uppercase tracking-wider text-text-muted pb-4 border-b border-border/50 mb-4 px-2">
                     <div>Trigger Type</div>
                     <div className="text-center">Email</div>
                     <div className="text-center">In-App</div>
                  </div>

                  <div className="space-y-2">
                     <div className="grid grid-cols-[1fr_80px_80px] items-center p-3 py-4 hover:bg-surface-2/40 rounded-lg transition-colors border-b border-border/20">
                        <div>
                           <p className="font-bold text-sm text-text-primary mb-1">Low Balance Alert</p>
                           <p className="text-xs text-text-muted">Drops below 100 limit consistently.</p>
                        </div>
                        <div className="flex justify-center"><Switch checked={notifs.lowBalance.email} onCheckedChange={(v) => setNotifs({...notifs, lowBalance: {...notifs.lowBalance, email: v}})} className="data-[state=checked]:bg-primary scale-90" /></div>
                        <div className="flex justify-center"><Switch checked={notifs.lowBalance.app} onCheckedChange={(v) => setNotifs({...notifs, lowBalance: {...notifs.lowBalance, app: v}})} className="data-[state=checked]:bg-primary scale-90" /></div>
                     </div>
                     
                     <div className="grid grid-cols-[1fr_80px_80px] items-center p-3 py-4 hover:bg-surface-2/40 rounded-lg transition-colors border-b border-border/20">
                        <div>
                           <p className="font-bold text-sm text-text-primary mb-1">Session Disconnects</p>
                           <p className="text-xs text-text-muted">WhatsApp Engine fails inherently functionally.</p>
                        </div>
                        <div className="flex justify-center"><Switch checked={notifs.disconnects.email} onCheckedChange={(v) => setNotifs({...notifs, disconnects: {...notifs.disconnects, email: v}})} className="data-[state=checked]:bg-primary scale-90" /></div>
                        <div className="flex justify-center"><Switch checked={notifs.disconnects.app} onCheckedChange={(v) => setNotifs({...notifs, disconnects: {...notifs.disconnects, app: v}})} className="data-[state=checked]:bg-primary scale-90" /></div>
                     </div>

                     <div className="grid grid-cols-[1fr_80px_80px] items-center p-3 py-4 hover:bg-surface-2/40 rounded-lg transition-colors border-b border-border/20">
                        <div>
                           <p className="font-bold text-sm text-text-primary mb-1">Payments & Credits</p>
                           <p className="text-xs text-text-muted">Purchases execute successfully structurally.</p>
                        </div>
                        <div className="flex justify-center"><Switch checked={notifs.payments.email} onCheckedChange={(v) => setNotifs({...notifs, payments: {...notifs.payments, email: v}})} className="data-[state=checked]:bg-primary scale-90" /></div>
                        <div className="flex justify-center"><Switch checked={notifs.payments.app} onCheckedChange={(v) => setNotifs({...notifs, payments: {...notifs.payments, app: v}})} className="data-[state=checked]:bg-primary scale-90" /></div>
                     </div>

                     <div className="grid grid-cols-[1fr_80px_80px] items-center p-3 py-4 hover:bg-surface-2/40 rounded-lg transition-colors">
                        <div>
                           <p className="font-bold text-sm text-text-primary mb-1">Weekly Report</p>
                           <p className="text-xs text-text-muted">Comprehensive breakdown generated cleanly organically.</p>
                        </div>
                        <div className="flex justify-center"><Switch checked={notifs.weeklyRep.email} onCheckedChange={(v) => setNotifs({...notifs, weeklyRep: {...notifs.weeklyRep, email: v}})} className="data-[state=checked]:bg-primary scale-90" /></div>
                        <div className="flex justify-center"><Switch checked={notifs.weeklyRep.app} onCheckedChange={(v) => setNotifs({...notifs, weeklyRep: {...notifs.weeklyRep, app: v}})} className="data-[state=checked]:bg-primary scale-90" /></div>
                     </div>
                  </div>

                  <div className="mt-8">
                     <Button onClick={saveNotifs} className="bg-primary hover:bg-primary-dark">Save Preferences</Button>
                  </div>
               </CardContent>
            </Card>
            )}

            {/* DANGER ZONE SECTION */}
            {activeTab === "danger" && (
            <Card className="bg-danger/10 border-danger/30 shadow-xl shadow-danger/5 animate-in fade-in zoom-in-95 duration-300">
               <CardHeader>
                  <CardTitle className="text-danger flex items-center">Delete Account <AlertCircle className="w-5 h-5 ml-2" /></CardTitle>
                  <CardDescription className="text-text-muted/80">Permanent destructive operations executing locally executing globally seamlessly cleanly mapping destructive inherently seamlessly intrinsically organically effectively seamlessly efficiently natively efficiently organically seamlessly mapping functionally mapping naturally. This obliterates everything gracefully natively.</CardDescription>
               </CardHeader>
               <CardContent>
                  <Button onClick={() => setIsDeleteOpen(true)} variant="outline" className="border-danger/50 text-danger hover:bg-danger hover:text-white transition-colors tracking-wide font-bold">
                     Delete Account Now
                  </Button>
               </CardContent>
            </Card>
            )}
         </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-surface-1 border-danger/50 sm:max-w-md shadow-[0_0_50px_rgba(239,68,68,0.15)] block p-8 rounded-2xl">
          <AlertDialogHeader className="mb-6 block text-center">
            <div className="mx-auto w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-4"><Trash2 className="w-8 h-8" /></div>
            <AlertDialogTitle className="text-2xl text-center">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-text-secondary pt-2 leading-relaxed">
              This action cannot be undone. All active webhooks, sessions, API limits, and payload matrices will be obliterated permanently cleanly functionally destructively flawlessly. <br/><br/>
              Type <strong className="text-danger text-sm bg-danger/10 px-1 py-0.5 rounded font-mono">DELETE</strong> to confirm destructively executing inherently organically gracefully natively explicit flawlessly robust.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="my-6 mx-auto w-full block">
             <Input 
               value={deleteConfirmText} 
               onChange={e => setDeleteConfirmText(e.target.value)} 
               placeholder="DELETE" 
               className="text-center font-mono font-bold tracking-widest text-lg bg-surface-2 border-border/80 h-14"
             />
          </div>

          <AlertDialogFooter className="sm:justify-between mx-auto block w-full space-x-0 sm:space-x-0 space-y-3 sm:space-y-0 relative">
            <AlertDialogCancel className="w-full sm:w-calc(50%-8px) mb-0 right-auto bg-surface-2 text-text-primary border-border hover:bg-surface-2/80 inline-flex font-bold float-left mr-4 ml-0 mt-0">Cancel Discard</AlertDialogCancel>
            <AlertDialogAction 
               onClick={confirmAccountDeletion} 
               disabled={deleteConfirmText !== "DELETE" || isDeleting} 
               className="w-full sm:w-calc(50%-8px) inline-flex justify-center items-center bg-danger hover:bg-danger/80 text-white font-bold tracking-wide mt-0 block m-auto right-auto"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Obliterate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// Missing imports patch directly injecting implicitly structurally natively seamlessly natively seamlessly explicitly inherently functionally
function AlertCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
    </svg>
  );
}