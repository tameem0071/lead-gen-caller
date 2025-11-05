import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeadSchema, type InsertLead } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { CheckCircle, Phone } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FormStep = "businessName" | "contactName" | "phoneNumber" | "productCategory" | "brandName" | "success";

export default function LeadGenPage() {
  const [step, setStep] = useState<FormStep>("businessName");
  const { toast } = useToast();

  const form = useForm<InsertLead>({
    resolver: zodResolver(insertLeadSchema),
    defaultValues: {
      businessName: "",
      contactName: "",
      phoneNumber: "",
      productCategory: "",
      brandName: "",
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: InsertLead) => {
      return await apiRequest("POST", "/api/leads", data);
    },
    onSuccess: () => {
      setStep("success");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit lead. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNext = async (currentStep: FormStep) => {
    let isValid = false;
    
    switch (currentStep) {
      case "businessName":
        isValid = await form.trigger("businessName");
        if (isValid) setStep("contactName");
        break;
      case "contactName":
        setStep("phoneNumber");
        break;
      case "phoneNumber":
        isValid = await form.trigger("phoneNumber");
        if (isValid) setStep("productCategory");
        break;
      case "productCategory":
        isValid = await form.trigger("productCategory");
        if (isValid) setStep("brandName");
        break;
      case "brandName":
        isValid = await form.trigger("brandName");
        if (isValid) {
          form.handleSubmit((data) => createLeadMutation.mutate(data))();
        }
        break;
    }
  };

  const questions = {
    businessName: "What's your business name?",
    contactName: "Who should we ask for? (optional)",
    phoneNumber: "What's the best number to reach you?",
    productCategory: "What product are you interested in?",
    brandName: "Which brand should we mention?",
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold" data-testid="text-success-title">
              We'll call you shortly!
            </h1>
            <p className="text-muted-foreground">
              Thanks for your interest. Our system is placing a call to your number right now.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4">
            <Phone className="h-4 w-4 animate-pulse" />
            <span>Call initiated</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-hero-title">
            Get a Call From Us in Minutes
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Fill out this quick form and we'll reach out to you with a personalized introduction.
          </p>
        </div>

        <Card className="p-6 md:p-8 space-y-6">
          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
              {step === "businessName" && (
                <div className="space-y-4">
                  <div className="max-w-sm">
                    <p className="text-base font-medium mb-4" data-testid="text-question-businessName">
                      {questions.businessName}
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Acme Corp"
                            {...field}
                            data-testid="input-businessName"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleNext("businessName");
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {step === "contactName" && (
                <div className="space-y-4">
                  <div className="max-w-sm">
                    <p className="text-base font-medium mb-4" data-testid="text-question-contactName">
                      {questions.contactName}
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Smith"
                            {...field}
                            data-testid="input-contactName"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleNext("contactName");
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {step === "phoneNumber" && (
                <div className="space-y-4">
                  <div className="max-w-sm">
                    <p className="text-base font-medium mb-4" data-testid="text-question-phoneNumber">
                      {questions.phoneNumber}
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="+12345678900"
                            {...field}
                            data-testid="input-phoneNumber"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleNext("phoneNumber");
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Format: +1234567890 (E.164 format with country code)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {step === "productCategory" && (
                <div className="space-y-4">
                  <div className="max-w-sm">
                    <p className="text-base font-medium mb-4" data-testid="text-question-productCategory">
                      {questions.productCategory}
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="productCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Category</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Software Solutions"
                            {...field}
                            data-testid="input-productCategory"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleNext("productCategory");
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {step === "brandName" && (
                <div className="space-y-4">
                  <div className="max-w-sm">
                    <p className="text-base font-medium mb-4" data-testid="text-question-brandName">
                      {questions.brandName}
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="brandName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="YourBrand"
                            {...field}
                            data-testid="input-brandName"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleNext("brandName");
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="flex gap-4 pt-4">
                {step !== "businessName" && step !== "success" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const steps: FormStep[] = ["businessName", "contactName", "phoneNumber", "productCategory", "brandName"];
                      const currentIndex = steps.indexOf(step);
                      if (currentIndex > 0) {
                        setStep(steps[currentIndex - 1]);
                      }
                    }}
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => handleNext(step)}
                  disabled={createLeadMutation.isPending}
                  className="flex-1"
                  data-testid="button-next"
                >
                  {step === "brandName" ? (createLeadMutation.isPending ? "Submitting..." : "Submit") : "Continue"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
