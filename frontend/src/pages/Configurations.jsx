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
  DialogTrigger,
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
    host: "",
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

export function Configurations() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [formData, setFormData] = useState(defaultConfig);
  const [saving, setSaving] = useState(false);

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
                  <Badge variant="outline" className="text-xs">
                    <Database className="h-3 w-3 mr-1" />
                    {config.database_config?.db_type || "DB"}
                  </Badge>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedConfig ? "Edit Configuration" : "New Configuration"}
            </DialogTitle>
            <DialogDescription>
              Configure your document extraction and matching settings
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="ai">AI</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="storage">Storage</TabsTrigger>
              <TabsTrigger value="matching">Matching</TabsTrigger>
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
              <div className="space-y-2">
                <Label>Custom API Endpoint (Optional)</Label>
                <Input
                  placeholder="https://api.openai.com/v1"
                  value={formData.ai_provider.api_endpoint || ""}
                  onChange={(e) => updateFormField("ai_provider", "api_endpoint", e.target.value)}
                  data-testid="ai-endpoint-input"
                />
              </div>
            </TabsContent>

            <TabsContent value="email" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Email Provider</Label>
                <Select
                  value={formData.email_provider.provider_type}
                  onValueChange={(v) => updateFormField("email_provider", "provider_type", v)}
                >
                  <SelectTrigger data-testid="email-provider-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail (OAuth)</SelectItem>
                    <SelectItem value="imap">Custom IMAP</SelectItem>
                    <SelectItem value="outlook">Outlook (OAuth)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.email_provider.provider_type === "gmail" && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Gmail OAuth</p>
                        <p className="text-sm text-muted-foreground">
                          {formData.email_provider.oauth_connected
                            ? `Connected: ${formData.email_provider.connected_email}`
                            : "Not connected - Connect during workflow"}
                        </p>
                      </div>
                      <Badge variant={formData.email_provider.oauth_connected ? "default" : "secondary"}>
                        {formData.email_provider.oauth_connected ? "Connected" : "Pending"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

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
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      placeholder="email@example.com"
                      value={formData.email_provider.username || ""}
                      onChange={(e) => updateFormField("email_provider", "username", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={formData.email_provider.password || ""}
                      onChange={(e) => updateFormField("email_provider", "password", e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Switch
                      checked={formData.email_provider.use_ssl}
                      onCheckedChange={(v) => updateFormField("email_provider", "use_ssl", v)}
                    />
                    <Label>Use SSL</Label>
                  </div>
                </div>
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

            <TabsContent value="matching" className="space-y-4 mt-4">
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
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Matching rules can be configured after creating field templates.
                    Define matching keys and comparison methods for each extracted field.
                  </p>
                </CardContent>
              </Card>
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
