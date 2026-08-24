#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: split_spreads.sh OUTPUT_DIR COVER_IMAGE SPREAD_01 [SPREAD_02 ...]" >&2
  exit 2
fi

for tool in ffmpeg ffprobe; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Required tool not found: $tool" >&2
    exit 3
  fi
done

output_dir=$1
cover_image=$2
shift 2
mkdir -p "$output_dir"

ffmpeg -loglevel error -y -i "$cover_image" -q:v 2 "$output_dir/page-01.jpg"

page_index=2
for spread in "$@"; do
  dimensions=$(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height -of csv=s=x:p=0 "$spread")
  width=${dimensions%x*}
  height=${dimensions#*x}
  if (( width < 2 || height < 1 )); then
    echo "Invalid spread dimensions: $spread ($dimensions)" >&2
    exit 4
  fi

  left_width=$((width / 2))
  right_width=$((width - left_width))
  printf -v left_name 'page-%02d.jpg' "$page_index"
  ffmpeg -loglevel error -y -i "$spread" \
    -vf "crop=${left_width}:${height}:0:0" -q:v 2 "$output_dir/$left_name"
  page_index=$((page_index + 1))
  printf -v right_name 'page-%02d.jpg' "$page_index"
  ffmpeg -loglevel error -y -i "$spread" \
    -vf "crop=${right_width}:${height}:${left_width}:0" -q:v 2 "$output_dir/$right_name"
  page_index=$((page_index + 1))
done

ffmpeg -loglevel error -y -pattern_type glob -i "$output_dir/page-*.jpg" \
  -vf "scale=240:320:force_original_aspect_ratio=decrease,pad=240:320:(ow-iw)/2:(oh-ih)/2:color=white,tile=4x3:padding=8:margin=8:color=#222222" \
  -frames:v 1 -q:v 3 "$output_dir/contact-sheet.jpg"

echo "Created $((page_index - 1)) pages and $output_dir/contact-sheet.jpg"
