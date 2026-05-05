import client from "../config/redis.config.js";

export const TTL_PROFILE_SECONDS = 180;
export const TTL_POST_DETAIL_SECONDS = 300;

export function myProfileCacheKey(userId) {
  return `vibely:cache:profile:me:${String(userId)}`;
}

export function userProfileCacheKey(identifier, viewerId) {
  const idStr = String(identifier);
  const v = viewerId ? String(viewerId) : "guest";
  return `vibely:cache:profile:user:${idStr}:viewer:${v}`;
}

export function postDetailCacheKey(postId, viewerId) {
  const v = viewerId ? String(viewerId) : "guest";
  return `vibely:cache:post:${String(postId)}:viewer:${v}`;
}

export async function cacheGetJson(key) {
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("[cache] get", key, e.message);
    return null;
  }
}

export async function cacheSetJson(key, value, ttlSeconds) {
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (e) {
    console.error("[cache] set", key, e.message);
  }
}

async function deleteKeysMatching(pattern) {
  try {
    for await (const key of client.scanIterator({
      MATCH: pattern,
      COUNT: 200,
    })) {
      await client.del(key);
    }
  } catch (e) {
    console.error("[cache] delete pattern", pattern, e.message);
  }
}

/** Clear “my profile” + all cached public profile views for this user (by id and username). */
export async function invalidateUserProfileCaches(userId, username) {
  const uid = String(userId);
  await client.del(myProfileCacheKey(uid)).catch(() => {});
  await deleteKeysMatching(`vibely:cache:profile:user:${uid}:viewer:*`);
  if (username) {
    await deleteKeysMatching(
      `vibely:cache:profile:user:${String(username)}:viewer:*`,
    );
  }
}

export async function invalidatePostDetailCache(postId) {
  await deleteKeysMatching(`vibely:cache:post:${String(postId)}:viewer:*`);
}
