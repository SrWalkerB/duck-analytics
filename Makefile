SHELL := /bin/bash
.DEFAULT_GOAL := help

PNPM ?= pnpm
FRONT_DIR := duck-analytics-front
BACK_DIR := duck-analytics-backend

.PHONY: help install install-front install-back install-all env setup docker-up docker-down docker-restart containers-up containers-down dev dev-front dev-back lint lint-front lint-back test test-back build build-front build-back verify db-generate db-migrate db-studio

help: ## Lista os comandos disponíveis
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Instala dependências da raiz
	$(PNPM) install

install-front: ## Instala dependências do frontend
	$(PNPM) -C $(FRONT_DIR) install

install-back: ## Instala dependências do backend
	$(PNPM) -C $(BACK_DIR) install

install-all: install install-front install-back ## Instala dependências da raiz, frontend e backend

env: ## Cria .env local no front e backend (se não existir)
	@test -f $(FRONT_DIR)/.env || cp $(FRONT_DIR)/.env.example $(FRONT_DIR)/.env
	@test -f $(BACK_DIR)/.env || cp $(BACK_DIR)/.env.example $(BACK_DIR)/.env

setup: install-all env docker-up ## Setup inicial do projeto

docker-up: ## Sobe os containers Docker (PostgreSQL)
	$(PNPM) docker:up

docker-down: ## Para os containers Docker
	$(PNPM) docker:down

docker-restart: docker-down docker-up ## Reinicia os containers Docker

containers-up: docker-up ## Alias para subir os containers

containers-down: docker-down ## Alias para parar os containers

dev: ## Roda frontend + backend em paralelo (com Docker)
	$(PNPM) dev

dev-front: ## Roda apenas o frontend
	$(PNPM) -C $(FRONT_DIR) dev

dev-back: ## Roda apenas o backend
	$(PNPM) -C $(BACK_DIR) start:dev

lint: lint-front lint-back ## Roda lint de frontend e backend

lint-front: ## Roda lint do frontend
	$(PNPM) -C $(FRONT_DIR) lint

lint-back: ## Roda lint do backend
	$(PNPM) -C $(BACK_DIR) lint

test: test-back ## Roda testes (atualmente backend)

test-back: ## Roda testes do backend
	$(PNPM) -C $(BACK_DIR) test

build: build-front build-back ## Builda frontend e backend

build-front: ## Builda frontend
	$(PNPM) -C $(FRONT_DIR) build

build-back: ## Builda backend
	$(PNPM) -C $(BACK_DIR) build

verify: lint build test ## Executa validações principais

db-generate: ## Gera client Prisma no backend
	$(PNPM) -C $(BACK_DIR) db:generate

db-migrate: ## Roda migrações Prisma no backend
	$(PNPM) -C $(BACK_DIR) db:migrate

db-studio: ## Abre Prisma Studio no backend
	$(PNPM) -C $(BACK_DIR) db:studio
