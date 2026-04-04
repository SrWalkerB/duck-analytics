# ROADMAP — Duck Analytics (90 dias)

## Objetivo
Entregar uma versão self-hosted do Duck Analytics, com experiência próxima de Power BI/Metabase para os fluxos principais, suporte a embed seguro e publicação em um único container de aplicação (com banco externo).

## Visão de Entrega
- Prazo: **06/04/2026 → 05/07/2026**
- Prioridade de produto: **Embed + Sharing**
- Modelo de deploy: **1 container de app + Postgres externo**

## Fase 0 — Hardening obrigatório (06/04/2026 a 19/04/2026)
### Meta
Criar baseline de segurança e confiabilidade para produção.

### Entregas
- Aplicar validação real de DTOs (Zod `parse`) nos endpoints críticos.
- Corrigir CORS para configuração por ambiente (`CORS_ALLOWED_ORIGINS`).
- Adicionar hardening HTTP (`helmet`), limites de payload e rate limiting.
- Remover logs sensíveis/verbosos de produção.
- Padronizar erros de autenticação e entrada inválida.

### Critério de aceite
- Rotas críticas rejeitam payload inválido.
- CORS funciona por allowlist (sem origem hardcoded).
- Proteções básicas HTTP ativas em produção.

## Fase 1 — Deploy self-hosted em 1 imagem (20/04/2026 a 03/05/2026)
### Meta
Permitir que cliente suba a plataforma com uma imagem única de aplicação.

### Entregas
- `Dockerfile` multi-stage de produção (frontend build + backend runtime).
- Healthcheck de aplicação.
- Variáveis de ambiente de produção documentadas.
- Guia de instalação e atualização para servidor do cliente.

### Critério de aceite
- Aplicação sobe com um único container de app.
- Conexão com Postgres externo validada.
- Processo de deploy reproduzível e documentado.

## Fase 2 — Embed MVP (04/05/2026 a 31/05/2026)
### Meta
Entregar embed seguro de dashboards em aplicações externas.

### Entregas
- Geração de token assinado para embed (escopo + expiração curta).
- Endpoint público read-only para consumo de dashboard embutido.
- Configuração de sharing por dashboard (enable/disable, domínios permitidos).
- Tela no frontend para gerar snippet de iframe.
- Revogação/rotação de credenciais de embed.

### Critério de aceite
- Embed funcional via iframe com token válido.
- Token expirado/revogado é bloqueado.
- Domínio fora da allowlist é negado.

## Fase 3 — BI core e UX de uso diário (01/06/2026 a 21/06/2026)
### Meta
Fortalecer os componentes mais usados e experiência de análise.

### Entregas
- Consolidar TABLE, BAR, LINE, PIE e KPI com melhorias de configuração.
- Implementar UI funcional para filtros `DATE_RANGE`.
- Melhorar desempenho de atualização de dashboard (reduzir recomputação total).
- Ajustes de usabilidade no fluxo question → component → dashboard.

### Critério de aceite
- Fluxo completo de criação e uso de dashboards estável.
- Filtros principais funcionando com previsibilidade.
- Performance aceitável em cenários reais de uso.

## Fase 4 — Fechamento para release (22/06/2026 a 05/07/2026)
### Meta
Preparar release candidate para primeiros clientes self-hosted.

### Entregas
- Testes de integração para fluxos críticos (auth, dashboards, embed).
- Checklist operacional (backup, rotação de segredos, troubleshooting).
- Documentação final de operação e suporte inicial.

### Critério de aceite
- Pipeline de build/test minimamente confiável.
- Runbook de produção disponível.
- Release candidate pronto para onboarding de clientes.

## Backlog pós-MVP (próximo ciclo)
- RBAC completo.
- Multi-tenancy/organizações.
- Auditoria detalhada.
- Exportações agendadas (PDF/CSV).
- Cache de queries.
