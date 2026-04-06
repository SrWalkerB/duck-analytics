import { Link } from '@tanstack/react-router'
import { ChevronRight, Home } from 'lucide-react'

interface Breadcrumb {
  id: string
  name: string
}

interface CollectionBreadcrumbsProps {
  breadcrumbs: Breadcrumb[]
}

export function CollectionBreadcrumbs({ breadcrumbs }: CollectionBreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link to="/collection" className="flex items-center hover:text-foreground">
        <Home className="size-4" />
      </Link>
      {breadcrumbs.map((crumb) => (
        <span key={crumb.id} className="flex items-center gap-1">
          <ChevronRight className="size-3" />
          <Link
            to="/collection/$folderId"
            params={{ folderId: crumb.id }}
            className="hover:text-foreground"
          >
            {crumb.name}
          </Link>
        </span>
      ))}
    </nav>
  )
}
