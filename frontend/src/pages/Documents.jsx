import { useState, useEffect } from "react";
import { documentsApi, templatesApi } from "../hooks/useApi";
import { cn, formatDateTime, getStatusColor, getConfidenceLevel, truncateText } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { ScrollArea } from "../components/ui/scroll-area";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import {
  FileText,
  Eye,
  Download,
  Trash2,
  Check,
  X,
  Flag,
  Filter,
  RefreshCw,
  Search,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await documentsApi.list({});
      setDocuments(response.data);
    } catch (error) {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (docId, action) => {
    try {
      await documentsApi.review(docId, action);
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, document_status: action } : d))
      );
      toast.success(`Document ${action}`);
    } catch (error) {
      toast.error("Failed to update document");
    }
  };

  const handleExport = async () => {
    try {
      const response = await documentsApi.export(null, "csv");
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

  const filteredDocuments = documents.filter((doc) => {
    const matchesStatus = statusFilter === "all" || doc.document_status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      doc.attachment_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.email_subject?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return <DocumentsSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in" data-testid="documents-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">
            View and manage extracted document data
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchDocuments} data-testid="refresh-docs-btn">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} data-testid="export-docs-btn">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by filename or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      {filteredDocuments.length > 0 ? (
        <Card data-testid="documents-table">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase">Document</TableHead>
                    <TableHead className="text-xs uppercase">Email Subject</TableHead>
                    <TableHead className="text-xs uppercase">Extracted Fields</TableHead>
                    <TableHead className="text-xs uppercase">Matching</TableHead>
                    <TableHead className="text-xs uppercase">Status</TableHead>
                    <TableHead className="text-xs uppercase">Date</TableHead>
                    <TableHead className="text-xs uppercase w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedDocument(doc);
                        setDetailsOpen(true);
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {truncateText(doc.attachment_name, 25)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {truncateText(doc.email_subject || "-", 30)}
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
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(doc.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setDetailsOpen(true);
                            }}
                            data-testid={`view-doc-${doc.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="empty-state py-16">
            <FileText className="empty-state-icon h-16 w-16" />
            <h3 className="font-semibold text-xl mt-4">No documents found</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Upload documents in the Workflow page to see extracted data here"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Document Details Sheet */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Document Details</SheetTitle>
            <SheetDescription>{selectedDocument?.attachment_name}</SheetDescription>
          </SheetHeader>

          {selectedDocument && (
            <div className="mt-6 space-y-6">
              {/* Document Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Document Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Filename</span>
                    <span className="font-medium">{selectedDocument.attachment_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email Subject</span>
                    <span className="font-medium">{selectedDocument.email_subject || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email Sender</span>
                    <span className="font-medium">{selectedDocument.email_sender || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processed</span>
                    <span className="font-medium">{formatDateTime(selectedDocument.created_at)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={getStatusColor(selectedDocument.document_status)}>
                      {selectedDocument.document_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Matching</span>
                    <Badge className={getStatusColor(selectedDocument.matching_status)}>
                      {selectedDocument.matching_status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Extracted Fields */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Extracted Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(selectedDocument.extracted_fields || {}).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(selectedDocument.extracted_fields).map(([key, value]) => {
                        const confidence = selectedDocument.confidence_scores?.[key] || 0;
                        const { level, color } = getConfidenceLevel(confidence);

                        return (
                          <div key={key} className="p-3 rounded-lg border bg-muted/30">
                            <div className="flex items-center justify-between mb-1">
                              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                {key}
                              </Label>
                              <span className={cn("text-xs font-medium", color)}>
                                {(confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="font-mono text-sm break-all">
                              {typeof value === "object" ? JSON.stringify(value) : String(value || "-")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No fields extracted</p>
                  )}
                </CardContent>
              </Card>

              {/* Matching Results */}
              {selectedDocument.matching_results && Object.keys(selectedDocument.matching_results).length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Matching Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedDocument.matching_results, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleReview(selectedDocument.id, "flagged")}
                  data-testid="flag-btn"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Flag
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleReview(selectedDocument.id, "rejected")}
                  data-testid="reject-btn"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleReview(selectedDocument.id, "approved")}
                  data-testid="approve-btn"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DocumentsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
