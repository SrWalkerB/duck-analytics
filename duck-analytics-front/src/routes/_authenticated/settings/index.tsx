import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/services/api'
import type { AIConfig } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: SettingsPage,
})

function SettingsPage() {
  const qc = useQueryClient()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gemini-1.5-flash')

  const { data: config } = useQuery<AIConfig | null>({
    queryKey: ['ai-config'],
    queryFn: () => api.get('/v1/ai/config').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: () => api.post('/v1/ai/config', { apiKey, model, provider: 'google' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-config'] })
      toast.success('AI config saved')
      setApiKey('')
    },
    onError: () => toast.error('Failed to save'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete('/v1/ai/config'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-config'] })
      toast.success('AI config removed')
    },
  })

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>AI Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p>Provider: {config.provider}</p>
              <p>Model: {config.model}</p>
              <p className="text-muted-foreground">API key is encrypted and stored securely.</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Google AI API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config ? 'Enter new key to replace...' : 'Enter API key...'}
            />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={!apiKey || saveMutation.isPending}>
              Save
            </Button>
            {config && (
              <Button variant="destructive" onClick={() => deleteMutation.mutate()}>
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
