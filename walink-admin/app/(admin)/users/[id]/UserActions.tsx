"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShieldBan, ShieldCheck, PlusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface UserActionsProps {
  userId: string;
  isActive: boolean;
  userName: string;
}

export function UserActions({ userId, isActive, userName }: UserActionsProps) {
  const router = useRouter();
  const supabase = createClient();

  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);

  const [showCredits, setShowCredits] = useState(false);
  const [creditsAmount, setCreditsAmount] = useState("");
  const [creditsLoading, setCreditsLoading] = useState(false);

  const handleToggle = async () => {
    setSuspendLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !isActive })
      .eq("id", userId);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(isActive ? "User suspended" : "User activated");
      router.refresh();
    }
    setSuspendLoading(false);
    setShowSuspend(false);
  };

  const handleAddCredits = async () => {
    const amount = parseInt(creditsAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error("Enter a valid amount");
      return;
    }
    setCreditsLoading(true);

    const { data, error } = await supabase.rpc("add_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_type: "bonus",
      p_description: `Admin added: ${amount} credits`,
    });

    if (error) {
      toast.error("Failed to add credits");
    } else {
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result?.success) {
        toast.success(`Added ${amount} credits`);
        router.refresh();
      } else {
        toast.error(result?.error || "Failed");
      }
    }
    setCreditsLoading(false);
    setShowCredits(false);
    setCreditsAmount("");
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCredits(true)}
          className="gap-1.5 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Add Credits
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSuspend(true)}
          className={`gap-1.5 cursor-pointer ${isActive ? "text-danger border-danger/30 hover:bg-danger/10" : "text-success border-success/30 hover:bg-success/10"}`}
        >
          {isActive ? <ShieldBan className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          {isActive ? "Suspend" : "Activate"}
        </Button>
      </div>

      {/* Suspend Dialog */}
      <AlertDialog open={showSuspend} onOpenChange={setShowSuspend}>
        <AlertDialogContent className="bg-surface-1 border-border-color">
          <AlertDialogHeader>
            <AlertDialogTitle>{isActive ? "Suspend" : "Activate"} {userName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "The user will lose access to all API features."
                : "The user will regain access to all features."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggle}
              disabled={suspendLoading}
              className={`cursor-pointer ${isActive ? "bg-danger" : "bg-success"}`}
            >
              {suspendLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Credits Dialog */}
      <Dialog open={showCredits} onOpenChange={(o) => { setShowCredits(o); if (!o) setCreditsAmount(""); }}>
        <DialogContent className="bg-surface-1 border-border-color">
          <DialogHeader>
            <DialogTitle>Add Credits to {userName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Amount</Label>
            <Input
              type="number"
              min={1}
              max={100000}
              value={creditsAmount}
              onChange={(e) => setCreditsAmount(e.target.value)}
              placeholder="Enter credits amount"
              className="bg-surface-2 border-border-color"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCredits(false); setCreditsAmount(""); }} className="cursor-pointer">Cancel</Button>
            <Button onClick={handleAddCredits} disabled={creditsLoading || !creditsAmount} className="bg-primary hover:bg-primary-dark text-primary-foreground cursor-pointer">
              {creditsLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
