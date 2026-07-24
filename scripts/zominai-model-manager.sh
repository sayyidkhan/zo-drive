#!/usr/bin/env bash
set -euo pipefail
runtime_root="${ZOMINAI_RUNTIME_ROOT:-/root/.local/share/zominai}"
model_version="Bonsai-8B-Q1_0.gguf"
model_path="${runtime_root}/models/${model_version}"
partial_path="${model_path}.part"
disabled_path="${runtime_root}/state/disabled"
model_url="https://huggingface.co/prism-ml/Bonsai-8B-gguf/resolve/main/${model_version}"
if [[ "${2:-}" != "${model_version}" ]]; then echo "Specify exact model version: ${model_version}" >&2; exit 64; fi
case "${1:-}" in
  install)
    mkdir -p "$(dirname "${model_path}")" "$(dirname "${disabled_path}")"
    if [[ ! -s "${model_path}" ]]; then curl --fail --location --retry 3 --continue-at - --output "${partial_path}" "${model_url}"; mv "${partial_path}" "${model_path}"; fi
    rm -f "${disabled_path}"
    ;;
  uninstall)
    mkdir -p "$(dirname "${disabled_path}")"
    printf 'removed %s\n' "${model_version}" > "${disabled_path}"
    pkill -f 'llama-server.*--port 57183' || true
    rm -f "${model_path}" "${partial_path}"
    ;;
  *) echo "Usage: $0 {install|uninstall} ${model_version}" >&2; exit 64 ;;
esac
