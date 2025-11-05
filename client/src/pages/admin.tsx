import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Lead, CallSession } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Phone, User, Package, Building2, Calendar, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
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

export default function AdminPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const { toast } = useToast();

  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: callSessions = [], isLoading: callsLoading } = useQuery<CallSession[]>({
    queryKey: ["/api/calls"],
    refetchInterval: 3000,
  });

  const placeCallMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) throw new Error("Lead not found");

      const callSession = await apiRequest("POST", "/api/call/start", {
        leadId: lead.id,
        phoneNumber: lead.phoneNumber,
        businessName: lead.businessName,
        productCategory: lead.productCategory,
        brandName: lead.brandName,
      });

      await apiRequest("POST", `/api/call/${callSession.id}/dial`, {});
      return callSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      toast({
        title: "Call initiated",
        description: "The outbound call has been placed successfully.",
      });
      setShowCallDialog(false);
      setSelectedLead(null);
    },
    onError: (error: any) => {
      toast({
        title: "Call failed",
        description: error.message || "Failed to place call. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCallNow = (lead: Lead) => {
    setSelectedLead(lead);
    setShowCallDialog(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-admin-title">
                Admin Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage leads and call sessions
              </p>
            </div>
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Twilio Connected
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="leads" className="space-y-6">
          <TabsList>
            <TabsTrigger value="leads" data-testid="tab-leads">
              Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="calls" data-testid="tab-calls">
              Call Sessions ({callSessions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="space-y-6">
            {leadsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : leads.length === 0 ? (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                      <Phone className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold" data-testid="text-empty-leads">
                      No leads yet
                    </h3>
                    <p className="text-muted-foreground mt-1">
                      Leads will appear here once created through the form
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {leads.map((lead) => (
                  <Card key={lead.id} className="hover-elevate" data-testid={`card-lead-${lead.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <CardTitle className="text-xl" data-testid={`text-lead-business-${lead.id}`}>
                            {lead.businessName}
                          </CardTitle>
                          <CardDescription className="flex flex-wrap items-center gap-4 text-sm">
                            {lead.contactName && (
                              <span className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />
                                {lead.contactName}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              {lead.phoneNumber}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Package className="h-3.5 w-3.5" />
                              {lead.productCategory}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5" />
                              {lead.brandName}
                            </span>
                          </CardDescription>
                        </div>
                        <Button
                          size="default"
                          onClick={() => handleCallNow(lead)}
                          data-testid={`button-call-${lead.id}`}
                          className="gap-2"
                        >
                          <Phone className="h-4 w-4" />
                          Call Now
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calls" className="space-y-6">
            {callsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : callSessions.length === 0 ? (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                      <Phone className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold" data-testid="text-empty-calls">
                      No call sessions yet
                    </h3>
                    <p className="text-muted-foreground mt-1">
                      Call sessions will appear here once initiated
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {callSessions.map((session) => (
                  <Card key={session.id} className="hover-elevate" data-testid={`card-call-${session.id}`}>
                    <CardHeader className="space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg" data-testid={`text-call-business-${session.id}`}>
                          {session.businessName}
                        </CardTitle>
                        <StatusBadge state={session.state as any} showPulse={session.state === "DIALING"} />
                      </div>
                      <CardDescription className="text-xs">
                        {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Phone</p>
                          <p className="font-medium truncate" data-testid={`text-call-phone-${session.id}`}>
                            {session.phoneNumber}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Product</p>
                          <p className="font-medium truncate">{session.productCategory}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground text-xs mb-1">Brand</p>
                          <p className="font-medium truncate">{session.brandName}</p>
                        </div>
                      </div>

                      {session.twilioSid && (
                        <div className="pt-4 border-t space-y-2">
                          <p className="text-xs text-muted-foreground">Twilio Details</p>
                          <div className="space-y-1">
                            <p className="text-xs font-mono truncate" title={session.twilioSid}>
                              SID: {session.twilioSid}
                            </p>
                            {session.twilioStatus && (
                              <p className="text-xs">
                                Status: <span className="font-medium">{session.twilioStatus}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={showCallDialog} onOpenChange={setShowCallDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Place Call Now?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>You're about to initiate an outbound call to:</p>
              {selectedLead && (
                <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Business:</span> {selectedLead.businessName}
                  </p>
                  <p>
                    <span className="font-medium">Phone:</span> {selectedLead.phoneNumber}
                  </p>
                  <p>
                    <span className="font-medium">Product:</span> {selectedLead.productCategory}
                  </p>
                  <p>
                    <span className="font-medium">Brand:</span> {selectedLead.brandName}
                  </p>
                </div>
              )}
              <div className="flex items-start gap-2 text-xs">
                <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  Trial mode: Ensure this number is verified in your Twilio account.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-call">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedLead && placeCallMutation.mutate(selectedLead.id)}
              disabled={placeCallMutation.isPending}
              data-testid="button-confirm-call"
            >
              {placeCallMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Placing Call...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Confirm & Call
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
