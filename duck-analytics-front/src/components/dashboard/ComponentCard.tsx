import { useState, useRef } from 'react'
import { GripVertical, Pencil, Trash2, FolderInput, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { ChartRenderer } from '@/components/visualizations/ChartRenderer'
import { Link } from '@tanstack/react-router'
import type { DashboardComponent, DashboardTab, ComponentType } from '@/types'

// '' (empty string) = title hidden sentinel; null = show default name; string = custom title
const TITLE_HIDDEN = ''

interface Meta {
  title?: string | null
  description?: string | null
}

interface Props {
  dc: DashboardComponent
  componentData: { data: Record<string, unknown>[]; count: number } | undefined
  isEditMode: boolean
  tabs: DashboardTab[]
  pendingTitle?: string | null
  pendingDescription?: string | null
  onRemove: () => void
  onUpdateMeta: (meta: Meta) => void
  onMoveToTab: (tabId: string) => void
}

export function ComponentCard({
  dc,
  componentData,
  isEditMode,
  tabs,
  pendingTitle,
  pendingDescription,
  onRemove,
  onUpdateMeta,
  onMoveToTab,
}: Props) {
  const [isHovered, setIsHovered] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [hideTitle, setHideTitle] = useState(false)
  // Delay-based hover so mouse moving card→toolbar doesn't close the toolbar
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const dataError = (componentData as { error?: string } | undefined)?.error
  const rows = componentData?.data ?? []

  const effectiveTitle = pendingTitle !== undefined ? pendingTitle : dc.title
  const effectiveDescription = pendingDescription !== undefined ? pendingDescription : dc.description

  const isTitleHidden = effectiveTitle === TITLE_HIDDEN
  const displayTitle = isTitleHidden ? null : (effectiveTitle ?? dc.component?.name ?? 'Component')

  function handleMouseEnter() {
    clearTimeout(hideTimer.current)
    setIsHovered(true)
  }

  function handleMouseLeave() {
    // Small delay so mouse can move from card to toolbar without flickering
    hideTimer.current = setTimeout(() => setIsHovered(false), 120)
  }

  function handlePopoverOpenChange(open: boolean) {
    if (open) {
      const isHidden = effectiveTitle === TITLE_HIDDEN
      setHideTitle(isHidden)
      setTitleInput(isHidden ? '' : (effectiveTitle ?? ''))
      setDescInput(effectiveDescription ?? '')
    }
    setPopoverOpen(open)
  }

  function handleSaveMeta() {
    onUpdateMeta({
      title: hideTitle ? TITLE_HIDDEN : (titleInput.trim() === '' ? null : titleInput.trim()),
      description: descInput.trim() === '' ? null : descInput.trim(),
    })
    setPopoverOpen(false)
  }

  return (
    <div
      className="relative h-full"
      style={{ overflow: 'visible', zIndex: isHovered ? 50 : 'auto' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover toolbar — also inherits the delayed hide so hovering it keeps it open */}
      {isEditMode && isHovered && (
        <div
          className="absolute left-0 z-20 flex items-center gap-0.5 rounded-md border bg-background px-1 py-1 shadow-md"
          style={{ bottom: '100%', marginBottom: 4 }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="drag-handle cursor-grab px-1 text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </div>

          <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar título / descrição">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Ocultar título</Label>
                  <Switch checked={hideTitle} onCheckedChange={setHideTitle} />
                </div>
                {!hideTitle && (
                  <div className="space-y-1">
                    <Label className="text-xs">Título personalizado</Label>
                    <Input
                      className="h-7 text-xs"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      placeholder={dc.component?.name ?? 'Deixe vazio para usar o padrão'}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Descrição (help text)</Label>
                  <Input
                    className="h-7 text-xs"
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <Button size="sm" className="w-full" onClick={handleSaveMeta}>
                  Aplicar
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {tabs.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Mover para aba">
                  <FolderInput className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {tabs.map((tab) => (
                  <DropdownMenuItem key={tab.id} onClick={() => onMoveToTab(tab.id)}>
                    {tab.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar componente" asChild>
            <Link to="/questions/$id" params={{ id: dc.componentId }}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Remover"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <Card
        className="h-full gap-0 overflow-hidden py-0"
        style={{ backgroundColor: dc.backgroundColor ?? undefined }}
      >
        {!isTitleHidden && (
          <div className="flex h-8 items-center border-b px-3">
            <span className="truncate text-xs font-medium">{displayTitle}</span>
          </div>
        )}
        {effectiveDescription && (
          <div className="border-b px-3 py-1">
            <span className="text-xs text-muted-foreground">{effectiveDescription}</span>
          </div>
        )}
        <div
          className="p-2"
          style={{
            height: (() => {
              let h = 'calc(100%'
              if (!isTitleHidden) h += ' - 2rem'
              if (effectiveDescription) h += ' - 1.5rem'
              return h + ')'
            })(),
          }}
        >
          {dataError ? (
            <div className="flex h-full items-center justify-center p-2">
              <p className="text-center text-xs text-destructive">Erro: {dataError}</p>
            </div>
          ) : (
            <ChartRenderer
              type={(dc.component?.type ?? 'TABLE') as ComponentType}
              data={rows}
              configuration={(dc.component?.configuration as Record<string, unknown>) ?? {}}
              title={displayTitle ?? dc.component?.name ?? 'dados'}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
