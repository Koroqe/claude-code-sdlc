# Vector-retrieval-backend benchmark report

**Date:** 2026-05-10

**Queries:** 12 (golden set)
**Top-K:** 10
**Relevance:** source-level — a hit is counted when at least one returned chunk's source basename is listed in the query's `relevant_sources` array.

## Aggregate metrics

| Mode | Recall@1 | Recall@3 | Recall@5 | Recall@10 | MRR | Latency p50 (ms) | Latency p95 (ms) |
|------|----------|----------|----------|-----------|-----|------------------|------------------|
| dense | 0.417 | 0.583 | 0.750 | 0.750 | 0.528 | 63.7 | 74.1 |
| hybrid | 0.333 | 0.583 | 0.750 | 0.833 | 0.483 | 59.1 | 66.1 |
| lexical | 0.333 | 0.333 | 0.417 | 0.583 | 0.378 | 4.6 | 9.0 |

## Per-query side-by-side

### Q01 (en, nl) — "RAG retrieval architecture"

Relevant sources: Building Al Agents with LLMs, RAG, and Knowledge Graphs.pdf, Generative Al with Lang Chain.pdf, 947059230_AI_Agents_and_Applications_Roberto_Infante_bibis_ir.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✓ | ✓ | 2 | 2248.7 | LangChain in Action.pdf, Generative Al with Lang Chain.pdf, AI engineering.pdf |
| hybrid | ✓ | ✓ | 3 | 65.4 | LangChain in Action.pdf, LangChain in Action.pdf, 947059230_AI_Agents_and_Applications_Roberto_Infante_bibis_ir.pdf |
| lexical | ✓ | ✓ | 4 | 14.4 | Mastering LangChain.pdf, AI engineering.pdf, AI engineering.pdf |

### Q02 (en, keyword) — "BM25 ranking full text search"

Relevant sources: Designing Large Language Model Applications.pdf, Building Al Agents with LLMs, RAG, and Knowledge Graphs.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✓ | ✓ | 4 | 65.2 | AI engineering.pdf, Building applications with AI agents.pdf, AI engineering.pdf |
| hybrid | ✓ | ✓ | 4 | 66.6 | AI engineering.pdf, Building applications with AI agents.pdf, AI engineering.pdf |
| lexical | ✗ | ✗ | — | 2.7 |  |

### Q03 (en, nl) — "vector embeddings semantic similarity"

Relevant sources: Designing Large Language Model Applications.pdf, Building Al Agents with LLMs, RAG, and Knowledge Graphs.pdf, Generative Al with Lang Chain.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✓ | ✓ | 1 | 68.5 | Designing Large Language Model Applications.pdf, LangChain in Action.pdf, LangChain in Action.pdf |
| hybrid | ✗ | ✓ | 8 | 57.5 | LangChain in Action.pdf, 947059230_AI_Agents_and_Applications_Roberto_Infante_bibis_ir.pdf, LangChain in Action.pdf |
| lexical | ✗ | ✓ | 7 | 9.0 | 947059230_AI_Agents_and_Applications_Roberto_Infante_bibis_ir.pdf, LangChain in Action.pdf, Mastering LangChain.pdf |

### Q04 (en, keyword) — "chaos engineering fault injection"

Relevant sources: Хаос инжиниринг.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✓ | ✓ | 4 | 59.3 | Building applications with AI agents.pdf, Infrastructure as a code.pdf, Infrastructure as a code.pdf |
| hybrid | ✓ | ✓ | 2 | 59.1 | Building applications with AI agents.pdf, Хаос инжиниринг.pdf, Infrastructure as a code.pdf |
| lexical | ✓ | ✓ | 1 | 3.1 | Хаос инжиниринг.pdf, Building applications with AI agents.pdf |

### Q05 (ru, cross) — "хаос инжиниринг отказоустойчивость"

Relevant sources: Хаос инжиниринг.pdf, Site_Reliability_Engineering.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✓ | ✓ | 1 | 60.8 | Хаос инжиниринг.pdf, Хаос инжиниринг.pdf, Хаос инжиниринг.pdf |
| hybrid | ✓ | ✓ | 1 | 57.7 | Хаос инжиниринг.pdf, Хаос инжиниринг.pdf, Хаос инжиниринг.pdf |
| lexical | ✓ | ✓ | 1 | 4.0 | Хаос инжиниринг.pdf, Хаос инжиниринг.pdf, Хаос инжиниринг.pdf |

### Q06 (en, keyword) — "data engineering pipelines Airflow"

Relevant sources: Apache Airflow и конвееры обработки данных.pdf, Data engineering design patterns.pdf, Data Engineering with Python.pdf, Fundamentals of data engineering.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✓ | ✓ | 1 | 59.3 | Data Engineering with Python.pdf, Data Engineering with Python.pdf, Data Engineering with Python.pdf |
| hybrid | ✓ | ✓ | 1 | 60.5 | Data Engineering with Python.pdf, Data Engineering with Python.pdf, Data engineering design patterns.pdf |
| lexical | ✓ | ✓ | 1 | 4.9 | Data Engineering with Python.pdf, Data Engineering with Python.pdf, Data Engineering with Python.pdf |

