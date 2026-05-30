# Safiron Global Solutions — SEO Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a comprehensive multi-language SEO strategy to generate 500-1000 monthly organic visitors and 15-30 B2B leads within 6 months.

**Architecture:** Layered approach—(1) Technical SEO foundation (meta tags, schema, sitemaps), (2) Multi-language content (landing, features, pricing), (3) Content marketing (blog), (4) Monitoring & iteration. Frontend changes use React components + Helmet for dynamic meta; backend exposes sitemap endpoints; content delivered in 3 languages (EN, TR, AR).

**Tech Stack:** React + Vite, Python/FastAPI backend, React Helmet for SEO, Schema.org structured data, Google Search Console, Google Analytics 4

---

## PHASE 1: FOUNDATION (Week 1-2) — Tasks 1-10

### Task 1: Create SEO Metadata Helper Utility

**Status:** Not Started
**Files:** frontend/src/utils/seo.js, frontend/src/utils/seo.test.js

Create SEO_PAGES object with metadata for EN/TR/AR languages covering pages: landing, features, pricing, blog, about, contact. Implement createSeoMetadata(page, lang) function returning title, description, keywords, ogTitle, ogDescription, ogImage, ogUrl, canonicalUrl, lang. Write 2 tests, run failing tests, implement, verify passing, commit.

