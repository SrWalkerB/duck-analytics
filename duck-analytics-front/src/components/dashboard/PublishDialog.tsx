import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Lock, Copy, Code, ExternalLink, ScrollText } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import type { Dashboard, EmbedType } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

interface PublishDialogProps {
  dashboard: Dashboard
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PublishDialog({ dashboard, open, onOpenChange }: PublishDialogProps) {
  const qc = useQueryClient()
  const embed = dashboard.embed
  const isPublished = dashboard.status === 'PUBLISHED' && !!embed

  const [embedType, setEmbedType] = useState<EmbedType>(embed?.embedType ?? 'PUBLIC')
  const [showFilters, setShowFilters] = useState(embed?.showFilters ?? true)
  const [showTitle, setShowTitle] = useState(embed?.showTitle ?? true)
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)

  const baseUrl = window.location.origin

  const publishMutation = useMutation({
    mutationFn: () =>
      api.patch(`/v1/dashboards/${dashboard.id}/publish`, {
        embedType,
        showFilters,
        showTitle,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', dashboard.id] })
      qc.invalidateQueries({ queryKey: ['dashboards'] })
      toast.success('Dashboard publicado com sucesso!')
      setGeneratedToken(null)
    },
  })

  const unpublishMutation = useMutation({
    mutationFn: () => api.delete(`/v1/dashboards/${dashboard.id}/publish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', dashboard.id] })
      qc.invalidateQueries({ queryKey: ['dashboards'] })
      toast.success('Dashboard despublicado')
      setGeneratedToken(null)
    },
  })

  const updateSettingsMutation = useMutation({
    mutationFn: () =>
      api.put(`/v1/dashboards/${dashboard.id}/embed-settings`, {
        embedType,
        showFilters,
        showTitle,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', dashboard.id] })
      toast.success('Configurações de embed atualizadas')
      setGeneratedToken(null)
    },
  })

  const generateTokenMutation = useMutation({
    mutationFn: () =>
      api
        .post<{ token: string; embedCode: string; expiresIn: string }>(
          `/v1/dashboards/${dashboard.id}/embed-token`,
        )
        .then((r) => r.data),
    onSuccess: (data) => {
      setGeneratedToken(data.token)
      toast.success('Token gerado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao gerar token')
    },
  })

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }

  const embedUrl = embed
    ? `${baseUrl}/embed/${embed.embedCode}`
    : null

  const embedUrlWithToken =
    embedUrl && generatedToken
      ? `${embedUrl}?token=${encodeURIComponent(generatedToken)}`
      : null

  const iframeSnippet = embedUrl
    ? `<iframe src="${embedType === 'JWT_SECURED' && generatedToken ? embedUrlWithToken : embedUrl}" width="100%" height="600" frameborder="0"></iframe>`
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl">Publicar Dashboard</DialogTitle>
            {isPublished ? (
              <Badge variant="default">Publicado</Badge>
            ) : (
              <Badge variant="secondary">Rascunho</Badge>
            )}
          </div>
          <DialogDescription>
            Publique este dashboard para gerar uma URL de embed que pode ser usada em iframes.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-6">
          {/* Tipo de Embed */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de Embed</Label>
            <div className="flex gap-3">
              <button
                className={cn(
                  'flex flex-1 items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors',
                  embedType === 'PUBLIC'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30',
                )}
                onClick={() => setEmbedType('PUBLIC')}
              >
                <Globe className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Público</p>
                  <p className="text-xs text-muted-foreground">
                    Qualquer pessoa com o link pode visualizar.
                  </p>
                </div>
              </button>
              <button
                className={cn(
                  'flex flex-1 items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors',
                  embedType === 'JWT_SECURED'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30',
                )}
                onClick={() => setEmbedType('JWT_SECURED')}
              >
                <Lock className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">JWT (Privado)</p>
                  <p className="text-xs text-muted-foreground">
                    Requer um token JWT válido para acessar.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Configurações de Exibição */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Configurações de Exibição</Label>
            <div className="flex gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  id="show-title"
                  checked={showTitle}
                  onCheckedChange={setShowTitle}
                />
                <Label htmlFor="show-title" className="text-sm font-normal">
                  Mostrar título da página
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="show-filters"
                  checked={showFilters}
                  onCheckedChange={setShowFilters}
                />
                <Label htmlFor="show-filters" className="text-sm font-normal">
                  Mostrar filtros
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          {!isPublished ? (
            <Button
              className="w-full"
              size="lg"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? 'Publicando...' : 'Publicar Dashboard'}
            </Button>
          ) : (
            <div className="space-y-5">
              {/* Embed URL */}
              {embedUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">URL do Embed</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs"
                        onClick={() => copyToClipboard(embedUrl)}
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs"
                        onClick={() => window.open(embedUrl, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir
                      </Button>
                    </div>
                  </div>
                  <code className="block overflow-x-auto whitespace-nowrap rounded-lg bg-muted px-4 py-3 text-sm">
                    {embedUrl}
                  </code>
                </div>
              )}

              {/* Iframe Snippet */}
              {iframeSnippet && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Snippet iframe</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs"
                      onClick={() => copyToClipboard(iframeSnippet)}
                    >
                      <Code className="h-3.5 w-3.5" /> Copiar
                    </Button>
                  </div>
                  <code className="block overflow-x-auto whitespace-nowrap rounded-lg bg-muted px-4 py-3 text-sm">
                    {iframeSnippet}
                  </code>
                </div>
              )}

              {/* JWT Token Generation */}
              {embedType === 'JWT_SECURED' && embed?.embedType === 'JWT_SECURED' && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Token JWT</span>
                      <p className="text-xs text-muted-foreground">
                        Gere um token para acesso autenticado ao embed.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateTokenMutation.mutate()}
                      disabled={generateTokenMutation.isPending}
                    >
                      {generateTokenMutation.isPending ? 'Gerando...' : 'Gerar Token'}
                    </Button>
                  </div>
                  {generatedToken && (
                    <div className="space-y-2">
                      <code className="block max-h-20 overflow-x-auto overflow-y-auto whitespace-nowrap rounded-lg bg-muted px-4 py-3 text-sm">
                        {generatedToken}
                      </code>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Expira em 1 hora. Use como query parameter: <code>?token=...</code>
                        </p>
                        {embedUrlWithToken && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => copyToClipboard(embedUrlWithToken)}
                          >
                            <Copy className="h-3 w-3" /> URL com token
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Footer: logs + save + unpublish */}
              <div className="flex items-center justify-between">
                {embed && (
                  <Link
                    to="/logs"
                    search={{ source: 'embed', resourceId: embed.id }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ScrollText className="h-4 w-4" /> Ver Logs de Embed
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => updateSettingsMutation.mutate()}
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => unpublishMutation.mutate()}
                    disabled={unpublishMutation.isPending}
                  >
                    {unpublishMutation.isPending ? 'Despublicando...' : 'Despublicar'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
