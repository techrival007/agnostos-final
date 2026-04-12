from typing import Any, Dict, List

from langchain_core.messages import AnyMessage, AIMessage, HumanMessage


def get_research_topic(messages: List[AnyMessage]) -> str:
    if len(messages) == 1:
        return messages[-1].content
    topic = ""
    for message in messages:
        if isinstance(message, HumanMessage):
            topic += f"User: {message.content}\n"
        elif isinstance(message, AIMessage):
            topic += f"Assistant: {message.content}\n"
    return topic


def resolve_urls(urls_to_resolve: List[Any], id: int) -> Dict[str, str]:
    prefix = "https://vertexaisearch.cloud.google.com/id/"
    urls = [site.web.uri for site in urls_to_resolve]
    resolved_map = {}
    for idx, url in enumerate(urls):
        if url not in resolved_map:
            resolved_map[url] = f"{prefix}{id}-{idx}"
    return resolved_map


def insert_citation_markers(text, citations_list):
    sorted_citations = sorted(
        citations_list, key=lambda c: (c["end_index"], c["start_index"]), reverse=True
    )
    modified_text = text
    for citation_info in sorted_citations:
        end_idx = citation_info["end_index"]
        marker = ""
        for segment in citation_info["segments"]:
            marker += f" [{segment['label']}]({segment['short_url']})"
        modified_text = modified_text[:end_idx] + marker + modified_text[end_idx:]
    return modified_text


def get_citations(response, resolved_urls_map):
    citations = []
    if not response or not response.candidates:
        return citations
    candidate = response.candidates[0]
    if (
        not hasattr(candidate, "grounding_metadata")
        or not candidate.grounding_metadata
        or not hasattr(candidate.grounding_metadata, "grounding_supports")
    ):
        return citations

    for support in candidate.grounding_metadata.grounding_supports:
        if not hasattr(support, "segment") or support.segment is None:
            continue
        start_index = support.segment.start_index if support.segment.start_index is not None else 0
        if support.segment.end_index is None:
            continue
        citation = {
            "start_index": start_index,
            "end_index": support.segment.end_index,
            "segments": [],
        }
        if hasattr(support, "grounding_chunk_indices") and support.grounding_chunk_indices:
            for ind in support.grounding_chunk_indices:
                try:
                    chunk = candidate.grounding_metadata.grounding_chunks[ind]
                    resolved_url = resolved_urls_map.get(chunk.web.uri, None)
                    citation["segments"].append({
                        "label": chunk.web.title.split(".")[:-1][0] if "." in chunk.web.title else chunk.web.title,
                        "short_url": resolved_url,
                        "value": chunk.web.uri,
                    })
                except (IndexError, AttributeError):
                    pass
        citations.append(citation)
    return citations
