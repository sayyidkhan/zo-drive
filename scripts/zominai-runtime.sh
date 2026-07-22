#!/usr/bin/env bash
set -euo pipefail

runtime_root="${ZOMINAI_RUNTIME_ROOT:-/root/.local/share/zominai}"
server_bin="${ZOMINAI_SERVER_BIN:-${runtime_root}/releases/b10087/llama-b10087/llama-server}"
model="${runtime_root}/models/Bonsai-8B-Q1_0.gguf"

if [[ ! -x "${server_bin}" ]]; then
  echo "ZominAI runtime is not installed: ${server_bin} is missing" >&2
  exit 1
fi

if [[ ! -f "${model}" ]]; then
  echo "ZominAI model is not installed: ${model} is missing" >&2
  exit 1
fi

exec "${server_bin}" \
  --host 127.0.0.1 \
  --port 57183 \
  --model "${model}" \
  --alias Bonsai-8B-Q1_0.gguf \
  --ctx-size 4096 \
  --parallel 2 \
  --jinja
