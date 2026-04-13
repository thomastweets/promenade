#!/bin/sh
set -eu

target_dir="${PROMENADE_DIST_DIR:-/srv/dist}"
seed_dir="${PROMENADE_DIST_SEED_DIR:-/srv/dist-image}"
target_marker="$target_dir/.promenade-build-id"
seed_marker="$seed_dir/.promenade-build-id"

if [ -n "${STUDIO_USERNAME:-}" ] && [ -n "${STUDIO_PASSWORD_HASH:-}" ] && [ -z "${STUDIO_SESSION_TOKEN:-}" ]; then
  echo "STUDIO_SESSION_TOKEN must be set when studio auth is enabled." >&2
  exit 1
fi

mkdir -p "$target_dir"

should_sync=false

if [ -d "$seed_dir" ]; then
  if [ -z "$(ls -A "$target_dir" 2>/dev/null)" ]; then
    should_sync=true
  elif [ -f "$seed_marker" ]; then
    if [ ! -f "$target_marker" ] || [ "$(cat "$seed_marker")" != "$(cat "$target_marker")" ]; then
      should_sync=true
    fi
  fi
fi

if [ "$should_sync" = "true" ]; then
  find "$target_dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "$seed_dir"/. "$target_dir"/
fi

exec "$@"
