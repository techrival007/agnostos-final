"""
Scraper for GitHub job listing repos:
  - speedyapply/2026-AI-College-Jobs
  - speedyapply/2026-SWE-College-Jobs

Fetches raw markdown, parses tables, and upserts into github_job_listings.
"""

import logging
import re
from datetime import date, timedelta
from dataclasses import dataclass

import httpx
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from theos.models import GithubJobListing

logger = logging.getLogger("theos.github_jobs")

REPOS = {
    "ai": {
        "base": "https://raw.githubusercontent.com/speedyapply/2026-AI-College-Jobs/main",
        "files": {
            "README.md": ("internship", "usa"),
            "INTERN_INTL.md": ("internship", "international"),
            "NEW_GRAD_USA.md": ("new_grad", "usa"),
            "NEW_GRAD_INTL.md": ("new_grad", "international"),
        },
    },
    "swe": {
        "base": "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main",
        "files": {
            "README.md": ("internship", "usa"),
            "INTERN_INTL.md": ("internship", "international"),
            "NEW_GRAD_USA.md": ("new_grad", "usa"),
            "NEW_GRAD_INTL.md": ("new_grad", "international"),
        },
    },
}

RE_HTML_LINK = re.compile(r'<a\s+href="([^"]+)"', re.IGNORECASE)
RE_STRONG = re.compile(r"<strong>(.*?)</strong>", re.IGNORECASE)
RE_AGE = re.compile(r"(\d+)d")
RE_TAGS = re.compile(r"<[^>]+>")


@dataclass
class ParsedJob:
    company: str
    company_url: str | None
    position: str
    location: str | None
    salary: str | None
    apply_url: str
    age_days: int | None
    posted_at: date | None
    category: str | None
    job_type: str
    region: str
    source_repo: str


def _strip_html(text: str) -> str:
    return RE_TAGS.sub("", text).strip()


def _extract_link(cell: str) -> str | None:
    m = RE_HTML_LINK.search(cell)
    return m.group(1) if m else None


def _extract_company_name(cell: str) -> str:
    m = RE_STRONG.search(cell)
    if m:
        return m.group(1).strip()
    return _strip_html(cell)


def _parse_age(cell: str) -> int | None:
    m = RE_AGE.search(cell.strip())
    return int(m.group(1)) if m else None


def _detect_category(line: str, current_category: str | None) -> str | None:
    """Detect FAANG+, Quant, or Other section headers."""
    stripped = line.strip()
    if stripped.startswith("### FAANG"):
        return "FAANG+"
    if stripped.startswith("### Quant"):
        return "Quant"
    if stripped.startswith("### Other"):
        return "Other"
    return current_category


def parse_markdown(content: str, job_type: str, region: str, source_repo: str) -> list[ParsedJob]:
    """Parse a single markdown file into job listings."""
    jobs: list[ParsedJob] = []
    today = date.today()
    current_category: str | None = None

    for line in content.split("\n"):
        current_category = _detect_category(line, current_category)

        if not line.strip().startswith("|"):
            continue

        cells = [c.strip() for c in line.split("|")]
        cells = [c for c in cells if c != ""]

        if len(cells) < 5:
            continue

        if cells[0].lower() in ("company", "---", ""):
            continue
        if all(c.replace("-", "") == "" for c in cells):
            continue

        company_cell = cells[0]
        position = _strip_html(cells[1])
        location = _strip_html(cells[2]) if len(cells) > 2 else None

        has_salary_col = len(cells) >= 6
        if has_salary_col:
            salary = cells[3].strip() if cells[3].strip() else None
            posting_cell = cells[4]
            age_cell = cells[5] if len(cells) > 5 else ""
        else:
            salary = None
            posting_cell = cells[3]
            age_cell = cells[4] if len(cells) > 4 else ""

        company_name = _extract_company_name(company_cell)
        company_url = _extract_link(company_cell)
        apply_url = _extract_link(posting_cell)

        if not apply_url or not position:
            continue

        age_days = _parse_age(age_cell)
        posted_at = today - timedelta(days=age_days) if age_days is not None else None

        jobs.append(ParsedJob(
            company=company_name,
            company_url=company_url,
            position=position,
            location=location if location else None,
            salary=salary,
            apply_url=apply_url,
            age_days=age_days,
            posted_at=posted_at,
            category=current_category,
            job_type=job_type,
            region=region,
            source_repo=source_repo,
        ))

    return jobs


async def fetch_and_parse_all() -> list[ParsedJob]:
    """Fetch all markdown files from both repos and parse them."""
    all_jobs: list[ParsedJob] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for repo_key, repo_info in REPOS.items():
            base_url = repo_info["base"]
            for filename, (job_type, region) in repo_info["files"].items():
                url = f"{base_url}/{filename}"
                logger.info("Fetching %s", url)
                try:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    content = resp.text
                    jobs = parse_markdown(content, job_type, region, repo_key)
                    logger.info("Parsed %d jobs from %s/%s", len(jobs), repo_key, filename)
                    all_jobs.extend(jobs)
                except Exception as e:
                    logger.error("Failed to fetch %s: %s", url, e)

    logger.info("Total jobs parsed: %d", len(all_jobs))
    return all_jobs


async def refresh_github_jobs(db: AsyncSession) -> int:
    """Fetch all jobs and upsert into the database. Returns count of jobs."""
    jobs = await fetch_and_parse_all()
    if not jobs:
        return 0

    await db.execute(delete(GithubJobListing))

    records = []
    seen_urls: set[str] = set()
    for j in jobs:
        if j.apply_url in seen_urls:
            continue
        seen_urls.add(j.apply_url)
        records.append({
            "company": j.company,
            "company_url": j.company_url,
            "position": j.position,
            "location": j.location,
            "salary": j.salary,
            "apply_url": j.apply_url,
            "age_days": j.age_days,
            "posted_at": j.posted_at,
            "category": j.category,
            "job_type": j.job_type,
            "region": j.region,
            "source_repo": j.source_repo,
        })

    batch_size = 200
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        stmt = pg_insert(GithubJobListing).values(batch)
        stmt = stmt.on_conflict_do_update(
            index_elements=["apply_url"],
            set_={
                "company": stmt.excluded.company,
                "company_url": stmt.excluded.company_url,
                "position": stmt.excluded.position,
                "location": stmt.excluded.location,
                "salary": stmt.excluded.salary,
                "age_days": stmt.excluded.age_days,
                "posted_at": stmt.excluded.posted_at,
                "category": stmt.excluded.category,
                "job_type": stmt.excluded.job_type,
                "region": stmt.excluded.region,
                "source_repo": stmt.excluded.source_repo,
            },
        )
        await db.execute(stmt)

    await db.commit()
    logger.info("Upserted %d unique jobs into database", len(records))
    return len(records)
