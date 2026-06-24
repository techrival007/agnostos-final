import ssl
import socket
from urllib.parse import urlparse, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from config import get_settings

settings = get_settings()

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE


def _resolve_db_url(url: str) -> str:
    """Pre-resolve hostname to IPv4 to work around flaky asyncio DNS on Windows."""
    parsed = urlparse(url)
    if parsed.hostname and not parsed.hostname.replace(".", "").isdigit():
        try:
            addrs = socket.getaddrinfo(parsed.hostname, parsed.port, socket.AF_INET)
            if addrs:
                ip = addrs[0][4][0]
                netloc = parsed.netloc.replace(parsed.hostname, ip, 1)
                return urlunparse(parsed._replace(netloc=netloc))
        except socket.gaierror:
            pass
    return url


resolved_url = _resolve_db_url(settings.database_url)
if "?" in resolved_url:
    resolved_url += "&prepared_statement_cache_size=0"
else:
    resolved_url += "?prepared_statement_cache_size=0"

_parsed = urlparse(resolved_url)
_use_ssl = _parsed.hostname not in ("localhost", "127.0.0.1")
_connect_args: dict = {"statement_cache_size": 0}
if _use_ssl:
    _connect_args["ssl"] = ssl_context

engine = create_async_engine(
    resolved_url,
    echo=False,
    connect_args=_connect_args,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