### Q07 (ru, cross) — "масштабируемые распределённые системы"

Relevant sources: Масштабируемые данные.pdf, Высоконагруженные_приложения_Программирование,_масштабирование,.pdf, Али_Аминиан_и_другие_System_Design_Подготовка_к_сложному_интервью.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✓ | ✓ | 1 | 70.5 | Высоконагруженные_приложения_Программирование,_масштабирование,.pdf, Высоконагруженные_приложения_Программирование,_масштабирование,.pdf, Высоконагруженные_приложения_Программирование,_масштабирование,.pdf |
| hybrid | ✓ | ✓ | 1 | 60.0 | Высоконагруженные_приложения_Программирование,_масштабирование,.pdf, Высоконагруженные_приложения_Программирование,_масштабирование,.pdf, Высоконагруженные_приложения_Программирование,_масштабирование,.pdf |
| lexical | ✗ | ✗ | — | 1.7 |  |

### Q08 (en, keyword) — "Kafka event streaming"

Relevant sources: Kafka в действии.pdf, Apache Airflow и конвееры обработки данных.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✗ | ✗ | — | 59.9 | Data Engineering with Python.pdf, Data Engineering with Python.pdf, Building applications with AI agents.pdf |
| hybrid | ✗ | ✗ | — | 66.1 | Data engineering design patterns.pdf, Building applications with AI agents.pdf, Data Engineering with Python.pdf |
| lexical | ✗ | ✗ | — | 4.6 | Data engineering design patterns.pdf, Data engineering design patterns.pdf, Kafka в действии.pdf |

### Q09 (en, paraphrase) — "how to authenticate users"

Relevant sources: Building Generative Al Services with FastAPI.pdf, Biling Generative AI Services with FastAPI.pdf, Building applications with AI agents.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✓ | ✓ | 1 | 74.1 | Building Generative Al Services with FastAPI.pdf, Building Generative Al Services with FastAPI.pdf, Biling Generative AI Services with FastAPI.pdf |
| hybrid | ✓ | ✓ | 1 | 58.0 | Building Generative Al Services with FastAPI.pdf, Biling Generative AI Services with FastAPI.pdf, Building Generative Al Services with FastAPI.pdf |
| lexical | ✓ | ✓ | 1 | 6.4 | Biling Generative AI Services with FastAPI.pdf, Building Generative Al Services with FastAPI.pdf, Building Generative Al Services with FastAPI.pdf |

### Q10 (en, nl) — "machine learning training loop optimization"

Relevant sources: Hands On Machine Learning with Pytorch.pdf, Deep_Learning.pdf, Designing machine learning systems.pdf, Building Machine learning powered applications.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✓ | ✓ | 3 | 63.7 | Gans in action.pdf, Hands on Generative AI with Transformers and Diffusion models.pdf, Deep_Learning.pdf |
| hybrid | ✓ | ✓ | 3 | 56.9 | Gans in action.pdf, Hands on Generative AI with Transformers and Diffusion models.pdf, Deep_Learning.pdf |
| lexical | ✗ | ✗ | — | 2.3 |  |

### Q11 (en, nl) — "prompt engineering best practices"

Relevant sources: Prompt engineering for Generative AI.pdf, Generative Al with Lang Chain.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✗ | ✗ | — | 53.3 | Biling Generative AI Services with FastAPI.pdf, LangChain in Action.pdf, AI engineering.pdf |
| hybrid | ✓ | ✓ | 4 | 56.3 | AI engineering.pdf, AI engineering.pdf, AI engineering.pdf |
| lexical | ✗ | ✓ | 7 | 5.8 | AI engineering.pdf, AI engineering.pdf, AI engineering.pdf |

### Q12 (en, keyword) — "system design interview architecture"

Relevant sources: system design interview.pdf, Али_Аминиан_и_другие_System_Design_Подготовка_к_сложному_интервью.pdf

| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |
|------|-------|--------|---------------------|--------------|---------------|
| dense | ✗ | ✗ | — | 62.9 | Infrastructure as a code.pdf, Fundamentals of data engineering.pdf, Building applications with AI agents.pdf |
| hybrid | ✗ | ✗ | — | 55.6 | Infrastructure as a code.pdf, Fundamentals of data engineering.pdf, Building applications with AI agents.pdf |
| lexical | ✗ | ✗ | — | 1.0 |  |

## Methodology

Each query runs in lexical, dense, and hybrid modes against the same project-local index.db. Relevance is source-level (see bench/golden/README.md). Hybrid mode uses RRF k=60 (Cormack et al. 2009). Dense uses sqlite-vec K-NN with `embedding MATCH ? AND k = ?`. Encoder is e5-multilingual-small (384-dim L2-normalized) loaded via fastembed-rs.
