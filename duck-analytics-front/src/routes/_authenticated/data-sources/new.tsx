import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useI18n } from '@/i18n/provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { DataSource } from '@/types'

export const Route = createFileRoute('/_authenticated/data-sources/new')({
  component: NewDataSourcePage,
})

function NewDataSourcePage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [type, setType] = useState<DataSource['type']>('MONGODB')

  // MongoDB fields
  const [connectionString, setConnectionString] = useState('')
  const [mongoDatabase, setMongoDatabase] = useState('')

  // PostgreSQL fields
  const [pgHost, setPgHost] = useState('')
  const [pgPort, setPgPort] = useState('5432')
  const [pgUsername, setPgUsername] = useState('')
  const [pgPassword, setPgPassword] = useState('')
  const [pgDatabase, setPgDatabase] = useState('')

  const resolvedConnectionString = useMemo(() => {
    if (type === 'MONGODB') return connectionString
    const userPart = pgUsername
      ? pgPassword
        ? `${encodeURIComponent(pgUsername)}:${encodeURIComponent(pgPassword)}@`
        : `${encodeURIComponent(pgUsername)}@`
      : ''
    return `postgresql://${userPart}${pgHost}:${pgPort}/${pgDatabase}`
  }, [type, connectionString, pgHost, pgPort, pgUsername, pgPassword, pgDatabase])

  const resolvedDatabase = type === 'MONGODB' ? mongoDatabase : pgDatabase

  const isFormValid = useMemo(() => {
    if (!name) return false
    if (type === 'MONGODB') return !!connectionString && !!mongoDatabase
    return !!pgHost && !!pgPort && !!pgDatabase
  }, [name, type, connectionString, mongoDatabase, pgHost, pgPort, pgDatabase])

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/v1/data-sources', {
        name,
        connectionString: resolvedConnectionString,
        database: resolvedDatabase,
        type,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-sources'] })
      toast.success(t('Data source created'))
      navigate({ to: '/data-sources' })
    },
    onError: () => toast.error(t('Failed to create')),
  })

  const testMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/data-sources/test-connection', {
        connectionString: resolvedConnectionString,
        database: resolvedDatabase,
        type,
      }),
    onSuccess: () => toast.success(t('Connection successful!')),
    onError: () => toast.error(t('Connection failed. Check the connection details.')),
  })

  function handleTypeChange(v: string) {
    setType(v as DataSource['type'])
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{t('New Data Source')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>{t('Name')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t('Type')}</Label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONGODB">MongoDB</SelectItem>
                  <SelectItem value="POSTGRESQL">PostgreSQL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === 'MONGODB' ? (
              <>
                <div className="space-y-2">
                  <Label>{t('Connection String')}</Label>
                  <Input
                    value={connectionString}
                    onChange={(e) => setConnectionString(e.target.value)}
                    placeholder="mongodb://..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('Database')}</Label>
                  <Input
                    value={mongoDatabase}
                    onChange={(e) => setMongoDatabase(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t('Host')}</Label>
                  <Input
                    value={pgHost}
                    onChange={(e) => setPgHost(e.target.value)}
                    placeholder="localhost"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('Port')}</Label>
                  <Input
                    value={pgPort}
                    onChange={(e) => setPgPort(e.target.value)}
                    placeholder="5432"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('Database')}</Label>
                  <Input
                    value={pgDatabase}
                    onChange={(e) => setPgDatabase(e.target.value)}
                    placeholder="postgres"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('Username')}</Label>
                  <Input
                    value={pgUsername}
                    onChange={(e) => setPgUsername(e.target.value)}
                    placeholder="postgres"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('Password')}</Label>
                  <Input
                    type="password"
                    value={pgPassword}
                    onChange={(e) => setPgPassword(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={testMutation.isPending || !isFormValid}
                onClick={() => testMutation.mutate()}
              >
                {testMutation.isPending ? t('Testing...') : t('Test Connection')}
              </Button>
              <Button type="submit" disabled={mutation.isPending || !isFormValid}>
                {mutation.isPending ? t('Creating...') : t('Create')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: '/data-sources' })}
              >
                {t('Cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
