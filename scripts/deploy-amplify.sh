#!/usr/bin/env bash
# Deploy one tested static artifact with temporary AWS credentials. Never log upload URLs.
set -euo pipefail

: "${AMPLIFY_APP_ID:?Set AMPLIFY_APP_ID}"
: "${AMPLIFY_BRANCH:?Set AMPLIFY_BRANCH to main or develop}"
: "${AWS_REGION:?Set AWS_REGION}"
: "${FRONTEND_URL:?Set FRONTEND_URL}"
case "$AMPLIFY_BRANCH" in
  main|develop) ;;
  *) echo "Unsupported Amplify deployment branch: $AMPLIFY_BRANCH" >&2; exit 1 ;;
esac
artifact_dir=${1:-apps/geolibre-desktop/dist}
test -f "$artifact_dir/index.html"
test -f "$artifact_dir/jupyterlite/lab/index.html"
release_dir=$(mktemp -d)
trap 'rm -rf "$release_dir"' EXIT

python3 - "$artifact_dir" "$release_dir/site.zip" <<'PY'
import pathlib
import sys
import zipfile

root = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(root))
PY

aws amplify create-deployment --app-id "$AMPLIFY_APP_ID" --branch-name "$AMPLIFY_BRANCH" \
  --region "$AWS_REGION" > "$release_dir/deployment.json"
job_id=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["jobId"])' "$release_dir/deployment.json")
# curl reads the presigned URL from a private config rather than printing it.
python3 - "$release_dir" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
url = json.loads((root / 'deployment.json').read_text())['zipUploadUrl']
(root / 'upload.conf').write_text('url = ' + json.dumps(url) + '\n')
PY
curl --fail --silent --show-error --retry 3 --config "$release_dir/upload.conf" \
  --upload-file "$release_dir/site.zip"
aws amplify start-deployment --app-id "$AMPLIFY_APP_ID" --branch-name "$AMPLIFY_BRANCH" \
  --job-id "$job_id" --region "$AWS_REGION" --query jobSummary --output json

for attempt in $(seq 1 90); do
  status=$(aws amplify get-job --app-id "$AMPLIFY_APP_ID" --branch-name "$AMPLIFY_BRANCH" \
    --job-id "$job_id" --region "$AWS_REGION" --query job.summary.status --output text)
  case "$status" in
    SUCCEED)
      echo "Amplify $AMPLIFY_BRANCH deployment $job_id succeeded."
      if [ -n "${GITHUB_OUTPUT:-}" ]; then
        echo "url=$FRONTEND_URL" >> "$GITHUB_OUTPUT"
        echo "job_id=$job_id" >> "$GITHUB_OUTPUT"
      fi
      if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
        echo "Deployed **$AMPLIFY_BRANCH** (Amplify job **$job_id**): $FRONTEND_URL" >> "$GITHUB_STEP_SUMMARY"
      fi
      exit 0
      ;;
    FAILED|CANCELLED) echo "Amplify deployment $job_id failed: $status" >&2; exit 1 ;;
  esac
  sleep 10
done
echo "Amplify deployment $job_id did not complete within 15 minutes." >&2
exit 1
