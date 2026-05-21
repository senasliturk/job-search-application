# Data models (ER)

## Relational store – Azure SQL (Job Posting Service)

```mermaid
erDiagram
    COMPANY ||--o{ JOB_POSTING : posts
    JOB_POSTING ||--o{ JOB_APPLICATION : receives
    USER_PROFILE ||--o{ JOB_APPLICATION : submits
    USER_PROFILE {
      string user_id PK "Firebase UID"
      string display_name
      string email
      string school
      string department
      string cv_filename
      string education_status "student|graduate|no_degree"
      string class_year       "prep|year_1|...|year_5"
      string experience_level "new_grad|junior|mid|senior"
    }

    COMPANY {
      uuid id PK
      string name
      string logo_url
      string website
      datetime created_at
    }

    JOB_POSTING {
      uuid id PK
      uuid company_id FK
      string title
      string description
      string country
      string city
      string town
      string work_preference  "onsite|remote|hybrid"
      string position_level   "junior|mid|senior|expert"
      string department
      decimal min_salary
      decimal max_salary
      int application_count
      datetime last_updated
      datetime created_at
      bool is_active
    }

    JOB_APPLICATION {
      uuid id PK
      uuid job_posting_id FK
      string user_id    "Firebase UID"
      string display_name
      string email
      datetime applied_at
      string status     "submitted|reviewed|rejected"
    }
```

## NoSQL store – Cosmos DB (Job Search Service)

Two containers, partitioned by `user_id` so every user’s history scans cheaply.

### `user_searches`

```json
{
  "id": "<uuid>",
  "user_id": "<firebase-uid or 'anonymous'>",
  "query_position": "Web Developer",
  "query_city": "Izmir",
  "query_country": "Türkiye",
  "filters": { "work_preference": "remote" },
  "result_count": 42,
  "searched_at": "2026-05-06T12:34:56Z"
}
```

### `user_alerts`

```json
{
  "id": "<uuid>",
  "user_id": "<firebase-uid>",
  "keywords": ["Web Tasarım Uzmanı"],
  "country": "Türkiye",
  "city": "Izmir",
  "town": null,
  "work_preference": null,
  "active": true,
  "created_at": "2026-05-06T12:34:56Z",
  "last_notified_at": null
}
```

## Cache layer – Redis

| Key pattern                   | Value                | TTL  | Purpose                          |
| ----------------------------- | -------------------- | ---- | -------------------------------- |
| `job:{id}`                    | JSON of full posting | 5 m  | Hot read for detail page         |
| `jobs:list:{hash(query)}`     | JSON page of results | 60 s | Cached search/list responses     |
| `autocomplete:position:{q}`   | JSON list of strings | 30 m | Position autocomplete            |
| `autocomplete:city:{q}`       | JSON list of strings | 30 m | City autocomplete                |
