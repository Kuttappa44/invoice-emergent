import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { dashboardApi } from "../hooks/useApi";
import { cn, formatNumber, formatPercentage, formatDateTime, getStatusColor } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Play,
  Plus,
  Upload,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

const CHART_COLORS = {
  primary: "hsl(217, 91%, 60%)",
  success: "hsl(160, 84%, 39%)",
  warning: "hsl(38, 92%, 50%)",
  destructive: "hsl(350, 89%, 60%)",
};

export function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, runsRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getRecentRuns(10),
      ]);
      setStats(statsRes.data);
      setRecentRuns(runsRes.data);
    } catch (error) {
      toast.error("Failed to load dashboard data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      title: "Total Workflow Runs",
      value: stats?.total_runs || 0,
      icon: TrendingUp,
      variant: "default",
    },
    {
      title: "Documents Processed",
      value: stats?.documents_processed || 0,
      icon: FileText,
      variant: "accent",
    },
    {
      title: "Successful Extractions",
      value: stats?.successful_extractions || 0,
      icon: CheckCircle2,
      variant: "success",
    },
    {
      title: "Matched Records",
      value: stats?.matched_records || 0,
      icon: Clock,
      variant: "warning",
    },
    {
      title: "Flagged Records",
      value: stats?.flagged_records || 0,
      icon: AlertCircle,
      variant: "destructive",
    },
    {
      title: "Errors",
      value: stats?.errors || 0,
      icon: AlertCircle,
      variant: "destructive",
    },
  ];

  const pieData = [
    { name: "Successful", value: stats?.successful_extractions || 0, color: CHART_COLORS.success },
    { name: "Errors", value: stats?.errors || 0, color: CHART_COLORS.destructive },
  ];

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your document extraction workflows
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/configurations">
            <Button variant="outline" data-testid="quick-action-config">
              <Plus className="h-4 w-4 mr-2" />
              New Config
            </Button>
          </Link>
          <Link to="/workflow">
            <Button data-testid="quick-action-workflow">
              <Play className="h-4 w-4 mr-2" />
              Start Workflow
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statsCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card
              key={index}
              className={cn("stats-card", card.variant)}
              data-testid={`stat-card-${index}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {card.title}
                    </p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(card.value)}</p>
                  </div>
                  <Icon className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Documents Per Day Chart */}
        <Card className="lg:col-span-2" data-testid="docs-per-day-chart">
          <CardHeader>
            <CardTitle className="text-lg">Documents Processed</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {stats?.documents_per_day?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.documents_per_day}>
                    <defs>
                      <linearGradient id="colorDocs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={CHART_COLORS.primary}
                      fillOpacity={1}
                      fill="url(#colorDocs)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Success Rate Pie Chart */}
        <Card data-testid="success-rate-chart">
          <CardHeader>
            <CardTitle className="text-lg">Success Rate</CardTitle>
            <CardDescription>
              Extraction: {formatPercentage(stats?.extraction_success_rate || 0)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {pieData.some((d) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs Table */}
      <Card data-testid="recent-runs-table">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent Workflow Runs</CardTitle>
            <CardDescription>Latest processing activities</CardDescription>
          </div>
          <Link to="/workflow">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentRuns.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase">Run ID</TableHead>
                    <TableHead className="text-xs uppercase">Mode</TableHead>
                    <TableHead className="text-xs uppercase">Documents</TableHead>
                    <TableHead className="text-xs uppercase">Status</TableHead>
                    <TableHead className="text-xs uppercase">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRuns.map((run) => (
                    <TableRow key={run.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {run.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {run.run_mode?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{run.documents_processed}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(run.status)}>
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(run.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="empty-state py-12">
              <FileText className="empty-state-icon h-12 w-12" />
              <h3 className="font-semibold text-lg">No workflow runs yet</h3>
              <p className="text-muted-foreground mt-1">
                Start your first workflow to see activity here
              </p>
              <Link to="/workflow" className="mt-4">
                <Button>
                  <Play className="h-4 w-4 mr-2" />
                  Start Workflow
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
