import { useState, useEffect, useCallback } from "react";
import { templatesApi } from "../hooks/useApi";
import { cn, formatDateTime } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
  FileText,
  Trash2,
  Edit,
  Upload,
  Loader2,
  CheckCircle2,
  X,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

export function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({ name: "", fields: [] });
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await templatesApi.list();
      setTemplates(response.data);
    } catch (error) {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setSelectedTemplate(null);
    setFormData({ name: "", fields: [] });
    setUploadedFile(null);
    setDialogOpen(true);
  };

  const openEditDialog = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      fields: template.fields || [],
    });
    setUploadedFile(null);
    setDialogOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setAnalyzing(true);

    try {
      const response = await templatesApi.analyze(file);
      const detectedFields = response.data.detected_fields || [];
      
      setFormData((prev) => ({
        ...prev,
        fields: detectedFields.map((f) => ({
          ...f,
          active: true,
          required: false,
        })),
      }));
      
      toast.success(`Detected ${detectedFields.length} fields`);
    } catch (error) {
      toast.error("Failed to analyze document");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Template name is required");
      return;
    }

    try {
      setSaving(true);
      if (selectedTemplate) {
        await templatesApi.update(selectedTemplate.id, formData);
        toast.success("Template updated");
      } else {
        await templatesApi.create(formData);
        toast.success("Template created");
      }
      setDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    try {
      await templatesApi.delete(selectedTemplate.id);
      toast.success("Template deleted");
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const updateField = (index, key, value) => {
    setFormData((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? { ...f, [key]: value } : f)),
    }));
  };

  const addField = () => {
    setFormData((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        { name: "", field_type: "text", required: false, active: true, description: "" },
      ],
    }));
  };

  const removeField = (index) => {
    setFormData((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return <TemplatesSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in" data-testid="templates-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Define extraction fields using sample documents
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="create-template-btn">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Templates Grid */}
      {templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="card-hover cursor-pointer"
              data-testid={`template-card-${template.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {formatDateTime(template.created_at)}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-4">
                  {template.fields?.slice(0, 5).map((field, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {field.name}
                    </Badge>
                  ))}
                  {template.fields?.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{template.fields.length - 5} more
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(template)}
                    data-testid={`edit-template-${template.id}`}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setDeleteDialogOpen(true);
                    }}
                    data-testid={`delete-template-${template.id}`}
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
            <FileText className="empty-state-icon h-16 w-16" />
            <h3 className="font-semibold text-xl mt-4">No templates yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              Create a template by uploading a sample document. AI will detect extractable
              fields automatically.
            </p>
            <Button onClick={openCreateDialog} className="mt-6">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription>
              Define the fields to extract from your documents
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Template Name */}
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                placeholder="e.g., Invoice Template"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                data-testid="template-name-input"
              />
            </div>

            {/* File Upload */}
            <Card className="border-dashed">
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    {analyzing ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="font-medium">
                      {uploadedFile
                        ? uploadedFile.name
                        : "Upload a sample document"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {analyzing
                        ? "Analyzing document..."
                        : "AI will detect extractable fields"}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="sample-upload"
                    disabled={analyzing}
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById("sample-upload")?.click()}
                    disabled={analyzing}
                    data-testid="upload-sample-btn"
                  >
                    {uploadedFile ? "Change File" : "Select File"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Fields Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Extraction Fields</Label>
                <Button variant="outline" size="sm" onClick={addField} data-testid="add-field-btn">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Field
                </Button>
              </div>

              {formData.fields.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Field Name</TableHead>
                        <TableHead className="w-[120px]">Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[80px]">Required</TableHead>
                        <TableHead className="w-[80px]">Active</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.fields.map((field, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={field.name}
                              onChange={(e) => updateField(index, "name", e.target.value)}
                              placeholder="Field name"
                              className="h-8"
                              data-testid={`field-name-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={field.field_type}
                              onValueChange={(v) => updateField(index, "field_type", v)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="currency">Currency</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={field.description || ""}
                              onChange={(e) => updateField(index, "description", e.target.value)}
                              placeholder="Description"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={field.required}
                              onCheckedChange={(v) => updateField(index, "required", v)}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={field.active}
                              onCheckedChange={(v) => updateField(index, "active", v)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeField(index)}
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
                      No fields defined. Upload a sample document to auto-detect fields, or
                      add them manually.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-template-btn">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedTemplate?.name}". This action cannot be
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

function TemplatesSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
