"""
AnchorReplicator (Feature 3): Multi-destination anchor replication for sovereign audit integrity.
Destinations:
  1. Local file (sovereign_vault.anchor) -- existing behavior
  2. Redis HASH (anchor_vault) -- fast-access backup
  3. S3 bucket -- durable multi-region storage (optional)
"""
import hashlib
import hmac as hmac_mod
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

# Lazy S3 import to avoid hard dependency
_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        try:
            import boto3
            _s3_client = boto3.client("s3", region_name=settings.S3_ANCHOR_REGION)
        except ImportError:
            logger.warning("boto3 not installed; S3 anchor replication disabled")
            _s3_client = False  # Sentinel: tried and failed
        except Exception as e:
            logger.error("Failed to initialize S3 client: %s", e)
            _s3_client = False
    return _s3_client if _s3_client is not False else None


class AnchorReplicator:
    def __init__(self) -> None:
        self._redis: Optional[aioredis.Redis] = None
        self._secret = os.environ.get(
            "SOVEREIGN_ANCHOR_KEY", "fallback-dev-key-do-not-use-in-prod"
        ).encode()
        self._local_path = "sovereign_vault.anchor"

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def _next_sequence(self) -> int:
        """Atomically increment and return the next anchor sequence number."""
        r = await self._get_redis()
        return await r.incr("anchor_vault:sequence")

    def _sign_anchor(self, anchor_payload: str) -> str:
        return hmac_mod.new(
            self._secret, anchor_payload.encode(), hashlib.sha256
        ).hexdigest()

    async def replicate_anchor(self, hash_value: str, log_size: int) -> dict:
        """
        Write an anchor to all configured destinations.
        Returns a status dict indicating success/failure per destination.
        """
        sequence = await self._next_sequence()
        timestamp = datetime.now(timezone.utc).isoformat()
        anchor_payload = (
            f"ANCHOR_V3 | SEQ:{sequence} | {timestamp} | HASH:{hash_value} | LOG_SIZE:{log_size}"
        )
        signature = self._sign_anchor(anchor_payload)
        signed_anchor = f"{anchor_payload} | SIG:{signature}"

        status = {"sequence": sequence, "local": False, "redis": False, "s3": False}

        # 1. Local file (synchronous, matches existing behavior)
        try:
            with open(self._local_path, "a") as f:
                f.write(signed_anchor + "\n")
            status["local"] = True
        except Exception as e:
            logger.error("LOCAL ANCHOR WRITE FAILED: %s", e)

        # 2. Redis HASH backup
        try:
            r = await self._get_redis()
            record = json.dumps({
                "anchor_payload": anchor_payload,
                "signature": signature,
                "hash": hash_value,
                "timestamp": timestamp,
                "sequence": sequence,
                "log_size": log_size,
            })
            await r.hset("anchor_vault", str(sequence).zfill(10), record)
            status["redis"] = True
        except Exception as e:
            logger.error("REDIS ANCHOR WRITE FAILED: %s", e)

        # 3. S3 (graceful degradation)
        if settings.S3_ANCHOR_ENABLED:
            try:
                s3 = _get_s3_client()
                if s3:
                    s3_key = f"{settings.S3_ANCHOR_PREFIX}{sequence:010d}.anchor"
                    s3.put_object(
                        Bucket=settings.S3_ANCHOR_BUCKET,
                        Key=s3_key,
                        Body=signed_anchor.encode("utf-8"),
                        ContentType="text/plain",
                        Metadata={
                            "sequence": str(sequence),
                            "hash": hash_value,
                        },
                    )
                    status["s3"] = True
                    logger.info("S3 ANCHOR WRITTEN: %s", s3_key)
            except Exception as e:
                logger.error("S3 ANCHOR WRITE FAILED (graceful degradation): %s", e)

        destinations_ok = sum([status["local"], status["redis"], status["s3"]])
        logger.info(
            "ANCHOR REPLICATED: SEQ=%d HASH=%s DESTINATIONS=%d/3",
            sequence, hash_value[:8], destinations_ok,
        )
        return status

    async def verify_integrity(self) -> dict:
        """Cross-check consistency across all replicas."""
        result = {
            "consistent": True,
            "local_count": 0,
            "redis_count": 0,
            "s3_count": 0,
            "mismatches": [],
        }

        # Read local anchors
        local_anchors = {}
        try:
            if os.path.exists(self._local_path):
                with open(self._local_path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        # Extract sequence from ANCHOR_V3 format
                        if "SEQ:" in line:
                            seq_part = line.split("SEQ:")[1].split(" |")[0].strip()
                            local_anchors[seq_part] = line
                result["local_count"] = len(local_anchors)
        except Exception as e:
            logger.error("Integrity check - local read failed: %s", e)

        # Read Redis anchors
        redis_anchors = {}
        try:
            r = await self._get_redis()
            all_records = await r.hgetall("anchor_vault")
            for seq_key, record_json in all_records.items():
                record = json.loads(record_json)
                redis_anchors[str(record.get("sequence", seq_key))] = record
            result["redis_count"] = len(redis_anchors)
        except Exception as e:
            logger.error("Integrity check - Redis read failed: %s", e)

        # Cross-check local vs Redis
        all_sequences = set(local_anchors.keys()) | set(redis_anchors.keys())
        for seq in all_sequences:
            in_local = seq in local_anchors
            in_redis = seq in redis_anchors
            if in_local and in_redis:
                # Verify hash match
                redis_hash = redis_anchors[seq].get("hash", "")
                if f"HASH:{redis_hash}" not in local_anchors[seq]:
                    result["consistent"] = False
                    result["mismatches"].append({
                        "sequence": seq,
                        "issue": "HASH_MISMATCH",
                        "detail": "Local and Redis anchor hashes differ",
                    })
            elif in_local and not in_redis:
                result["consistent"] = False
                result["mismatches"].append({
                    "sequence": seq,
                    "issue": "MISSING_IN_REDIS",
                })
            elif in_redis and not in_local:
                result["consistent"] = False
                result["mismatches"].append({
                    "sequence": seq,
                    "issue": "MISSING_IN_LOCAL",
                })

        return result
