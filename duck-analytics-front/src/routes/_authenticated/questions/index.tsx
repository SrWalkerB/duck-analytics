import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Component } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table2,
  BarChart2,
  LineChart,
  PieChart,
  Hash,
  Plus,
  Clock,
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/questions/')({
  component: QuestionsPage,
})

const VIZ_ICON: Record<string, React.ReactNode> = {
  TABLE: <Table2 size={16} />,
  BAR_CHART: <BarChart2 size={16} />,
  LINE_CHART: <LineChart size={16} />,
  PIE_CHART: <PieChart size={16} />,
  KPI: <Hash size={16} />,
}

const VIZ_LABEL: Record<string, string> = {
  TABLE: 'Table',
  BAR_CHART: 'Bar Chart',
  LINE_CHART: 'Line Chart',
  PIE_CHART: 'Pie Chart',
  KPI: 'KPI',
}

function QuestionsPage() {
  const { data: questions, isLoading } = useQuery<Component[]>({
    queryKey: ['questions'],
    queryFn: () => api.get('/v1/components').then((r) => r.data),
  })

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Questions</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Build queries and visualizations in one place
          </p>
        </div>
        <Button asChild>
          <Link to="/questions/new">
            <Plus size={16} className="mr-1.5" />
            New Question
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24 p-4" />
            </Card>
          ))}
        </div>
      ) : !questions?.length ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <BarChart2 size={40} className="opacity-20" />
          <p className="text-sm">No questions yet</p>
          <Button variant="outline" asChild size="sm">
            <Link to="/questions/new">Create your first question</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {questions.map((q) => (
            <Link key={q.id} to="/questions/$id" params={{ id: q.id }}>
              <Card className="cursor-pointer transition-colors hover:border-foreground/30 hover:bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium">{q.name}</p>
                    <Badge
                      variant="secondary"
                      className="flex shrink-0 items-center gap-1 text-xs"
                    >
                      {VIZ_ICON[q.type]}
                      {VIZ_LABEL[q.type] ?? q.type}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={11} />
                    {new Date(q.updatedAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
