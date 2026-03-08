import { useState, useEffect } from "react";
import { configurationsApi } from "../hooks/useApi";
import { cn, formatDateTime } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Plus,
  Settings,
  Trash2,
  Edit,
  Bot,
  Mail,
  Database,
  Cloud,
  Link,
  FileText,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";

const defaultConfig = {
  name: "",
  description: "",
  ai_provider: {
    provider_name: "openai",
    api_endpoint: "",
    api_key: "",
    model_name: "gpt-5o-mini",
  },
  email_provider: {
    provider_type: "gmail",
    host: "imap.gmail.com",
    port: 993,
    username: "",
    password: "",
    use_ssl: true,
    oauth_connected: false,
    connected_email: "",
  },
  storage_config: {
    provider_name: "emergent",
    bucket_name: "",
    folder_structure: "/{run-id}/{email-date}/{filename}",
  },
  database_config: {
    db_type: "mongodb",
    host: "",
    port: 27017,
    database_name: "",
    username: "",
    password: "",
  },
  matching_source: {
    source_type: "api",
    connection_settings: {},
    field_mappings: {},
  },
  matching_logic: {
    matching_keys: [],
    rules: [],
  },
};

const MATCH_TYPES = [
  { value: "exact", label: "Exact Match" },
  { value: "case_insensitive", label: "Case Insensitive" },
  { value: "contains", label: "Contains" },
  { value: "fuzzy", label: "Fuzzy Match (≥80%)" },
  { value: "numeric_tolerance", label: "Numeric Tolerance" },
  { value: "date_tolerance", label: "Date Tolerance" },
];

