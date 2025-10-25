#!/bin/bash
set -euo pipefail

# Default configuration values
LOG_RETENTION_DAYS=${LOG_RETENTION_DAYS:-30}
JOURNAL_MAX_SIZE=${JOURNAL_MAX_SIZE:-200M}
DOCKER_PRUNE_AGE_HOURS=${DOCKER_PRUNE_AGE_HOURS:-168}
APT_AUTOREMOVE=${APT_AUTOREMOVE:-false}

log() {
  echo "[$(date --iso-8601=seconds)] $1"
}

ensure_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    log "Elevating privileges for maintenance (sudo required)."
    exec sudo LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS}" JOURNAL_MAX_SIZE="${JOURNAL_MAX_SIZE}" DOCKER_PRUNE_AGE_HOURS="${DOCKER_PRUNE_AGE_HOURS}" APT_AUTOREMOVE="${APT_AUTOREMOVE}" "$0" "$@"
  fi
}

cleanup_journal() {
  log "Vacuuming systemd journal to ${JOURNAL_MAX_SIZE}."
  journalctl --vacuum-size="${JOURNAL_MAX_SIZE}" >/dev/null 2>&1 || log "Journal vacuum skipped (journalctl not available)."
}

cleanup_logs() {
  local retention="${LOG_RETENTION_DAYS}"
  if [[ -z "${retention}" || "${retention}" -lt 1 ]]; then
    log "Invalid LOG_RETENTION_DAYS=${retention}. Skipping log cleanup."
    return
  fi

  log "Cleaning log files older than ${retention} days in /var/log and application logs."
  find /var/log -type f -name "*.log" -mtime +"${retention}" -print -delete 2>/dev/null || true
  find /var/log -type f -name "*.gz" -mtime +"${retention}" -print -delete 2>/dev/null || true

  local app_log_root="${APP_LOG_ROOT:-${HOME}/dsfms/logs}"
  if [[ -d "${app_log_root}" ]]; then
    find "${app_log_root}" -type f -mtime +"${retention}" -print -delete 2>/dev/null || true
  fi
}

cleanup_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    return
  fi

  log "Pruning unused Docker resources older than ${DOCKER_PRUNE_AGE_HOURS} hours."
  docker system prune -af --filter "until=${DOCKER_PRUNE_AGE_HOURS}h" >/dev/null 2>&1 || log "Docker prune skipped."
}

cleanup_apt_cache() {
  if [[ "${APT_AUTOREMOVE}" != "true" ]]; then
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    log "Cleaning apt caches and removing unused packages."
    apt-get clean >/dev/null 2>&1 || true
    apt-get autoremove -y >/dev/null 2>&1 || true
  fi
}

report_disk_usage() {
  log "Disk usage summary:"
  df -h /
}

main() {
  ensure_root "$@"

  local mode=${1:-"run"}

  case "${mode}" in
    --cron)
      cleanup_journal
      cleanup_logs
      cleanup_docker
      cleanup_apt_cache
      report_disk_usage
      ;;
    --once|run)
      cleanup_journal
      cleanup_logs
      cleanup_docker
      cleanup_apt_cache
      report_disk_usage
      ;;
    *)
      echo "Usage: $0 [--once|--cron]" >&2
      exit 1
      ;;
  esac
}

main "$@"
