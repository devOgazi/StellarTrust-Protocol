'use client';

import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';

// Shape returned by GET /score/:address/history
interface ScoreHistoryItem {
  score: number;
  rating: string;
  dataPoints: number;
  snapshotAt: string; // ISO-8601
}

interface ScoreHistoryProps {
  history: ScoreHistoryItem[];
  loading?: boolean;
}

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return ts;
  }
}

function scoreBadgeVariant(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 700) return 'success';
  if (score >= 580) return 'warning';
  return 'danger';
}

export function ScoreHistory({ history, loading }: ScoreHistoryProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Score History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!history.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Score History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No history available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {history.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <span className="text-sm text-muted-foreground">
                {formatDate(item.snapshotAt)}
              </span>
              <Badge variant={scoreBadgeVariant(item.score)}>
                {item.score} — {item.rating}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
