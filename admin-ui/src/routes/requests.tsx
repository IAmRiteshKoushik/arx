import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardContent } from '@/components/ui'

export const Route = createFileRoute('/requests')({
  component: RequestsComponent,
})

function RequestsComponent() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Routing Requests</h1>
      <Card>
        <CardHeader>Recent Requests</CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <div className="text-6xl mb-4">📊</div>
            <div className="text-xl font-medium mb-2">Request tracking coming soon</div>
            <div>Monitor and analyze routing requests in real-time</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}