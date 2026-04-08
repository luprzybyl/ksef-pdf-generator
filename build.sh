#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <image:tag>" >&2
  echo "Example: $0 org/image-name:latest" >&2
  exit 1
fi

IMAGE="$1"

echo "Building ${IMAGE} ..."
docker build -t "${IMAGE}" .

echo "Pushing ${IMAGE} ..."
docker push "${IMAGE}"

echo "Done: ${IMAGE}"
