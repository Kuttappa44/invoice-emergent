import { useState, useEffect, useRef } from "react";
import { configurationsApi, templatesApi, workflowsApi, documentsApi } from "../hooks/useApi";
import { cn, formatDateTime, getStatusColor, getConfidenceLevel, truncateText } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { format } from "date-fns";
import {
  Play,
  Pause,
  CheckCircle2,
  Circle,
  Settings,
  FileText,
  Calendar as CalendarIcon,
  Filter,
  Upload,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Flag,
} from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { id: 1, label: "Configuration", icon: Settings },
  { id: 2, label: "Run Mode", icon: Play },
  { id: 3, label: "Template", icon: FileText },
  { id: 4, label: "Filters", icon: Filter },
];

export function Workflow() {
  const [currentStep, setCurrentStep] = useState(1);
  const [configs, setConfigs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [runMode, setRunMode] = useState("full_flow");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [emailFilters, setEmailFilters] = useState({
    sender_email: "",
    sender_domain: "",
    subject_keywords: "",
  });
  
  // Workflow execution state
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState(null);
  const [logs, setLogs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  
  const logsEndRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [configsRes, templatesRes] = await Promise.all([
        configurationsApi.list(),
        templatesApi.list(),
      ]);
      setConfigs(configsRes.data);
      setTemplates(templatesRes.data);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedConfig !== null;
      case 2:
        return runMode !== null;
      case 3:
        return runMode === "matching_only" || selectedTemplate !== null;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleStartWorkflow = async () => {
    if (!selectedConfig) {
      toast.error("Please select a configuration");
      return;
    }

    try {
      setWorkflowRunning(true);
      setLogs([]);
      setDocuments([]);

      // Create workflow run
      const runData = {
        configuration_id: selectedConfig.id,
        template_id: selectedTemplate?.id,
        run_mode: runMode,
        date_from: dateFrom?.toISOString(),
        date_to: dateTo?.toISOString(),
        email_filters: emailFilters,
      };

      const response = await workflowsApi.create(runData);
      setCurrentRun(response.data);
      
      // Start the workflow
      await workflowsApi.start(response.data.id);
      
      // Add simulated logs for demo (since we don't have Gmail OAuth connected yet)
      simulateWorkflowExecution(response.data.id);
      
    } catch (error) {
      toast.error("Failed to start workflow");
      setWorkflowRunning(false);
    }
  };

  const simulateWorkflowExecution = async (runId) => {
    const logMessages = [
      "Starting workflow execution...",
      "Initializing AI extraction model...",
      "Checking email provider connection...",
      "Note: Gmail OAuth not connected. Using manual document upload mode.",
      "Ready for document processing.",
      "Upload documents manually to extract data.",
    ];

    for (let i = 0; i < logMessages.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          message: logMessages[i],
          type: i === 3 ? "warning" : "info",
        },
      ]);
    }

    setWorkflowRunning(false);
    toast.success("Workflow initialized. Upload documents to process.");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLogs((prev) => [
        ...prev,
        { timestamp: new Date().toISOString(), message: `Uploading ${file.name}...`, type: "info" },
      ]);

      const response = await documentsApi.upload(
        file,
        selectedTemplate?.id,
        currentRun?.id
      );

      setLogs((prev) => [
        ...prev,
        { timestamp: new Date().toISOString(), message: `Extraction complete for ${file.name}`, type: "success" },
      ]);

      // Refresh documents
      if (currentRun?.id) {
        const docsResponse = await documentsApi.list({ workflow_run_id: currentRun.id });
        setDocuments(docsResponse.data);
      } else {
        setDocuments((prev) => [
          ...prev,
          {
            id: response.data.id,
            attachment_name: file.name,
            extracted_fields: response.data.extracted_fields,
            confidence_scores: response.data.confidence_scores,
            document_status: "pending",
            matching_status: "pending",
          },
        ]);
      }

      toast.success("Document processed successfully");
    } catch (error) {
      setLogs((prev) => [
        ...prev,
        { timestamp: new Date().toISOString(), message: `Error processing ${file.name}`, type: "error" },
      ]);
      toast.error("Failed to process document");
    }
  };

  const handleReviewDocument = async (action) => {
    if (!selectedDocument) return;

    try {
      await documentsApi.review(selectedDocument.id, action);
      
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === selectedDocument.id ? { ...d, document_status: action } : d
        )
      );

      toast.success(`Document ${action}`);
      setReviewDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update document");
    }
  };

  const handleExport = async () => {
    try {
      const response = await documentsApi.export(currentRun?.id, "csv");
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export completed");
    } catch (error) {
      toast.error("Export failed");
    }
  };

  if (loading) {
    return <WorkflowSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in" data-testid="workflow-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Workflow</h1>
        <p className="text-muted-foreground mt-1">
          Execute document extraction and matching workflows
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-lg transition-all",
                  isActive && "bg-primary text-primary-foreground",
                  isCompleted && "text-primary",
                  !isActive && !isCompleted && "text-muted-foreground"
                )}
                data-testid={`step-${step.id}`}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2",
                    isActive && "border-primary-foreground bg-primary-foreground/20",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    !isActive && !isCompleted && "border-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <span className="font-semibold">{step.id}</span>
                  )}
                </div>
                <span className="font-medium hidden md:inline">{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Configuration Steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Configuration */}
          {currentStep === 1 && (
            <Card data-testid="step-config">
              <CardHeader>
                <CardTitle>Select Configuration Profile</CardTitle>
                <CardDescription>
                  Choose a saved configuration or create a new one
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {configs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {configs.map((config) => (
                      <Card
                        key={config.id}
                        className={cn(
                          "cursor-pointer transition-all",
                          selectedConfig?.id === config.id
                            ? "ring-2 ring-primary"
                            : "hover:border-primary/50"
                        )}
                        onClick={() => setSelectedConfig(config)}
                        data-testid={`config-option-${config.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                selectedConfig?.id === config.id
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground"
                              )}
                            >
                              {selectedConfig?.id === config.id && (
                                <Check className="h-3 w-3 text-primary-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{config.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {config.ai_provider?.provider_name} / {config.email_provider?.provider_type}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-muted/50">
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">
                        No configurations available. Create one first.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Run Mode */}
          {currentStep === 2 && (
            <Card data-testid="step-mode">
              <CardHeader>
                <CardTitle>Select Run Mode</CardTitle>
                <CardDescription>
                  Choose how the workflow should process documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    id: "extraction_only",
                    label: "Extraction Only",
                    description: "Extract data from documents without matching",
                  },
                  {
                    id: "matching_only",
                    label: "Matching Only",
                    description: "Match existing extracted data with sources",
                  },
                  {
                    id: "full_flow",
                    label: "Full Flow",
                    description: "Extract data and run matching logic",
                  },
                ].map((mode) => (
                  <Card
                    key={mode.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      runMode === mode.id
                        ? "ring-2 ring-primary"
                        : "hover:border-primary/50"
                    )}
                    onClick={() => setRunMode(mode.id)}
                    data-testid={`mode-option-${mode.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
                            runMode === mode.id
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          )}
                        >
                          {runMode === mode.id && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{mode.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {mode.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Template */}
          {currentStep === 3 && (
            <Card data-testid="step-template">
              <CardHeader>
                <CardTitle>Select Template</CardTitle>
                <CardDescription>
                  Choose extraction fields template
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {runMode === "matching_only" ? (
                  <Card className="bg-muted/50">
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">
                        Template not required for matching-only mode
                      </p>
                    </CardContent>
                  </Card>
                ) : templates.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((template) => (
                      <Card
                        key={template.id}
                        className={cn(
                          "cursor-pointer transition-all",
                          selectedTemplate?.id === template.id
                            ? "ring-2 ring-primary"
                            : "hover:border-primary/50"
                        )}
                        onClick={() => setSelectedTemplate(template)}
                        data-testid={`template-option-${template.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                selectedTemplate?.id === template.id
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground"
                              )}
                            >
                              {selectedTemplate?.id === template.id && (
                                <Check className="h-3 w-3 text-primary-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{template.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {template.fields?.length || 0} fields
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-muted/50">
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">
                        No templates available. Create one first.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Filters */}
          {currentStep === 4 && (
            <Card data-testid="step-filters">
              <CardHeader>
                <CardTitle>Runtime Inputs</CardTitle>
                <CardDescription>
                  Set date range and email filters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateFrom && "text-muted-foreground"
                          )}
                          data-testid="date-from-btn"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>To Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateTo && "text-muted-foreground"
                          )}
                          data-testid="date-to-btn"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Email Filters */}
                <div className="space-y-4">
                  <Label>Email Filters (Optional)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder="Sender email"
                      value={emailFilters.sender_email}
                      onChange={(e) =>
                        setEmailFilters((prev) => ({
                          ...prev,
                          sender_email: e.target.value,
                        }))
                      }
                      data-testid="filter-sender-email"
                    />
                    <Input
                      placeholder="Sender domain"
                      value={emailFilters.sender_domain}
                      onChange={(e) =>
                        setEmailFilters((prev) => ({
                          ...prev,
                          sender_domain: e.target.value,
                        }))
                      }
                      data-testid="filter-sender-domain"
                    />
                  </div>
                  <Input
                    placeholder="Subject keywords"
                    value={emailFilters.subject_keywords}
                    onChange={(e) =>
                      setEmailFilters((prev) => ({
                        ...prev,
                        subject_keywords: e.target.value,
                      }))
                    }
                    data-testid="filter-subject"
                  />
                </div>

                {/* Start Button */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleStartWorkflow}
                  disabled={workflowRunning}
                  data-testid="start-workflow-btn"
                >
                  {workflowRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Workflow
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              data-testid="prev-step-btn"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1))}
              disabled={currentStep === 4 || !canProceed()}
              data-testid="next-step-btn"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Results Table */}
          {documents.length > 0 && (
            <Card data-testid="results-table">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Extracted Documents</CardTitle>
                  <CardDescription>{documents.length} documents processed</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} data-testid="export-btn">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Extracted Fields</TableHead>
                        <TableHead>Matching</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            {truncateText(doc.attachment_name, 30)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Object.keys(doc.extracted_fields || {})
                                .slice(0, 3)
                                .map((key) => (
                                  <Badge key={key} variant="secondary" className="text-xs">
                                    {key}
                                  </Badge>
                                ))}
                              {Object.keys(doc.extracted_fields || {}).length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{Object.keys(doc.extracted_fields).length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(doc.matching_status)}>
                              {doc.matching_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(doc.document_status)}>
                              {doc.document_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedDocument(doc);
                                setReviewDialogOpen(true);
                              }}
                              data-testid={`review-doc-${doc.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel - Logs & Actions */}
        <div className="space-y-6">
          {/* Upload Documents */}
          <Card data-testid="upload-panel">
            <CardHeader>
              <CardTitle className="text-lg">Upload Documents</CardTitle>
              <CardDescription>Process documents manually</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="doc-upload"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById("doc-upload")?.click()}
                data-testid="upload-doc-btn"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </CardContent>
          </Card>

          {/* Live Logs */}
          <Card data-testid="logs-panel">
            <CardHeader>
              <CardTitle className="text-lg">Live Logs</CardTitle>
              <CardDescription>Workflow execution logs</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                {logs.length > 0 ? (
                  <div className="space-y-2 font-mono text-sm">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex gap-2",
                          log.type === "error" && "text-destructive",
                          log.type === "warning" && "text-amber-600 dark:text-amber-400",
                          log.type === "success" && "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        <span className="text-muted-foreground text-xs">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">No logs yet. Start a workflow to see logs.</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
            <DialogDescription>
              {selectedDocument?.attachment_name}
            </DialogDescription>
          </DialogHeader>

          {selectedDocument && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              {/* Document Preview Placeholder */}
              <Card className="bg-muted/50">
                <CardContent className="p-8 flex items-center justify-center min-h-[400px]">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Document Preview</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedDocument.attachment_name}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Extracted Fields */}
              <div className="space-y-4">
                <h3 className="font-semibold">Extracted Fields</h3>
                <div className="space-y-3">
                  {Object.entries(selectedDocument.extracted_fields || {}).map(
                    ([key, value]) => {
                      const confidence = selectedDocument.confidence_scores?.[key] || 0;
                      const { level, color } = getConfidenceLevel(confidence);

                      return (
                        <div
                          key={key}
                          className="p-3 rounded-lg border bg-card space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                              {key}
                            </Label>
                            <span className={cn("text-xs font-medium", color)}>
                              {(confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <Input
                            value={String(value || "")}
                            className="font-mono"
                            readOnly
                          />
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => handleReviewDocument("flagged")}
              data-testid="flag-doc-btn"
            >
              <Flag className="h-4 w-4 mr-2" />
              Flag
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReviewDocument("rejected")}
              data-testid="reject-doc-btn"
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={() => handleReviewDocument("approved")}
              data-testid="approve-doc-btn"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkflowSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[400px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