export function Configurations() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [formData, setFormData] = useState(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await configurationsApi.list();
      setConfigs(response.data);
    } catch (error) {
      toast.error("Failed to load configurations");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setSelectedConfig(null);
    setFormData(defaultConfig);
    setDialogOpen(true);
  };

  const openEditDialog = (config) => {
    setSelectedConfig(config);
    setFormData({
      ...defaultConfig,
      ...config,
      ai_provider: { ...defaultConfig.ai_provider, ...config.ai_provider },
      email_provider: { ...defaultConfig.email_provider, ...config.email_provider },
      storage_config: { ...defaultConfig.storage_config, ...config.storage_config },
      database_config: { ...defaultConfig.database_config, ...config.database_config },
      matching_source: { ...defaultConfig.matching_source, ...config.matching_source },
      matching_logic: { ...defaultConfig.matching_logic, ...config.matching_logic },
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Configuration name is required");
      return;
    }

    try {
      setSaving(true);
      if (selectedConfig) {
        await configurationsApi.update(selectedConfig.id, formData);
        toast.success("Configuration updated");
      } else {
        await configurationsApi.create(formData);
        toast.success("Configuration created");
      }
      setDialogOpen(false);
      fetchConfigs();
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedConfig) return;
    try {
      await configurationsApi.delete(selectedConfig.id);
      toast.success("Configuration deleted");
      setDeleteDialogOpen(false);
      setSelectedConfig(null);
      fetchConfigs();
    } catch (error) {
      toast.error("Failed to delete configuration");
    }
  };

  const updateFormField = (section, field, value) => {
    if (section) {
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const addMatchingRule = () => {
    setFormData((prev) => ({
      ...prev,
      matching_logic: {
        ...prev.matching_logic,
        rules: [
          ...prev.matching_logic.rules,
          { field_name: "", match_type: "exact", tolerance_value: null, priority: prev.matching_logic.rules.length + 1 },
        ],
      },
    }));
  };

  const updateMatchingRule = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      matching_logic: {
        ...prev.matching_logic,
        rules: prev.matching_logic.rules.map((rule, i) =>
          i === index ? { ...rule, [field]: value } : rule
        ),
      },
    }));
  };

  const removeMatchingRule = (index) => {
    setFormData((prev) => ({
      ...prev,
      matching_logic: {
        ...prev.matching_logic,
        rules: prev.matching_logic.rules.filter((_, i) => i !== index),
      },
    }));
  };

  const addFieldMapping = () => {
    const key = `extracted_field_${Object.keys(formData.matching_source.field_mappings).length + 1}`;
    setFormData((prev) => ({
      ...prev,
      matching_source: {
        ...prev.matching_source,
        field_mappings: {
          ...prev.matching_source.field_mappings,
          [key]: "",
        },
      },
    }));
  };

  const updateFieldMapping = (oldKey, newKey, newValue) => {
    setFormData((prev) => {
      const newMappings = { ...prev.matching_source.field_mappings };
      if (oldKey !== newKey) {
        delete newMappings[oldKey];
      }
      newMappings[newKey] = newValue;
      return {
        ...prev,
        matching_source: {
          ...prev.matching_source,
          field_mappings: newMappings,
        },
      };
    });
  };

  const removeFieldMapping = (key) => {
    setFormData((prev) => {
      const newMappings = { ...prev.matching_source.field_mappings };
      delete newMappings[key];
      return {
        ...prev,
        matching_source: {
          ...prev.matching_source,
          field_mappings: newMappings,
        },
      };
    });
  };

  if (loading) {
    return <ConfigurationsSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in" data-testid="configurations-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Configurations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your extraction and matching profiles
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="create-config-btn">
          <Plus className="h-4 w-4 mr-2" />
          New Configuration
        </Button>
      </div>

      {/* Configurations Grid */}
      {configs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {configs.map((config) => (
            <Card
              key={config.id}
              className="card-hover cursor-pointer"
              data-testid={`config-card-${config.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Settings className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {formatDateTime(config.created_at)}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {config.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {config.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline" className="text-xs">
                    <Bot className="h-3 w-3 mr-1" />
                    {config.ai_provider?.provider_name || "AI"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Mail className="h-3 w-3 mr-1" />
                    {config.email_provider?.provider_type || "Email"}
                  </Badge>
                  {config.email_provider?.username && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Credentials Set
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(config)}
                    data-testid={`edit-config-${config.id}`}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setSelectedConfig(config);
                      setDeleteDialogOpen(true);
                    }}
                    data-testid={`delete-config-${config.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="empty-state py-16">
            <Settings className="empty-state-icon h-16 w-16" />
            <h3 className="font-semibold text-xl mt-4">No configurations yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              Create your first configuration profile to define AI providers, email settings,
              and matching rules.
            </p>
            <Button onClick={openCreateDialog} className="mt-6">
              <Plus className="h-4 w-4 mr-2" />
              Create Configuration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedConfig ? "Edit Configuration" : "New Configuration"}
            </DialogTitle>
            <DialogDescription>
              Configure your document extraction and matching settings
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="ai">AI</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="storage">Storage</TabsTrigger>
              <TabsTrigger value="matching-source">Source</TabsTrigger>
              <TabsTrigger value="matching-rules">Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Configuration Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Invoice Processing"
                  value={formData.name}
                  onChange={(e) => updateFormField(null, "name", e.target.value)}
                  data-testid="config-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe this configuration..."
                  value={formData.description || ""}
                  onChange={(e) => updateFormField(null, "description", e.target.value)}
                  data-testid="config-description-input"
                />
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>AI Provider</Label>
                  <Select
                    value={formData.ai_provider.provider_name}
                    onValueChange={(v) => updateFormField("ai_provider", "provider_name", v)}
                  >
                    <SelectTrigger data-testid="ai-provider-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="azure">Azure OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Model Name</Label>
                  <Input
                    placeholder="gpt-5o-mini"
                    value={formData.ai_provider.model_name}
                    onChange={(e) => updateFormField("ai_provider", "model_name", e.target.value)}
                    data-testid="ai-model-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>API Key (Optional - uses default if empty)</Label>
                <Input
                  type="password"
                  placeholder="Leave empty to use default key"
                  value={formData.ai_provider.api_key || ""}
                  onChange={(e) => updateFormField("ai_provider", "api_key", e.target.value)}
                  data-testid="ai-key-input"
                />
              </div>
            </TabsContent>

            <TabsContent value="email" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Email Provider</Label>
                <Select
                  value={formData.email_provider.provider_type}
                  onValueChange={(v) => {
                    updateFormField("email_provider", "provider_type", v);
                    if (v === "gmail") {
                      updateFormField("email_provider", "host", "imap.gmail.com");
                      updateFormField("email_provider", "port", 993);
                    }
                  }}
                >
                  <SelectTrigger data-testid="email-provider-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail (IMAP with App Password)</SelectItem>
                    <SelectItem value="outlook">Outlook (IMAP)</SelectItem>
                    <SelectItem value="imap">Custom IMAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Gmail Instructions */}
              {formData.email_provider.provider_type === "gmail" && (
                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-800 dark:text-blue-200">Gmail App Password Required</p>
                        <ol className="mt-2 space-y-1 text-blue-700 dark:text-blue-300 list-decimal list-inside">
                          <li>Go to your <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline">Google Account Security</a></li>
                          <li>Enable 2-Step Verification if not already enabled</li>
                          <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">App Passwords</a></li>
                          <li>Create a new app password for "Mail"</li>
                          <li>Copy the 16-character password below</li>
                        </ol>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Email Credentials */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email Address (Username)</Label>
                  <Input
                    type="email"
                    placeholder="your-email@gmail.com"
                    value={formData.email_provider.username || ""}
                    onChange={(e) => updateFormField("email_provider", "username", e.target.value)}
                    data-testid="email-username-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>App Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="xxxx xxxx xxxx xxxx"
                      value={formData.email_provider.password || ""}
                      onChange={(e) => updateFormField("email_provider", "password", e.target.value)}
                      data-testid="email-password-input"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* IMAP Settings (for custom IMAP) */}
              {formData.email_provider.provider_type === "imap" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>IMAP Host</Label>
                    <Input
                      placeholder="imap.example.com"
                      value={formData.email_provider.host || ""}
                      onChange={(e) => updateFormField("email_provider", "host", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      type="number"
                      placeholder="993"
                      value={formData.email_provider.port || ""}
                      onChange={(e) => updateFormField("email_provider", "port", parseInt(e.target.value))}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.email_provider.use_ssl}
                  onCheckedChange={(v) => updateFormField("email_provider", "use_ssl", v)}
                />
                <Label>Use SSL/TLS</Label>
              </div>

              {/* Connection Status */}
              {formData.email_provider.username && formData.email_provider.password && (
                <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        Credentials configured for {formData.email_provider.username}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="storage" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Storage Provider</Label>
                <Select
                  value={formData.storage_config.provider_name}
                  onValueChange={(v) => updateFormField("storage_config", "provider_name", v)}
                >
                  <SelectTrigger data-testid="storage-provider-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergent">Emergent Cloud Storage</SelectItem>
                    <SelectItem value="s3">AWS S3</SelectItem>
                    <SelectItem value="gcs">Google Cloud Storage</SelectItem>
                    <SelectItem value="local">Local Storage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Folder Structure</Label>
                <Input
                  placeholder="/{run-id}/{email-date}/{filename}"
                  value={formData.storage_config.folder_structure}
                  onChange={(e) => updateFormField("storage_config", "folder_structure", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{run-id}"}, {"{email-date}"}, {"{filename}"}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="matching-source" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Matching Source Type</Label>
                <Select
                  value={formData.matching_source.source_type}
                  onValueChange={(v) => updateFormField("matching_source", "source_type", v)}
                >
                  <SelectTrigger data-testid="matching-source-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">REST API</SelectItem>
                    <SelectItem value="excel">Excel File</SelectItem>
                    <SelectItem value="csv">CSV File</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Field Mappings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Field Mappings</Label>
                  <Button variant="outline" size="sm" onClick={addFieldMapping}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Mapping
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Map extracted fields to source fields (e.g., extracted.invoice_number → source.invoiceNum)
                </p>

                {Object.entries(formData.matching_source.field_mappings).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(formData.matching_source.field_mappings).map(([key, value], index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Extracted Field"
                          value={key}
                          onChange={(e) => updateFieldMapping(key, e.target.value, value)}
                          className="flex-1"
                        />
                        <span className="text-muted-foreground">→</span>
                        <Input
                          placeholder="Source Field"
                          value={value}
                          onChange={(e) => updateFieldMapping(key, key, e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeFieldMapping(key)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 text-center text-sm text-muted-foreground">
                      No field mappings defined. Add mappings to connect extracted fields with source data.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="matching-rules" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Matching Rules</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Define how extracted fields should be matched against source data
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addMatchingRule} data-testid="add-rule-btn">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rule
                </Button>
              </div>

              {formData.matching_logic.rules.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Priority</TableHead>
                        <TableHead>Field Name</TableHead>
                        <TableHead>Match Type</TableHead>
                        <TableHead>Tolerance</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.matching_logic.rules.map((rule, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={rule.priority}
                              onChange={(e) => updateMatchingRule(index, "priority", parseInt(e.target.value))}
                              className="w-16 h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="e.g., invoice_number"
                              value={rule.field_name}
                              onChange={(e) => updateMatchingRule(index, "field_name", e.target.value)}
                              className="h-8"
                              data-testid={`rule-field-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={rule.match_type}
                              onValueChange={(v) => updateMatchingRule(index, "match_type", v)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MATCH_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {(rule.match_type === "numeric_tolerance" || rule.match_type === "date_tolerance") && (
                              <Input
                                type="number"
                                placeholder="±"
                                value={rule.tolerance_value || ""}
                                onChange={(e) => updateMatchingRule(index, "tolerance_value", parseFloat(e.target.value))}
                                className="w-20 h-8"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeMatchingRule(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Card className="bg-muted/50">
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">
                      No matching rules defined. Add rules to configure how fields are compared.
                    </p>
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p className="font-medium mb-2">Example rules:</p>
                      <ul className="space-y-1 text-left max-w-md mx-auto">
                        <li>• invoice_number → Exact Match (Priority 1)</li>
                        <li>• vendor_name → Fuzzy Match ≥80% (Priority 2)</li>
                        <li>• total_amount → Numeric Tolerance ±5 (Priority 3)</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-config-btn">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedConfig ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedConfig?.name}". This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConfigurationsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-4" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
