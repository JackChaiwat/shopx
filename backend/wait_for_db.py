#!/usr/bin/env python3
"""Wait for PostgreSQL to be ready before starting the app."""
import asyncio
import os
import sys
import time


async def wait_for_db():
    import asyncpg

    db_url = os.environ.get("DATABASE_URL", "")
    # Parse URL: postgresql+asyncpg://user:pass@host:port/db
    url = db_url.replace("postgresql+asyncpg://", "")
    user_pass, rest = url.split("@", 1)
    user, password = user_pass.split(":", 1)
    host_port, database = rest.split("/", 1)
    if ":" in host_port:
        host, port = host_port.split(":", 1)
        port = int(port)
    else:
        host, port = host_port, 5432

    max_retries = 30
    for attempt in range(max_retries):
        try:
            conn = await asyncpg.connect(
                host=host, port=port, user=user,
                password=password, database=database,
                timeout=5,
            )
            await conn.close()
            print(f"[wait_for_db] PostgreSQL ready after {attempt + 1} attempt(s)")
            return True
        except Exception as e:
            print(f"[wait_for_db] Attempt {attempt + 1}/{max_retries}: {e}")
            await asyncio.sleep(2)

    print("[wait_for_db] PostgreSQL not ready after max retries, exiting")
    sys.exit(1)


if __name__ == "__main__":
    asyncio.run(wait_for_db())
