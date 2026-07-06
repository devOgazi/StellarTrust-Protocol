import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

export default function GovernancePage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-6">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>Governance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="text-6xl">🏛️</div>
          <p className="text-muted-foreground">
            Protocol governance is coming soon. The governance contract is currently stubbed
            on the backend and will be activated in Phase 2.
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Planned features:</p>
            <ul className="list-disc list-inside">
              <li>Create &amp; vote on protocol proposals</li>
              <li>Token-weighted governance</li>
              <li>Parameter changes through community voting</li>
              <li>Timelocked execution with multisig security</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
