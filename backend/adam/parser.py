import fitz
from shared.gemini import generate_structured
from config import get_settings

settings = get_settings()


def extract_pdf_text(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


async def parse_cv(cv_text: str) -> dict:
    if not settings.gemini_api_key:
        return get_mock_parsed_cv()

    prompt = f"""
    You are parsing a CV to extract structured data.
    Return ONLY valid JSON -- no explanation, no markdown fences.

    Extract:
    {{
      "skills": {{
        "technical": ["list of technical skills"],
        "soft": ["list of soft skills"]
      }},
      "experience": [
        {{
          "company": "company name",
          "role": "job title",
          "duration_months": 12,
          "start_date": "YYYY-MM",
          "end_date": "YYYY-MM or present",
          "description": "what they did",
          "tech_used": ["list"]
        }}
      ],
      "projects": [
        {{
          "name": "project name",
          "description": "what it does",
          "tech": ["list"],
          "url": "if available",
          "context": "built at company / side project / hackathon"
        }}
      ],
      "education": [
        {{
          "institution": "",
          "degree": "",
          "field": "",
          "year": ""
        }}
      ],
      "location": "city, country"
    }}

    CV TEXT:
    {cv_text[:5000]}
    """
    return await generate_structured(prompt)


async def extract_proof_points(structured: dict, cv_text: str) -> list:
    if not settings.gemini_api_key:
        return get_mock_proof_points()

    import json
    prompt = f"""
    From this career data, extract 5-8 "proof points".
    A proof point is a specific moment where this person built something,
    solved a real problem, and had a measurable impact.

    Return ONLY valid JSON array:
    [
      {{
        "title": "short name",
        "project": "what they built",
        "problem": "what problem it solved",
        "impact": "measurable outcome",
        "tech": ["technologies used"],
        "context": "startup / side project / academic",
        "highlight": true
      }}
    ]

    Career data: {json.dumps(structured)[:3000]}
    Raw CV: {cv_text[:2000]}
    """
    return await generate_structured(prompt)


def get_mock_parsed_cv() -> dict:
    return {
        "skills": {
            "technical": ["Python", "React", "TypeScript", "FastAPI", "PostgreSQL", "Docker", "AWS"],
            "soft": ["Leadership", "Problem Solving", "Communication"]
        },
        "experience": [
            {
                "company": "TechCorp",
                "role": "Senior Software Engineer",
                "duration_months": 24,
                "start_date": "2024-01",
                "end_date": "present",
                "description": "Led backend architecture for AI-powered analytics platform",
                "tech_used": ["Python", "FastAPI", "PostgreSQL", "Redis"]
            }
        ],
        "projects": [
            {
                "name": "DataFlow Engine",
                "description": "Real-time data processing pipeline handling 1M events/day",
                "tech": ["Python", "Kafka", "PostgreSQL"],
                "url": "",
                "context": "built at company"
            }
        ],
        "education": [
            {
                "institution": "IIT Delhi",
                "degree": "B.Tech",
                "field": "Computer Science",
                "year": "2023"
            }
        ],
        "location": "Bangalore, India"
    }


def get_mock_proof_points() -> list:
    return [
        {
            "title": "DataFlow Engine",
            "project": "Real-time data processing pipeline",
            "problem": "Company had no way to process streaming data at scale",
            "impact": "Handles 1M events/day with 99.9% uptime, reduced processing latency by 80%",
            "tech": ["Python", "Kafka", "PostgreSQL"],
            "context": "startup",
            "highlight": True
        },
        {
            "title": "Auth Microservice",
            "project": "Zero-downtime auth migration",
            "problem": "Legacy auth was a security risk and caused 2hr outages monthly",
            "impact": "Zero downtime migration for 50K users, eliminated monthly outages",
            "tech": ["FastAPI", "Redis", "JWT"],
            "context": "startup",
            "highlight": True
        },
        {
            "title": "Dashboard Revamp",
            "project": "Customer analytics dashboard",
            "problem": "Product team had no visibility into user behavior",
            "impact": "Used by 30 internal users daily, drove 3 major product decisions",
            "tech": ["React", "TypeScript", "D3.js"],
            "context": "startup",
            "highlight": False
        }
    ]
