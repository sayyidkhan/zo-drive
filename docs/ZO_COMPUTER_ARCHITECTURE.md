# ZO-COMPUTER-ARCHITECTURE.md

> Understanding the Zo Computer Platform
>
> Version: v0.1

---

# Purpose

This document explains the architecture of the Zo Computer platform so that AI agents and developers can build applications correctly.

Zo is **not** simply a storage provider.

Zo is intended to become a complete cloud platform where developers can deploy modern applications without managing infrastructure.

Applications built on Zo should use native Zo services whenever possible.

---

# Design Philosophy

Zo follows several core principles.

## 1. Cloud Native

Applications should assume cloud-first deployment.

Avoid writing applications that depend on:

- Local filesystem
- Local SQLite databases
- Local caches
- Local background workers

Instead, use Zo services.

---

## 2. Managed Services

Applications should consume managed services instead of implementing infrastructure themselves.

Examples

❌ Build your own object storage.

✅ Use Zo Storage.

---

❌ Build your own authentication.

✅ Use Zo Identity.

---

❌ Build your own workflow engine.

✅ Use Zo Workflow.

---

# Core Platform

## Zo Static

Purpose

Hosts frontend applications.

Examples

- React
- Vue
- Svelte
- HTML
- Vite

Responsibilities

- Static assets
- SPA hosting
- CDN delivery

---

## Zo Compute

Purpose

Runs backend logic.

Responsibilities

- REST APIs
- Business logic
- Authentication middleware
- Webhooks
- Server-side processing

Examples

- Hono
- Express
- Fastify

---

## Zo Storage

Purpose

Object Storage.

Stores

- Images
- Videos
- PDFs
- Audio
- Archives
- Binary objects

Do NOT use Zo Storage like a database.

Objects should remain immutable whenever possible.

---

## Zo Database

Purpose

Persistent structured data.

Examples

- Users
- Metadata
- Permissions
- Settings
- Application data

Do NOT store large binary files here.

---

## Zo Identity

Purpose

Authentication.

Responsibilities

- Users
- Sessions
- OAuth
- API Tokens

Applications should never implement authentication from scratch if Zo Identity exists.

---

## Zo Workflow

Purpose

Background automation.

Examples

Image uploaded

↓

Resize image

↓

Generate thumbnail

↓

Send notification

Applications should avoid implementing custom background workers.

---

## Zo AI

Purpose

Artificial Intelligence.

Capabilities

- Chat
- Vision
- OCR
- Embeddings
- Image captioning
- Summarization

Applications should consume AI through Zo AI rather than directly integrating multiple providers.

---

## Zo Voice

Purpose

Speech services.

Capabilities

- Speech-to-text
- Text-to-speech
- Voice agents

---

## Zo Memory

Purpose

Persistent memory for AI agents.

Stores

- User preferences
- Conversation history
- Agent memory

---

# Platform Relationships

```
                 Browser

                     │

              Zo Static

                     │

             Zo Compute

                     │

     ┌────────┼────────┬────────┐

 Zo Storage  Zo Database  Zo Identity

                     │

              Zo Workflow

                     │

                 Zo AI
```

Every application should think in terms of managed services instead of infrastructure.

---

# How Applications Should Be Designed

Applications should be thin.

Business logic belongs inside Zo Compute.

Persistent files belong inside Zo Storage.

Structured data belongs inside Zo Database.

Authentication belongs inside Zo Identity.

Automation belongs inside Zo Workflow.

AI belongs inside Zo AI.

---

# Object Storage Pattern

Recommended architecture

```
Browser

↓

Upload File

↓

Zo Compute

↓

Zo Storage

↓

Return Object URL
```

The application never stores files locally.

---

# CRUD Pattern

Read

```
Browser

↓

GET /objects

↓

Zo Compute

↓

Zo Storage
```

Upload

```
Browser

↓

POST /objects

↓

Zo Compute

↓

Zo Storage
```

Delete

```
Browser

↓

DELETE /objects/:id

↓

Zo Compute

↓

Zo Storage
```

---

# Recommended Application Stack

Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Zustand
- TanStack Query

Backend

- Hono
- TypeScript
- Zod

Database

- Zo Database

Storage

- Zo Storage

Authentication

- Zo Identity

Deployment

- Zo Static
- Zo Compute

---

# Monorepo Structure

```
apps/

    web/

    api/

    cli/

packages/

    sdk/

    types/
```

Applications should separate presentation from business logic.

---

# API Design Principles

REST-first.

Examples

```
GET     /objects

POST    /objects

DELETE  /objects/:id

GET     /health
```

Avoid deeply nested endpoints.

---

# CLI Support

Every Zo application should expose APIs that can be consumed by both:

- Web UI
- CLI

Never write backend logic exclusively for the frontend.

Example

```
Web

↓

REST API

↓

Zo Compute

↓

Zo Storage
```

```
CLI

↓

REST API

↓

Zo Compute

↓

Zo Storage
```

Both clients should consume identical APIs.

---

# Shared SDK

Business logic should not be duplicated.

Create a shared SDK.

```
packages/

    sdk/
```

The SDK should be consumed by

- React
- CLI
- Future desktop apps
- Future mobile apps

---

# AI Development Principles

When generating applications for Zo:

Always prefer

✅ Zo Storage

over

❌ Local filesystem

---

Always prefer

✅ Zo Identity

over

❌ Custom authentication

---

Always prefer

✅ Zo Workflow

over

❌ Cron jobs

---

Always prefer

✅ Zo AI

over

❌ Direct vendor integrations

unless explicitly required.

---

# Future Vision

Zo Computer aims to become a complete cloud platform.

Applications built on Zo should feel native to the ecosystem.

Every project should reinforce the platform by using Zo services rather than rebuilding them.

The goal is not only to build applications—it is to demonstrate how modern cloud software can be composed from managed services with minimal infrastructure management.

---

# Guiding Principle

> Build products, not infrastructure.

Whenever a Zo service exists that fulfills a requirement, prefer using that service over implementing the capability from scratch.
