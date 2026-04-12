from typing import List

from pydantic import BaseModel, Field


class SearchQueryList(BaseModel):
    query: List[str] = Field(description="Search queries for web research.")
    rationale: str = Field(description="Why these queries are relevant.")


class Reflection(BaseModel):
    is_sufficient: bool = Field(description="Whether summaries are sufficient to answer the question.")
    knowledge_gap: str = Field(description="What information is missing or needs clarification.")
    follow_up_queries: List[str] = Field(description="Follow-up queries to address knowledge gaps.")
