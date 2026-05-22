# Architecture

## High-level component diagram

```mermaid
flowchart LR
    subgraph Clients
      AdminUI[Admin Client\nNext.js · Vercel]
      Client[Public Client\nNext.js · Vercel]
    end

    AdminUI -- manage jobs --> GW
    Client -- search / apply --> GW
    Client -- chat --> GW

    subgraph Cloud["Render + Firebase + Upstash"]
      GW[API Gateway\nFastAPI · Render]
      JP[Job Posting Service\nFastAPI · Render]
      JS[Job Search Service\nFastAPI · Render]
      NS[Notification Service\nFastAPI · Render]
      AI[AI Agent Service\nFastAPI + LLM · Render]

      GW --> JP
      GW --> JS
      GW --> NS
      GW --> AI

      AI --> JP
      AI --> JS

      JP -->|cache| Redis[(Upstash Redis\nJob Posting Cache)]
      JP -->|writes| PG[(PostgreSQL\nRender · Job Postings)]
      JP -->|publish new job| Q{{CloudAMQP\nRabbitMQ}}

      JS -->|store searches & alerts| FS[(Firebase Firestore\nNoSQL)]
      NS -->|read alerts/searches| FS
      NS -->|consume| Q

      Sched[GitHub Actions\nnightly cron] --> NS
    end

    Client -- login --> Firebase[(Firebase Auth)]
    AdminUI -- login --> Firebase
    GW -- verify JWT --> Firebase
```

## Service responsibilities

| Service | Responsibility | Storage |
|---|---|---|
| API Gateway | Single entrypoint, JWT verification, request routing, CORS | — |
| Job Posting Service | CRUD on jobs (admin/company), publishes new-job events, serves cached reads | PostgreSQL + Upstash Redis |
| Job Search Service | Search jobs by position/city + filters, autocomplete, persists user searches | Firebase Firestore |
| Notification Service | Two scheduled tasks: (a) job-alert notifier consumes queue + matches alerts; (b) related-job notifier reads user searches and sends suggestions | Firebase Firestore |
| AI Agent Service | Chat endpoint that calls Search & Posting APIs as LLM tools | — |

## Why this layout matches the assignment

- **"Deployed separately"** → each service has its own `Dockerfile`, its own `requirements.txt`, its own Render Web Service.
- **"All APIs via an API Gateway"** → public clients only know the gateway URL.
- **"Versioned + paginated REST"** → every router at `/api/v1`, list endpoints accept `?page=&page_size=`.
- **"At least one distributed caching solution"** → Upstash Redis for hot Job Posting reads.
- **"Job searches in separate NoSQL DB"** → Firebase Firestore collection `user_searches`.
- **"IAM service"** → Firebase Auth; gateway verifies the ID token.
- **"Queue solution (RabbitMQ or Azure Messaging)"** → CloudAMQP RabbitMQ.
- **"Scheduling services"** → GitHub Actions cron hits `/internal/run-job-alert` and `/internal/run-related-jobs`.
