import os
from typing import Any, Optional

from pydantic import BaseModel, Field
from langchain_core.runnables import RunnableConfig


class Configuration(BaseModel):
    query_generator_model: str = Field(
        default="gemini-2.0-flash",
        metadata={"description": "Model for generating search queries."},
    )
    reflection_model: str = Field(
        default="gemini-2.5-flash",
        metadata={"description": "Model for reflection / gap analysis."},
    )
    answer_model: str = Field(
        default="gemini-2.5-flash",
        metadata={"description": "Model for final answer synthesis."},
    )
    number_of_initial_queries: int = Field(
        default=5,
        metadata={"description": "Number of initial search queries to generate."},
    )
    max_research_loops: int = Field(
        default=3,
        metadata={"description": "Maximum research-reflection loops."},
    )

    @classmethod
    def from_runnable_config(cls, config: Optional[RunnableConfig] = None) -> "Configuration":
        configurable = (config["configurable"] if config and "configurable" in config else {})
        raw: dict[str, Any] = {
            name: os.environ.get(name.upper(), configurable.get(name))
            for name in cls.model_fields.keys()
        }
        values = {k: v for k, v in raw.items() if v is not None}
        return cls(**values)
