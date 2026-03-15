"use client";

import { useEffect, useState, useMemo } from "react";
import { useUserStore } from "@/store/user.store";
import { createClient } from "@/lib/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { Check, X, CreditCard, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PlanBadge } from "@/components/shared/PlanBadge";

const PLANS = [
  { id: "free", name: "Free", price: "Free", credits: "100", sessions: 1, media: false, webhooks: false, rate: "10", support: "Community" },
  { id: "starter", name: "Starter", price: "$29 / month", credits: "5,000", sessions: 1, media: true, webhooks: true, rate: "60", support: "Email" },
  { id: "pro", name: "Pro", price: "$99 / month", credits: "50,000", sessions: 3, media: true, webhooks: true, rate: "300", support: "Priority" },
  { id: "business", name: "Business", price: "$499 / month", credits: "500,000", sessions: 10, media: true, webhooks: true, rate: "1000", support: "24/7 Slack" },
];

const PRESETS = [
  { credits: 500, price: 2 },
  { credits: 1000, price: 4 },
  { credits: 2500, price: 9 },
  { credits: 5000, price: 16 },
];

export default function BillingPage() {
  const { user, fetchUser, isLoading: userLoading } = useUserStore();
  const supabase = createClient();
  
  const [loadingTx, setLoadingTx] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customAmount, setCustomAmount] = useState<number | "">("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    async function loadTransactions() {
      if (!user) return;
      setLoadingTx(true);
      
      const start = (page - 1) * limit;
      const end = start + limit - 1;
      
      const { data, count } = await supabase
        .from("credit_transactions")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(start, end);
        
      setTransactions(data || []);
      setTotalCount(count || 0);
      setLoadingTx(false);
    }
    loadTransactions();
  }, [user, page, supabase]);

  const handleBuy = () => {
    toast.info("Payment gateway integration coming soon!");
  };

  const planId = user?.plan_id || "free";
  const planIndex = PLANS.findIndex(p => p.id === planId);
  const monthlyLimit = parseInt(PLANS.find(p => p.id === planId)?.credits.replace(/,/g, "") || "100");
  const creditsUsed = monthlyLimit - (user?.credits_balance || 0);
  const progressPercent = Math.min(Math.max((creditsUsed / monthlyLimit) * 100, 0), 100);

  const getArcColor = () => {
    if (progressPercent >= 90) return "#ef4444"; // danger
    if (progressPercent >= 75) return "#eab308"; // warning
    return "#00D4A0"; // success
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Credits</h1>
          <p className="text-text-muted mt-1 text-sm">Manage your subscription, transaction history, and API quotas.</p>
        </div>
      </div>

      <Tabs defaultValue="subscription" className="w-full">
        <TabsList className="mb-6 w-full md:w-auto grid grid-cols-2 md:inline-flex bg-surface-1 border border-border/50 h-12">
          <TabsTrigger value="subscription" className="text-sm">Subscription</TabsTrigger>
          <TabsTrigger value="credits" className="text-sm">Credits</TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------------------------------
            SUBSCRIPTION TAB 
            ------------------------------------------------------------------------- */}
        <TabsContent value="subscription" className="border-none p-0 focus-visible:outline-none">
          <Card className="bg-surface-1 border-border/50 mb-8 max-w-2xl">
            <CardContent className="p-6">
               <div className="flex items-center gap-4 mb-4">
                 <h2 className="text-2xl font-bold capitalize">{planId} Plan</h2>
                 <PlanBadge plan_id={planId} />
               </div>
               <div className="text-text-secondary text-sm space-y-2">
                 {planId !== "free" && user?.plan_expires_at && (
                    <p>Next renewal date: <strong className="text-text-primary">{format(new Date(user.plan_expires_at), "MMM do, yyyy")}</strong></p>
                 )}
                 <p className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> Active monthly credits allocated.</p>
                 <p className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> API access functioning normally.</p>
               </div>
               
               {planId !== "business" && (
                 <Button onClick={handleBuy} className="mt-6 bg-primary hover:bg-primary-dark">Upgrade Plan</Button>
               )}
            </CardContent>
          </Card>

          <Card className="bg-surface-1 border-border/50 overflow-hidden">
             <CardHeader>
               <CardTitle>Plan Comparison</CardTitle>
               <CardDescription>Upgrade seamlessly manually mapping tier quotas to your operational capacity.</CardDescription>
             </CardHeader>
             <CardContent className="p-0 overflow-x-auto">
                <Table>
                   <TableHeader>
                     <TableRow className="border-border hover:bg-transparent bg-surface-2/20">
                       <TableHead className="w-[150px] font-bold text-text-primary text-sm"></TableHead>
                       {PLANS.map(p => (
                          <TableHead key={p.id} className={`text-center py-4 font-bold text-lg ${p.id === planId ? "text-primary border-t-2 border-t-primary bg-primary/5" : ""}`}>
                            {p.name}
                          </TableHead>
                       ))}
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                      <TableRow className="border-border/50 hover:bg-surface-2/20">
                         <TableCell className="font-semibold text-text-muted">Price</TableCell>
                         {PLANS.map(p => <TableCell key={p.id} className="text-center font-mono text-sm">{p.price}</TableCell>)}
                      </TableRow>
                      <TableRow className="border-border/50 hover:bg-surface-2/20">
                         <TableCell className="font-semibold text-text-muted">Monthly Credits</TableCell>
                         {PLANS.map(p => <TableCell key={p.id} className="text-center font-mono text-sm">{p.credits}</TableCell>)}
                      </TableRow>
                      <TableRow className="border-border/50 hover:bg-surface-2/20">
                         <TableCell className="font-semibold text-text-muted">Max Sessions</TableCell>
                         {PLANS.map(p => <TableCell key={p.id} className="text-center font-mono text-sm">{p.sessions}</TableCell>)}
                      </TableRow>
                      <TableRow className="border-border/50 hover:bg-surface-2/20">
                         <TableCell className="font-semibold text-text-muted">Rate Limit</TableCell>
                         {PLANS.map(p => <TableCell key={p.id} className="text-center font-mono text-sm">{p.rate} msg/min</TableCell>)}
                      </TableRow>
                      <TableRow className="border-border/50 hover:bg-surface-2/20">
                         <TableCell className="font-semibold text-text-muted">Support</TableCell>
                         {PLANS.map(p => <TableCell key={p.id} className="text-center font-mono text-sm">{p.support}</TableCell>)}
                      </TableRow>
                      <TableRow className="border-border/50 hover:bg-surface-2/20">
                         <TableCell className="font-semibold text-text-muted">File & Media</TableCell>
                         {PLANS.map(p => <TableCell key={p.id} className="text-center">{p.media ? <Check className="w-5 h-5 mx-auto text-success" /> : <X className="w-5 h-5 mx-auto text-text-muted opacity-50" />}</TableCell>)}
                      </TableRow>
                      <TableRow className="border-border/50 hover:bg-surface-2/20">
                         <TableCell className="font-semibold text-text-muted">Webhooks</TableCell>
                         {PLANS.map(p => <TableCell key={p.id} className="text-center">{p.webhooks ? <Check className="w-5 h-5 mx-auto text-success" /> : <X className="w-5 h-5 mx-auto text-text-muted opacity-50" />}</TableCell>)}
                      </TableRow>
                      <TableRow className="border-border hover:bg-transparent">
                         <TableCell className="font-semibold text-text-muted"></TableCell>
                         {PLANS.map((p, i) => (
                            <TableCell key={p.id} className={`text-center py-6 ${p.id === planId ? "bg-primary/5" : ""}`}>
                               {p.id === planId ? (
                                  <Button disabled variant="outline" className="w-full max-w-[120px] bg-surface-2 border-border/50 text-text-muted opacity-60">Current Plan</Button>
                               ) : i < planIndex ? (
                                  <Button variant="outline" onClick={handleBuy} className="w-full max-w-[120px] border-text-muted/50 hover:bg-surface-2">Downgrade</Button>
                               ) : (
                                  <Button onClick={handleBuy} className="w-full max-w-[120px] bg-primary hover:bg-primary-dark">Upgrade</Button>
                               )}
                            </TableCell>
                         ))}
                      </TableRow>
                   </TableBody>
                </Table>
             </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------------------------------
            CREDITS TAB 
            ------------------------------------------------------------------------- */}
        <TabsContent value="credits" className="border-none p-0 focus-visible:outline-none space-y-8">
           <div className="grid lg:grid-cols-3 gap-6">
              
              {/* Balance Card */}
              <Card className="bg-surface-1 border-border/50 h-full">
                 <CardContent className="p-8 flex flex-col items-center justify-center text-center h-full">
                    <div className="relative w-48 h-48 flex items-center justify-center">
                       {/* SVG Arc Progress */}
                       <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                         <circle className="text-surface-2 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                         <circle 
                           className="stroke-current transition-all duration-1000 ease-in-out" 
                           stroke={getArcColor()} 
                           strokeWidth="8" strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent"
                           strokeDasharray={`${2 * Math.PI * 40}`}
                           strokeDashoffset={`${2 * Math.PI * 40 * (1 - (progressPercent / 100))}`}
                         ></circle>
                       </svg>
                       <div className="flex flex-col items-center justify-center">
                          <span className="text-4xl font-extrabold text-text-primary">
                            {userLoading ? <Skeleton className="w-20 h-10 bg-surface-2" /> : user?.credits_balance?.toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-text-muted uppercase tracking-widest mt-1">Balance</span>
                       </div>
                    </div>
                    <div className="mt-6">
                       <p className="text-sm font-medium text-text-secondary">
                          <strong className="text-text-primary">{Math.max(0, creditsUsed).toLocaleString()}</strong> of <strong className="text-text-primary">{monthlyLimit.toLocaleString()}</strong> credits used this month.
                       </p>
                    </div>
                 </CardContent>
              </Card>

              {/* Top Up Form */}
              <Card className="bg-surface-1 border-border/50 lg:col-span-2 shadow-xl">
                 <CardHeader>
                    <CardTitle>Top up your balance</CardTitle>
                    <CardDescription>Credits roll over indefinitely across active plans.</CardDescription>
                 </CardHeader>
                 <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                       {PRESETS.map((preset, i) => (
                          <div key={i} className="bg-surface-2 border border-border/60 hover:border-primary/50 transition-colors p-4 rounded-xl flex flex-col items-center text-center cursor-pointer hover:shadow-lg hover:shadow-primary/5 group" onClick={handleBuy}>
                             <div className="text-xl font-bold text-text-primary group-hover:text-primary mb-1">{preset.credits.toLocaleString()}</div>
                             <div className="text-xs text-text-muted font-medium mb-3">credits</div>
                             <div className="text-lg font-black text-accent mt-auto">${preset.price}</div>
                             <Button size="sm" className="w-full mt-3 h-8 text-xs bg-primary hover:bg-primary-dark">Buy</Button>
                          </div>
                       ))}
                    </div>

                    <div className="border-t border-border/50 pt-6">
                       <h3 className="text-sm font-semibold mb-3">Custom Amount</h3>
                       <div className="flex items-end gap-4 max-w-sm">
                          <div className="flex-1 space-y-1.5">
                             <label className="text-xs font-medium text-text-muted">Enter custom amount (min 100)</label>
                             <Input 
                               type="number" 
                               min="100" 
                               step="100"
                               placeholder="1000" 
                               value={customAmount} 
                               onChange={e => setCustomAmount(e.target.value ? parseInt(e.target.value) : "")}
                               className="bg-surface-2 h-11"
                             />
                          </div>
                          <div className="w-32 flex flex-col justify-end">
                             <Button onClick={handleBuy} disabled={typeof customAmount !== 'number' || customAmount < 100} className="w-full h-11 bg-primary hover:bg-primary-dark">
                               Buy {typeof customAmount === 'number' && customAmount >= 100 ? `($${(customAmount * 0.0035).toFixed(2)})` : ''}
                             </Button>
                          </div>
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>

           {/* Transaction History */}
           <Card className="bg-surface-1 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                 <CardTitle>Transaction History</CardTitle>
                 <Button variant="outline" size="sm" onClick={() => toast("Export coming soon")} className="bg-surface-2 h-8 text-xs">
                   <Download className="w-3.5 h-3.5 mr-2" /> Export
                 </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                 <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs font-semibold text-text-muted">Date</TableHead>
                        <TableHead className="text-xs font-semibold text-text-muted">Type</TableHead>
                        <TableHead className="text-xs font-semibold text-text-muted">Description</TableHead>
                        <TableHead className="text-xs font-semibold text-text-muted text-right">Amount</TableHead>
                        <TableHead className="text-xs font-semibold text-text-muted text-right">Balance After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {loadingTx ? (
                          Array.from({length: 5}).map((_, i) => (
                            <TableRow key={i} className="border-border/50"><TableCell colSpan={5}><Skeleton className="h-10 w-full bg-surface-2 rounded" /></TableCell></TableRow>
                          ))
                       ) : transactions.length === 0 ? (
                          <TableRow className="border-none hover:bg-transparent">
                             <TableCell colSpan={5} className="h-32 text-center text-text-muted text-sm">No transactions yet.</TableCell>
                          </TableRow>
                       ) : (
                          transactions.map(tx => (
                             <TableRow key={tx.id} className="border-border/50 hover:bg-surface-2/40">
                               <TableCell className="text-xs text-text-secondary whitespace-nowrap">{format(new Date(tx.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                               <TableCell>
                                  <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider border ${
                                     tx.type === 'purchase' ? 'bg-success/10 text-success border-success/30' :
                                     tx.type === 'usage' ? 'bg-danger/10 text-danger border-danger/30' :
                                     tx.type === 'bonus' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                     'bg-teal-500/10 text-teal-400 border-teal-500/30'
                                  }`}>
                                     {tx.type} {tx.type === 'usage' ? '-' : '+'}
                                  </Badge>
                               </TableCell>
                               <TableCell className="text-xs font-medium text-text-primary">{tx.description}</TableCell>
                               <TableCell className="text-right font-mono text-sm text-text-primary">
                                  <span className={tx.type === 'usage' ? 'text-danger' : 'text-success'}>
                                     {tx.type === 'usage' ? '-' : '+'}{Math.abs(tx.amount).toLocaleString()}
                                  </span>
                               </TableCell>
                               <TableCell className="text-right font-mono text-sm text-text-muted">{tx.balance_after?.toLocaleString() || '-'}</TableCell>
                             </TableRow>
                          ))
                       )}
                    </TableBody>
                 </Table>
              </CardContent>
              
              {!loadingTx && totalCount > limit && (
                 <div className="p-3 border-t border-border/50 flex items-center justify-between text-xs text-text-muted bg-surface-1/50">
                    <span>Showing {(page - 1) * limit + 1}-{Math.min(page * limit, totalCount)} of {totalCount}</span>
                    <div className="flex gap-1">
                       <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0"><ChevronLeft className="w-4 h-4" /></Button>
                       <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(Math.ceil(totalCount / limit), p + 1))} disabled={page >= Math.ceil(totalCount / limit)} className="h-8 w-8 p-0"><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                 </div>
              )}
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}